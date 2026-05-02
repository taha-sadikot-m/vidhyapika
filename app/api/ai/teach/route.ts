import { verifyJWT, requireAuth } from "../../../../backend/middleware/auth";
import { generateLessonCards, generateMistakePackage } from "../../../../backend/services/ai";
import {
  createAISession,
  upsertTopicProgress,
  upsertSubTopicProgress,
  getTopicProgress,
  getSubTopicProgress,
} from "../../../../backend/repositories/progressRepo";
import { getTopic, getSubTopic, getPrerequisite } from "../../../../backend/repositories/curriculumRepo";
import { countFailedAiRetakes } from "../../../../backend/repositories/progressRepo";
import { z } from "zod";

const MAX_AI_COACHING_CYCLES = 3;

const TeachSchema = z.object({
  topicId: z.string().min(1),
  subTopicId: z.string().optional(),
  /** Prereq id, or other quiz scope id when multiple quizzes share the same topic */
  contextId: z.string().optional(),
  contextType: z.enum(["prereq", "subtopic", "finaltest"]),
  failedQuestions: z.array(
    z.object({
      questionId: z.string(),
      text: z.string(),
      studentAnswer: z.string().optional(),
      correctAnswer: z.string().optional(),
      aiReasoning: z.string().optional(),
    })
  ),
});

export async function POST(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAuth(user);
  if (err) return err;

  const studentId = user!.sub;

  try {
    const body = TeachSchema.parse(await req.json());
    const { topicId, subTopicId, contextType, failedQuestions, contextId: contextIdBody } = body;
    const [topic, subTopic] = await Promise.all([
      getTopic(topicId),
      subTopicId ? getSubTopic(subTopicId) : Promise.resolve(null),
    ]);

    if (!topic) return Response.json({ error: "Topic not found" }, { status: 404 });

    let resolvedContextId =
      contextIdBody ??
      (contextType === "subtopic" && subTopicId ? subTopicId : null) ??
      null;
    if (!resolvedContextId && contextType === "prereq") {
      const pr = await getPrerequisite(topicId);
      resolvedContextId = pr?.id ?? null;
    }
    if (!resolvedContextId && contextType === "finaltest") {
      resolvedContextId = topicId;
    }

    if (resolvedContextId) {
      const failedAi = await countFailedAiRetakes(studentId, contextType, resolvedContextId);
      if (failedAi >= MAX_AI_COACHING_CYCLES) {
        return Response.json(
          {
            error:
              "You have used all AI coaching and retest attempts for this quiz. Please contact your instructor for help.",
            code: "AI_COACHING_CAP",
            failedAiRetakes: failedAi,
            maxAiCoachingCycles: MAX_AI_COACHING_CYCLES,
          },
          { status: 403 }
        );
      }
    }

    // Generate AI lesson cards
    const lessonCards = await generateLessonCards({
      topicName: topic.name,
      subTopicName: subTopic?.name,
      failedQuestions,
      contextType,
    });

    const mistakePackage = await generateMistakePackage({
      topicName: topic.name,
      subTopicName: subTopic?.name,
      failedQuestions,
      contextType,
    });

    // Create AI session
    const sessionId = await createAISession({
      studentId,
      topicId,
      contextId: resolvedContextId,
      subTopicId: subTopicId ?? null,
      contextType,
      messages: [
        {
          role: "tutor",
          content: `Hello! I've prepared some lessons to help you understand the concepts you missed. Let's go through them together.`,
          timestamp: Date.now(),
        },
      ],
      lessonCards,
      mistakes: mistakePackage.mistakes,
      drills: mistakePackage.drills,
      status: "active",
    });

    // Increment AI attempt count
    if (contextType === "prereq") {
      const existing = await getTopicProgress(studentId, topicId);
      await upsertTopicProgress(studentId, topicId, {
        prereqAIAttemptCount: (existing?.prereqAIAttemptCount ?? 0) + 1,
      });
    } else if (contextType === "subtopic" && subTopicId) {
      const existing = await getSubTopicProgress(studentId, subTopicId);
      await upsertSubTopicProgress(studentId, subTopicId, topicId, {
        quizAIAttemptCount: (existing?.quizAIAttemptCount ?? 0) + 1,
      });
    } else if (contextType === "finaltest") {
      const existing = await getTopicProgress(studentId, topicId);
      await upsertTopicProgress(studentId, topicId, {
        finalTestAIAttemptCount: (existing?.finalTestAIAttemptCount ?? 0) + 1,
      });
    }

    return Response.json({
      sessionId,
      lessonCards,
      mistakes: mistakePackage.mistakes,
      drills: mistakePackage.drills,
    });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
