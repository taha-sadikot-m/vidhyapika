import { verifyJWT, requireAuth } from "../../../../backend/middleware/auth";
import { listQuizAttempts, listSubTopicProgressByStudent, listTopicProgressByStudent } from "../../../../backend/repositories/progressRepo";

function dayKey(d: Date): string {
  // Use local calendar day in the runtime timezone (typically UTC on cloud hosts).
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Normalize Firestore Timestamp, serialized {seconds}, Date, ISO string, etc. */
function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "string" || typeof v === "number") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof (o as { toDate?: () => Date }).toDate === "function") {
      try {
        const d = (o as { toDate: () => Date }).toDate();
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
      } catch {
        /* ignore */
      }
    }
    const sec =
      typeof o.seconds === "number"
        ? o.seconds
        : typeof o._seconds === "number"
          ? o._seconds
          : null;
    if (sec != null) {
      const d = new Date(sec * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function addDayKeysFromRecord(activeDays: Set<string>, rec: Record<string, unknown>, fields: string[]) {
  for (const f of fields) {
    const d = toDate(rec[f]);
    if (d) activeDays.add(dayKey(d));
  }
}

/**
 * Longest run of consecutive calendar days ending on the student's most recent activity day.
 * (Previously we only counted days ending *today*, so any user who hadn't opened the app yet
 * today always saw 0 — even with a perfect run through yesterday.)
 */
function streakFromMostRecentActivity(activeDays: Set<string>): number {
  if (activeDays.size === 0) return 0;
  const sorted = [...activeDays].sort();
  const lastKey = sorted[sorted.length - 1]!;
  const [y, m, d0] = lastKey.split("-").map(Number);
  let streak = 0;
  const cursor = new Date(y!, (m ?? 1) - 1, d0);
  for (let i = 0; i < 365; i++) {
    if (activeDays.has(dayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return streak;
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
    const dt = toDate(a.timestamp as unknown);
    if (dt) activeDays.add(dayKey(dt));
  }
  for (const s of subProgress) {
    addDayKeysFromRecord(activeDays, s as unknown as Record<string, unknown>, ["updatedAt", "createdAt", "completedAt"]);
  }
  for (const t of topicProgress) {
    addDayKeysFromRecord(activeDays, t as unknown as Record<string, unknown>, ["updatedAt", "createdAt", "completedAt"]);
  }

  const streakDays = streakFromMostRecentActivity(activeDays);

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

