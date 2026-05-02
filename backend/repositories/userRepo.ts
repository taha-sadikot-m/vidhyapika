import { getDb } from "../firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  password_hash: string;
  must_reset_password: boolean;
  parent_id?: string | null;
  class_id?: string | null;
  phone?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
};

export type UserRecord = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  passwordHash: string;
  mustResetPassword: boolean;
  parentId?: string | null;
  classId?: string | null;
  phone?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
};

function docToUserRow(id: string, data: FirebaseFirestore.DocumentData): UserRow {
  return {
    id,
    email: data.email,
    name: data.name ?? null,
    role: data.role ?? "student",
    password_hash: data.passwordHash || data.password_hash || "",
    must_reset_password: data.mustResetPassword ?? false,
    parent_id: data.parentId ?? null,
    class_id: data.classId ?? null,
    phone: data.phone ?? null,
    parentName: data.parentName ?? data.parent_name ?? null,
    parentEmail: data.parentEmail ?? data.parent_email ?? null,
  };
}

/** Parent accounts store parentId = linked student's user id. Used when student doc lacks parentName/parentEmail. */
export async function getParentUserLinkedToStudent(studentId: string): Promise<UserRow | null> {
  const db = getDb();
  const snap = await db.collection("users").where("parentId", "==", studentId).limit(10).get();
  const doc = snap.docs.find((d) => (d.data().role ?? "") === "parent");
  if (!doc) return null;
  return docToUserRow(doc.id, doc.data());
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  try {
    const db = getDb();
    const snap = await db
      .collection("users")
      .where("email", "==", email.toLowerCase())
      .limit(1)
      .get();
    if (snap.empty) return null;
    const doc = snap.docs[0]!;
    return docToUserRow(doc.id, doc.data());
  } catch (err: any) {
    // Firestore misconfig / permissions should not crash login flows.
    // Return null and log a clear hint for operators.
    const code = err?.code ?? err?.status ?? err?.errorInfo?.code;
    const message = err?.message ?? String(err);
    console.error("[userRepo.getUserByEmail] Firestore error", {
      code,
      message,
      hint:
        "Check FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY and ensure Firestore is enabled for the project.",
    });
    return null;
  }
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const db = getDb();
  const doc = await db.collection("users").doc(id).get();
  if (!doc.exists) return null;
  return docToUserRow(doc.id, doc.data()!);
}

/** Batch fetch by id (deduped). Chunks to stay within Firestore batch-get limits. */
export async function getUsersByIds(ids: string[]): Promise<Map<string, UserRow>> {
  const uniq = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, UserRow>();
  if (uniq.length === 0) return map;
  const db = getDb();
  const chunkSize = 10;
  for (let i = 0; i < uniq.length; i += chunkSize) {
    const chunk = uniq.slice(i, i + chunkSize);
    const refs = chunk.map((id) => db.collection("users").doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (snap.exists) map.set(snap.id, docToUserRow(snap.id, snap.data()!));
    }
  }
  return map;
}

export async function setUserPassword(params: {
  email: string;
  passwordHash: string;
  mustResetPassword: boolean;
}) {
  const db = getDb();
  try {
    const snap = await db
      .collection("users")
      .where("email", "==", params.email.toLowerCase())
      .limit(1)
      .get();
    if (snap.empty) throw new Error("User not found");
    await snap.docs[0]!.ref.update({
      passwordHash: params.passwordHash,
      mustResetPassword: params.mustResetPassword,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err: any) {
    const code = err?.code ?? err?.status ?? err?.errorInfo?.code;
    const message = err?.message ?? String(err);
    console.error("[userRepo.setUserPassword] Firestore error", {
      code,
      message,
      hint:
        "Check Firebase Admin credentials and ensure Firestore is enabled and service account has access.",
    });
    throw err;
  }
}

export async function upsertUser(params: {
  email: string;
  name?: string | null;
  role?: string;
  passwordHash: string;
  mustResetPassword: boolean;
  parentId?: string | null;
  classId?: string | null;
  phone?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
}): Promise<string> {
  const db = getDb();
  const email = params.email.toLowerCase();

  const snap = await db.collection("users").where("email", "==", email).limit(1).get();

  if (!snap.empty) {
    const ref = snap.docs[0]!.ref;
    await ref.update({
      name: params.name ?? null,
      role: params.role ?? "student",
      passwordHash: params.passwordHash,
      mustResetPassword: params.mustResetPassword,
      ...(params.parentId !== undefined && { parentId: params.parentId }),
      ...(params.classId !== undefined && { classId: params.classId }),
      ...(params.phone !== undefined && { phone: params.phone }),
      ...(params.parentName !== undefined && { parentName: params.parentName }),
      ...(params.parentEmail !== undefined && { parentEmail: params.parentEmail }),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return snap.docs[0]!.id;
  }

  const ref = await db.collection("users").add({
    email,
    name: params.name ?? null,
    role: params.role ?? "student",
    passwordHash: params.passwordHash,
    mustResetPassword: params.mustResetPassword,
    parentId: params.parentId ?? null,
    classId: params.classId ?? null,
    phone: params.phone ?? null,
    parentName: params.parentName ?? null,
    parentEmail: params.parentEmail ?? null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function createUser(params: {
  email: string;
  name?: string | null;
  role?: string;
  passwordHash: string;
  mustResetPassword: boolean;
  parentId?: string | null;
  classId?: string | null;
  phone?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
}): Promise<string> {
  return upsertUser(params);
}

export async function updateUser(
  id: string,
  data: Partial<{
    name: string | null;
    role: string;
    passwordHash: string;
    mustResetPassword: boolean;
    parentId: string | null;
    classId: string | null;
    phone: string | null;
    parentName: string | null;
    parentEmail: string | null;
  }>
) {
  const db = getDb();
  await db
    .collection("users")
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteUser(id: string) {
  const db = getDb();
  await db.collection("users").doc(id).delete();
}

export async function listUsersByRole(role: string): Promise<UserRow[]> {
  const db = getDb();
  const snap = await db.collection("users").where("role", "==", role).get();
  return snap.docs.map((d) => docToUserRow(d.id, d.data()));
}

/** Count aggregation — 1 read op, not 1 per document. */
export async function countUsersByRole(role: string): Promise<number> {
  const snap = await getDb()
    .collection("users")
    .where("role", "==", role)
    .count()
    .get();
  return snap.data().count;
}

/**
 * Most recently created users for a role. Requires `createdAt` on documents (new users have it).
 * Composite index: users — role Asc, createdAt Desc
 */
export async function listRecentUsersByRole(role: string, limit: number): Promise<UserRow[]> {
  const snap = await getDb()
    .collection("users")
    .where("role", "==", role)
    .orderBy("createdAt", "desc")
    .limit(Math.max(1, Math.min(limit, 50)))
    .get();
  return snap.docs.map((d) => docToUserRow(d.id, d.data()));
}

export async function getAllUsers(): Promise<UserRow[]> {
  const db = getDb();
  const snap = await db.collection("users").get();
  return snap.docs.map((d) => docToUserRow(d.id, d.data()));
}
