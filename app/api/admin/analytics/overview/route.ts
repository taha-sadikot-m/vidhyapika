import { verifyJWT, requireAdmin } from "../../../../../backend/middleware/auth";
import { getDb } from "../../../../../backend/firebase/admin";
import {
  listStandards,
  getAllClasses,
} from "../../../../../backend/repositories/curriculumRepo";

// ─── Types returned by this endpoint ─────────────────────────────────────────

export type TopicStat = {
  topicId: string;
  topicName: string;
  topicOrder: number;
  classId: string;
  className: string;
  standardId: string;
  standardName: string;
  enrolled: number;
  prereqAttempted: number;
  prereqPassed: number;
  contentUnlocked: number;
  finalTestPassed: number;
  flaggedCount: number;
  avgPrereqAttempts: number;
  avgFinalAttempts: number;
  prereqPassRate: number;   // 0–100
  finalPassRate: number;    // 0–100
  aiInterventionRate: number; // 0–100
  completionRate: number;   // 0–100 (final test passed / enrolled)
};

export type ClassStat = {
  classId: string;
  className: string;
  standardId: string;
  standardName: string;
  enrolled: number;
  topicCount: number;
  avgPrereqPassRate: number;
  avgFinalPassRate: number;
  flaggedCount: number;
};

export type PlatformSummary = {
  avgPassRate: number;
  avgAIInterventionRate: number;
  avgCompletionRate: number;
  totalAttempts: number;
  totalTopicsWithData: number;
};

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const db = getDb();

  // ── Fetch curriculum structure ────────────────────────────────────────────
  const [standards, classes, topicsSnap] = await Promise.all([
    listStandards(),
    getAllClasses(),
    db.collection("topics").get(),
  ]);

  const standardMap = new Map(standards.map((s) => [s.id, s]));
  const classMap = new Map(classes.map((c) => [c.id, c]));

  const topics = topicsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

  // ── Fetch enrollments + all topic progress in parallel ────────────────────
  const [enrollmentsSnap, topicProgressSnap] = await Promise.all([
    db.collection("classEnrollments").get(),
    db.collection("studentTopicProgress").get(),
  ]);

  // classId → Set of enrolled studentIds
  const enrollmentByClass = new Map<string, Set<string>>();
  for (const doc of enrollmentsSnap.docs) {
    const { classId, studentId } = doc.data();
    if (!enrollmentByClass.has(classId)) enrollmentByClass.set(classId, new Set());
    enrollmentByClass.get(classId)!.add(studentId);
  }

  // topicId → array of progress records (for enrolled students only — checked per topic)
  const progressByTopic = new Map<string, any[]>();
  for (const doc of topicProgressSnap.docs) {
    const data = doc.data();
    const tid = data.topicId as string;
    if (!progressByTopic.has(tid)) progressByTopic.set(tid, []);
    progressByTopic.get(tid)!.push(data);
  }

  // ── Compute per-topic stats ───────────────────────────────────────────────
  const topicStats: TopicStat[] = [];

  for (const topic of topics) {
    const cls = classMap.get(topic.classId);
    if (!cls) continue;
    const std = standardMap.get(cls.standardId);
    if (!std) continue;

    const enrolledSet = enrollmentByClass.get(topic.classId) ?? new Set<string>();
    const enrolled = enrolledSet.size;

    const progressRecords = (progressByTopic.get(topic.id) ?? []).filter((p) =>
      enrolledSet.has(p.studentId)
    );

    const prereqAttempted = progressRecords.filter((p) => p.prereqAttemptCount > 0).length;
    const prereqPassed = progressRecords.filter((p) => p.prereqStatus === "passed").length;
    const contentUnlocked = progressRecords.filter((p) => p.contentUnlocked === true).length;
    const finalTestPassed = progressRecords.filter((p) => p.finalTestStatus === "passed").length;
    const flaggedCount = progressRecords.filter(
      (p) => p.prereqStatus === "flagged" || p.finalTestStatus === "flagged"
    ).length;

    const aiInterventionCount = progressRecords.filter(
      (p) => (p.prereqAIAttemptCount ?? 0) > 0 || (p.finalTestAIAttemptCount ?? 0) > 0
    ).length;

    const totalPrereqAttempts = progressRecords.reduce(
      (sum, p) => sum + (p.prereqAttemptCount ?? 0),
      0
    );
    const totalFinalAttempts = progressRecords.reduce(
      (sum, p) => sum + (p.finalTestAttemptCount ?? 0),
      0
    );

    const prereqPassRate =
      prereqAttempted > 0 ? Math.round((prereqPassed / prereqAttempted) * 100) : 0;
    const finalPassRate =
      contentUnlocked > 0 ? Math.round((finalTestPassed / contentUnlocked) * 100) : 0;
    const completionRate =
      enrolled > 0 ? Math.round((finalTestPassed / enrolled) * 100) : 0;
    const aiInterventionRate =
      enrolled > 0 ? Math.round((aiInterventionCount / enrolled) * 100) : 0;

    topicStats.push({
      topicId: topic.id,
      topicName: topic.name,
      topicOrder: topic.order ?? 0,
      classId: cls.id,
      className: cls.name,
      standardId: std.id,
      standardName: std.name,
      enrolled,
      prereqAttempted,
      prereqPassed,
      contentUnlocked,
      finalTestPassed,
      flaggedCount,
      avgPrereqAttempts:
        prereqAttempted > 0
          ? Math.round((totalPrereqAttempts / prereqAttempted) * 10) / 10
          : 0,
      avgFinalAttempts:
        contentUnlocked > 0
          ? Math.round((totalFinalAttempts / contentUnlocked) * 10) / 10
          : 0,
      prereqPassRate,
      finalPassRate,
      aiInterventionRate,
      completionRate,
    });
  }

  // Sort topics by difficulty (lowest prereq pass rate first among those with data)
  topicStats.sort((a, b) => {
    if (a.enrolled === 0 && b.enrolled === 0) return 0;
    if (a.enrolled === 0) return 1;
    if (b.enrolled === 0) return -1;
    return a.prereqPassRate - b.prereqPassRate;
  });

  // ── Compute per-class stats ───────────────────────────────────────────────
  const classStats: ClassStat[] = classes.map((cls) => {
    const std = standardMap.get(cls.standardId);
    const cTopics = topicStats.filter((t) => t.classId === cls.id);
    const enrolled = enrollmentByClass.get(cls.id)?.size ?? 0;
    const withData = cTopics.filter((t) => t.enrolled > 0);
    const flaggedCount = cTopics.reduce((s, t) => s + t.flaggedCount, 0);

    return {
      classId: cls.id,
      className: cls.name,
      standardId: cls.standardId,
      standardName: std?.name ?? "",
      enrolled,
      topicCount: cTopics.length,
      avgPrereqPassRate:
        withData.length > 0
          ? Math.round(withData.reduce((s, t) => s + t.prereqPassRate, 0) / withData.length)
          : 0,
      avgFinalPassRate:
        withData.length > 0
          ? Math.round(withData.reduce((s, t) => s + t.finalPassRate, 0) / withData.length)
          : 0,
      flaggedCount,
    };
  });

  // ── Platform summary ──────────────────────────────────────────────────────
  const withData = topicStats.filter((t) => t.enrolled > 0);
  const totalAttempts = topicProgressSnap.size;

  const platformSummary: PlatformSummary = {
    avgPassRate:
      withData.length > 0
        ? Math.round(
            withData.reduce((s, t) => s + t.prereqPassRate, 0) / withData.length
          )
        : 0,
    avgAIInterventionRate:
      withData.length > 0
        ? Math.round(
            withData.reduce((s, t) => s + t.aiInterventionRate, 0) / withData.length
          )
        : 0,
    avgCompletionRate:
      withData.length > 0
        ? Math.round(
            withData.reduce((s, t) => s + t.completionRate, 0) / withData.length
          )
        : 0,
    totalAttempts,
    totalTopicsWithData: withData.length,
  };

  return Response.json({ platformSummary, classStats, topicStats });
}
