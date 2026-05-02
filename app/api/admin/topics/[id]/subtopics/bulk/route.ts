import { verifyJWT, requireAdmin } from "../../../../../../../backend/middleware/auth";
import { createSubTopic } from "../../../../../../../backend/repositories/curriculumRepo";
import { z } from "zod";

const ItemSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().nonnegative().default(0),
  youtubeUrl: z.string().url().optional().or(z.literal("")).default(""),
  passingThreshold: z.number().min(0).max(100).default(60),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const { id: topicId } = await params;

  const created: { index: number; id: string }[] = [];
  const errors: { index: number; message: string; field?: string }[] = [];

  try {
    const body = (await req.json()) as any;
    const items: unknown[] = Array.isArray(body?.items) ? body.items : [];
    if (!items.length) return Response.json({ created, errors: [{ index: 0, message: "No items provided." }] }, { status: 400 });

    for (let i = 0; i < items.length; i++) {
      const parsed = ItemSchema.safeParse(items[i]);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        errors.push({ index: i, message: issue?.message ?? "Validation error", field: String(issue?.path?.[0] ?? "") || undefined });
        continue;
      }
      try {
        const id = await createSubTopic({
          topicId,
          name: parsed.data.name,
          order: parsed.data.order,
          youtubeUrl: parsed.data.youtubeUrl || "",
          passingThreshold: parsed.data.passingThreshold,
        } as any);
        created.push({ index: i, id });
      } catch (e: any) {
        errors.push({ index: i, message: e?.message ?? "Failed to create sub-topic" });
      }
    }

    return Response.json({ created, errors });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

