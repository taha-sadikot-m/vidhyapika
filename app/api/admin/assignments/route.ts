import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { verifyJWT, requireAdmin } from "../../../../backend/middleware/auth";
import { createAssignment, listAssignmentsByClass } from "../../../../backend/repositories/assignmentsRepo";
import { getClass } from "../../../../backend/repositories/curriculumRepo";

const CreateSchema = z.object({
  classId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().nullable().optional().default(null),
  dueAt: z.string().datetime().nullable().optional().default(null),
  type: z.enum(["practice", "homework", "project", "quiz"]).default("practice"),
  status: z.enum(["draft", "published", "archived"]).default("published"),
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

  const items = await listAssignmentsByClass(classId);
  return Response.json({ class: { id: cls.id, name: cls.name }, assignments: items }, { status: 200 });
}

export async function POST(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const body = CreateSchema.parse(await req.json());
  const cls = await getClass(body.classId);
  if (!cls) return Response.json({ error: "Class not found" }, { status: 404 });

  const dueAtTs = body.dueAt ? Timestamp.fromDate(new Date(body.dueAt)) : null;
  const id = await createAssignment({
    classId: body.classId,
    title: body.title,
    description: body.description ?? null,
    dueAt: dueAtTs,
    type: body.type,
    status: body.status,
  });
  return Response.json({ id }, { status: 201 });
}

