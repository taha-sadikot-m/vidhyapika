import type { Firestore, QueryDocumentSnapshot } from "firebase-admin/firestore";

/** Firestore disjunction limit for `in` / `not-in` queries. */
export const FIRESTORE_IN_QUERY_MAX = 30;

export function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Run batched equality+`in` queries (max 30 ids per query) and merge document results.
 */
export async function queryDocumentsWhereIn(
  db: Firestore,
  collectionPath: string,
  field: string,
  values: string[]
): Promise<QueryDocumentSnapshot[]> {
  const uniq = [...new Set(values.filter(Boolean))];
  if (uniq.length === 0) return [];
  const out: QueryDocumentSnapshot[] = [];
  for (const group of chunkIds(uniq, FIRESTORE_IN_QUERY_MAX)) {
    const snap = await db.collection(collectionPath).where(field, "in", group).get();
    out.push(...snap.docs);
  }
  return out;
}
