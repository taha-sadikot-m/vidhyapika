import React, { useMemo, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { useApiGet, apiFetch } from '../../hooks/useApi';

type Standard = { id: string; name: string };
type Class = { id: string; name: string; standardId: string };

type AdminEvent = {
  id: string;
  classId: string;
  title: string;
  startsAt: any;
  endsAt: any;
  type: 'live' | 'workshop' | 'exam' | 'meeting' | 'other';
  location?: string | null;
  joinUrl?: string | null;
};

export function AdminSchedule() {
  const { data: standardsData } = useApiGet<{ standards: Standard[] }>('/api/admin/standards', []);
  const [standardId, setStandardId] = useState<string>('');
  const { data: classesData } = useApiGet<{ classes: Class[] }>(
    standardId ? `/api/admin/standards/${standardId}/classes` : '',
    [standardId]
  );
  const [classId, setClassId] = useState<string>('');

  const { data: eventsData, refetch } = useApiGet<{ events: AdminEvent[] }>(
    classId ? `/api/admin/schedule-events?classId=${classId}` : '',
    [classId]
  );

  const classes = classesData?.classes ?? [];
  const standards = standardsData?.standards ?? [];
  const selectedClass = useMemo(() => classes.find((c) => c.id === classId), [classes, classId]);

  const [form, setForm] = useState({
    title: '',
    startsAt: '',
    endsAt: '',
    type: 'live' as const,
    location: '',
    joinUrl: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!classId) return;
    setBusy(true);
    setError(null);
    const { error } = await apiFetch<{ id: string }>('/api/admin/schedule-events', {
      method: 'POST',
      body: JSON.stringify({
        classId,
        title: form.title,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
        type: form.type,
        location: form.location || null,
        joinUrl: form.joinUrl || null,
      }),
    });
    setBusy(false);
    if (error) return setError(String(error));
    setForm({ title: '', startsAt: '', endsAt: '', type: 'live', location: '', joinUrl: '' });
    void refetch?.();
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    const { error } = await apiFetch(`/api/admin/schedule-events/${id}`, { method: 'DELETE' });
    setBusy(false);
    if (error) return setError(String(error));
    void refetch?.();
  }

  return (
    <AdminLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Schedule Events</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Create and manage class schedule events.</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-600">Standard</label>
            <select
              value={standardId}
              onChange={(e) => { setStandardId(e.target.value); setClassId(''); }}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold"
            >
              <option value="">Select standard…</option>
              {standards.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600">Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold"
              disabled={!standardId}
            >
              <option value="">{standardId ? 'Select class…' : 'Select standard first'}</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <div className="text-sm font-semibold text-slate-700">
              Selected: <span className="font-extrabold">{selectedClass?.name ?? '—'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-lg font-extrabold text-slate-900">Create event</h2>
          {error && <div className="mt-3 text-sm font-semibold text-red-600">{error}</div>}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as any }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold"
              >
                <option value="live">Live</option>
                <option value="workshop">Workshop</option>
                <option value="exam">Exam</option>
                <option value="meeting">Meeting</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">Starts</label>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">Ends</label>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((p) => ({ ...p, endsAt: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">Location</label>
              <input
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">Join URL</label>
              <input
                value={form.joinUrl}
                onChange={(e) => setForm((p) => ({ ...p, joinUrl: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              disabled={busy || !classId || !form.title.trim() || !form.startsAt || !form.endsAt}
              onClick={create}
              className="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-extrabold disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-lg font-extrabold text-slate-900 mb-4">Events</h2>
          {!classId && <div className="text-sm font-semibold text-slate-500">Select a class to view events.</div>}
          {classId && (eventsData?.events ?? []).length === 0 && (
            <div className="text-sm font-semibold text-slate-500">No events yet.</div>
          )}
          <div className="space-y-3">
            {(eventsData?.events ?? []).map((e) => (
              <div key={e.id} className="border border-slate-200 rounded-xl p-4 flex items-start gap-4">
                <div className="flex-1">
                  <div className="text-sm font-extrabold text-slate-900">{e.title}</div>
                  <div className="text-xs font-semibold text-slate-500 mt-1">
                    {e.type} • {e.startsAt ? new Date(e.startsAt).toLocaleString() : ''} – {e.endsAt ? new Date(e.endsAt).toLocaleString() : ''}
                  </div>
                </div>
                <button
                  disabled={busy}
                  onClick={() => remove(e.id)}
                  className="px-3 py-2 rounded-xl border border-red-200 text-red-700 text-xs font-extrabold hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

