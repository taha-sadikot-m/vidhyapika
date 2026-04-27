import { verifyJWT, requireAdmin } from "../../../../backend/middleware/auth";
import {
  listStandards,
  createStandard,
} from "../../../../backend/repositories/curriculumRepo";
import { z } from "zod";

const CreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  order: z.number().int().default(0),
});

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const standards = await listStandards();
  return Response.json({ standards });
}

export async function POST(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  try {
    const body = CreateSchema.parse(await req.json());
    const id = await createStandard(body);
    return Response.json({ id }, { status: 201 });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
