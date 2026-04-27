export const dynamic = 'force-dynamic';
import { verifyJWT, requireAdmin } from "../../../../backend/middleware/auth";
import { listUsersByRole, createUser } from "../../../../backend/repositories/userRepo";
import { hashPassword } from "../../../../backend/services/auth";
import { sendEnrollmentNotifications } from "../../../../backend/services/notifications";
import { enrollStudent, syncStudentEnrollments } from "../../../../backend/repositories/curriculumRepo";
import { getDb } from "../../../../backend/firebase/admin";
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
  
  // Attach all class enrollments to students for the UI
  const db = getDb();
  const enrollmentsSnap = await db.collection("classEnrollments").get();
  const enrollmentsMap: Record<string, string[]> = {};
  enrollmentsSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    if (!enrollmentsMap[data.studentId]) enrollmentsMap[data.studentId] = [];
    enrollmentsMap[data.studentId].push(data.classId);
  });

  const studentsWithClasses = students.map((s: any) => ({
    ...s,
    classIds: enrollmentsMap[s.id] || (s.class_id ? [s.class_id] : []),
  }));

  return Response.json({ students: studentsWithClasses });
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
