import { verifyJWT, requireAdmin } from "../../../../../../backend/middleware/auth";
import {
  listPrerequisites,
  createPrerequisite,
} from "../../../../../../backend/repositories/curriculumRepo";
import { z } from "zod";

const CreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  passingThreshold: z.number().min(0).max(100).default(60),
  maxAIAttempts: z.number().int().min(1).max(10).default(3),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id: topicId } = await params;
  const prerequisites = await listPrerequisites(topicId);
  return Response.json({ prerequisites });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id: topicId } = await params;
  try {
    const body = CreateSchema.parse(await req.json());
    const id = await createPrerequisite(topicId, body);
    return Response.json({ id }, { status: 201 });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
