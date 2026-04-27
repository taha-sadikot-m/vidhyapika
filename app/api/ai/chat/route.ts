import { verifyJWT, requireAuth } from "../../../../backend/middleware/auth";
import { generateChatResponse } from "../../../../backend/services/ai";
import {
  getAISession,
  updateAISession,
} from "../../../../backend/repositories/progressRepo";
import { getTopic, getSubTopic } from "../../../../backend/repositories/curriculumRepo";
import { z } from "zod";

const ChatSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
});

export async function POST(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAuth(user);
  if (err) return err;

  try {
    const { sessionId, message } = ChatSchema.parse(await req.json());

    const session = await getAISession(sessionId);
    if (!session) return Response.json({ error: "Session not found" }, { status: 404 });
    if (session.studentId !== user!.sub) return Response.json({ error: "Forbidden" }, { status: 403 });

    const [topic, subTopic] = await Promise.all([
      getTopic(session.topicId),
      session.subTopicId ? getSubTopic(session.subTopicId) : Promise.resolve(null),
    ]);

    // Generate AI response
    const history = session.messages.map((m) => ({
      role: m.role as "tutor" | "student",
      content: m.content,
    }));

    const aiResponse = await generateChatResponse({
      topicName: topic?.name ?? "the topic",
      subTopicName: subTopic?.name,
      history,
      studentMessage: message,
    });

    // Append both messages to session
    const newMessages = [
      ...session.messages,
      { role: "student" as const, content: message, timestamp: Date.now() },
      { role: "tutor" as const, content: aiResponse, timestamp: Date.now() + 1 },
    ];

    await updateAISession(sessionId, { messages: newMessages });

    return Response.json({ response: aiResponse });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
