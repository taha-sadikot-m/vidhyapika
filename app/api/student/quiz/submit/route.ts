import { verifyJWT, requireAuth } from "../../../../../backend/middleware/auth";
import {
  listQuestions,
  getPrerequisite,
  getTopic,
  getSubTopic,
  QuestionContextType,
} from "../../../../../backend/repositories/curriculumRepo";
import {
  saveQuizAttempt,
  upsertTopicProgress,
  upsertSubTopicProgress,
  getTopicProgress,
  getSubTopicProgress,
  createFlag,
  countFailedAiRetakes,
} from "../../../../../backend/repositories/progressRepo";
import { getUserById } from "../../../../../backend/repositories/userRepo";
import { sendFlaggedAlert } from "../../../../../backend/services/notifications";
import { evaluateSubjectiveAnswer } from "../../../../../backend/services/ai";
import { z } from "zod";

const SubmitSchema = z.object({
  contextType: z.enum(["prereq", "subtopic", "finaltest"]),
  contextId: z.string().min(1),
  topicId: z.string().min(1),
  subTopicId: z.string().optional(),
  answers: z.array(
    z.object({
      questionId: z.string(),
      answer: z.string(),
    })
  ),
});

/** Max failed AI-generated retakes before escalating (coach + AI test loop per quiz scope). */
const MAX_AI_COACHING_CYCLES = 3;

