import { verifyJWT, requireAuth } from "../../../../backend/middleware/auth";
import { generateRetakeQuestions } from "../../../../backend/services/ai";
import { getTopic, getSubTopic, getPrerequisite, listQuestions } from "../../../../backend/repositories/curriculumRepo";
import { z } from "zod";

const Schema = z.object({
  topicId: z.string().min(1),
  subTopicId: z.string().optional(),
  contextType: z.enum(["prereq", "subtopic", "finaltest"]),
  contextId: z.string().min(1),
  failedQuestions: z.array(
    z.object({
      questionId: z.string(),
      text: z.string(),
      studentAnswer: z.string().optional(),
      correctAnswer: z.string().optional(),
    })
  ),
  count: z.number().int().min(1).max(20).default(5),
});

export async function POST(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAuth(user);
  if (err) return err;

  try {
    const body = Schema.parse(await req.json());
    const { topicId, subTopicId, contextType, contextId, failedQuestions, count } = body;

    const [topic, subTopic] = await Promise.all([
      getTopic(topicId),
      subTopicId ? getSubTopic(subTopicId) : Promise.resolve(null),
    ]);

    if (!topic) return Response.json({ error: "Topic not found" }, { status: 404 });

    const questionIds = await generateRetakeQuestions({
      topicName: topic.name,
      subTopicName: subTopic?.name,
      failedQuestions,
      count,
      contextType,
      contextId,
    });

    // Fetch the generated questions to return them
    const questions = await Promise.all(
      questionIds.map((id) =>
        listQuestions(contextType, contextId).then((qs) => qs.find((q) => q.id === id) ?? null)
      )
    );

    const allGenerated = await listQuestions(contextType, contextId).then((qs) =>
      qs.filter((q) => q.isAIGenerated)
    );

    return Response.json({ questionIds, questions: allGenerated });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
