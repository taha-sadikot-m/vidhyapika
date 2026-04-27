import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { verifyJWT, requireAdmin } from "../../../../../backend/middleware/auth";
import { deleteAssignment, getAssignment, updateAssignment } from "../../../../../backend/repositories/assignmentsRepo";

const UpdateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dueAt: z.string().datetime().nullable().optional(),
  type: z.enum(["practice", "homework", "project", "quiz"]).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const existing = await getAssignment(params.id);
  if (!existing) return Response.json({ error: "Assignment not found" }, { status: 404 });

  const body = UpdateSchema.parse(await req.json());
  await updateAssignment(params.id, {
    ...(body.title !== undefined ? { title: body.title } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.type !== undefined ? { type: body.type } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.dueAt !== undefined ? { dueAt: body.dueAt ? Timestamp.fromDate(new Date(body.dueAt)) : null } : {}),
  });

  return Response.json({ ok: true }, { status: 200 });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const existing = await getAssignment(params.id);
  if (!existing) return Response.json({ error: "Assignment not found" }, { status: 404 });

  await deleteAssignment(params.id);
  return Response.json({ ok: true }, { status: 200 });
}

