import type { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { z } from "zod";
import { getUserByEmail, setUserPassword } from "../repositories/userRepo";
import { createAccessToken, hashPassword, verifyPassword } from "../services/auth";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ResetPasswordSchema = z.object({
  email: z.string().email(),
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = LoginSchema.parse(req.body);

    // Optional: allow env-based admin login (no Firestore lookup required).
    // This is useful for bootstrapping the very first admin access.
    const envAdminEmail = process.env.ADMIN_LOGIN_EMAIL || process.env.ADMIN_EMAIL;
    const envAdminPassword = process.env.ADMIN_LOGIN_PASSWORD || process.env.ADMIN_PASSWORD;
    if (envAdminEmail && envAdminPassword && email.toLowerCase() === envAdminEmail.toLowerCase()) {
      if (password !== envAdminPassword) return res.status(401).json({ error: "Invalid credentials" });

      const token = await createAccessToken({
        sub: `env-admin:${envAdminEmail.toLowerCase()}`,
        email: envAdminEmail,
        role: "admin",
        name: "Admin",
      });

      return res.json({
        success: true,
        token,
        user: { email: envAdminEmail, name: "Admin", role: "admin" },
      });
    }

    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    if (user.must_reset_password) {
      return res.json({ success: true, requirePasswordReset: true });
    }

    const token = await createAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    return res.json({
      success: true,
      token,
      user: { email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    next(e);
  }
}

export async function resetPasswordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, oldPassword, newPassword } = ResetPasswordSchema.parse(req.body);
    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await verifyPassword(oldPassword, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    await setUserPassword({
      email,
      passwordHash: await hashPassword(newPassword),
      mustResetPassword: false,
    });

    return res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export function authRoutes() {
  const r = Router();
  r.post("/login", loginHandler);
  r.post("/reset-password", resetPasswordHandler);
  return r;
}

