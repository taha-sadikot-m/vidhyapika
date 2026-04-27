import { verifyJWT, requireAdmin } from "../../../../../backend/middleware/auth";
import { getUserById, updateUser, deleteUser } from "../../../../../backend/repositories/userRepo";
import { enrollStudent, syncStudentEnrollments } from "../../../../../backend/repositories/curriculumRepo";
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
  return Response.json({ student });
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
    await updateUser(id, body);

    if (body.classIds) {
      await syncStudentEnrollments(id, body.classIds);
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
