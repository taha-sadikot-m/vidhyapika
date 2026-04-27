import { z } from "zod";
import { getUserByEmail, setUserPassword } from "../../../backend/repositories/userRepo";
import { hashPassword, verifyPassword } from "../../../backend/services/auth";

const ResetPasswordSchema = z.object({
  email: z.string().email(),
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, oldPassword, newPassword } = ResetPasswordSchema.parse(body);

    const user = await getUserByEmail(email);
    if (!user) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const ok = await verifyPassword(oldPassword, user.password_hash);
    if (!ok) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    await setUserPassword({
      email,
      passwordHash: await hashPassword(newPassword),
      mustResetPassword: false,
    });

    return Response.json({ success: true });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return Response.json({ error: "Validation error", details: e.issues }, { status: 400 });
    }
    console.error("[POST /api/reset-password] error:", e?.message ?? e);
    return Response.json({ error: "Password reset failed" }, { status: 500 });
  }
}
