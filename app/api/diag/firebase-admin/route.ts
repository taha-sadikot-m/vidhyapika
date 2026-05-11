import { createHash } from "crypto";
import { getDb } from "../../../../backend/firebase/admin";

function allowed(): boolean {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_DEMO_ENDPOINTS === "true"
  );
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function GET() {
  if (!allowed()) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() ?? "";
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim() ?? "";
  const hasB64 = !!process.env.FIREBASE_PRIVATE_KEY_BASE64?.trim();
  const hasPk = !!process.env.FIREBASE_PRIVATE_KEY?.trim();

  const envSummary = {
    projectIdPresent: !!projectId,
    clientEmailPresent: !!clientEmail,
    privateKeyBase64Present: hasB64,
    privateKeyPresent: hasPk,
    storageBucketPresent: !!process.env.FIREBASE_STORAGE_BUCKET?.trim(),
    nodeEnv: process.env.NODE_ENV ?? null,
  };

  try {
    const db = getDb();
    // Lightweight call to force auth; count avoids fetching docs.
    const snap = await db.collection("users").limit(1).get();
    return Response.json({
      ok: true,
      envSummary,
      clientEmailDomain: clientEmail.includes("@") ? clientEmail.split("@")[1] : null,
      projectIdHash: projectId ? sha256(projectId).slice(0, 12) : null,
      clientEmailHash: clientEmail ? sha256(clientEmail).slice(0, 12) : null,
      firestoreSmoke: { ok: true, docs: snap.size },
    });
  } catch (e: any) {
    const message = e?.message ?? String(e);
    const code = e?.code ?? e?.status ?? e?.errorInfo?.code ?? null;
    return Response.json(
      {
        ok: false,
        envSummary,
        error: "Firebase admin init / Firestore call failed",
        code,
        message,
      },
      { status: 500 }
    );
  }
}