export async function POST(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAuth(user);
  if (err) return err;

  const studentId = user!.sub;

  try {
    const body = SubmitSchema.parse(await req.json());
    const { contextType, contextId, topicId, subTopicId, answers } = body;

    const effectiveSubTopicId =
      contextType === "subtopic" ? subTopicId ?? contextId : subTopicId;

    // Score only questions included in this submission (AI retakes submit a subset of catalog questions).
    const allCatalogQuestions = await listQuestions(contextType as QuestionContextType, contextId);
    if (allCatalogQuestions.length === 0) {
      return Response.json({ error: "No questions found for this context" }, { status: 404 });
    }

    const submittedIds = new Set(answers.map((a) => a.questionId));
    const questions = allCatalogQuestions.filter((q) => submittedIds.has(q.id));
    if (questions.length === 0) {
      return Response.json(
        { error: "No submitted answers match questions for this quiz scope." },
        { status: 400 }
      );
    }

    const priorFailedAiRetakes = await countFailedAiRetakes(studentId, contextType, contextId);

    // Score the attempt using AI for subjective questions
    const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]));
    const scoredAnswers = await Promise.all(
      questions.map(async (q) => {
        const studentAnswer = answerMap.get(q.id) ?? "";
        let correct = false;
        let aiReasoning = "";
        let evaluationFailed = false;

        if (q.type === "text" || q.type === "image_upload") {
          if (!studentAnswer.trim()) {
            correct = false;
          } else {
            const evalResult = await evaluateSubjectiveAnswer({
              questionText: q.text,
              correctAnswerText: q.correctAnswer ?? "",
              studentAnswer,
              type: q.type,
            });
            correct = evalResult.correct;
            aiReasoning = evalResult.reasoning;
            evaluationFailed = !!evalResult.evaluationFailed;
          }
        } else {
          correct =
            studentAnswer.toLowerCase().trim() === (q.correctAnswer ?? "").toLowerCase().trim();
        }

        return { questionId: q.id, answer: studentAnswer, correct, aiReasoning, evaluationFailed };
      })
    );

    const evaluationIncomplete = scoredAnswers.some((a) => a.evaluationFailed);

    // All questions are now graded (provisional if AI incomplete)
    const correctCount = scoredAnswers.filter((a) => a.correct).length;
    const score = correctCount;
    const total = scoredAnswers.length;
    const percentage = total > 0 ? (score / total) * 100 : 100;

    // Determine threshold
    let passingThreshold = 60;
    if (contextType === "prereq") {
      const prereq = await getPrerequisite(topicId);
      passingThreshold = prereq?.passingThreshold ?? 60;
    } else if (contextType === "subtopic") {
      const st = await getSubTopic(contextId);
      passingThreshold = st?.passingThreshold ?? 60;
    } else if (contextType === "finaltest") {
      const topic = await getTopic(topicId);
      passingThreshold = topic?.finalTestThreshold ?? 60;
    }

    const passed = percentage >= passingThreshold;

    const aiGenerated =
      questions.length > 0 && questions.every((q) => q.isAIGenerated === true);

    if (evaluationIncomplete) {
      return Response.json({
        success: true,
        evaluationIncomplete: true,
        message:
          "The AI could not finish grading one or more answers. Your attempt was not saved — review below and tap “Retry evaluation”.",
        score,
        total,
        percentage: Math.round(percentage),
        passed,
        passingThreshold,
        scoredAnswers: scoredAnswers.map(
          ({ questionId, correct, aiReasoning, evaluationFailed }) => ({
            questionId,
            correct,
            ...(aiReasoning ? { aiReasoning } : {}),
            ...(evaluationFailed ? { evaluationFailed: true } : {}),
          })
        ),
      });
    }

    // Save quiz attempt record
    const attemptId = await saveQuizAttempt({
      studentId,
      contextType,
      contextId,
      answers: scoredAnswers.map(({ questionId, answer, correct, aiReasoning }) => ({
        questionId,
        answer,
        correct,
        ...(aiReasoning ? { aiReasoning } : {}),
      })),
      score,
      total,
      passed,
      aiGenerated,
    });

    let flagged = false;
    let contentUnlocked = false;
    let aiNeeded = false;

    // Update progress based on contextType.
    // Once a stage is passed (or cleared via flag / unlock), practice retakes never downgrade status.

    if (contextType === "prereq") {
      const existing = await getTopicProgress(studentId, topicId);
      const attemptCount = (existing?.prereqAttemptCount ?? 0) + 1;
      const prereqEverCleared =
        existing?.prereqStatus === "passed" ||
        existing?.prereqStatus === "flagged" ||
        existing?.contentUnlocked === true;
      const thirdFailedAiRetake =
        !passed &&
        aiGenerated &&
        priorFailedAiRetakes >= MAX_AI_COACHING_CYCLES - 1 &&
        !prereqEverCleared;

      if (passed) {
        await upsertTopicProgress(studentId, topicId, {
          prereqStatus: "passed",
          prereqAttemptCount: attemptCount,
          contentUnlocked: true,
        });
        contentUnlocked = true;
      } else if (thirdFailedAiRetake) {
        await upsertTopicProgress(studentId, topicId, {
          prereqStatus: "flagged",
          prereqAttemptCount: attemptCount,
          contentUnlocked: true,
        });
        await createFlag({
          studentId,
          topicId,
          subTopicId: null,
          flagType: "prereq",
          resolvedAt: null,
          resolvedBy: null,
        });
        flagged = true;
        contentUnlocked = true;
        const student = await getUserById(studentId);
        const topic = await getTopic(topicId);
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail && student && topic) {
          sendFlaggedAlert({
            adminEmail,
            studentName: student.name ?? student.email,
            studentEmail: student.email,
            topicName: topic.name,
            flagType: "Prerequisite Test",
            attemptCount: MAX_AI_COACHING_CYCLES,
          }).catch(console.error);
        }
      } else if (!prereqEverCleared) {
        await upsertTopicProgress(studentId, topicId, {
          prereqStatus: "failed",
          prereqAttemptCount: attemptCount,
        });
        aiNeeded = true;
      } else {
        await upsertTopicProgress(studentId, topicId, {
          prereqAttemptCount: attemptCount,
        });
        aiNeeded = true;
      }
    } else if (contextType === "subtopic" && effectiveSubTopicId) {
      const existing = await getSubTopicProgress(studentId, effectiveSubTopicId);
      const attemptCount = (existing?.quizAttemptCount ?? 0) + 1;
      const quizEverCleared =
        existing?.quizStatus === "passed" || existing?.quizStatus === "flagged";
      const thirdFailedAiRetake =
        !passed &&
        aiGenerated &&
        priorFailedAiRetakes >= MAX_AI_COACHING_CYCLES - 1 &&
        !quizEverCleared;

      if (passed) {
        await upsertSubTopicProgress(studentId, effectiveSubTopicId, topicId, {
          quizStatus: "passed",
          quizAttemptCount: attemptCount,
          completedAt: new Date() as any,
        });
      } else if (thirdFailedAiRetake) {
        await upsertSubTopicProgress(studentId, effectiveSubTopicId, topicId, {
          quizStatus: "flagged",
          quizAttemptCount: attemptCount,
        });
        await createFlag({
          studentId,
          topicId,
          subTopicId: effectiveSubTopicId,
          flagType: "subtopic",
          resolvedAt: null,
          resolvedBy: null,
        });
        flagged = true;
        const student = await getUserById(studentId);
        const topic = await getTopic(topicId);
        const subTopic = await getSubTopic(effectiveSubTopicId);
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail && student && topic) {
          sendFlaggedAlert({
            adminEmail,
            studentName: student.name ?? student.email,
            studentEmail: student.email,
            topicName: topic.name,
            subTopicName: subTopic?.name,
            flagType: "Sub-Topic Quiz",
            attemptCount: MAX_AI_COACHING_CYCLES,
          }).catch(console.error);
        }
      } else if (!quizEverCleared) {
        await upsertSubTopicProgress(studentId, effectiveSubTopicId, topicId, {
          quizStatus: "failed",
          quizAttemptCount: attemptCount,
        });
        aiNeeded = true;
      } else {
        await upsertSubTopicProgress(studentId, effectiveSubTopicId, topicId, {
          quizAttemptCount: attemptCount,
        });
        aiNeeded = true;
      }
    } else if (contextType === "finaltest") {
      const existing = await getTopicProgress(studentId, topicId);
      const attemptCount = (existing?.finalTestAttemptCount ?? 0) + 1;
      const finalEverCleared =
        existing?.finalTestStatus === "passed" ||
        existing?.finalTestStatus === "flagged" ||
        !!existing?.completedAt;
      const thirdFailedAiRetake =
        !passed &&
        aiGenerated &&
        priorFailedAiRetakes >= MAX_AI_COACHING_CYCLES - 1 &&
        !finalEverCleared;

      if (passed) {
        await upsertTopicProgress(studentId, topicId, {
          finalTestStatus: "passed",
          finalTestAttemptCount: attemptCount,
          completedAt: new Date() as any,
        });
      } else if (thirdFailedAiRetake) {
        await upsertTopicProgress(studentId, topicId, {
          finalTestStatus: "flagged",
          finalTestAttemptCount: attemptCount,
        });
        await createFlag({
          studentId,
          topicId,
          subTopicId: null,
          flagType: "finaltest",
          resolvedAt: null,
          resolvedBy: null,
        });
        flagged = true;
        const student = await getUserById(studentId);
        const topic = await getTopic(topicId);
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail && student && topic) {
          sendFlaggedAlert({
            adminEmail,
            studentName: student.name ?? student.email,
            studentEmail: student.email,
            topicName: topic.name,
            flagType: "Final Test",
            attemptCount: MAX_AI_COACHING_CYCLES,
          }).catch(console.error);
        }
      } else if (!finalEverCleared) {
        await upsertTopicProgress(studentId, topicId, {
          finalTestStatus: "failed",
          finalTestAttemptCount: attemptCount,
        });
        aiNeeded = true;
      } else {
        await upsertTopicProgress(studentId, topicId, {
          finalTestAttemptCount: attemptCount,
        });
        aiNeeded = true;
      }
    }

    // Build failed questions list for AI
    const failedQuestions = questions
      .filter((q) => {
        const scored = scoredAnswers.find((a) => a.questionId === q.id);
        return scored && !scored.correct;
      })
      .map((q) => {
        const scored = scoredAnswers.find((a) => a.questionId === q.id);
        return {
          questionId: q.id,
          text: q.text,
          type: q.type,
          studentAnswer: answerMap.get(q.id) ?? "",
          correctAnswer: q.correctAnswer ?? "",
          aiReasoning: scored?.aiReasoning ?? "",
        };
      });

    return Response.json({
      success: true,
      attemptId,
      score,
      total,
      percentage: Math.round(percentage),
      passed,
      flagged,
      contentUnlocked,
      aiNeeded,
      aiGenerated,
      priorFailedAiRetakes,
      maxAiCoachingCycles: MAX_AI_COACHING_CYCLES,
      failedQuestions,
      /** Per-question results (AI for text/image_upload; exact match for mcq / true_false). For client review UI. */
      scoredAnswers: scoredAnswers.map(({ questionId, correct, aiReasoning, evaluationFailed }) => ({
        questionId,
        correct,
        ...(aiReasoning ? { aiReasoning } : {}),
        ...(evaluationFailed ? { evaluationFailed: true } : {}),
      })),
    });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
