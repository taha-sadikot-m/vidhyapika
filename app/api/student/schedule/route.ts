import { Timestamp } from "firebase-admin/firestore";
import { verifyJWT, requireAuth } from "../../../../backend/middleware/auth";
import { getStudentEnrollment } from "../../../../backend/repositories/curriculumRepo";
import { listScheduleEventsByClass } from "../../../../backend/repositories/scheduleRepo";

function toIso(ts: any): string | null {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate().toISOString();
  return null;
}

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAuth(user);
  if (err) return err;

  const enrollment = await getStudentEnrollment(user!.sub);
  if (!enrollment) return Response.json({ events: [] }, { status: 200 });

  const url = new URL(req.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  let range: { start: FirebaseFirestore.Timestamp; end: FirebaseFirestore.Timestamp } | undefined;
  if (start && end) {
    const s = new Date(`${start}T00:00:00.000Z`);
    const e = new Date(`${end}T23:59:59.999Z`);
    range = { start: Timestamp.fromDate(s), end: Timestamp.fromDate(e) };
  }

  const events = await listScheduleEventsByClass(enrollment.classId, range);
  return Response.json(
    {
      events: events.map((e) => ({
        ...e,
        startsAt: toIso(e.startsAt),
        endsAt: toIso(e.endsAt),
        createdAt: toIso((e as any).createdAt),
        updatedAt: toIso((e as any).updatedAt),
      })),
    },
    { status: 200 }
  );
}

