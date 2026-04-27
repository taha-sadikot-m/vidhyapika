import { verifyJWT, requireAdmin } from "../../../../../../backend/middleware/auth";
import {
  listClasses,
  createClass,
} from "../../../../../../backend/repositories/curriculumRepo";
import { z } from "zod";

const CreateSchema = z.object({
  name: z.string().min(1),
  passingThreshold: z.number().min(0).max(100).default(60),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id: standardId } = await params;
  const classes = await listClasses(standardId);
  return Response.json({ classes });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id: standardId } = await params;
  try {
    const body = CreateSchema.parse(await req.json());
    const id = await createClass({ ...body, standardId });
    return Response.json({ id }, { status: 201 });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
