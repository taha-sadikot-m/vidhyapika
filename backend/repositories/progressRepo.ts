import { getDb } from "../firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProgressStatus = "pending" | "passed" | "failed" | "flagged";

export type StudentTopicProgress = {
  id: string;
  studentId: string;
  topicId: string;
  prereqStatus: ProgressStatus;
  prereqAttemptCount: number;
  prereqAIAttemptCount: number;
  contentUnlocked: boolean;
  finalTestStatus: ProgressStatus;
  finalTestAttemptCount: number;
  finalTestAIAttemptCount: number;
  flaggedAt?: FirebaseFirestore.Timestamp | null;
  completedAt?: FirebaseFirestore.Timestamp | null;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
};

export type StudentSubTopicProgress = {
  id: string;
  studentId: string;
  subTopicId: string;
  topicId: string;
  videoWatched: boolean;
  quizStatus: ProgressStatus;
  quizAttemptCount: number;
  quizAIAttemptCount: number;
  flaggedAt?: FirebaseFirestore.Timestamp | null;
  completedAt?: FirebaseFirestore.Timestamp | null;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
};

export type QuizAttemptRecord = {
  id: string;
  studentId: string;
  contextType: "prereq" | "subtopic" | "finaltest";
  contextId: string;
  answers: { questionId: string; answer: string; correct: boolean; aiReasoning?: string }[];
  score: number;
  total: number;
  passed: boolean;
  aiGenerated: boolean;
  timestamp: FirebaseFirestore.Timestamp;
};

export type AISessionRecord = {
  id: string;
  studentId: string;
  topicId: string;
  subTopicId?: string | null;
  contextType: "prereq" | "subtopic" | "finaltest";
  messages: { role: "tutor" | "student"; content: string; timestamp: number }[];
  lessonCards?: { title: string; content: string }[];
  generatedQuizIds?: string[];
  status: "active" | "completed";
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
};

export type FlaggedStudent = {
  id: string;
  studentId: string;
  topicId: string;
  subTopicId?: string | null;
  flagType: "prereq" | "subtopic" | "finaltest";
  flaggedAt: FirebaseFirestore.Timestamp;
  resolvedAt?: FirebaseFirestore.Timestamp | null;
  resolvedBy?: string | null;
};

// ─── Student Topic Progress ───────────────────────────────────────────────────

export async function getTopicProgress(
  studentId: string,
  topicId: string
): Promise<StudentTopicProgress | null> {
  const snap = await getDb()
    .collection("studentTopicProgress")
    .where("studentId", "==", studentId)
    .where("topicId", "==", topicId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0]!.id, ...snap.docs[0]!.data() } as StudentTopicProgress;
}

export async function upsertTopicProgress(
  studentId: string,
  topicId: string,
  data: Partial<Omit<StudentTopicProgress, "id" | "studentId" | "topicId" | "createdAt">>
): Promise<StudentTopicProgress> {
  const db = getDb();
  const existing = await getTopicProgress(studentId, topicId);

  if (existing) {
    await db
      .collection("studentTopicProgress")
      .doc(existing.id)
      .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
    return { ...existing, ...data };
  }

  const ref = await db.collection("studentTopicProgress").add({
    studentId,
    topicId,
    prereqStatus: "pending",
    prereqAttemptCount: 0,
    prereqAIAttemptCount: 0,
    contentUnlocked: false,
    finalTestStatus: "pending",
    finalTestAttemptCount: 0,
    finalTestAIAttemptCount: 0,
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const doc = await ref.get();
  return { id: ref.id, ...doc.data() } as StudentTopicProgress;
}

export async function listTopicProgressByStudent(
  studentId: string
): Promise<StudentTopicProgress[]> {
  const snap = await getDb()
    .collection("studentTopicProgress")
    .where("studentId", "==", studentId)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentTopicProgress));
}

// ─── Student Sub-Topic Progress ───────────────────────────────────────────────

export async function getSubTopicProgress(
  studentId: string,
  subTopicId: string
): Promise<StudentSubTopicProgress | null> {
  const snap = await getDb()
    .collection("studentSubTopicProgress")
    .where("studentId", "==", studentId)
    .where("subTopicId", "==", subTopicId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0]!.id, ...snap.docs[0]!.data() } as StudentSubTopicProgress;
}

