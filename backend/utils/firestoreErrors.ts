/**
 * Detect Firestore / gRPC quota exhaustion (Spark plan daily limits, burst limits, etc.).
 */
export function isFirestoreResourceExhausted(err: unknown): boolean {
  const e = err as {
    code?: number | string;
    message?: string;
    status?: string;
    errorInfo?: { code?: string };
  };
  if (e?.code === 8) return true;
  if (e?.code === "RESOURCE_EXHAUSTED" || e?.status === "RESOURCE_EXHAUSTED") return true;
  if (e?.errorInfo?.code === "RESOURCE_EXHAUSTED") return true;
  const m = String(e?.message ?? err);
  return m.includes("RESOURCE_EXHAUSTED") || m.includes("Quota exceeded");
}
