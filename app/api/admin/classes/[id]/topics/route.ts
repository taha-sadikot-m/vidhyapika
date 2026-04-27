import { verifyJWT, requireAdmin } from "../../../../../../backend/middleware/auth";
import {
  listTopics,
  createTopic,
} from "../../../../../../backend/repositories/curriculumRepo";
import { z } from "zod";

const CreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  order: z.number().int().default(0),
  finalTestThreshold: z.number().min(0).max(100).default(60),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id: classId } = await params;
  const topics = await listTopics(classId);
  return Response.json({ topics });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id: classId } = await params;
  try {
    const body = CreateSchema.parse(await req.json());
    const id = await createTopic({ ...body, classId });
    return Response.json({ id }, { status: 201 });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
