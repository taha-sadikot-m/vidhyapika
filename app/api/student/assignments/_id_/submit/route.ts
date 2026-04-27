import { verifyJWT, requireAuth } from "../../../../../../backend/middleware/auth";
import { submitAssignment, getAssignment } from "../../../../../../backend/repositories/assignmentsRepo";
import { getStudentEnrollment } from "../../../../../../backend/repositories/curriculumRepo";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAuth(user);
  if (err) return err;

  const enrollment = await getStudentEnrollment(user!.sub);
  if (!enrollment) return Response.json({ error: "Not enrolled in a class" }, { status: 403 });

  const assignment = await getAssignment(params.id);
  if (!assignment) return Response.json({ error: "Assignment not found" }, { status: 404 });
  if (assignment.classId !== enrollment.classId) {
    return Response.json({ error: "Assignment does not belong to your class" }, { status: 403 });
  }

  await submitAssignment(params.id, user!.sub);
  return Response.json({ ok: true }, { status: 200 });
}

