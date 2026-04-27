import { verifyJWT, requireAdmin } from "../../../../../backend/middleware/auth";
import { getDb } from "../../../../../backend/firebase/admin";
import { listQuestions, QuestionContextType } from "../../../../../backend/repositories/curriculumRepo";

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const url = new URL(req.url);
  const contextType = url.searchParams.get("contextType") as QuestionContextType | null;
  const contextId = url.searchParams.get("contextId");

  if (!contextType || !contextId) {
    return Response.json({ error: "contextType and contextId are required" }, { status: 400 });
  }

  // ── Fetch questions for this context ────────────────────────────────────────
  const questions = await listQuestions(contextType, contextId);

  if (questions.length === 0) {
    return Response.json({ hasData: false, questions: [], summary: null });
  }

  // ── Fetch all quiz attempts for this contextId (single-field where, no composite index) ─
  const db = getDb();
  const attemptsSnap = await db
    .collection("quizAttempts")
    .where("contextId", "==", contextId)
    .get();

  // Filter by contextType in memory to avoid composite index
  const attempts = attemptsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((a) => a.contextType === contextType);

  if (attempts.length === 0) {
    // Return questions but with zero stats — this is real, not mock
    return Response.json({
      hasData: true,
      hasAttempts: false,
      questions: questions.map((q, i) => ({
        id: q.id,
        label: `Q${i + 1}`,
        text: q.text,
        type: q.type,
        correctAttempts: 0,
        incorrectAttempts: 0,
        totalAttempts: 0,
        successRate: 0,
      })),
      summary: {
        totalAttempts: 0,
        uniqueStudents: 0,
        avgScore: 0,
        passRate: 0,
        totalQuestions: questions.length,
      },
    });
  }

  // ── Aggregate per-question stats ────────────────────────────────────────────
  const questionIndex = new Map(questions.map((q, i) => [q.id, i]));
  const correctCounts = new Map<string, number>();
  const incorrectCounts = new Map<string, number>();
  const uniqueStudents = new Set<string>();

  let totalScore = 0;
  let totalMaxScore = 0;
  let passedCount = 0;

  for (const attempt of attempts) {
    uniqueStudents.add(attempt.studentId);
    totalScore += attempt.score ?? 0;
    totalMaxScore += attempt.total ?? 1;
    if (attempt.passed) passedCount++;

    const answers: { questionId: string; correct: boolean }[] = attempt.answers ?? [];
    for (const ans of answers) {
      const qid = ans.questionId;
      if (ans.correct) {
        correctCounts.set(qid, (correctCounts.get(qid) ?? 0) + 1);
      } else {
        incorrectCounts.set(qid, (incorrectCounts.get(qid) ?? 0) + 1);
      }
    }
  }

  const questionStats = questions.map((q, i) => {
    const correct = correctCounts.get(q.id) ?? 0;
    const incorrect = incorrectCounts.get(q.id) ?? 0;
    const total = correct + incorrect;
    return {
      id: q.id,
      label: `Q${i + 1}`,
      text: q.text,
      type: q.type,
      correctAttempts: correct,
      incorrectAttempts: incorrect,
      totalAttempts: total,
      successRate: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
  });

  const avgScore =
    totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

  return Response.json({
    hasData: true,
    hasAttempts: true,
    questions: questionStats,
    summary: {
      totalAttempts: attempts.length,
      uniqueStudents: uniqueStudents.size,
      avgScore,
      passRate: attempts.length > 0 ? Math.round((passedCount / attempts.length) * 100) : 0,
      totalQuestions: questions.length,
    },
  });
}
