import { getDb } from "../firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

// ─── Standards ───────────────────────────────────────────────────────────────

export type Standard = {
  id: string;
  name: string;
  description?: string;
  order: number;
  createdAt?: FirebaseFirestore.Timestamp;
};

export async function listStandards(): Promise<Standard[]> {
  const snap = await getDb().collection("standards").get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Standard))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getStandard(id: string): Promise<Standard | null> {
  const doc = await getDb().collection("standards").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Standard;
}

/** Batch fetch standards by id (deduped). */
export async function getStandardsByIds(ids: string[]): Promise<Map<string, Standard>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, Standard>();
  if (uniq.length === 0) return map;
  const db = getDb();
  const chunkSize = 10;
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);
    const refs = chunk.map((id) => db.collection("standards").doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (snap.exists) map.set(snap.id, { id: snap.id, ...snap.data() } as Standard);
    }
  }
  return map;
}

export async function createStandard(data: Omit<Standard, "id" | "createdAt">): Promise<string> {
  const ref = await getDb()
    .collection("standards")
    .add({ ...data, createdAt: FieldValue.serverTimestamp() });
  return ref.id;
}

export async function updateStandard(id: string, data: Partial<Omit<Standard, "id">>) {
  await getDb()
    .collection("standards")
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteStandard(id: string) {
  await getDb().collection("standards").doc(id).delete();
}

// ─── Classes ─────────────────────────────────────────────────────────────────

export type Class = {
  id: string;
  standardId: string;
  name: string;
  passingThreshold: number;
  createdAt?: FirebaseFirestore.Timestamp;
};

export async function listClasses(standardId: string): Promise<Class[]> {
  const snap = await getDb()
    .collection("classes")
    .where("standardId", "==", standardId)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Class));
}

export async function getClass(id: string): Promise<Class | null> {
  const doc = await getDb().collection("classes").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Class;
}

/** Batch fetch classes by id (deduped). */
export async function getClassesByIds(ids: string[]): Promise<Map<string, Class>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, Class>();
  if (uniq.length === 0) return map;
  const db = getDb();
  const chunkSize = 10;
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);
    const refs = chunk.map((id) => db.collection("classes").doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (snap.exists) map.set(snap.id, { id: snap.id, ...snap.data() } as Class);
    }
  }
  return map;
}

export async function createClass(data: Omit<Class, "id" | "createdAt">): Promise<string> {
  const ref = await getDb()
    .collection("classes")
    .add({ ...data, createdAt: FieldValue.serverTimestamp() });
  return ref.id;
}

export async function updateClass(id: string, data: Partial<Omit<Class, "id">>) {
  await getDb()
    .collection("classes")
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteClass(id: string) {
  await getDb().collection("classes").doc(id).delete();
}

export async function getAllClasses(): Promise<Class[]> {
  const snap = await getDb().collection("classes").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Class));
}

// ─── Topics ──────────────────────────────────────────────────────────────────

export type Topic = {
  id: string;
  classId: string;
  name: string;
  description?: string;
  order: number;
  finalTestThreshold: number;
  createdAt?: FirebaseFirestore.Timestamp;
};

export async function listTopics(classId: string): Promise<Topic[]> {
  const snap = await getDb()
    .collection("topics")
    .where("classId", "==", classId)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Topic))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getTopic(id: string): Promise<Topic | null> {
  const doc = await getDb().collection("topics").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Topic;
}

/** Batch fetch topics by id (deduped). */
export async function getTopicsByIds(ids: string[]): Promise<Map<string, Topic>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, Topic>();
  if (uniq.length === 0) return map;
  const db = getDb();
  const chunkSize = 10;
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);
    const refs = chunk.map((id) => db.collection("topics").doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (snap.exists) map.set(snap.id, { id: snap.id, ...snap.data() } as Topic);
    }
  }
  return map;
}

