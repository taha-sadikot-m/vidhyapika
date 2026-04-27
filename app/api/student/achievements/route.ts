import { verifyJWT, requireAuth } from "../../../../backend/middleware/auth";
import { listQuizAttempts, listSubTopicProgressByStudent, listTopicProgressByStudent } from "../../../../backend/repositories/progressRepo";

function dayKey(d: Date): string {
  // Use local day to match user perception.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAuth(user);
  if (err) return err;

  const studentId = user!.sub;

  const attempts = await listQuizAttempts(studentId);
  const subProgress = await listSubTopicProgressByStudent(studentId);
  const topicProgress = await listTopicProgressByStudent(studentId);

  const activeDays = new Set<string>();
  for (const a of attempts) {
    const dt = (a.timestamp as any)?.toDate?.();
    if (dt) activeDays.add(dayKey(dt));
  }
  for (const s of subProgress) {
    const dt = (s.updatedAt as any)?.toDate?.() ?? (s.createdAt as any)?.toDate?.();
    if (dt) activeDays.add(dayKey(dt));
  }

  // Compute streak ending today.
  let streakDays = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (activeDays.has(dayKey(d))) streakDays++;
    else break;
  }

  const quizzesPassed = attempts.filter((a) => a.passed).length;
  const videosWatched = subProgress.filter((s) => !!s.videoWatched).length;
  const topicsCompleted = topicProgress.filter((t) => t.completedAt != null).length;

  // Simple points system: keep deterministic and easy to understand.
  const totalPoints = quizzesPassed * 10 + videosWatched * 5 + topicsCompleted * 25;

  const badges = [
    { key: "FIRST_QUIZ_PASSED", title: "First Win", description: "Pass your first quiz.", unlocked: quizzesPassed >= 1 },
    { key: "THREE_DAY_STREAK", title: "3-Day Streak", description: "Be active 3 days in a row.", unlocked: streakDays >= 3 },
    { key: "SEVEN_DAY_STREAK", title: "7-Day Streak", description: "Be active 7 days in a row.", unlocked: streakDays >= 7 },
    { key: "FIVE_VIDEOS", title: "Video Learner", description: "Watch 5 lesson videos.", unlocked: videosWatched >= 5 },
    { key: "TEN_QUIZZES", title: "Quiz Explorer", description: "Pass 10 quizzes.", unlocked: quizzesPassed >= 10 },
    { key: "ONE_TOPIC_DONE", title: "Topic Complete", description: "Complete a full topic.", unlocked: topicsCompleted >= 1 },
  ];

  return Response.json(
    {
      streakDays,
      totalPoints,
      badges,
      stats: { quizzesPassed, videosWatched, topicsCompleted, totalAttempts: attempts.length },
    },
    { status: 200 }
  );
}

