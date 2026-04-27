import { verifyJWT, requireAdmin } from "../../../../backend/middleware/auth";
import { listFlaggedStudents } from "../../../../backend/repositories/progressRepo";
import { getUserById } from "../../../../backend/repositories/userRepo";
import { getTopic, getSubTopic } from "../../../../backend/repositories/curriculumRepo";

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const url = new URL(req.url);
  const includeResolved = url.searchParams.get("includeResolved") === "true";

  const flags = await listFlaggedStudents(!includeResolved);

  // Enrich with student and topic names
  const enriched = await Promise.all(
    flags.map(async (flag) => {
      const [student, topic, subTopic] = await Promise.all([
        getUserById(flag.studentId),
        getTopic(flag.topicId),
        flag.subTopicId ? getSubTopic(flag.subTopicId) : Promise.resolve(null),
      ]);
      return {
        ...flag,
        studentName: student?.name ?? "Unknown",
        studentEmail: student?.email ?? "",
        topicName: topic?.name ?? "Unknown Topic",
        subTopicName: subTopic?.name ?? null,
      };
    })
  );

  return Response.json({ flags: enriched });
}
