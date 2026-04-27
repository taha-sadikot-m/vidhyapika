import { verifyJWT, requireAdmin } from "../../../../../../backend/middleware/auth";
import { getUserById } from "../../../../../../backend/repositories/userRepo";
import {
  listTopicProgressByStudent,
  listSubTopicProgressByStudent,
  listQuizAttempts,
  listAISessionsByStudent,
  listFlagsByStudent,
} from "../../../../../../backend/repositories/progressRepo";
import {
  listTopics,
  listSubTopics,
  getStudentEnrollment,
  getClass,
} from "../../../../../../backend/repositories/curriculumRepo";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id: studentId } = await params;

  const student = await getUserById(studentId);
  if (!student || student.role !== "student") {
    return Response.json({ error: "Student not found" }, { status: 404 });
  }

  const [topicProgress, subTopicProgress, quizAttempts, aiSessions, flags] = await Promise.all([
    listTopicProgressByStudent(studentId),
    listSubTopicProgressByStudent(studentId),
    listQuizAttempts(studentId),
    listAISessionsByStudent(studentId),
    listFlagsByStudent(studentId),
  ]);

  // Get enrollment and class info
  const enrollment = await getStudentEnrollment(studentId);
  let topics: any[] = [];
  if (enrollment) {
    topics = await listTopics(enrollment.classId);
  }

  return Response.json({
    student: { id: student.id, name: student.name, email: student.email },
    enrollment,
    topics,
    topicProgress,
    subTopicProgress,
    quizAttempts,
    aiSessions,
    flags,
  });
}
