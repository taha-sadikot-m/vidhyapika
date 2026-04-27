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
    parentName: data.parentName ?? null,
    parentEmail: data.parentEmail ?? null,
  };
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

export async function getAllUsers(): Promise<UserRow[]> {
  const db = getDb();
  const snap = await db.collection("users").get();
  return snap.docs.map((d) => docToUserRow(d.id, d.data()));
}
