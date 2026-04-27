import { verifyJWT, requireAuth } from "../../../../backend/middleware/auth";
import { listQuizAttempts } from "../../../../backend/repositories/progressRepo";

function toIso(ts: any): string | null {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate().toISOString();
  return null;
}

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAuth(user);
  if (err) return err;

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 6), 1), 20);

  const attempts = await listQuizAttempts(user!.sub);
  const items = attempts.slice(0, limit).map((a) => {
    const pct = a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
    const label =
      a.contextType === "prereq" ? "Prerequisite Quiz" : a.contextType === "subtopic" ? "Sub-topic Quiz" : "Final Test";
    return {
      id: a.id,
      title: `${label} • ${pct}%`,
      timestamp: toIso(a.timestamp),
      meta: a.passed ? "Passed" : "Attempted",
      context: { type: a.contextType, id: a.contextId },
    };
  });

  return Response.json({ items }, { status: 200 });
}

