// PostgreSQL migrations removed. Database is now handled by Firebase Firestore.
// This file is kept for backwards compatibility.
export async function runMigrations(): Promise<void> {
  // No-op: Firestore does not require schema migrations.
}
