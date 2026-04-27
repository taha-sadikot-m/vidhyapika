import { verifyJWT, requireAdmin } from "../../../../backend/middleware/auth";
import { listUsersByRole, createUser } from "../../../../backend/repositories/userRepo";
import { hashPassword } from "../../../../backend/services/auth";
import { z } from "zod";

const CreateParentSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  studentId: z.string().optional(),
});

function generateTempPassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  const parents = await listUsersByRole("parent");
  return Response.json({ parents });
}

export async function POST(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAdmin(user);
  if (err) return err;

  try {
    const body = CreateParentSchema.parse(await req.json());
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const id = await createUser({
      email: body.email,
      name: body.name,
      role: "parent",
      passwordHash,
      mustResetPassword: true,
      parentId: body.studentId ?? null,
    });

    return Response.json({ id, tempPassword }, { status: 201 });
  } catch (e: any) {
    if (e?.name === "ZodError") return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    return Response.json({ error: e.message }, { status: 500 });
  }
}
