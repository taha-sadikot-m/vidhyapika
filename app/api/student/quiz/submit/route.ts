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

const MAX_AI_ATTEMPTS = 3;

export async function POST(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAuth(user);
  if (err) return err;

  const studentId = user!.sub;

  try {
    const body = SubmitSchema.parse(await req.json());
    const { contextType, contextId, topicId, subTopicId, answers } = body;

    // Fetch the questions for this context
    const questions = await listQuestions(contextType as QuestionContextType, contextId);
    if (questions.length === 0) {
      return Response.json({ error: "No questions found for this context" }, { status: 404 });
    }

    // Score the attempt using AI for subjective questions
    const answerMap = new Map(answers.map((a) => [a.questionId, a.answer]));
    const scoredAnswers = await Promise.all(questions.map(async (q) => {
      const studentAnswer = answerMap.get(q.id) ?? "";
      let correct = false;
      let aiReasoning = "";

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
        }
      } else {
        correct = studentAnswer.toLowerCase().trim() === (q.correctAnswer ?? "").toLowerCase().trim();
      }
      
      return { questionId: q.id, answer: studentAnswer, correct, aiReasoning };
    }));

    // All questions are now graded
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

    // Save quiz attempt record
    const attemptId = await saveQuizAttempt({
      studentId,
      contextType,
      contextId,
      answers: scoredAnswers,
      score,
      total,
      passed,
      aiGenerated: false,
    });

    let flagged = false;
    let contentUnlocked = false;
    let aiNeeded = false;

    // Update progress based on contextType
    if (contextType === "prereq") {
      const existing = await getTopicProgress(studentId, topicId);
      const attemptCount = (existing?.prereqAttemptCount ?? 0) + 1;
      const aiAttemptCount = existing?.prereqAIAttemptCount ?? 0;

      if (passed) {
        await upsertTopicProgress(studentId, topicId, {
          prereqStatus: "passed",
          prereqAttemptCount: attemptCount,
          contentUnlocked: true,
        });
        contentUnlocked = true;
      } else if (aiAttemptCount >= MAX_AI_ATTEMPTS) {
        // Flag student — they've exhausted all AI attempts
        await upsertTopicProgress(studentId, topicId, {
          prereqStatus: "flagged",
          prereqAttemptCount: attemptCount,
          contentUnlocked: true, // Force-unlock
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
        // Send alert email
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
            attemptCount: aiAttemptCount + 1,
          }).catch(console.error);
        }
      } else {
        await upsertTopicProgress(studentId, topicId, {
          prereqStatus: "failed",
          prereqAttemptCount: attemptCount,
        });
        aiNeeded = true;
      }
    } else if (contextType === "subtopic" && subTopicId) {
      const existing = await getSubTopicProgress(studentId, subTopicId);
      const attemptCount = (existing?.quizAttemptCount ?? 0) + 1;
      const aiAttemptCount = existing?.quizAIAttemptCount ?? 0;

      if (passed) {
        await upsertSubTopicProgress(studentId, subTopicId, topicId, {
          quizStatus: "passed",
          quizAttemptCount: attemptCount,
          completedAt: new Date() as any,
        });
      } else if (aiAttemptCount >= MAX_AI_ATTEMPTS) {
        await upsertSubTopicProgress(studentId, subTopicId, topicId, {
          quizStatus: "flagged",
          quizAttemptCount: attemptCount,
        });
        await createFlag({
          studentId,
          topicId,
          subTopicId,
          flagType: "subtopic",
          resolvedAt: null,
          resolvedBy: null,
        });
        flagged = true;
        const student = await getUserById(studentId);
        const topic = await getTopic(topicId);
        const subTopic = await getSubTopic(subTopicId);
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail && student && topic) {
          sendFlaggedAlert({
            adminEmail,
            studentName: student.name ?? student.email,
            studentEmail: student.email,
            topicName: topic.name,
            subTopicName: subTopic?.name,
            flagType: "Sub-Topic Quiz",
            attemptCount: aiAttemptCount + 1,
          }).catch(console.error);
        }
      } else {
        await upsertSubTopicProgress(studentId, subTopicId, topicId, {
          quizStatus: "failed",
          quizAttemptCount: attemptCount,
        });
        aiNeeded = true;
      }
    } else if (contextType === "finaltest") {
      const existing = await getTopicProgress(studentId, topicId);
      const attemptCount = (existing?.finalTestAttemptCount ?? 0) + 1;
      const aiAttemptCount = existing?.finalTestAIAttemptCount ?? 0;

      if (passed) {
        await upsertTopicProgress(studentId, topicId, {
          finalTestStatus: "passed",
          finalTestAttemptCount: attemptCount,
          completedAt: new Date() as any,
        });
      } else if (aiAttemptCount >= MAX_AI_ATTEMPTS) {
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
            attemptCount: aiAttemptCount + 1,
          }).catch(console.error);
        }
      } else {
        await upsertTopicProgress(studentId, topicId, {
          finalTestStatus: "failed",
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
      failedQuestions,
    });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
