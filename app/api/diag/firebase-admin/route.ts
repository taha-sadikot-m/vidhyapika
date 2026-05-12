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

  let firebaseKeyDecode: {
    decodeOk: boolean;
    pemHasBegin: boolean;
    pemHasEnd: boolean;
    length: number;
    sha256Prefix: string | null;
  } = {
    decodeOk: false,
    pemHasBegin: false,
    pemHasEnd: false,
    length: 0,
    sha256Prefix: null,
  };

  const b64Env = process.env.FIREBASE_PRIVATE_KEY_BASE64;
  if (hasB64 && b64Env && !b64Env.includes("undefined")) {
    try {
      const b64 = b64Env.trim().replace(/\s+/g, "");
      const decoded = Buffer.from(b64, "base64").toString("utf8");
      const norm = decoded
        .trim()
        .replace(/^['"]/, "")
        .replace(/['"]$/, "")
        .replace(/\\n/g, "\n");
      firebaseKeyDecode = {
        decodeOk: true,
        pemHasBegin:
          norm.includes("BEGIN PRIVATE KEY") || norm.includes("BEGIN RSA PRIVATE KEY"),
        pemHasEnd: norm.includes("END PRIVATE KEY") || norm.includes("END RSA PRIVATE KEY"),
        length: norm.length,
        sha256Prefix: sha256(norm).slice(0, 12),
      };
    } catch {
      // keep defaults
    }
  }

  const pemFromEnv = process.env.FIREBASE_PRIVATE_KEY?.trim()
    ? true
    : false;
  const activeKeySource =
    pemFromEnv ? "FIREBASE_PRIVATE_KEY" : hasB64 ? "FIREBASE_PRIVATE_KEY_BASE64" : "none";

  const envSummary = {
    projectIdPresent: !!projectId,
    clientEmailPresent: !!clientEmail,
    privateKeyBase64Present: hasB64,
    privateKeyPresent: hasPk,
    activeKeySource,
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
      firebaseKeyDecode,
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
        firebaseKeyDecode,
        error: "Firebase admin init / Firestore call failed",
        code,
        message,
      },
      { status: 500 }
    );
  }
}

