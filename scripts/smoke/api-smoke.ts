import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

type Json = any;

type SmokeCtx = {
  baseUrl: string;
  adminEmail: string;
  adminPassword: string;
  adminToken: string;
  studentEmail?: string;
  studentPassword?: string;
  studentToken?: string;
  ids: {
    standardId?: string;
    classId?: string;
    topicId?: string;
    prereqId?: string;
    subTopicId?: string;
    studentId?: string;
    parentId?: string;
    questionIds: string[];
  };
};

function nowId() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`;
}

async function httpJson<T = Json>(url: string, init: RequestInit = {}): Promise<{ status: number; data: T }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function httpForm<T = Json>(url: string, form: FormData, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    method: init.method ?? "POST",
    body: form,
    headers: {
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

function must(status: number, expected: number | number[], label: string, data: any) {
  const ok = Array.isArray(expected) ? expected.includes(status) : status === expected;
  if (!ok) {
    const exp = Array.isArray(expected) ? expected.join(",") : String(expected);
    throw new Error(`${label} failed: expected ${exp}, got ${status}. Response: ${JSON.stringify(data)}`);
  }
}

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function cleanupBestEffort(ctx: SmokeCtx) {
  const { baseUrl } = ctx;
  const adminHeaders = ctx.adminToken ? authHeader(ctx.adminToken) : {};

  // Delete questions first
  for (const qid of [...ctx.ids.questionIds].reverse()) {
    try {
      const r = await httpJson(`${baseUrl}/api/admin/questions/${qid}`, { method: "DELETE", headers: adminHeaders });
      // ignore failures
      void r;
    } catch {}
  }

  const del = async (path?: string) => {
    if (!path) return;
    try {
      await httpJson(`${baseUrl}${path}`, { method: "DELETE", headers: adminHeaders });
    } catch {}
  };

  await del(ctx.ids.subTopicId ? `/api/admin/subtopics/${ctx.ids.subTopicId}` : undefined);
  await del(ctx.ids.topicId ? `/api/admin/topics/${ctx.ids.topicId}` : undefined);
  await del(ctx.ids.classId ? `/api/admin/classes/${ctx.ids.classId}` : undefined);
  await del(ctx.ids.standardId ? `/api/admin/standards/${ctx.ids.standardId}` : undefined);

  // Users cleanup
  await del(ctx.ids.studentId ? `/api/admin/students/${ctx.ids.studentId}` : undefined);
  if (ctx.ids.parentId) {
    // NOTE: there is no /api/admin/parents/[id] DELETE route; parent is stored as a user.
    // If you add a delete route later, plug it in here.
  }
}

async function main() {
  const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";
  const adminEmail = process.env.ADMIN_LOGIN_EMAIL ?? process.env.ADMIN_EMAIL ?? "";
  const adminPassword = process.env.ADMIN_LOGIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "Missing admin credentials in environment (.env.local). Set ADMIN_LOGIN_EMAIL + ADMIN_LOGIN_PASSWORD (preferred) or ADMIN_EMAIL + ADMIN_PASSWORD (legacy)."
    );
  }

  const runId = nowId();
  const ctx: SmokeCtx = {
    baseUrl,
    adminEmail,
    adminPassword,
    adminToken: "",
    ids: { questionIds: [] },
  };

  const steps: { name: string; fn: () => Promise<void> }[] = [];

  steps.push({
    name: "healthz",
    fn: async () => {
      const r = await httpJson(`${baseUrl}/api/healthz`);
      must(r.status, [200, 500], "GET /api/healthz", r.data);
      if (r.status !== 200) {
        throw new Error(`healthz not ok: ${JSON.stringify(r.data)}`);
      }
    },
  });

  steps.push({
    name: "admin_login",
    fn: async () => {
      const r = await httpJson<{ token?: string; user?: any; error?: string }>(`${baseUrl}/api/login`, {
        method: "POST",
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      must(r.status, 200, "POST /api/login (admin)", r.data);
      if (!r.data?.token) throw new Error(`No token from admin login: ${JSON.stringify(r.data)}`);
      ctx.adminToken = r.data.token;
    },
  });

  steps.push({
    name: "create_curriculum",
    fn: async () => {
      const h = authHeader(ctx.adminToken);

      const std = await httpJson<{ standard: any }>(`${baseUrl}/api/admin/standards`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ name: `SmokeStd-${runId}`, description: "smoke", order: 999 }),
      });
      must(std.status, 201, "POST /api/admin/standards", std.data);
      ctx.ids.standardId = (std.data as any).id ?? (std.data as any).standard?.id;
      if (!ctx.ids.standardId) throw new Error(`No standard id: ${JSON.stringify(std.data)}`);

      const cls = await httpJson(`${baseUrl}/api/admin/standards/${ctx.ids.standardId}/classes`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ name: `SmokeClass-${runId}`, passingThreshold: 60 }),
      });
      must(cls.status, 201, "POST /api/admin/standards/[id]/classes", cls.data);
      ctx.ids.classId = (cls.data as any).id;

      const topic = await httpJson(`${baseUrl}/api/admin/classes/${ctx.ids.classId}/topics`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ name: `SmokeTopic-${runId}`, description: "smoke", order: 1, finalTestThreshold: 60 }),
      });
      must(topic.status, 201, "POST /api/admin/classes/[id]/topics", topic.data);
      ctx.ids.topicId = (topic.data as any).id;

      const prereq = await httpJson(`${baseUrl}/api/admin/topics/${ctx.ids.topicId}/prerequisite`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ name: `Prereq-${runId}`, description: "smoke", passingThreshold: 60 }),
      });
      must(prereq.status, 200, "POST /api/admin/topics/[id]/prerequisite", prereq.data);
      ctx.ids.prereqId = (prereq.data as any).prerequisite?.id ?? (prereq.data as any).id;

      const sub = await httpJson(`${baseUrl}/api/admin/topics/${ctx.ids.topicId}/subtopics`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          name: `SubTopic-${runId}`,
          order: 1,
          youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          passingThreshold: 60,
        }),
      });
      must(sub.status, 201, "POST /api/admin/topics/[id]/subtopics", sub.data);
      ctx.ids.subTopicId = (sub.data as any).id;
    },
  });

  steps.push({
    name: "create_questions",
    fn: async () => {
      const h = authHeader(ctx.adminToken);
      if (!ctx.ids.prereqId || !ctx.ids.subTopicId || !ctx.ids.topicId) throw new Error("Missing ids for questions");

      const mk = async (contextType: string, contextId: string, text: string, correctAnswer: string) => {
        const r = await httpJson(`${baseUrl}/api/admin/questions`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({
            contextType,
            contextId,
            text,
            type: "mcq",
            options: ["A", correctAnswer, "C"],
            correctAnswer,
            order: 1,
          }),
        });
        must(r.status, 201, "POST /api/admin/questions", r.data);
        const id = (r.data as any).id;
        if (id) ctx.ids.questionIds.push(id);
      };

      await mk("prereq", ctx.ids.prereqId, "Smoke prereq question: 2+2=?", "4");
      await mk("subtopic", ctx.ids.subTopicId, "Smoke subtopic question: 3+3=?", "6");
      await mk("finaltest", ctx.ids.topicId, "Smoke finaltest question: 5+5=?", "10");
    },
  });

  steps.push({
    name: "create_student",
    fn: async () => {
      const h = authHeader(ctx.adminToken);
      const studentEmail = `smoke-student-${runId}@example.com`;
      const r = await httpJson(`${baseUrl}/api/admin/students`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          name: "Smoke Student",
          email: studentEmail,
          parentName: "Smoke Parent",
          parentEmail: `smoke-parent-${runId}@example.com`,
          classId: ctx.ids.classId,
          className: "SmokeClass",
          sendEmail: false,
        }),
      });
      must(r.status, 201, "POST /api/admin/students", r.data);
      ctx.ids.studentId = (r.data as any).id;
      ctx.ids.parentId = (r.data as any).parentId ?? undefined;
      ctx.studentEmail = studentEmail;
      ctx.studentPassword = (r.data as any).tempPassword;
      if (!ctx.studentPassword) throw new Error("No tempPassword returned from student create");
    },
  });

  steps.push({
    name: "student_login",
    fn: async () => {
      const r = await httpJson(`${baseUrl}/api/login`, {
        method: "POST",
        body: JSON.stringify({ email: ctx.studentEmail, password: ctx.studentPassword }),
      });
      must(r.status, 200, "POST /api/login (student)", r.data);
      ctx.studentToken = (r.data as any).token;
      if (!ctx.studentToken) throw new Error("No student token");
    },
  });

  steps.push({
    name: "student_curriculum",
    fn: async () => {
      const r = await httpJson(`${baseUrl}/api/student/curriculum`, { headers: authHeader(ctx.studentToken!) });
      must(r.status, 200, "GET /api/student/curriculum", r.data);
    },
  });

  steps.push({
    name: "student_video_watched",
    fn: async () => {
      const r = await httpJson(`${baseUrl}/api/student/video/watched`, {
        method: "POST",
        headers: authHeader(ctx.studentToken!),
        body: JSON.stringify({ topicId: ctx.ids.topicId, subTopicId: ctx.ids.subTopicId }),
      });
      must(r.status, 200, "POST /api/student/video/watched", r.data);
    },
  });

  steps.push({
    name: "student_quiz_submit_prereq",
    fn: async () => {
      const r = await httpJson(`${baseUrl}/api/student/quiz/submit`, {
        method: "POST",
        headers: authHeader(ctx.studentToken!),
        body: JSON.stringify({
          contextType: "prereq",
          contextId: ctx.ids.prereqId,
          topicId: ctx.ids.topicId,
          answers: [{ questionId: ctx.ids.questionIds[0], answer: "4" }],
        }),
      });
      must(r.status, 200, "POST /api/student/quiz/submit prereq", r.data);
    },
  });

  steps.push({
    name: "student_quiz_submit_subtopic",
    fn: async () => {
      const r = await httpJson(`${baseUrl}/api/student/quiz/submit`, {
        method: "POST",
        headers: authHeader(ctx.studentToken!),
        body: JSON.stringify({
          contextType: "subtopic",
          contextId: ctx.ids.subTopicId,
          topicId: ctx.ids.topicId,
          subTopicId: ctx.ids.subTopicId,
          answers: [{ questionId: ctx.ids.questionIds[1], answer: "6" }],
        }),
      });
      must(r.status, 200, "POST /api/student/quiz/submit subtopic", r.data);
    },
  });

  steps.push({
    name: "student_quiz_submit_finaltest",
    fn: async () => {
      const r = await httpJson(`${baseUrl}/api/student/quiz/submit`, {
        method: "POST",
        headers: authHeader(ctx.studentToken!),
        body: JSON.stringify({
          contextType: "finaltest",
          contextId: ctx.ids.topicId,
          topicId: ctx.ids.topicId,
          answers: [{ questionId: ctx.ids.questionIds[2], answer: "10" }],
        }),
      });
      must(r.status, 200, "POST /api/student/quiz/submit finaltest", r.data);
    },
  });

  steps.push({
    name: "upload_image_optional",
    fn: async () => {
      // Skip if bucket not configured
      if (!process.env.FIREBASE_STORAGE_BUCKET) return;
      const form = new FormData();
      // Tiny 1x1 PNG
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+o2nUAAAAASUVORK5CYII=",
        "base64"
      );
      form.append("file", new Blob([png], { type: "image/png" }), "smoke.png");
      form.append("folder", "smoke");
      const r = await httpForm(`${baseUrl}/api/upload/image`, form, { headers: authHeader(ctx.adminToken) });
      must(r.status, 200, "POST /api/upload/image", r.data);
      if (!(r.data as any)?.url) throw new Error(`No url from upload: ${JSON.stringify(r.data)}`);
    },
  });

  steps.push({
    name: "ai_optional",
    fn: async () => {
      if (!process.env.GEMINI_API_KEY) return;
      const h = authHeader(ctx.studentToken!);
      const teach = await httpJson(`${baseUrl}/api/ai/teach`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          topicId: ctx.ids.topicId,
          subTopicId: ctx.ids.subTopicId,
          contextType: "subtopic",
          failedQuestions: [],
        }),
      });
      must(teach.status, 200, "POST /api/ai/teach", teach.data);
      const sessionId = (teach.data as any)?.sessionId;
      if (!sessionId) throw new Error("No sessionId from /api/ai/teach");

      const chat = await httpJson(`${baseUrl}/api/ai/chat`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({ sessionId, message: "hello" }),
      });
      must(chat.status, 200, "POST /api/ai/chat", chat.data);

      const gen = await httpJson(`${baseUrl}/api/ai/generate-test`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          topicId: ctx.ids.topicId,
          subTopicId: ctx.ids.subTopicId,
          contextType: "subtopic",
          contextId: ctx.ids.subTopicId,
          failedQuestions: [],
          count: 2,
        }),
      });
      must(gen.status, 200, "POST /api/ai/generate-test", gen.data);
    },
  });

  steps.push({
    name: "admin_dashboards",
    fn: async () => {
      const h = authHeader(ctx.adminToken);
      const dash = await httpJson(`${baseUrl}/api/admin/dashboard`, { headers: h });
      must(dash.status, 200, "GET /api/admin/dashboard", dash.data);
      const flagged = await httpJson(`${baseUrl}/api/admin/flagged-students`, { headers: h });
      must(flagged.status, 200, "GET /api/admin/flagged-students", flagged.data);
      const prog = await httpJson(`${baseUrl}/api/admin/students/${ctx.ids.studentId}/progress`, { headers: h });
      must(prog.status, 200, "GET /api/admin/students/[id]/progress", prog.data);
    },
  });

  const results: { name: string; ok: boolean; error?: string }[] = [];

  try {
    for (const s of steps) {
      const started = Date.now();
      try {
        await s.fn();
        results.push({ name: s.name, ok: true });
        // eslint-disable-next-line no-console
        console.log(`ok  - ${s.name} (${Date.now() - started}ms)`);
      } catch (e: any) {
        results.push({ name: s.name, ok: false, error: e?.message ?? String(e) });
        // eslint-disable-next-line no-console
        console.error(`FAIL- ${s.name}: ${e?.message ?? e}`);
        throw e;
      }
    }
  } finally {
    await cleanupBestEffort(ctx);
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    throw new Error(`Smoke failed (${failed.length}): ${failed.map((f) => f.name).join(", ")}`);
  }

  // eslint-disable-next-line no-console
  console.log("Smoke passed.");
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e?.message ?? e);
  process.exit(1);
});

