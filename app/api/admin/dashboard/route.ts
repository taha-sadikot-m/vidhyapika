import { verifyJWT, requireAdmin } from "../../../../backend/middleware/auth";
import { listUsersByRole } from "../../../../backend/repositories/userRepo";
import { listStandards, getAllClasses } from "../../../../backend/repositories/curriculumRepo";
import { getDb } from "../../../../backend/firebase/admin";

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const db = getDb();

  const [students, parents, standards, classes] = await Promise.all([
    listUsersByRole("student"),
    listUsersByRole("parent"),
    listStandards(),
    getAllClasses(),
  ]);

  // Count topics and subtopics
  const [topicsSnap, subTopicsSnap, questionsSnap, aiSessionsSnap, flagsSnap] = await Promise.all([
    db.collection("topics").count().get(),
    db.collection("subTopics").count().get(),
    db.collection("questions").count().get(),
    db.collection("aiSessions").count().get(),
    db.collection("flaggedStudents").where("resolvedAt", "==", null).count().get(),
  ]);

  const totalTopics = topicsSnap.data().count;
  const totalSubTopics = subTopicsSnap.data().count;
  const totalQuestions = questionsSnap.data().count;
  const totalAISessions = aiSessionsSnap.data().count;
  const flaggedCount = flagsSnap.data().count;

  // Video coverage: subtopics with youtubeUrl set
  const subTopicsWithVideoSnap = await db
    .collection("subTopics")
    .where("youtubeUrl", "!=", "")
    .count()
    .get();
  const videoCoverage =
    totalSubTopics > 0
      ? Math.round((subTopicsWithVideoSnap.data().count / totalSubTopics) * 100)
      : 0;

  return Response.json({
    stats: {
      totalStudents: students.length,
      totalParents: parents.length,
      totalStandards: standards.length,
      totalClasses: classes.length,
      totalTopics,
      totalSubTopics,
      totalQuestions,
      totalAISessions,
      flaggedStudents: flaggedCount,
      videoCoverage,
    },
    recentStudents: students.slice(0, 10),
  });
}
