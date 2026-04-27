export const dynamic = 'force-dynamic';
import { verifyJWT, requireAuth } from "../../../../backend/middleware/auth";
import { getUserById } from "../../../../backend/repositories/userRepo";
import { getStudentEnrollment, getClass } from "../../../../backend/repositories/curriculumRepo";

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAuth(user);
  if (err) return err;

  const u = await getUserById(user!.sub);
  if (!u) return Response.json({ error: "User not found" }, { status: 404 });

  let cls: { id: string; name: string } | null = null;
  const enrollment = await getStudentEnrollment(u.id);
  if (enrollment) {
    const c = await getClass(enrollment.classId);
    if (c) cls = { id: c.id, name: c.name };
  }

  return Response.json({
    user: { id: u.id, name: u.name, email: u.email, role: u.role },
    class: cls,
  });
}

