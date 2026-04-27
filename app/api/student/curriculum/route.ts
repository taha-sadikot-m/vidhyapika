export const dynamic = 'force-dynamic';

import { verifyJWT, requireAuth } from "../../../../backend/middleware/auth";
import { getUserById } from "../../../../backend/repositories/userRepo";
import {
  getClass,
  listTopics,
  listSubTopics,
  getPrerequisite,
  listQuestions,
  getStudentEnrollment,
  getStudentEnrollments,
  enrollStudent,
} from "../../../../backend/repositories/curriculumRepo";
import {
  getTopicProgress,
  getSubTopicProgress,
} from "../../../../backend/repositories/progressRepo";

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAuth(user);
  if (err) return err;

  const student = await getUserById(user!.sub);
  if (!student) return Response.json({ error: "Student not found" }, { status: 404 });

  // Find enrollments
  let enrollments = await getStudentEnrollments(student.id);
  console.log(`[curriculum API] student.id: ${student.id}, enrollments found:`, enrollments);

  // Self-heal: if legacy data set users.classId but missed classEnrollments, create it now.
  if (enrollments.length === 0 && student.class_id) {
    console.log(`[curriculum API] Self-healing for student ${student.id} with class ${student.class_id}`);
    await enrollStudent(student.class_id, student.id);
    enrollments = await getStudentEnrollments(student.id);
  }
  if (enrollments.length === 0) {
    console.log(`[curriculum API] Still 0 enrollments for ${student.id}, returning empty.`);
    return Response.json({ curriculums: [], message: "Not enrolled in any class" });
  }

  const curriculums = await Promise.all(enrollments.map(async (enrollment) => {
    const cls = await getClass(enrollment.classId);
    if (!cls) return null;

    const topics = await listTopics(enrollment.classId);

    // Build full curriculum tree with progress
    const topicsWithProgress = await Promise.all(
      topics.map(async (topic) => {
        const [topicProgress, prerequisite, subTopics] = await Promise.all([
          getTopicProgress(student.id, topic.id),
          getPrerequisite(topic.id),
          listSubTopics(topic.id),
        ]);

        const prereqQuestions = prerequisite
          ? await listQuestions("prereq", prerequisite.id)
          : [];

        const finalTestQuestions = await listQuestions("finaltest", topic.id);

        const subTopicsWithProgress = await Promise.all(
          subTopics.map(async (st) => {
            const stProgress = await getSubTopicProgress(student.id, st.id);
            const stQuestions = await listQuestions("subtopic", st.id);
            return {
              ...st,
              progress: stProgress,
              questions: stQuestions,
            };
          })
        );

        return {
          ...topic,
          progress: topicProgress,
          prerequisite: prerequisite
            ? { ...prerequisite, questions: prereqQuestions }
            : null,
          finalTestQuestions,
          subTopics: subTopicsWithProgress,
        };
      })
    );

    return {
      classId: cls.id,
      className: cls.name,
      passingThreshold: cls.passingThreshold,
      topics: topicsWithProgress,
    };
  }));

  return Response.json({
    curriculums: curriculums.filter(Boolean),
  });
}
