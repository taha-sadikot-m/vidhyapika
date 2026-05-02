import { verifyJWT, requireAdmin } from "../../../../../../backend/middleware/auth";
import { getDb } from "../../../../../../backend/firebase/admin";
import {
  getTopic,
  getClass,
  listSubTopics,
  listPrerequisites,
} from "../../../../../../backend/repositories/curriculumRepo";
import { isFirestoreResourceExhausted } from "../../../../../../backend/utils/firestoreErrors";
import { ADMIN_JSON_CACHE_CONTROL } from "../../../../../../backend/utils/adminApiCache";
import { getUsersByIds } from "../../../../../../backend/repositories/userRepo";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id: topicId } = await params;
  const db = getDb();

  try {
  // ── Curriculum data ───────────────────────────────────────────────────────
  const [topic, prerequisites, subtopics] = await Promise.all([
    getTopic(topicId),
    listPrerequisites(topicId),
    listSubTopics(topicId),
  ]);

  if (!topic) {
    return Response.json({ error: "Topic not found" }, { status: 404 });
  }

  // ── Enrolled students for this topic's class ──────────────────────────────
  const enrollmentsSnap = await db
    .collection("classEnrollments")
    .where("classId", "==", topic.classId)
    .get();

  const enrolledStudentIds = new Set(
    enrollmentsSnap.docs.map((d) => d.data().studentId as string)
  );
  const enrolled = enrolledStudentIds.size;

  // ── Progress data (single-field where, no index needed) ───────────────────
  const [topicProgressSnap, subtopicProgressSnap, flagsSnap, aiSessionsSnap] =
    await Promise.all([
      db.collection("studentTopicProgress").where("topicId", "==", topicId).get(),
      db.collection("studentSubTopicProgress").where("topicId", "==", topicId).get(),
      db.collection("flaggedStudents").where("topicId", "==", topicId).get(),
      db.collection("aiSessions").where("topicId", "==", topicId).get(),
    ]);

  // Filter to only enrolled students
  const topicProgress = topicProgressSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((p) => enrolledStudentIds.has(p.studentId));

  const subtopicProgress = subtopicProgressSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((p) => enrolledStudentIds.has(p.studentId));

  const flags = flagsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
  const aiSessions = aiSessionsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

  // ── Student funnel ────────────────────────────────────────────────────────
  const prereqAttempted = topicProgress.filter((p) => p.prereqAttemptCount > 0).length;
  const prereqPassed = topicProgress.filter((p) => p.prereqStatus === "passed").length;
  const contentUnlocked = topicProgress.filter((p) => p.contentUnlocked === true).length;
  const finalTestAttempted = topicProgress.filter(
    (p) => p.finalTestAttemptCount > 0
  ).length;
  const finalTestPassed = topicProgress.filter(
    (p) => p.finalTestStatus === "passed"
  ).length;
  const flaggedStudentIds = new Set(
    flags.filter((f) => !f.resolvedAt).map((f) => f.studentId as string)
  );

  // Count students who completed all subtopics (quizStatus === "passed" for all subtopics)
  const subtopicPassByStudent = new Map<string, Set<string>>();
  for (const p of subtopicProgress) {
    if (p.quizStatus === "passed") {
      if (!subtopicPassByStudent.has(p.studentId)) {
        subtopicPassByStudent.set(p.studentId, new Set());
      }
      subtopicPassByStudent.get(p.studentId)!.add(p.subTopicId);
    }
  }
  const allSubtopicIds = new Set(subtopics.map((s) => s.id));
  const allSubtopicsDone =
    allSubtopicIds.size > 0
      ? [...subtopicPassByStudent.entries()].filter(([, passedSet]) => {
          for (const sid of allSubtopicIds) {
            if (!passedSet.has(sid)) return false;
          }
          return true;
        }).length
      : 0;

  const funnel = {
    enrolled,
    prereqAttempted,
    prereqPassed,
    contentUnlocked,
    allSubtopicsDone,
    finalTestAttempted,
    finalTestPassed,
    flaggedCount: flaggedStudentIds.size,
  };

  // ── Per-subtopic analytics ────────────────────────────────────────────────
  const subtopicStats = subtopics.map((st) => {
    const stProgress = subtopicProgress.filter((p) => p.subTopicId === st.id);
    const videoWatched = stProgress.filter((p) => p.videoWatched === true).length;
    const quizPassed = stProgress.filter((p) => p.quizStatus === "passed").length;
    const quizAttempted = stProgress.filter((p) => p.quizAttemptCount > 0).length;
    const aiSessions_st = aiSessions.filter(
      (s) => s.subTopicId === st.id && s.contextType === "subtopic"
    ).length;

    const totalAttempts = stProgress.reduce(
      (sum, p) => sum + (p.quizAttemptCount ?? 0),
      0
    );

    return {
      id: st.id,
      name: st.name,
      order: st.order,
      hasVideo: !!(st.youtubeUrl),
      videoWatchRate:
        enrolled > 0 ? Math.round((videoWatched / enrolled) * 100) : 0,
      quizPassRate:
        quizAttempted > 0 ? Math.round((quizPassed / quizAttempted) * 100) : 0,
      avgAttempts:
        quizAttempted > 0
          ? Math.round((totalAttempts / quizAttempted) * 10) / 10
          : 0,
      aiInterventionCount: aiSessions_st,
    };
  });

  // ── Per-prerequisite analytics ────────────────────────────────────────────
  const prereqStats = prerequisites.map((pr) => {
    // Prereq-specific attempt data is implied from topicProgress.prereqAttemptCount
    // (per-prereq granularity would need a dedicated collection; use topic-level here)
    const prAISessions = aiSessions.filter(
      (s) => s.contextType === "prereq" && s.subTopicId == null
    ).length;
    return {
      id: pr.id,
      name: pr.name,
      passingThreshold: pr.passingThreshold,
      maxAIAttempts: pr.maxAIAttempts,
      aiSessionCount: prAISessions,
    };
  });

  // ── Struggling students (flagged or stuck on prereq) ─────────────────────
  const flaggedIds = [...flaggedStudentIds].slice(0, 20);
  const stuckOnPrereq = topicProgress
    .filter(
      (p) =>
        p.prereqAttemptCount > 0 &&
        p.prereqStatus !== "passed" &&
        !flaggedStudentIds.has(p.studentId)
    )
    .slice(0, 10);

  const userIdsForStruggling = [
    ...flaggedIds,
    ...stuckOnPrereq.map((p) => p.studentId),
  ];
  const strugglingUsers = await getUsersByIds(userIdsForStruggling);

  const strugglingStudents: { id: string; name: string | null; email: string; status: string }[] =
    [];
  for (const id of flaggedIds) {
    const u = strugglingUsers.get(id);
    if (u) {
      strugglingStudents.push({
        id,
        name: u.name ?? null,
        email: u.email ?? "",
        status: "flagged",
      });
    }
  }
  for (const p of stuckOnPrereq) {
    const u = strugglingUsers.get(p.studentId);
    if (u) {
      strugglingStudents.push({
        id: p.studentId,
        name: u.name ?? null,
        email: u.email ?? "",
        status: "stuck",
      });
    }
  }

  // ── Class info (single doc read, not full collection scan) ────────────────
  const cls = await getClass(topic.classId);

  return Response.json(
    {
      topic: {
        id: topic.id,
        name: topic.name,
        description: topic.description ?? null,
        classId: topic.classId,
        className: cls?.name ?? "",
        finalTestThreshold: topic.finalTestThreshold,
      },
      funnel,
      subtopicStats,
      prereqStats,
      strugglingStudents,
      totalAISessions: aiSessions.length,
    },
    { headers: { "Cache-Control": ADMIN_JSON_CACHE_CONTROL } }
  );
  } catch (e) {
    if (isFirestoreResourceExhausted(e)) {
      console.error("[GET /api/admin/analytics/topic/:id] Firestore quota exceeded", e);
      return Response.json(
        {
          error: "Database quota exceeded. Try again later or upgrade your Firebase plan.",
          code: "firestore_quota",
        },
        { status: 503 }
      );
    }
    throw e;
  }
}
