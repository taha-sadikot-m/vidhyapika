import { verifyJWT, requireAdmin } from "../../../../backend/middleware/auth";
import {
  createQuestion,
  listQuestions,
  QuestionContextType,
} from "../../../../backend/repositories/curriculumRepo";
import { z } from "zod";

const CreateSchema = z.object({
  contextType: z.enum(["prereq", "subtopic", "finaltest"]),
  contextId: z.string().min(1),
  text: z.string().min(1),
  type: z.enum(["mcq", "true_false", "image_upload", "text"]),
  imageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional().default(null),
  options: z.array(z.string()).nullable().optional().default(null),
  correctAnswer: z.string().nullable().optional().default(null),
  order: z.number().int().default(0),
});

const ListSchema = z.object({
  contextType: z.enum(["prereq", "subtopic", "finaltest"]),
  contextId: z.string().min(1),
});

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const url = new URL(req.url);
  try {
    const { contextType, contextId } = ListSchema.parse({
      contextType: url.searchParams.get("contextType"),
      contextId: url.searchParams.get("contextId"),
    });
    const questions = await listQuestions(contextType as QuestionContextType, contextId);
    return Response.json({ questions });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  try {
    const body = CreateSchema.parse(await req.json());
    const id = await createQuestion({
      contextType: body.contextType as QuestionContextType,
      contextId: body.contextId,
      text: body.text,
      type: body.type,
      imageUrl: body.imageUrl || null,
      options: body.options ?? [],
      correctAnswer: body.correctAnswer ?? null,
      order: body.order,
      isAIGenerated: false,
    } as any);
    return Response.json({ id }, { status: 201 });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
