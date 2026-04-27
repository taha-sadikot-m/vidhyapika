import { verifyJWT, requireAuth } from "../../../../../backend/middleware/auth";
import { upsertSubTopicProgress } from "../../../../../backend/repositories/progressRepo";
import { getSubTopic } from "../../../../../backend/repositories/curriculumRepo";
import { z } from "zod";

const Schema = z.object({
  subTopicId: z.string().min(1),
  topicId: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAuth(user);
  if (err) return err;

  try {
    const { subTopicId, topicId } = Schema.parse(await req.json());

    const subTopic = await getSubTopic(subTopicId);
    if (!subTopic) return Response.json({ error: "Sub-topic not found" }, { status: 404 });

    await upsertSubTopicProgress(user!.sub, subTopicId, topicId, { videoWatched: true });
    return Response.json({ success: true });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
