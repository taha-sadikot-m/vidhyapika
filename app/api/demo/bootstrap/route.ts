import { bootstrapDemoData } from "../../../../backend/services/demoSeed";

export async function POST() {
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
    const demo = await bootstrapDemoData();
    return Response.json({ success: true, demo });
  } catch (e: any) {
    const message = e?.message ?? String(e);
    const hint =
      message.includes("Missing Firebase credentials")
        ? "Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (use \\n for newlines)."
        : undefined;
    return Response.json(
      { error: "Demo bootstrap failed", message, ...(hint ? { hint } : {}) },
      { status: 500 }
    );
  }
}

