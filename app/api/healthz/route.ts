import { getEnv } from "../../../backend/config/env";
import { getDb } from "../../../backend/firebase/admin";

export async function GET() {
  const out: any = { ok: true };

  // Validate env shape (does not leak secrets)
  try {
    const env = getEnv();
    out.env = {
      ok: true,
      firebaseProjectId: env.FIREBASE_PROJECT_ID,
      hasStorageBucket: !!env.FIREBASE_STORAGE_BUCKET,
      hasSmtp: !!(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS),
      hasGeminiKey: !!env.GEMINI_API_KEY,
    };
  } catch (e: any) {
    out.ok = false;
    out.env = { ok: false, error: e?.message ?? String(e) };
  }

  // Firebase ping (lightweight)
  try {
    const db = getDb();
    await db.collection("users").limit(1).get();
    out.firebase = { ok: true };
  } catch (e: any) {
    out.ok = false;
    out.firebase = {
      ok: false,
      code: e?.code ?? e?.status ?? e?.errorInfo?.code,
      error: e?.message ?? String(e),
    };
  }

  return Response.json(out, { status: out.ok ? 200 : 500 });
}

