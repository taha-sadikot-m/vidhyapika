import { verifyJWT, requireAdmin } from "../../../../../backend/middleware/auth";
import {
  getSubTopic,
  updateSubTopic,
  deleteSubTopic,
} from "../../../../../backend/repositories/curriculumRepo";
import { z } from "zod";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  order: z.number().int().optional(),
  youtubeUrl: z.string().url().optional().or(z.literal("")),
  passingThreshold: z.number().min(0).max(100).optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id } = await params;
  const subTopic = await getSubTopic(id);
  if (!subTopic) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ subTopic });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id } = await params;
  try {
    const body = UpdateSchema.parse(await req.json());
    await updateSubTopic(id, body);
    return Response.json({ success: true });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id } = await params;
  await deleteSubTopic(id);
  return Response.json({ success: true });
}
