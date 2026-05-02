import type { Query } from "firebase-admin/firestore";
import { verifyJWT, requireAdmin } from "../../../../../backend/middleware/auth";
import { getDb } from "../../../../../backend/firebase/admin";
import { getClassesByIds, getStandardsByIds } from "../../../../../backend/repositories/curriculumRepo";
import { isFirestoreResourceExhausted } from "../../../../../backend/utils/firestoreErrors";
import { queryDocumentsWhereIn } from "../../../../../backend/utils/firestoreQuery";
import { ADMIN_JSON_CACHE_CONTROL } from "../../../../../backend/utils/adminApiCache";

/** Optional cap for very large installs; omit for full-platform analytics (default). Max 2000. */
const TOPIC_LIMIT_CAP = 2000;

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
  prereqPassRate: number; // 0–100
  finalPassRate: number; // 0–100
  aiInterventionRate: number; // 0–100
  completionRate: number; // 0–100 (final test passed / enrolled)
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
  const url = new URL(req.url);
  const topicLimitRaw = url.searchParams.get("topicLimit");
  let topicLimit: number | undefined;
  if (topicLimitRaw != null && topicLimitRaw !== "") {
    const n = Number.parseInt(topicLimitRaw, 10);
    if (Number.isFinite(n) && n > 0) topicLimit = Math.min(n, TOPIC_LIMIT_CAP);
  }

  try {
    // ── Curriculum: topics (full list by default; optional limit for huge collections) ──
    let topicsQuery: Query = db.collection("topics");
    if (topicLimit != null) {
      topicsQuery = topicsQuery.orderBy("order", "asc").limit(topicLimit);
    }
    const topicsSnap = await topicsQuery.get();
    const topics = topicsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

    const classIdsNeeded = [...new Set(topics.map((t: { classId?: string }) => t.classId).filter(Boolean))] as string[];

    const classMap = await getClassesByIds(classIdsNeeded);
    const standardIdsNeeded = [
      ...new Set(
        [...classMap.values()].map((c) => c.standardId).filter(Boolean) as string[]
      ),
    ];
    const standardMap = await getStandardsByIds(standardIdsNeeded);

    // ── Enrollments + progress: scoped to classes / topics in curriculum (not full collection scans) ──
    const [enrollmentDocs, topicProgressDocs] = await Promise.all([
      queryDocumentsWhereIn(db, "classEnrollments", "classId", classIdsNeeded),
      queryDocumentsWhereIn(
        db,
        "studentTopicProgress",
        "topicId",
        topics.map((t: { id: string }) => t.id)
      ),
    ]);

    const enrollmentByClass = new Map<string, Set<string>>();
    for (const doc of enrollmentDocs) {
      const { classId, studentId } = doc.data();
      if (!enrollmentByClass.has(classId)) enrollmentByClass.set(classId, new Set());
      enrollmentByClass.get(classId)!.add(studentId);
    }

    const progressByTopic = new Map<string, any[]>();
    for (const doc of topicProgressDocs) {
      const data = doc.data();
      const tid = data.topicId as string;
      if (!progressByTopic.has(tid)) progressByTopic.set(tid, []);
      progressByTopic.get(tid)!.push(data);
    }

    const totalAttempts = topicProgressDocs.length;

    // ── Compute per-topic stats ─────────────────────────────────────────────
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

    topicStats.sort((a, b) => {
      if (a.enrolled === 0 && b.enrolled === 0) return 0;
      if (a.enrolled === 0) return 1;
      if (b.enrolled === 0) return -1;
      return a.prereqPassRate - b.prereqPassRate;
    });

    // ── Per-class stats (classes that have at least one topic only) ──────────
    const classes = [...classMap.values()].sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "")
    );

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

    const withData = topicStats.filter((t) => t.enrolled > 0);

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

    return Response.json(
      {
        platformSummary,
        classStats,
        topicStats,
        ...(topicLimit != null ? { topicLimitApplied: topicLimit } : {}),
      },
      { headers: { "Cache-Control": ADMIN_JSON_CACHE_CONTROL } }
    );
  } catch (e) {
    if (isFirestoreResourceExhausted(e)) {
      console.error("[GET /api/admin/analytics/overview] Firestore quota exceeded", e);
      return Response.json(
        {
          error:
            "Database quota exceeded (Firestore read limit). Wait for the daily reset, reduce traffic, or upgrade your Firebase plan.",
          code: "firestore_quota",
        },
        { status: 503 }
      );
    }
    throw e;
  }
}
