import { verifyJWT, requireAdmin } from "../../../../../../backend/middleware/auth";
import { resolveFlag } from "../../../../../../backend/repositories/progressRepo";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id } = await params;
  await resolveFlag(id, user!.sub);
  return Response.json({ success: true });
}
