import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { verifyJWT, requireAdmin } from "../../../../backend/middleware/auth";
import { createScheduleEvent, listScheduleEventsByClass } from "../../../../backend/repositories/scheduleRepo";
import { getClass } from "../../../../backend/repositories/curriculumRepo";

const CreateSchema = z.object({
  classId: z.string().min(1),
  title: z.string().min(1),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  type: z.enum(["live", "workshop", "exam", "meeting", "other"]).default("live"),
  location: z.string().nullable().optional().default(null),
  joinUrl: z.string().url().nullable().optional().default(null),
});

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const url = new URL(req.url);
  const classId = url.searchParams.get("classId");
  if (!classId) return Response.json({ error: "classId is required" }, { status: 400 });

  const cls = await getClass(classId);
  if (!cls) return Response.json({ error: "Class not found" }, { status: 404 });

  const events = await listScheduleEventsByClass(classId);
  return Response.json({ class: { id: cls.id, name: cls.name }, events }, { status: 200 });
}

export async function POST(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const body = CreateSchema.parse(await req.json());
  const cls = await getClass(body.classId);
  if (!cls) return Response.json({ error: "Class not found" }, { status: 404 });

  const id = await createScheduleEvent({
    classId: body.classId,
    title: body.title,
    startsAt: Timestamp.fromDate(new Date(body.startsAt)),
    endsAt: Timestamp.fromDate(new Date(body.endsAt)),
    type: body.type,
    location: body.location,
    joinUrl: body.joinUrl,
  });

  return Response.json({ id }, { status: 201 });
}

