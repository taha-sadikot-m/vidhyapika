import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { verifyJWT, requireAdmin } from "../../../../../backend/middleware/auth";
import { deleteScheduleEvent, getScheduleEvent, updateScheduleEvent } from "../../../../../backend/repositories/scheduleRepo";

const UpdateSchema = z.object({
  title: z.string().min(1).optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  type: z.enum(["live", "workshop", "exam", "meeting", "other"]).optional(),
  location: z.string().nullable().optional(),
  joinUrl: z.string().url().nullable().optional(),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const existing = await getScheduleEvent(params.id);
  if (!existing) return Response.json({ error: "Schedule event not found" }, { status: 404 });

  const body = UpdateSchema.parse(await req.json());
  await updateScheduleEvent(params.id, {
    ...(body.title !== undefined ? { title: body.title } : {}),
    ...(body.type !== undefined ? { type: body.type } : {}),
    ...(body.location !== undefined ? { location: body.location } : {}),
    ...(body.joinUrl !== undefined ? { joinUrl: body.joinUrl } : {}),
    ...(body.startsAt !== undefined ? { startsAt: Timestamp.fromDate(new Date(body.startsAt)) } : {}),
    ...(body.endsAt !== undefined ? { endsAt: Timestamp.fromDate(new Date(body.endsAt)) } : {}),
  });

  return Response.json({ ok: true }, { status: 200 });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const existing = await getScheduleEvent(params.id);
  if (!existing) return Response.json({ error: "Schedule event not found" }, { status: 404 });

  await deleteScheduleEvent(params.id);
  return Response.json({ ok: true }, { status: 200 });
}

