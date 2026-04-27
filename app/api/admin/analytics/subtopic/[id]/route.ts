import { verifyJWT, requireAdmin } from "../../../../../../backend/middleware/auth";
import { getDb } from "../../../../../../backend/firebase/admin";
import { getSubTopic } from "../../../../../../backend/repositories/curriculumRepo";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id: subtopicId } = await params;
  const db = getDb();

  const subtopic = await getSubTopic(subtopicId);
  if (!subtopic) {
    return Response.json({ error: "Subtopic not found" }, { status: 404 });
  }

  // ── Enrolled students (via parent topic's class) ───────────────────────────
  // Find classId from the topic
  const topicDoc = await db.collection("topics").doc(subtopic.topicId).get();
  const classId: string = topicDoc.exists ? (topicDoc.data()!.classId as string) : "";

  const enrollmentsSnap = classId
    ? await db.collection("classEnrollments").where("classId", "==", classId).get()
    : { docs: [], size: 0 };

  const enrolledSet = new Set(
    (enrollmentsSnap as any).docs.map((d: any) => d.data().studentId as string)
  );
  const enrolled = enrolledSet.size;

  // ── Progress data ──────────────────────────────────────────────────────────
  const [progressSnap, attemptsSnap, aiSessionsSnap] = await Promise.all([
    db
      .collection("studentSubTopicProgress")
      .where("subTopicId", "==", subtopicId)
      .get(),
    db
      .collection("quizAttempts")
      .where("contextType", "==", "subtopic")
      .where("contextId", "==", subtopicId)
      .get(),
    db
      .collection("aiSessions")
      .where("subTopicId", "==", subtopicId)
      .get(),
  ]);

  const progress = progressSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((p) => !enrolledSet.size || enrolledSet.has(p.studentId));

  const attempts = attemptsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
  const aiSessions = aiSessionsSnap.docs.length;

  // ── Compute metrics ────────────────────────────────────────────────────────
  const videoWatched = progress.filter((p) => p.videoWatched === true).length;
  const quizAttempted = progress.filter((p) => p.quizAttemptCount > 0).length;
  const quizPassed = progress.filter((p) => p.quizStatus === "passed").length;
  const quizFailed = quizAttempted - quizPassed;
  const totalAttempts = progress.reduce((s, p) => s + (p.quizAttemptCount ?? 0), 0);

  // Score distribution buckets: 0-49, 50-59, 60-74, 75-89, 90-100
  const scoreBuckets = { "0-49": 0, "50-59": 0, "60-74": 0, "75-89": 0, "90-100": 0 };
  for (const att of attempts) {
    const pct = att.total > 0 ? Math.round((att.score / att.total) * 100) : 0;
    if (pct < 50) scoreBuckets["0-49"]++;
    else if (pct < 60) scoreBuckets["50-59"]++;
    else if (pct < 75) scoreBuckets["60-74"]++;
    else if (pct < 90) scoreBuckets["75-89"]++;
    else scoreBuckets["90-100"]++;
  }

  const avgScore =
    attempts.length > 0
      ? Math.round(
          attempts.reduce((s, a) => s + (a.total > 0 ? (a.score / a.total) * 100 : 0), 0) /
            attempts.length
        )
      : 0;

  return Response.json({
    subtopic: {
      id: subtopic.id,
      name: subtopic.name,
      topicId: subtopic.topicId,
      hasVideo: !!(subtopic.youtubeUrl),
      youtubeUrl: subtopic.youtubeUrl ?? null,
      passingThreshold: subtopic.passingThreshold,
    },
    enrolled,
    videoWatchRate: enrolled > 0 ? Math.round((videoWatched / enrolled) * 100) : 0,
    quizAttempted,
    quizPassed,
    quizFailed,
    quizPassRate: quizAttempted > 0 ? Math.round((quizPassed / quizAttempted) * 100) : 0,
    avgAttempts:
      quizAttempted > 0 ? Math.round((totalAttempts / quizAttempted) * 10) / 10 : 0,
    avgScore,
    totalAttempts,
    aiSessions,
    scoreBuckets,
  });
}
