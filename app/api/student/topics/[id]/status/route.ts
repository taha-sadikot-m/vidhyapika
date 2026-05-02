import { verifyJWT, requireAuth } from "../../../../../../backend/middleware/auth";
import {
  getTopic,
  listPrerequisites,
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

  const [topic, topicProgress, prerequisites, subTopics] = await Promise.all([
    getTopic(topicId),
    getTopicProgress(studentId, topicId),
    listPrerequisites(topicId),
    listSubTopics(topicId),
  ]);

  if (!topic) return Response.json({ error: "Not found" }, { status: 404 });

  const prerequisite = prerequisites[0] ?? null;

  const [subTopicProgress, prereqQuizAttempts, finalTestAttempts] = await Promise.all([
    listSubTopicProgressByStudent(studentId, topicId),
    Promise.all(
      prerequisites.map(async (p) => ({
        prerequisiteId: p.id,
        prerequisiteName: p.name,
        attempts: await listQuizAttempts(studentId, "prereq", p.id),
      }))
    ),
    listQuizAttempts(studentId, "finaltest", topicId),
  ]);

  const subtopicQuizAttempts = await Promise.all(
    subTopics.map(async (st) => ({
      subTopicId: st.id,
      subTopicName: st.name,
      attempts: await listQuizAttempts(studentId, "subtopic", st.id),
    }))
  );

  return Response.json({
    topic,
    progress: topicProgress,
    prerequisite,
    prerequisites,
    subTopics,
    subTopicProgress,
    prereqQuizAttempts,
    finalTestAttempts,
    subtopicQuizAttempts,
  });
}