export async function upsertSubTopicProgress(
  studentId: string,
  subTopicId: string,
  topicId: string,
  data: Partial<Omit<StudentSubTopicProgress, "id" | "studentId" | "subTopicId" | "topicId" | "createdAt">>
): Promise<StudentSubTopicProgress> {
  const db = getDb();
  const existing = await getSubTopicProgress(studentId, subTopicId);

  if (existing) {
    await db
      .collection("studentSubTopicProgress")
      .doc(existing.id)
      .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
    return { ...existing, ...data };
  }

  const ref = await db.collection("studentSubTopicProgress").add({
    studentId,
    subTopicId,
    topicId,
    videoWatched: false,
    quizStatus: "pending",
    quizAttemptCount: 0,
    quizAIAttemptCount: 0,
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const doc = await ref.get();
  return { id: ref.id, ...doc.data() } as StudentSubTopicProgress;
}

export async function listSubTopicProgressByStudent(
  studentId: string,
  topicId?: string
): Promise<StudentSubTopicProgress[]> {
  let query = getDb()
    .collection("studentSubTopicProgress")
    .where("studentId", "==", studentId);
  if (topicId) query = query.where("topicId", "==", topicId) as any;
  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StudentSubTopicProgress));
}

// ─── Quiz Attempts ────────────────────────────────────────────────────────────

export async function saveQuizAttempt(
  data: Omit<QuizAttemptRecord, "id" | "timestamp">
): Promise<string> {
  const ref = await getDb()
    .collection("quizAttempts")
    .add({ ...data, timestamp: FieldValue.serverTimestamp() });
  return ref.id;
}

export async function listQuizAttempts(
  studentId: string,
  contextType?: string,
  contextId?: string
): Promise<QuizAttemptRecord[]> {
  let query = getDb()
    .collection("quizAttempts")
    .where("studentId", "==", studentId);
  if (contextType) query = query.where("contextType", "==", contextType) as any;
  if (contextId) query = query.where("contextId", "==", contextId) as any;
  const snap = await query.get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as QuizAttemptRecord))
    .sort((a, b) => {
      const ta = (a.timestamp as any)?.toMillis?.() ?? 0;
      const tb = (b.timestamp as any)?.toMillis?.() ?? 0;
      return tb - ta;
    });
}

// ─── AI Sessions ──────────────────────────────────────────────────────────────

export async function createAISession(
  data: Omit<AISessionRecord, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await getDb()
    .collection("aiSessions")
    .add({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  return ref.id;
}

export async function getAISession(id: string): Promise<AISessionRecord | null> {
  const doc = await getDb().collection("aiSessions").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as AISessionRecord;
}

export async function updateAISession(
  id: string,
  data: Partial<Omit<AISessionRecord, "id">>
) {
  await getDb()
    .collection("aiSessions")
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function listAISessionsByStudent(studentId: string): Promise<AISessionRecord[]> {
  const snap = await getDb()
    .collection("aiSessions")
    .where("studentId", "==", studentId)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as AISessionRecord))
    .sort((a, b) => {
      const ta = (a.createdAt as any)?.toMillis?.() ?? 0;
      const tb = (b.createdAt as any)?.toMillis?.() ?? 0;
      return tb - ta;
    });
}

// ─── Flagged Students ─────────────────────────────────────────────────────────

export async function createFlag(
  data: Omit<FlaggedStudent, "id" | "flaggedAt">
): Promise<string> {
  const ref = await getDb()
    .collection("flaggedStudents")
    .add({ ...data, flaggedAt: FieldValue.serverTimestamp() });
  return ref.id;
}

export async function listFlaggedStudents(onlyUnresolved = true): Promise<FlaggedStudent[]> {
  let query = getDb().collection("flaggedStudents") as FirebaseFirestore.Query;
  if (onlyUnresolved) {
    query = query.where("resolvedAt", "==", null);
  }
  const snap = await query.get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as FlaggedStudent))
    .sort((a, b) => {
      const ta = (a.flaggedAt as any)?.toMillis?.() ?? 0;
      const tb = (b.flaggedAt as any)?.toMillis?.() ?? 0;
      return tb - ta;
    });
}

export async function resolveFlag(id: string, resolvedBy: string) {
  await getDb()
    .collection("flaggedStudents")
    .doc(id)
    .update({
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy,
    });
}

export async function listFlagsByStudent(studentId: string): Promise<FlaggedStudent[]> {
  const snap = await getDb()
    .collection("flaggedStudents")
    .where("studentId", "==", studentId)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as FlaggedStudent))
    .sort((a, b) => {
      const ta = (a.flaggedAt as any)?.toMillis?.() ?? 0;
      const tb = (b.flaggedAt as any)?.toMillis?.() ?? 0;
      return tb - ta;
    });
}
