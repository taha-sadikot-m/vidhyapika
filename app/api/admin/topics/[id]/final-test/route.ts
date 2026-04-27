import { verifyJWT, requireAdmin } from "../../../../../../backend/middleware/auth";
import {
  listQuestions,
  getTopic,
  updateTopic,
} from "../../../../../../backend/repositories/curriculumRepo";
import { z } from "zod";

const UpdateThresholdSchema = z.object({
  finalTestThreshold: z.number().min(0).max(100),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id: topicId } = await params;
  const topic = await getTopic(topicId);
  if (!topic) return Response.json({ error: "Not found" }, { status: 404 });

  const questions = await listQuestions("finaltest", topicId);
  return Response.json({ finalTestThreshold: topic.finalTestThreshold, questions });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id: topicId } = await params;
  try {
    const body = UpdateThresholdSchema.parse(await req.json());
    await updateTopic(topicId, { finalTestThreshold: body.finalTestThreshold });
    return Response.json({ success: true });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