export async function createTopic(data: Omit<Topic, "id" | "createdAt">): Promise<string> {
  const ref = await getDb()
    .collection("topics")
    .add({ ...data, createdAt: FieldValue.serverTimestamp() });
  return ref.id;
}

export async function updateTopic(id: string, data: Partial<Omit<Topic, "id">>) {
  await getDb()
    .collection("topics")
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteTopic(id: string) {
  await getDb().collection("topics").doc(id).delete();
}

// ─── SubTopics ────────────────────────────────────────────────────────────────

export type SubTopic = {
  id: string;
  topicId: string;
  name: string;
  order: number;
  youtubeUrl?: string;
  passingThreshold: number;
  createdAt?: FirebaseFirestore.Timestamp;
};

export async function listSubTopics(topicId: string): Promise<SubTopic[]> {
  const snap = await getDb()
    .collection("subTopics")
    .where("topicId", "==", topicId)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as SubTopic))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getSubTopic(id: string): Promise<SubTopic | null> {
  const doc = await getDb().collection("subTopics").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as SubTopic;
}

/** Batch fetch sub-topics by id (deduped). */
export async function getSubTopicsByIds(ids: string[]): Promise<Map<string, SubTopic>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, SubTopic>();
  if (uniq.length === 0) return map;
  const db = getDb();
  const chunkSize = 10;
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);
    const refs = chunk.map((id) => db.collection("subTopics").doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (snap.exists) map.set(snap.id, { id: snap.id, ...snap.data() } as SubTopic);
    }
  }
  return map;
}

export async function createSubTopic(data: Omit<SubTopic, "id" | "createdAt">): Promise<string> {
  const ref = await getDb()
    .collection("subTopics")
    .add({ ...data, createdAt: FieldValue.serverTimestamp() });
  return ref.id;
}

export async function updateSubTopic(id: string, data: Partial<Omit<SubTopic, "id">>) {
  await getDb()
    .collection("subTopics")
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteSubTopic(id: string) {
  await getDb().collection("subTopics").doc(id).delete();
}

// ─── Prerequisites ────────────────────────────────────────────────────────────

export type Prerequisite = {
  id: string;
  topicId: string;
  name: string;
  description?: string;
  passingThreshold: number;
  maxAIAttempts: number;
  createdAt?: FirebaseFirestore.Timestamp;
};

export async function listPrerequisites(topicId: string): Promise<Prerequisite[]> {
  const snap = await getDb()
    .collection("prerequisites")
    .where("topicId", "==", topicId)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Prerequisite))
    .sort((a, b) => ((a as any).order ?? 0) - ((b as any).order ?? 0));
}

export async function getPrerequisite(topicId: string): Promise<Prerequisite | null> {
  const list = await listPrerequisites(topicId);
  return list[0] ?? null;
}

export async function createPrerequisite(
  topicId: string,
  data: Omit<Prerequisite, "id" | "topicId" | "createdAt">
): Promise<string> {
  const ref = await getDb()
    .collection("prerequisites")
    .add({ ...data, topicId, order: 0, createdAt: FieldValue.serverTimestamp() });
  return ref.id;
}

export async function updatePrerequisite(
  id: string,
  data: Partial<Omit<Prerequisite, "id" | "topicId" | "createdAt">>
): Promise<void> {
  await getDb()
    .collection("prerequisites")
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deletePrerequisite(id: string): Promise<void> {
  await getDb().collection("prerequisites").doc(id).delete();
}

/** @deprecated kept for migration compat — use createPrerequisite / updatePrerequisite */
export async function upsertPrerequisite(
  topicId: string,
  data: Omit<Prerequisite, "id" | "topicId" | "createdAt">
): Promise<string> {
  const existing = await getPrerequisite(topicId);
  if (existing) {
    await updatePrerequisite(existing.id, data);
    return existing.id;
  }
  return createPrerequisite(topicId, data);
}

// ─── Questions ────────────────────────────────────────────────────────────────

export type QuestionType = "mcq" | "true_false" | "image_upload" | "text";
export type QuestionContextType = "prereq" | "subtopic" | "finaltest";

export type Question = {
  id: string;
  contextType: QuestionContextType;
  contextId: string;
  text: string;
  type: QuestionType;
  imageUrl?: string;
  options?: string[];
  correctAnswer?: string;
  order: number;
  isAIGenerated?: boolean;
  createdAt?: FirebaseFirestore.Timestamp;
};

export async function listQuestions(
  contextType: QuestionContextType,
  contextId: string
): Promise<Question[]> {
  const snap = await getDb()
    .collection("questions")
    .where("contextType", "==", contextType)
    .where("contextId", "==", contextId)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Question))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getQuestion(id: string): Promise<Question | null> {
  const doc = await getDb().collection("questions").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Question;
}

