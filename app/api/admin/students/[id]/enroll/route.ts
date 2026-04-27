import { verifyJWT, requireAdmin } from "../../../../../../backend/middleware/auth";
import { getUserById, updateUser } from "../../../../../../backend/repositories/userRepo";
import { enrollStudent, getClass } from "../../../../../../backend/repositories/curriculumRepo";
import { z } from "zod";

const EnrollSchema = z.object({
  classId: z.string().min(1),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id: studentId } = await params;
  try {
    const { classId } = EnrollSchema.parse(await req.json());

    const student = await getUserById(studentId);
    if (!student || student.role !== "student") {
      return Response.json({ error: "Student not found" }, { status: 404 });
    }

    const cls = await getClass(classId);
    if (!cls) return Response.json({ error: "Class not found" }, { status: 404 });

    await enrollStudent(classId, studentId);
    await updateUser(studentId, { classId });

    return Response.json({ success: true });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
