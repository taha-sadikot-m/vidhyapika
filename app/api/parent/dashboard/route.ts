import { verifyJWT, requireRole } from "../../../../backend/middleware/auth";
import { getUserById } from "../../../../backend/repositories/userRepo";
import {
  getClass,
  listTopics,
  listSubTopics,
  getPrerequisite,
  listQuestions,
  getStudentEnrollment,
} from "../../../../backend/repositories/curriculumRepo";
import { getTopicProgress, getSubTopicProgress } from "../../../../backend/repositories/progressRepo";

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireRole(user, "parent");
  if (err) return err;

  const parent = await getUserById(user!.sub);
  if (!parent) return Response.json({ error: "Parent not found" }, { status: 404 });

  const childId = parent.parent_id;
  if (!childId) {
    return Response.json({ child: null, curriculum: null, message: "No child linked to this parent account." });
  }

  const child = await getUserById(childId);
  if (!child) return Response.json({ error: "Child not found" }, { status: 404 });

  const enrollment = await getStudentEnrollment(child.id);
  if (!enrollment) {
    return Response.json({
      child: { id: child.id, name: child.name, email: child.email },
      curriculum: null,
      message: "Child is not enrolled in any class.",
    });
  }

  const cls = await getClass(enrollment.classId);
  if (!cls) return Response.json({ error: "Class not found" }, { status: 404 });

  const topics = await listTopics(enrollment.classId);

  const topicsWithProgress = await Promise.all(
    topics.map(async (topic) => {
      const [topicProgress, prerequisite, subTopics] = await Promise.all([
        getTopicProgress(child.id, topic.id),
        getPrerequisite(topic.id),
        listSubTopics(topic.id),
      ]);

      // For parent dashboard, we don’t need full question sets, only counts
      const prereqQCount = prerequisite ? (await listQuestions("prereq", prerequisite.id)).length : 0;
      const finalQCount = (await listQuestions("finaltest", topic.id)).length;

      const subTopicsWithProgress = await Promise.all(
        subTopics.map(async (st) => {
          const stProgress = await getSubTopicProgress(child.id, st.id);
          const qCount = (await listQuestions("subtopic", st.id)).length;
          return { ...st, progress: stProgress, questionCount: qCount };
        })
      );

      const subDone = subTopicsWithProgress.filter((st: any) => st.progress?.quizStatus === "passed").length;

      return {
        ...topic,
        progress: topicProgress,
        prerequisite: prerequisite ? { ...prerequisite, questionCount: prereqQCount } : null,
        finalTestQuestionCount: finalQCount,
        subTopics: subTopicsWithProgress,
        subtopicsCompleted: subDone,
        totalSubtopics: subTopicsWithProgress.length,
      };
    })
  );

  const completedTopics = topicsWithProgress.filter((t: any) => t.progress?.completedAt).length;
  const overallProgress = topicsWithProgress.length > 0
    ? Math.round((completedTopics / topicsWithProgress.length) * 100)
    : 0;

  return Response.json({
    child: { id: child.id, name: child.name, email: child.email },
    curriculum: {
      classId: cls.id,
      className: cls.name,
      passingThreshold: cls.passingThreshold,
      overallProgress,
      completedTopics,
      totalTopics: topicsWithProgress.length,
      topics: topicsWithProgress,
    },
  });
}

