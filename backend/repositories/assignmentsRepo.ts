import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../firebase/admin";

export type AssignmentStatus = "draft" | "published" | "archived";
export type AssignmentType = "practice" | "homework" | "project" | "quiz";

export type Assignment = {
  id: string;
  classId: string;
  title: string;
  description?: string | null;
  dueAt?: FirebaseFirestore.Timestamp | null;
  type: AssignmentType;
  status: AssignmentStatus;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
};

export type AssignmentSubmissionStatus = "not_submitted" | "submitted" | "graded";

export type AssignmentSubmission = {
  id: string;
  assignmentId: string;
  studentId: string;
  status: AssignmentSubmissionStatus;
  submittedAt?: FirebaseFirestore.Timestamp | null;
  score?: number | null;
  feedback?: string | null;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
};

export async function listAssignmentsByClass(classId: string): Promise<Assignment[]> {
  const snap = await getDb().collection("assignments").where("classId", "==", classId).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Assignment))
    .sort((a, b) => {
      const ad = a.dueAt?.toMillis?.() ?? 0;
      const bd = b.dueAt?.toMillis?.() ?? 0;
      return ad - bd;
    });
}

export async function getAssignment(id: string): Promise<Assignment | null> {
  const doc = await getDb().collection("assignments").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Assignment;
}

export async function createAssignment(
  data: Omit<Assignment, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await getDb()
    .collection("assignments")
    .add({ ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  return ref.id;
}

export async function updateAssignment(
  id: string,
  data: Partial<Omit<Assignment, "id" | "createdAt" | "updatedAt">>
) {
  await getDb()
    .collection("assignments")
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteAssignment(id: string) {
  await getDb().collection("assignments").doc(id).delete();
}

export async function getOrCreateSubmission(
  assignmentId: string,
  studentId: string
): Promise<AssignmentSubmission> {
  const db = getDb();
  const existing = await db
    .collection("assignmentSubmissions")
    .where("assignmentId", "==", assignmentId)
    .where("studentId", "==", studentId)
    .limit(1)
    .get();

  if (!existing.empty) {
    const d = existing.docs[0]!;
    return { id: d.id, ...d.data() } as AssignmentSubmission;
  }

  const ref = await db.collection("assignmentSubmissions").add({
    assignmentId,
    studentId,
    status: "not_submitted",
    submittedAt: null,
    score: null,
    feedback: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const doc = await ref.get();
  return { id: doc.id, ...doc.data() } as AssignmentSubmission;
}

export async function submitAssignment(assignmentId: string, studentId: string): Promise<void> {
  const sub = await getOrCreateSubmission(assignmentId, studentId);
  await getDb()
    .collection("assignmentSubmissions")
    .doc(sub.id)
    .update({ status: "submitted", submittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
}

