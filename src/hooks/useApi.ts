import { useState, useCallback, useEffect } from 'react';

function getToken(): string | null {
  return localStorage.getItem('vidhyapika_token');
}

export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(url, { ...options, headers });
    const json = await res.json();
    if (!res.ok) {
      // Token expired or missing — clear session and redirect to the appropriate login page
      if (res.status === 401) {
        localStorage.removeItem('vidhyapika_token');
        localStorage.removeItem('vidhyapika_user');
        const dest = url.includes('/api/admin/') ? '/admin/login' : '/login';
        if (typeof window !== 'undefined' && !window.location.pathname.endsWith('/login')) {
          window.location.href = dest;
        }
        return { data: null, error: 'Session expired. Redirecting to login…' };
      }
      let errMsg: string = json.error ?? 'Request failed';
      if (Array.isArray(json.details) && json.details.length > 0) {
        const fieldErrors = json.details
          .map((d: any) => {
            const field = Array.isArray(d.path) && d.path.length ? d.path.join('.') : null;
            return field ? `${field}: ${d.message}` : d.message;
          })
          .join('; ');
        errMsg = `${errMsg} — ${fieldErrors}`;
      }
      return { data: null, error: errMsg };
    }
    return { data: json as T, error: null };
  } catch (e: any) {
    return { data: null, error: e.message };
  }
}

export function useApiGet<T = any>(url: string, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await apiFetch<T>(url);
    setData(result.data);
    setError(result.error);
    setLoading(false);
  }, [url]);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  return { data, loading, error, refetch };
}
