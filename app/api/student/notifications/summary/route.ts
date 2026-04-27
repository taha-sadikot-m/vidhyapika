import { verifyJWT, requireAuth } from "../../../../../backend/middleware/auth";
import { getStudentEnrollment } from "../../../../../backend/repositories/curriculumRepo";
import { listAssignmentsByClass } from "../../../../../backend/repositories/assignmentsRepo";
import { listScheduleEventsByClass } from "../../../../../backend/repositories/scheduleRepo";

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAuth(user);
  if (err) return err;

  const enrollment = await getStudentEnrollment(user!.sub);
  if (!enrollment) return Response.json({ unreadCount: 0 }, { status: 200 });

  const now = Date.now();
  const in48h = now + 48 * 60 * 60 * 1000;

  const [assignments, events] = await Promise.all([
    listAssignmentsByClass(enrollment.classId),
    listScheduleEventsByClass(enrollment.classId),
  ]);

  const upcomingAssignments = assignments.filter((a) => {
    const due = (a.dueAt as any)?.toMillis?.();
    return typeof due === "number" && due >= now && due <= in48h;
  }).length;

  const upcomingEvents = events.filter((e) => {
    const s = (e.startsAt as any)?.toMillis?.();
    return typeof s === "number" && s >= now && s <= in48h;
  }).length;

  // For MVP: count “upcoming within 48h” as unread.
  return Response.json({ unreadCount: upcomingAssignments + upcomingEvents }, { status: 200 });
}

