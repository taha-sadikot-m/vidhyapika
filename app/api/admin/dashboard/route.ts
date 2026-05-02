import { verifyJWT, requireAdmin } from "../../../../backend/middleware/auth";
import {
  countUsersByRole,
  listRecentUsersByRole,
  listUsersByRole,
} from "../../../../backend/repositories/userRepo";
import { getDb } from "../../../../backend/firebase/admin";
import { ADMIN_JSON_CACHE_CONTROL } from "../../../../backend/utils/adminApiCache";

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const db = getDb();

  const [
    totalStudents,
    totalParents,
    standardsCountSnap,
    classesCountSnap,
    topicsCountSnap,
    subTopicsCountSnap,
    questionsCountSnap,
    aiSessionsCountSnap,
    flagsCountSnap,
    subTopicsWithVideoSnap,
  ] = await Promise.all([
    countUsersByRole("student"),
    countUsersByRole("parent"),
    db.collection("standards").count().get(),
    db.collection("classes").count().get(),
    db.collection("topics").count().get(),
    db.collection("subTopics").count().get(),
    db.collection("questions").count().get(),
    db.collection("aiSessions").count().get(),
    db.collection("flaggedStudents").where("resolvedAt", "==", null).count().get(),
    db
      .collection("subTopics")
      .where("youtubeUrl", "!=", "")
      .count()
      .get(),
  ]);

  let recentUserRows;
  try {
    recentUserRows = await listRecentUsersByRole("student", 10);
  } catch (e) {
    console.warn(
      "[admin/dashboard] listRecentUsersByRole failed (add Firestore index: users role+createdAt?). Falling back.",
      e
    );
    const all = await listUsersByRole("student");
    recentUserRows = all.slice(0, 10);
  }

  const totalSubTopics = subTopicsCountSnap.data().count;
  const videoCoverage =
    totalSubTopics > 0
      ? Math.round((subTopicsWithVideoSnap.data().count / totalSubTopics) * 100)
      : 0;

  const recentStudents = recentUserRows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
  }));

  return Response.json(
    {
      stats: {
        totalStudents,
        totalParents,
        totalStandards: standardsCountSnap.data().count,
        totalClasses: classesCountSnap.data().count,
        totalTopics: topicsCountSnap.data().count,
        totalSubTopics,
        totalQuestions: questionsCountSnap.data().count,
        totalAISessions: aiSessionsCountSnap.data().count,
        flaggedStudents: flagsCountSnap.data().count,
        videoCoverage,
      },
      recentStudents,
    },
    {
      headers: { "Cache-Control": ADMIN_JSON_CACHE_CONTROL },
    }
  );
}
