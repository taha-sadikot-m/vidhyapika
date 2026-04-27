import { verifyJWT, requireAuth } from "../../../../backend/middleware/auth";
import { getStudentEnrollment, getClass } from "../../../../backend/repositories/curriculumRepo";
import { listAssignmentsByClass, getOrCreateSubmission } from "../../../../backend/repositories/assignmentsRepo";

function toIso(ts: any): string | null {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate().toISOString();
  return null;
}

export async function GET(req: Request) {
  const user = await verifyJWT(req.headers.get("authorization"));
  const err = requireAuth(user);
  if (err) return err;

  const enrollment = await getStudentEnrollment(user!.sub);
  if (!enrollment) return Response.json({ assignments: [], class: null }, { status: 200 });

  const cls = await getClass(enrollment.classId);
  const assignments = await listAssignmentsByClass(enrollment.classId);

  const enriched = await Promise.all(
    assignments.map(async (a) => {
      const sub = await getOrCreateSubmission(a.id, user!.sub);
      return {
        ...a,
        dueAt: toIso(a.dueAt),
        createdAt: toIso((a as any).createdAt),
        updatedAt: toIso((a as any).updatedAt),
        submission: {
          id: sub.id,
          status: sub.status,
          submittedAt: toIso(sub.submittedAt),
          score: sub.score ?? null,
          feedback: sub.feedback ?? null,
        },
      };
    })
  );

  return Response.json({
    class: cls ? { id: cls.id, name: cls.name } : { id: enrollment.classId, name: "" },
    assignments: enriched,
  });
}

