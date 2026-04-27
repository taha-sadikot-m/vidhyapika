import { verifyJWT, requireAuth } from "../../../../../../backend/middleware/auth";
import {
  getTopic,
  getPrerequisite,
  listSubTopics,
} from "../../../../../../backend/repositories/curriculumRepo";
import {
  getTopicProgress,
  listSubTopicProgressByStudent,
  listQuizAttempts,
} from "../../../../../../backend/repositories/progressRepo";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAuth(user);
  if (err) return err;

  const { id: topicId } = await params;
  const studentId = user!.sub;

  const [topic, topicProgress, prerequisite, subTopics] = await Promise.all([
    getTopic(topicId),
    getTopicProgress(studentId, topicId),
    getPrerequisite(topicId),
    listSubTopics(topicId),
  ]);

  if (!topic) return Response.json({ error: "Not found" }, { status: 404 });

  const [subTopicProgress, prereqAttempts, finalTestAttempts] = await Promise.all([
    listSubTopicProgressByStudent(studentId, topicId),
    prerequisite ? listQuizAttempts(studentId, "prereq", prerequisite.id) : Promise.resolve([]),
    listQuizAttempts(studentId, "finaltest", topicId),
  ]);

  return Response.json({
    topic,
    progress: topicProgress,
    prerequisite,
    subTopics,
    subTopicProgress,
    prereqAttempts,
    finalTestAttempts,
  });
}
