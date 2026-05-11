import { z } from "zod";
import { createDemoSession } from "../../../../backend/services/demoSeed";

const BodySchema = z.object({
  role: z.enum(["admin", "student"]),
});

export async function POST(req: Request) {
  const allowed =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_DEMO_ENDPOINTS === "true";
  if (!allowed) {
    return Response.json(
      { error: "Demo endpoints are disabled in production." },
      { status: 403 }
    );
  }

  try {
    const body = BodySchema.parse(await req.json().catch(() => ({})));
    const result = await createDemoSession(body.role);
    if (result.deny) return result.deny;
    return Response.json({
      success: true,
      token: result.token,
      user: result.user,
      demo: result.demo,
    });
  } catch (e: any) {
    if (e?.name === "ZodError") {
      return Response.json({ error: "role is required" }, { status: 400 });
    }
    const message = e?.message ?? String(e);
    const hint =
      message.includes("Missing Firebase credentials")
        ? "Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (use \\n for newlines)."
        : undefined;
    return Response.json(
      { error: "Demo session failed", message, ...(hint ? { hint } : {}) },
      { status: 500 }
    );
  }
}

