import { jwtVerify } from "jose";

export type JWTPayload = {
  sub: string;
  email: string;
  role: string;
  name?: string;
};

export async function verifyJWT(authHeader: string | null): Promise<JWTPayload | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);

  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: process.env.JWT_ISSUER || "vidhyapika",
      audience: process.env.JWT_AUDIENCE || "vidhyapika-web",
    });

    return {
      sub: payload.sub as string,
      email: payload["email"] as string,
      role: payload["role"] as string,
      name: payload["name"] as string | undefined,
    };
  } catch {
    return null;
  }
}

export function requireAuth(
  user: JWTPayload | null
): Response | null {
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function requireAdmin(
  user: JWTPayload | null
): Response | null {
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export function requireRole(
  user: JWTPayload | null,
  ...roles: string[]
): Response | null {
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!roles.includes(user.role)) return Response.json({ error: "Forbidden" }, { status: 403 });
  return null;
}
