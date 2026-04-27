import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { getEnv } from "../config/env";

export async function hashPassword(password: string) {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createAccessToken(payload: {
  sub: string;
  email: string;
  role: string;
  name?: string | null;
}) {
  const env = getEnv();
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    email: payload.email,
    role: payload.role,
    name: payload.name ?? undefined,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setSubject(payload.sub)
    .setIssuedAt(now)
    .setExpirationTime("2h")
    .sign(secret);
}

