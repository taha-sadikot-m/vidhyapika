import { verifyJWT, requireAdmin } from "../../../../../backend/middleware/auth";
import {
  getUserById,
  getParentUserLinkedToStudent,
  updateUser,
  deleteUser,
} from "../../../../../backend/repositories/userRepo";
import { syncStudentEnrollments, getStudentEnrollments } from "../../../../../backend/repositories/curriculumRepo";
import { z } from "zod";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  classIds: z.array(z.string()).optional(),
  phone: z.string().nullable().optional(),
  parentName: z.string().nullable().optional(),
  parentEmail: z.string().email().nullable().optional().or(z.literal("")).transform(v => v === "" ? null : v),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id } = await params;
  const student = await getUserById(id);
  if (!student || student.role !== "student") return Response.json({ error: "Not found" }, { status: 404 });

  const enrollments = await getStudentEnrollments(id);
  const classIds = enrollments.map((e) => e.classId);
  if (classIds.length === 0 && student.class_id) {
    classIds.push(student.class_id);
  }

  const linkedParent = await getParentUserLinkedToStudent(id);
  const parentName =
    (student.parentName && String(student.parentName).trim()) || linkedParent?.name || null;
  const parentEmail =
    (student.parentEmail && String(student.parentEmail).trim()) || linkedParent?.email || null;

  return Response.json({
    student: {
      ...student,
      classIds,
      parentName,
      parentEmail,
    },
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id } = await params;
  try {
    const before = await getUserById(id);
    if (!before || before.role !== "student") return Response.json({ error: "Not found" }, { status: 404 });

    const body = UpdateSchema.parse(await req.json());
    const { classIds, ...rest } = body;
    const patch: Record<string, unknown> = {};
    if (rest.name !== undefined) patch.name = rest.name;
    if (rest.phone !== undefined) patch.phone = rest.phone;
    if (rest.parentName !== undefined) patch.parentName = rest.parentName;
    if (rest.parentEmail !== undefined) patch.parentEmail = rest.parentEmail;
    if (Object.keys(patch).length > 0) await updateUser(id, patch as Parameters<typeof updateUser>[1]);

    if (classIds) {
      await syncStudentEnrollments(id, classIds);
    }

    return Response.json({ success: true });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id } = await params;
  await deleteUser(id);
  return Response.json({ success: true });
}