export async function createQuestion(data: Omit<Question, "id" | "createdAt">): Promise<string> {
  // Strip undefined values — Firestore rejects them
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );
  const ref = await getDb()
    .collection("questions")
    .add({ ...clean, createdAt: FieldValue.serverTimestamp() });
  return ref.id;
}

export async function updateQuestion(id: string, data: Partial<Omit<Question, "id">>) {
  await getDb()
    .collection("questions")
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteQuestion(id: string) {
  await getDb().collection("questions").doc(id).delete();
}

export async function createQuestionsInBatch(
  questions: Omit<Question, "id" | "createdAt">[]
): Promise<string[]> {
  const db = getDb();
  const batch = db.batch();
  const refs = questions.map(() => db.collection("questions").doc());
  refs.forEach((ref, i) => {
    batch.set(ref, { ...questions[i], createdAt: FieldValue.serverTimestamp() });
  });
  await batch.commit();
  return refs.map((r) => r.id);
}

// ─── Class Enrollments ────────────────────────────────────────────────────────

export type ClassEnrollment = {
  id: string;
  classId: string;
  studentId: string;
  enrolledAt?: FirebaseFirestore.Timestamp;
};

export async function enrollStudent(classId: string, studentId: string): Promise<string> {
  const db = getDb();
  const existing = await db
    .collection("classEnrollments")
    .where("classId", "==", classId)
    .where("studentId", "==", studentId)
    .limit(1)
    .get();
  if (!existing.empty) return existing.docs[0]!.id;
  const ref = await db
    .collection("classEnrollments")
    .add({ classId, studentId, enrolledAt: FieldValue.serverTimestamp() });
  return ref.id;
}

export async function syncStudentEnrollments(studentId: string, classIds: string[]): Promise<void> {
  const db = getDb();
  const existingSnap = await db
    .collection("classEnrollments")
    .where("studentId", "==", studentId)
    .get();
  
  const existingClassIds = new Set<string>();
  const batch = db.batch();

  existingSnap.docs.forEach(doc => {
    const data = doc.data() as ClassEnrollment;
    if (!classIds.includes(data.classId)) {
      batch.delete(doc.ref);
    } else {
      existingClassIds.add(data.classId);
    }
  });

  for (const cid of classIds) {
    if (!existingClassIds.has(cid)) {
      const ref = db.collection("classEnrollments").doc();
      batch.set(ref, { classId: cid, studentId, enrolledAt: FieldValue.serverTimestamp() });
    }
  }

  await batch.commit();
}

export async function getStudentEnrollments(
  studentId: string
): Promise<ClassEnrollment[]> {
  const snap = await getDb()
    .collection("classEnrollments")
    .where("studentId", "==", studentId)
    .get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassEnrollment));
}

export async function getStudentEnrollment(
  studentId: string
): Promise<ClassEnrollment | null> {
  const enrollments = await getStudentEnrollments(studentId);
  return enrollments.length > 0 ? enrollments[0] : null;
}

export async function listClassEnrollments(classId: string): Promise<ClassEnrollment[]> {
  const snap = await getDb()
    .collection("classEnrollments")
    .where("classId", "==", classId)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassEnrollment));
}
