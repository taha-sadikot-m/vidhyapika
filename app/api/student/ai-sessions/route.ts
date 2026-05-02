export const dynamic = "force-dynamic";

import { verifyJWT, requireAuth } from "../../../../backend/middleware/auth";
import { listAISessionsByStudent } from "../../../../backend/repositories/progressRepo";

function tsToIso(t: unknown): string | null {
  if (t && typeof t === "object" && "toMillis" in t && typeof (t as { toMillis: () => number }).toMillis === "function") {
    try {
      return new Date((t as { toMillis: () => number }).toMillis()).toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAuth(user);
  if (err) return err;

  const url = new URL(req.url);
  const topicId = url.searchParams.get("topicId");
  const contextType = url.searchParams.get("contextType") as "prereq" | "subtopic" | "finaltest" | null;
  const contextId = url.searchParams.get("contextId");

  if (!topicId) {
    return Response.json({ error: "topicId is required" }, { status: 400 });
  }

  const all = await listAISessionsByStudent(user!.sub);
  let rows = all.filter((s) => s.topicId === topicId);
  if (contextType && ["prereq", "subtopic", "finaltest"].includes(contextType)) {
    rows = rows.filter((s) => s.contextType === contextType);
  }
  if (contextId) {
    rows = rows.filter((s) => s.contextId === contextId);
  }

  const detail =
    url.searchParams.get("detail") === "1" || url.searchParams.get("include") === "detail";

  const sessions = rows.map((s) => ({
    id: s.id,
    topicId: s.topicId,
    contextType: s.contextType,
    contextId: s.contextId ?? null,
    subTopicId: s.subTopicId ?? null,
    createdAt: tsToIso(s.createdAt),
    mistakeCount: s.mistakes?.length ?? 0,
    lessonCount: s.lessonCards?.length ?? 0,
    drillCount: s.drills?.length ?? 0,
    status: s.status,
    ...(detail
      ? {
          lessonCards: s.lessonCards ?? [],
          mistakes: s.mistakes ?? [],
          drills: s.drills ?? [],
          messages: s.messages ?? [],
        }
      : {}),
  }));

  return Response.json({ sessions });
}
