import { verifyJWT, requireAdmin } from "../../../../../../backend/middleware/auth";
import {
  listSubTopics,
  createSubTopic,
} from "../../../../../../backend/repositories/curriculumRepo";
import { z } from "zod";

const CreateSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().default(0),
  youtubeUrl: z.string().url().optional().or(z.literal("")),
  passingThreshold: z.number().min(0).max(100).default(60),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id: topicId } = await params;
  const subTopics = await listSubTopics(topicId);
  return Response.json({ subTopics });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id: topicId } = await params;
  try {
    const body = CreateSchema.parse(await req.json());
    const id = await createSubTopic({ ...body, topicId });
    return Response.json({ id }, { status: 201 });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
