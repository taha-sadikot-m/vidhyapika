import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../firebase/admin";

export type ScheduleEventType = "live" | "workshop" | "exam" | "meeting" | "other";

export type ScheduleEvent = {
  id: string;
  classId: string;
  title: string;
  startsAt: FirebaseFirestore.Timestamp;
  endsAt: FirebaseFirestore.Timestamp;
  type: ScheduleEventType;
  location?: string | null;
  joinUrl?: string | null;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
};

export async function listScheduleEventsByClass(
  classId: string,
  range?: { start: FirebaseFirestore.Timestamp; end: FirebaseFirestore.Timestamp }
): Promise<ScheduleEvent[]> {
  let q: FirebaseFirestore.Query = getDb().collection("scheduleEvents").where("classId", "==", classId);
  // Avoid composite indexes: fetch and filter in-memory if needed.
  const snap = await q.get();
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ScheduleEvent));
  const filtered = range
    ? all.filter((e) => {
        const s = e.startsAt?.toMillis?.() ?? 0;
        return s >= range.start.toMillis() && s <= range.end.toMillis();
      })
    : all;
  return filtered.sort((a, b) => (a.startsAt?.toMillis?.() ?? 0) - (b.startsAt?.toMillis?.() ?? 0));
}

export async function getScheduleEvent(id: string): Promise<ScheduleEvent | null> {
  const doc = await getDb().collection("scheduleEvents").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as ScheduleEvent;
}

export async function createScheduleEvent(
  data: Omit<ScheduleEvent, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await getDb()
    .collection("scheduleEvents")
    .add({ ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  return ref.id;
}

export async function updateScheduleEvent(
  id: string,
  data: Partial<Omit<ScheduleEvent, "id" | "createdAt" | "updatedAt">>
) {
  await getDb()
    .collection("scheduleEvents")
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteScheduleEvent(id: string) {
  await getDb().collection("scheduleEvents").doc(id).delete();
}

