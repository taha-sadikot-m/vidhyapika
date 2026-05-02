import { verifyJWT, requireAdmin } from "../../../../../backend/middleware/auth";
import { createQuestionsInBatch, QuestionContextType } from "../../../../../backend/repositories/curriculumRepo";
import { z } from "zod";

const ItemSchema = z.object({
  text: z.string().min(1),
  type: z.enum(["mcq", "true_false", "image_upload", "text"]),
  imageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional().default(null),
  options: z.array(z.string()).nullable().optional().default(null),
  correctAnswer: z.string().nullable().optional().default(null),
  explanation: z.string().optional().default(""),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).optional().default("Medium"),
  order: z.number().int().default(0),
});

const BodySchema = z.object({
  contextType: z.enum(["prereq", "subtopic", "finaltest"]),
  contextId: z.string().min(1),
  items: z.array(z.unknown()).min(1),
});

export async function POST(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const created: { index: number; id: string }[] = [];
  const errors: { index: number; message: string; field?: string }[] = [];

  try {
    const bodyRaw = await req.json();
    const bodyParsed = BodySchema.safeParse(bodyRaw);
    if (!bodyParsed.success) {
      return Response.json({ error: "Validation error", details: bodyParsed.error.issues }, { status: 400 });
    }

    const { contextType, contextId, items } = bodyParsed.data;

    const validForBatch: any[] = [];
    const validIndexMap: number[] = [];

    for (let i = 0; i < items.length; i++) {
      const parsed = ItemSchema.safeParse(items[i]);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        errors.push({ index: i, message: issue?.message ?? "Validation error", field: String(issue?.path?.[0] ?? "") || undefined });
        continue;
      }
      const q = parsed.data;
      validForBatch.push({
        contextType: contextType as QuestionContextType,
        contextId,
        text: q.text,
        type: q.type,
        imageUrl: q.imageUrl || null,
        options: q.options ?? [],
        correctAnswer: q.correctAnswer ?? null,
        explanation: q.explanation ?? "",
        difficulty: q.difficulty ?? "Medium",
        order: q.order ?? 0,
        isAIGenerated: false,
      });
      validIndexMap.push(i);
    }

    if (validForBatch.length > 0) {
      try {
        const ids = await createQuestionsInBatch(validForBatch);
        for (let j = 0; j < ids.length; j++) {
          created.push({ index: validIndexMap[j]!, id: ids[j]! });
        }
      } catch (e: any) {
        // If batch fails, mark all valid rows as failed.
        for (const idx of validIndexMap) {
          errors.push({ index: idx, message: e?.message ?? "Batch create failed" });
        }
      }
    }

    return Response.json({ created, errors });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}

