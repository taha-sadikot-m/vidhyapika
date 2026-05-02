/**
 * HTTP caching for admin JSON APIs.
 * - private: do not store in shared CDNs without auth
 * - s-maxage: edge may reuse (if you add a cache later)
 * - stale-while-revalidate: serve stale briefly while refreshing
 *
 * This does not reduce the first load’s Firestore reads, but cuts repeat reads when
 * admins refresh or multiple tabs hit the same endpoint within the window.
 */
export const ADMIN_JSON_CACHE_CONTROL =
  "private, max-age=0, s-maxage=300, stale-while-revalidate=600";
