export const dynamic = 'force-dynamic';
import { verifyJWT, requireAdmin } from "../../../../backend/middleware/auth";
import { listUsersByRole, createUser } from "../../../../backend/repositories/userRepo";
import { hashPassword } from "../../../../backend/services/auth";
import { sendEnrollmentNotifications } from "../../../../backend/services/notifications";
import { syncStudentEnrollments } from "../../../../backend/repositories/curriculumRepo";
import { getDb } from "../../../../backend/firebase/admin";
import { queryDocumentsWhereIn } from "../../../../backend/utils/firestoreQuery";
import { ADMIN_JSON_CACHE_CONTROL } from "../../../../backend/utils/adminApiCache";
import { z } from "zod";

const CreateStudentSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  parentName: z.string().optional(),
  parentEmail: z.string().email().optional().or(z.literal("")),
  classIds: z.array(z.string()).optional(),
  phone: z.string().optional(),
  sendEmail: z.boolean().default(true),
});

function generateTempPassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const students = await listUsersByRole("student");

  const db = getDb();
  const studentIds = students.map((s) => s.id);
  const enrollmentDocs = await queryDocumentsWhereIn(
    db,
    "classEnrollments",
    "studentId",
    studentIds
  );
  const enrollmentsMap: Record<string, string[]> = {};
  for (const doc of enrollmentDocs) {
    const data = doc.data();
    if (!enrollmentsMap[data.studentId]) enrollmentsMap[data.studentId] = [];
    enrollmentsMap[data.studentId].push(data.classId);
  }

  /** Parent users store parentId = student id; merge when student doc has no parentName/parentEmail. */
  const parentByStudentId = new Map<string, { name: string | null; email: string | null }>();
  const chunkSize = 30;
  for (let i = 0; i < studentIds.length; i += chunkSize) {
    const chunk = studentIds.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;
    const parentSnap = await db.collection("users").where("parentId", "in", chunk).get();
    for (const d of parentSnap.docs) {
      const data = d.data() as { role?: string; parentId?: string; name?: string | null; email?: string };
      if (data.role !== "parent" || !data.parentId) continue;
      if (!parentByStudentId.has(data.parentId)) {
        parentByStudentId.set(data.parentId, { name: data.name ?? null, email: data.email ?? null });
      }
    }
  }

  const studentsWithClasses = students.map((s: any) => {
    const classIds = enrollmentsMap[s.id] || (s.class_id ? [s.class_id] : []);
    const link = parentByStudentId.get(s.id);
    const parentName = (s.parentName && String(s.parentName).trim()) || link?.name || null;
    const parentEmail = (s.parentEmail && String(s.parentEmail).trim()) || link?.email || null;
    return { ...s, classIds, parentName, parentEmail };
  });

  return Response.json(
    { students: studentsWithClasses },
    { headers: { "Cache-Control": ADMIN_JSON_CACHE_CONTROL } }
  );
}

export async function POST(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  try {
    const body = CreateStudentSchema.parse(await req.json());
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const studentId = await createUser({
      email: body.email,
      name: body.name,
      role: "student",
      passwordHash,
      mustResetPassword: true,
      phone: body.phone ?? null,
      parentName: body.parentName ?? null,
      parentEmail: body.parentEmail ?? null,
    });

    if (body.classIds && body.classIds.length > 0) {
      await syncStudentEnrollments(studentId, body.classIds);
    }

    let parentId: string | null = null;
    if (body.parentEmail) {
      const parentTempPw = generateTempPassword();
      const parentHash = await hashPassword(parentTempPw);
      parentId = await createUser({
        email: body.parentEmail,
        name: body.parentName ?? null,
        role: "parent",
        passwordHash: parentHash,
        mustResetPassword: true,
        parentId: studentId,
      });

    }

    // Send welcome emails in the background — do not await SMTP or the admin waits several seconds.
    if (body.sendEmail) {
      const emailPromise = body.parentEmail
        ? sendEnrollmentNotifications({
            studentName: body.name,
            studentEmail: body.email,
            parentName: body.parentName ?? "",
            parentEmail: body.parentEmail,
            className: "your enrolled classes",
            tempPassword,
          })
        : sendEnrollmentNotifications({
            studentName: body.name,
            studentEmail: body.email,
            parentName: "",
            className: "your enrolled classes",
            tempPassword,
          });
      void emailPromise.catch((err) => {
        console.error("[POST /api/admin/students] enrollment email failed:", err);
      });
    }

    return Response.json({ id: studentId, parentId, tempPassword }, { status: 201 });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
