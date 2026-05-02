import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { Modal } from '../../components/ui/Modal';
import {
  Search, Plus, Edit2, Trash2, ChevronRight, X,
  Users, Mail, Phone, BookOpen, CheckCircle2, AlertTriangle,
  Flag, Brain, ClipboardList, GraduationCap, RefreshCw,
} from 'lucide-react';
import { useApiGet, apiFetch } from '../../hooks/useApi';

// ─── Types ────────────────────────────────────────────────────────────────────

type Student = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  class_id?: string | null;
  classIds?: string[];
  parentName?: string | null;
  parentEmail?: string | null;
  phone?: string | null;
};

type ApiStandard = { id: string; name: string };

type ApiClass    = { id: string; name: string; standardId: string };

type TopicProgress = {
  topicId: string;
  topicName?: string;
  prereqPassed: boolean;
  contentUnlocked: boolean;
  finalTestPassed: boolean;
  aiAttempts: number;
  flagged: boolean;
};

type QuizAttempt = { id: string; topicId?: string; subtopicId?: string; score: number; total: number; passed: boolean; timestamp: any };
type AiSession   = { id: string; topicId?: string; createdAt: any };
type FlagRecord  = { id: string; topicId?: string; topicName?: string; flagType: string; flaggedAt: any };

type JourneyData = {
  enrollment: { classId: string; className?: string } | null;
  topicProgress: TopicProgress[];
  quizAttempts: QuizAttempt[];
  aiSessions: AiSession[];
  flags: FlagRecord[];
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminStudents() {
  // ── Data ────────────────────────────────────────────────────────────────────
  const { data: studentsData, loading: loadingStudents, error: studentsError, refetch: refetchStudents } = useApiGet<{ students: Student[] }>('/api/admin/students');
  const { data: standardsData } = useApiGet<{ standards: ApiStandard[] }>('/api/admin/standards');

  const students  = studentsData?.students ?? [];
  const standards = standardsData?.standards ?? [];

  // ── Classes (loaded per selected standard in form) ────────────────────────
  const [classesMap, setClassesMap] = useState<Record<string, ApiClass[]>>({});
  const [loadingClasses, setLoadingClasses] = useState(false);

  const loadClassesForStd = useCallback(async (standardId: string) => {
    if (classesMap[standardId]) return;
    setLoadingClasses(true);
    const { data } = await apiFetch<{ classes: ApiClass[] }>(`/api/admin/standards/${standardId}/classes`);
    setClassesMap(m => ({ ...m, [standardId]: data?.classes ?? [] }));
    setLoadingClasses(false);
  }, [classesMap]);

  // Load classes for ALL standards on mount (so dropdown can show classes)
  useEffect(() => {
    standards.forEach(s => loadClassesForStd(s.id));
  }, [standards]);

  // ── Search ────────────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const filtered = students.filter(s =>
    (s.name ?? '').toLowerCase().includes(query.toLowerCase()) ||
    s.email.toLowerCase().includes(query.toLowerCase())
  );

  // ── Form modal ────────────────────────────────────────────────────────────
  const [modal, setModal] = useState<{ open: boolean; type: string; payload: any }>({ open: false, type: '', payload: null });
  const [form, setForm]   = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const openModal = async (type: string, payload: any = null) => {
    setSaveError(null);
    setModal({ open: true, type, payload });
    if (type === 'edit' && payload?.id) {
      const { data, error } = await apiFetch<{
        student: Student & { classIds?: string[] };
      }>(`/api/admin/students/${payload.id}`);
      if (data?.student) {
        const st = data.student;
        setForm({
          name: st.name ?? '',
          email: st.email,
          phone: st.phone ?? '',
          classIds: Array.isArray(st.classIds) ? st.classIds : payload.classIds ?? [],
          parentName: st.parentName ?? '',
          parentEmail: st.parentEmail ?? '',
        });
        return;
      }
      if (error) setSaveError(error);
      setForm({
        name: payload.name ?? '',
        email: payload.email,
        phone: payload.phone ?? '',
        classIds: payload.classIds ?? [],
        parentName: payload.parentName ?? '',
        parentEmail: payload.parentEmail ?? '',
      });
      return;
    }
    if (type === 'edit') {
      setForm({
        name: payload.name ?? '',
        email: payload.email,
        phone: payload.phone ?? '',
        classIds: payload.classIds ?? [],
        parentName: payload.parentName ?? '',
        parentEmail: payload.parentEmail ?? '',
      });
    } else {
      setForm({ sendEmail: true, classIds: [], parentName: '', parentEmail: '' });
    }
  };
  const closeModal = () => { setModal({ open: false, type: '', payload: null }); setSaveError(null); };

  // ── Toast ────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const showToast = (ok: boolean, text: string) => { setToast({ ok, text }); setTimeout(() => setToast(null), 4000); };

  // ── CRUD ─────────────────────────────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    if (modal.type === 'add') {
      const { data, error } = await apiFetch<{ tempPassword: string }>('/api/admin/students', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          parentName: form.parentName || undefined,
          parentEmail: form.parentEmail || undefined,
          classIds: form.classIds || [],
          phone: form.phone || undefined,
          sendEmail: form.sendEmail ?? true,
        }),
      });
      if (error) { setSaveError(error); setSaving(false); return; }
      if (data?.tempPassword) {
        const emailNote = form.sendEmail ? ' Welcome emails are sending in the background.' : '';
        showToast(true, `Student added. Temp password: ${data.tempPassword}.${emailNote}`);
      } else showToast(true, 'Student added successfully.');
    } else if (modal.type === 'edit') {
      const { error } = await apiFetch(`/api/admin/students/${modal.payload.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: form.name, classIds: form.classIds || [], phone: form.phone || null, parentName: form.parentName || null, parentEmail: form.parentEmail || null }),
      });
      if (error) { setSaveError(error); setSaving(false); return; }
      showToast(true, 'Student updated.');
    }

    await refetchStudents();
    closeModal();
    setSaving(false);
  };

  const handleDelete = async () => {
    const { error } = await apiFetch(`/api/admin/students/${modal.payload.id}`, { method: 'DELETE' });
    closeModal();
    if (error) { showToast(false, `Delete failed: ${error}`); return; }
    showToast(true, 'Student removed.');
    await refetchStudents();
  };

  // ── Journey drawer ────────────────────────────────────────────────────────

  const [journeyOpen, setJourneyOpen] = useState(false);
  const [journeyStudent, setJourneyStudent] = useState<Student | null>(null);
  const [journeyData, setJourneyData] = useState<JourneyData | null>(null);
  const [loadingJourney, setLoadingJourney] = useState(false);
  const [journeyError, setJourneyError] = useState<string | null>(null);

  const openJourney = async (student: Student) => {
    setJourneyStudent(student);
    setJourneyOpen(true);
    setJourneyData(null);
    setJourneyError(null);
    setLoadingJourney(true);
    const { data, error } = await apiFetch<JourneyData>(`/api/admin/students/${student.id}/progress`);
    if (error) { setJourneyError(error); setLoadingJourney(false); return; }
    setJourneyData(data);
    setLoadingJourney(false);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getStudentClasses = (s: any) => {
    if (!s.classIds || s.classIds.length === 0) return [];
    const allClasses = Object.values(classesMap).flat();
    return s.classIds.map((cid: string) => allClasses.find(c => c.id === cid)).filter(Boolean);
  };

  const formatDate = (ts: any): string => {
    if (!ts) return '—';
    if (ts?.toDate) return ts.toDate().toLocaleDateString();
    if (ts?.seconds) return new Date(ts.seconds * 1000).toLocaleDateString();
    return new Date(ts).toLocaleDateString();
  };

  const classIndex = useMemo(() => {
    const byId = new Map<string, ApiClass>();
    for (const list of Object.values(classesMap)) {
      for (const c of list) byId.set(c.id, c);
    }
    return byId;
  }, [classesMap]);

  const enrollmentMeta = useCallback(
    (classId: string) => {
      const cls = classIndex.get(classId);
      const stdName = cls ? standards.find((s) => s.id === cls.standardId)?.name : undefined;
      return { cls, stdName: stdName ?? 'Standard' };
    },
    [classIndex, standards]
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.text}
          <button onClick={() => setToast(null)}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
        </div>
      )}

      <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Student Management</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Add, edit, and track student progress.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => refetchStudents()} className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={() => openModal('add')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Add Student
            </button>
          </div>
        </div>

        {/* Error banner */}
        {studentsError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-800">Could not load students</p>
              <p className="text-xs text-red-600 mt-0.5">{studentsError}</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
          />
        </div>

        {/* Student count */}
        <p className="text-sm text-slate-500 font-medium">{filtered.length} of {students.length} students</p>

        {/* Loading */}
        {loadingStudents && (
          <div className="py-12 flex justify-center"><div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        )}

        {/* Empty */}
        {!loadingStudents && filtered.length === 0 && (
          <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
            <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Students Found</h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">{query ? 'No students match your search.' : 'Add students to get started.'}</p>
            {!query && <button onClick={() => openModal('add')} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-sm">Add First Student</button>}
          </div>
        )}

        {/* Table */}
        {!loadingStudents && filtered.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="py-3 px-5">Student</th>
                    <th className="py-3 px-5">Email</th>
                    <th className="py-3 px-5">Class</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map(s => {
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="py-3 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-extrabold shrink-0">
                              {(s.name ?? s.email).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900">{s.name ?? '—'}</p>
                              {s.phone && <p className="text-xs text-slate-400">{s.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-5 text-sm text-slate-600">{s.email}</td>
                        <td className="py-3 px-5">
                          <div className="flex flex-wrap gap-1.5">
                            {getStudentClasses(s).length > 0 ? (
                              getStudentClasses(s).map((cls: any) => (
                                <span key={cls.id} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-bold whitespace-nowrap">{cls.name}</span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400">Not enrolled</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-5">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openJourney(s)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5">
                              <GraduationCap className="w-3.5 h-3.5" /> Journey
                            </button>
                            <button onClick={() => openModal('edit', s)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => openModal('delete', s)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Add / Edit Student Modal ────────────────────────────────────────────── */}
      <Modal
        isOpen={modal.open && (modal.type === 'add' || modal.type === 'edit')}
        onClose={closeModal}
        title={modal.type === 'add' ? 'Add Student' : 'Edit Student'}
        size="3xl"
      >
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Full Name</label>
              <input type="text" required value={form.name ?? ''} onChange={e => setForm({ ...form, name: e.target.value })}
                className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all outline-none font-medium text-slate-900" placeholder="e.g. Arjun Sharma" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Email</label>
              <input type="email" required value={form.email ?? ''} onChange={e => setForm({ ...form, email: e.target.value })} disabled={modal.type === 'edit'}
                className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all outline-none font-medium text-slate-900 disabled:opacity-60" placeholder="student@email.com" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Phone (optional)</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="tel" value={form.phone ?? ''} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="block w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all outline-none font-medium text-slate-900" placeholder="+91 98765 43210" />
            </div>
          </div>

          {/* Class enrollment — multiple classes across standards */}
          <div className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Class enrollments</label>
              <p className="text-[11px] font-medium text-slate-500">
                {(form.classIds || []).length} class{(form.classIds || []).length === 1 ? '' : 'es'} selected · same student can join multiple
              </p>
            </div>

            {(form.classIds || []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(form.classIds || []).map((cid: string) => {
                  const { cls, stdName } = enrollmentMeta(cid);
                  return (
                    <span
                      key={cid}
                      className="inline-flex items-center gap-1 max-w-full pl-2.5 pr-1 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs font-semibold"
                    >
                      <span className="truncate min-w-0">
                        {cls?.name ?? 'Class'}
                        <span className="font-normal text-indigo-500"> · {stdName}</span>
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${cls?.name ?? 'class'}`}
                        onClick={() =>
                          setForm({
                            ...form,
                            classIds: (form.classIds || []).filter((id: string) => id !== cid),
                          })
                        }
                        className="shrink-0 p-1 rounded-md hover:bg-indigo-100 text-indigo-600 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white max-h-[min(42vh,360px)] overflow-y-auto divide-y divide-slate-100 shadow-sm">
              {standards.map((std) => {
                const stdClasses = classesMap[std.id] || [];
                if (stdClasses.length === 0) return null;
                const ids = form.classIds || [];
                const selectedInStd = stdClasses.filter((c) => ids.includes(c.id)).length;
                return (
                  <details key={std.id} className="group" open={selectedInStd > 0}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-slate-800 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2 min-w-0">
                        <BookOpen className="w-4 h-4 shrink-0 text-indigo-500" />
                        <span className="truncate">{std.name}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700 tabular-nums">
                        {selectedInStd}/{stdClasses.length}
                      </span>
                    </summary>
                    <div className="flex flex-wrap gap-2 px-4 pb-4 pt-0">
                      {stdClasses.map((cls) => {
                        const isSelected = ids.includes(cls.id);
                        return (
                          <label
                            key={cls.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const newIds = e.target.checked
                                  ? [...(form.classIds || []), cls.id]
                                  : (form.classIds || []).filter((id: string) => id !== cls.id);
                                setForm({ ...form, classIds: newIds });
                              }}
                              className="w-3.5 h-3.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                            />
                            <span className="text-xs font-bold">{cls.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
              {standards.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-slate-400">Loading standards…</p>
              )}
            </div>
          </div>

          {/* Parent details */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Parent / Guardian (optional)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Parent Name</label>
                <input type="text" value={form.parentName ?? ''} onChange={e => setForm({ ...form, parentName: e.target.value })}
                  className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all outline-none font-medium text-slate-900" placeholder="e.g. Ramesh Sharma" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Parent Email</label>
                <input type="email" value={form.parentEmail ?? ''} onChange={e => setForm({ ...form, parentEmail: e.target.value })}
                  className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all outline-none font-medium text-slate-900" placeholder="parent@email.com" />
              </div>
            </div>
          </div>

          {/* Send email checkbox (add only) */}
          {modal.type === 'add' && (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input type="checkbox" checked={form.sendEmail ?? true} onChange={e => setForm({ ...form, sendEmail: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm font-medium text-slate-700">Send enrollment email with temporary password</span>
            </label>
          )}

          {saveError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700 font-medium">{saveError}</p>
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={closeModal} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-60 transition-colors shadow-sm">{saving ? 'Saving...' : modal.type === 'add' ? 'Add Student' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* ── Delete modal ───────────────────────────────────────────────────────── */}
      <Modal isOpen={modal.open && modal.type === 'delete'} onClose={closeModal} title="Delete Student">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-8 h-8" /></div>
          <h4 className="text-lg font-bold text-slate-900 mb-2">Remove {modal.payload?.name ?? modal.payload?.email}?</h4>
          <p className="text-slate-500 mb-6">This will permanently delete the student and all associated data. This action cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={closeModal} className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-sm">Delete Student</button>
          </div>
        </div>
      </Modal>

      {/* ── Journey Slide-over ─────────────────────────────────────────────────── */}
      {journeyOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setJourneyOpen(false)} />

          {/* Panel */}
          <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right-full duration-300">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">{journeyStudent?.name ?? 'Student'}</h2>
                <p className="text-sm text-slate-500 font-medium">{journeyStudent?.email}</p>
              </div>
              <button onClick={() => setJourneyOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {loadingJourney && (
                <div className="py-16 flex flex-col items-center justify-center">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-sm text-slate-500">Loading journey data…</p>
                </div>
              )}

              {journeyError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{journeyError}</p>
                </div>
              )}

              {journeyData && !loadingJourney && (
                <>
                  {/* Enrollment */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Enrollment</h3>
                    <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center"><BookOpen className="w-4 h-4 text-indigo-600" /></div>
                      <div>
                        {journeyData.enrollment ? (
                          <>
                            <p className="text-sm font-bold text-slate-900">{journeyData.enrollment.className ?? 'Class'}</p>
                            <p className="text-xs text-slate-500">Enrolled</p>
                          </>
                        ) : (
                          <p className="text-sm font-medium text-slate-500">Not enrolled in any class</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Quiz Attempts', value: journeyData.quizAttempts.length, icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-50' },
                      { label: 'AI Sessions', value: journeyData.aiSessions.length, icon: Brain, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                      { label: 'Flagged Topics', value: journeyData.flags.length, icon: Flag, color: 'text-amber-600', bg: 'bg-amber-50' },
                    ].map((s, i) => (
                      <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
                        <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center mx-auto mb-1`}><s.icon className={`w-4 h-4 ${s.color}`} /></div>
                        <p className="text-xl font-extrabold text-slate-900">{s.value}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Topic progress */}
                  {journeyData.topicProgress.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Topic Progress</h3>
                      <div className="space-y-2">
                        {journeyData.topicProgress.map((tp, i) => (
                          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-bold text-slate-900">{tp.topicName ?? `Topic ${i + 1}`}</p>
                              {tp.flagged && (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-bold"><Flag className="w-2.5 h-2.5" /> Flagged</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className={`flex items-center gap-1 ${tp.prereqPassed ? 'text-green-600' : 'text-slate-400'}`}>
                                <CheckCircle2 className="w-3 h-3" /> Prereq
                              </span>
                              <span className={`flex items-center gap-1 ${tp.contentUnlocked ? 'text-green-600' : 'text-slate-400'}`}>
                                <CheckCircle2 className="w-3 h-3" /> Unlocked
                              </span>
                              <span className={`flex items-center gap-1 ${tp.finalTestPassed ? 'text-green-600' : 'text-slate-400'}`}>
                                <CheckCircle2 className="w-3 h-3" /> Final Test
                              </span>
                              {tp.aiAttempts > 0 && <span className="text-indigo-500"><Brain className="w-3 h-3 inline mr-0.5" />{tp.aiAttempts} AI</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Flags */}
                  {journeyData.flags.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Flagged Issues</h3>
                      <div className="space-y-2">
                        {journeyData.flags.map((f, i) => (
                          <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center gap-3">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-amber-900 truncate">{f.topicName ?? 'Unknown Topic'}</p>
                              <p className="text-xs text-amber-600">{f.flagType} · {formatDate(f.flaggedAt)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent quiz attempts */}
                  {journeyData.quizAttempts.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Recent Quiz Attempts</h3>
                      <div className="space-y-2">
                        {journeyData.quizAttempts.slice(0, 10).map((a, i) => (
                          <div key={i} className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-slate-900">Attempt {i + 1}</p>
                              <p className="text-xs text-slate-400">{formatDate(a.timestamp)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-extrabold text-slate-900">{a.score}/{a.total}</p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${a.passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                {a.passed ? 'PASS' : 'FAIL'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {journeyData.topicProgress.length === 0 && journeyData.quizAttempts.length === 0 && (
                    <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                      <GraduationCap className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">No learning activity yet.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
