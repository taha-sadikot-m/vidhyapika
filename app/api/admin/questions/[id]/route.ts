import { verifyJWT, requireAdmin } from "../../../../../backend/middleware/auth";
import {
  getQuestion,
  updateQuestion,
  deleteQuestion,
} from "../../../../../backend/repositories/curriculumRepo";
import { z } from "zod";

const UpdateSchema = z.object({
  text: z.string().min(1).optional(),
  type: z.enum(["mcq", "true_false", "image_upload", "text"]).optional(),
  imageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  options: z.array(z.string()).nullable().optional(),
  correctAnswer: z.string().nullable().optional(),
  order: z.number().int().optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id } = await params;
  const question = await getQuestion(id);
  if (!question) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ question });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id } = await params;
  try {
    const body = UpdateSchema.parse(await req.json());
    await updateQuestion(id, body as any);
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
  await deleteQuestion(id);
  return Response.json({ success: true });
}
