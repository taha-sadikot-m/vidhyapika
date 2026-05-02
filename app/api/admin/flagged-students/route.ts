import { verifyJWT, requireAdmin } from "../../../../backend/middleware/auth";
import { listFlaggedStudents } from "../../../../backend/repositories/progressRepo";
import { getUsersByIds } from "../../../../backend/repositories/userRepo";
import { getSubTopicsByIds, getTopicsByIds } from "../../../../backend/repositories/curriculumRepo";
import { isFirestoreResourceExhausted } from "../../../../backend/utils/firestoreErrors";
import { ADMIN_JSON_CACHE_CONTROL } from "../../../../backend/utils/adminApiCache";

const DEFAULT_FLAG_CAP = 250;
const MAX_FLAG_CAP = 500;

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const url = new URL(req.url);
  const includeResolved = url.searchParams.get("includeResolved") === "true";
  const limitRaw = url.searchParams.get("limit");
  const parsedLimit = limitRaw != null ? Number.parseInt(limitRaw, 10) : NaN;
  const flagCap = Number.isFinite(parsedLimit)
    ? Math.min(MAX_FLAG_CAP, Math.max(1, parsedLimit))
    : DEFAULT_FLAG_CAP;

  try {
    const flags = await listFlaggedStudents(!includeResolved, flagCap);

    const studentIds = flags.map((f) => f.studentId);
    const topicIds = flags.map((f) => f.topicId);
    const subTopicIds = flags
      .map((f) => f.subTopicId)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const [usersById, topicsById, subTopicsById] = await Promise.all([
      getUsersByIds(studentIds),
      getTopicsByIds(topicIds),
      getSubTopicsByIds(subTopicIds),
    ]);

    const enriched = flags.map((flag) => {
      const student = usersById.get(flag.studentId);
      const topic = topicsById.get(flag.topicId);
      const subTopic = flag.subTopicId ? subTopicsById.get(flag.subTopicId) : undefined;
      return {
        ...flag,
        studentName: student?.name ?? "Unknown",
        studentEmail: student?.email ?? "",
        topicName: topic?.name ?? "Unknown Topic",
        subTopicName: subTopic?.name ?? null,
      };
    });

    return Response.json(
      {
        flags: enriched,
        truncated: flags.length >= flagCap,
        limit: flagCap,
      },
      { headers: { "Cache-Control": ADMIN_JSON_CACHE_CONTROL } }
    );
  } catch (e) {
    if (isFirestoreResourceExhausted(e)) {
      console.error("[GET /api/admin/flagged-students] Firestore quota exceeded", e);
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
