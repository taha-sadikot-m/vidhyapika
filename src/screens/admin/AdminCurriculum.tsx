import React, { useState, useCallback, useEffect } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { Modal } from '../../components/ui/Modal';
import { LevelImportPanel } from '../../components/LevelImportPanel';
import { ThresholdSlider } from '../../components/ui/ThresholdSlider';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { 
  Plus, Edit2, Trash2, ChevronRight, 
  BookOpen, Layers, ListTree, AlertTriangle, Calculator,
  Video, HelpCircle, FileText, ArrowLeft, PlayCircle, CheckCircle2,
  Network, ClipboardCheck, X, BarChart2, Trophy, Sparkles,
  Image as ImageIcon, Upload,
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { apiFetch } from '../../hooks/useApi';

// ─── Types ────────────────────────────────────────────────────────────────────

type ViewLevel = 'standards' | 'classes' | 'topics' | 'subtopics';

type ApiStandard = { id: string; name: string; description?: string; order: number };
type ApiClass    = { id: string; standardId: string; name: string; passingThreshold: number };
type ApiTopic    = { id: string; classId: string; name: string; order: number; finalTestThreshold: number };
type ApiSubTopic = { id: string; topicId: string; name: string; order: number; youtubeUrl?: string; passingThreshold: number };
type ApiPrereq   = { id: string; topicId: string; name: string; description?: string; passingThreshold: number; maxAIAttempts: number };

type QuestionType = 'mcq' | 'true_false' | 'text' | 'image_upload';
type Question = {
  id: string;
  text: string;
  type: QuestionType;
  imageUrl?: string | null;
  options?: string[];
  correctAnswer?: string | null;
  explanation?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  contextType?: string;
  contextId?: string;
  order?: number;
};

// ─── Math renderer ────────────────────────────────────────────────────────────

function MathText({ text }: { text: string }) {
  if (!text) return null;
  // Split by $$...$$ (block) and $...$ (inline)
  const parts: React.ReactNode[] = [];
  const blockRe = /\$\$(.+?)\$\$/gs;
  const inlineRe = /\$(.+?)\$/g;

  let last = 0;
  let i = 0;
  const merged = text.replace(blockRe, (_, math) => `\x00BLOCK:${math}\x00`)
                      .replace(inlineRe, (_, math) => `\x00INLINE:${math}\x00`);
  const segments = merged.split('\x00').filter(Boolean);

  for (const seg of segments) {
    if (seg.startsWith('BLOCK:')) {
      parts.push(<BlockMath key={i++} math={seg.slice(6)} />);
    } else if (seg.startsWith('INLINE:')) {
      parts.push(<InlineMath key={i++} math={seg.slice(7)} />);
    } else {
      parts.push(<span key={i++}>{seg}</span>);
    }
  }
  return <>{parts}</>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getYoutubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return match && match[2].length === 11 ? `https://www.youtube.com/embed/${match[2]}` : null;
}

// ─── Real quiz analytics component (replaces mock generator) ─────────────────

type QuizAnalyticsSummary = {
  totalAttempts: number;
  uniqueStudents: number;
  avgScore: number;
  passRate: number;
  totalQuestions: number;
};
type QuizQuestionStat = {
  id: string;
  label: string;
  text: string;
  type: string;
  correctAttempts: number;
  incorrectAttempts: number;
  totalAttempts: number;
  successRate: number;
};

function QuizAnalyticsPanel({
  contextType,
  contextId,
  accentColor,
}: {
  contextType: string;
  contextId: string;
  accentColor: string;
}) {
  const [loading, setLoading] = React.useState(true);
  const [hasData, setHasData] = React.useState(false);
  const [hasAttempts, setHasAttempts] = React.useState(false);
  const [summary, setSummary] = React.useState<QuizAnalyticsSummary | null>(null);
  const [questionStats, setQuestionStats] = React.useState<QuizQuestionStat[]>([]);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!contextId) return;
    setLoading(true);
    setFetchError(null);
    apiFetch<any>(
      `/api/admin/analytics/quiz-questions?contextType=${contextType}&contextId=${contextId}`
    ).then(({ data, error }) => {
      if (error) { setFetchError(error); setLoading(false); return; }
      setHasData(data?.hasData ?? false);
      setHasAttempts(data?.hasAttempts ?? false);
      setSummary(data?.summary ?? null);
      setQuestionStats(data?.questions ?? []);
      setLoading(false);
    });
  }, [contextType, contextId]);

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium">Loading analytics…</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-red-800">Could not load analytics</p>
          <p className="text-xs text-red-600 mt-0.5">{fetchError}</p>
        </div>
      </div>
    );
  }

  if (!hasData || questionStats.length === 0) {
    return (
      <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
        <BarChart2 className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-slate-900 mb-2">No Analytics Yet</h3>
        <p className="text-slate-500">Add questions to see performance analytics.</p>
      </div>
    );
  }

  if (!hasAttempts) {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-start gap-3">
          <BarChart2 className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-blue-800">{questionStats.length} question{questionStats.length !== 1 ? 's' : ''} configured — no attempts yet</p>
            <p className="text-xs text-blue-600 mt-0.5">Analytics will appear here once students start taking this quiz.</p>
          </div>
        </div>
        <div className="space-y-2">
          {questionStats.map((q) => (
            <div key={q.id} className="bg-white border border-slate-100 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-xs font-extrabold text-slate-400 w-8 shrink-0">{q.label}</span>
              <p className="text-sm text-slate-700 truncate flex-1">{q.text}</p>
              <span className="text-xs text-slate-400 shrink-0">{q.type}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const pieData = [
    { name: 'Pass', value: summary!.passRate, fill: accentColor },
    { name: 'Gap', value: 100 - summary!.passRate, fill: '#e2e8f0' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-center">
          <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">Questions</p>
          <p className="text-3xl font-extrabold text-blue-900">{summary!.totalQuestions}</p>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">Students</p>
          <p className="text-3xl font-extrabold text-indigo-900">{summary!.uniqueStudents}</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 text-center">
          <p className="text-xs font-bold text-green-500 uppercase tracking-widest mb-1">Avg Score</p>
          <p className="text-3xl font-extrabold text-green-900">{summary!.avgScore}%</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Pass Rate</p>
          <div className="relative w-16 h-16">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={22} outerRadius={30} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                  {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-slate-900">{summary!.passRate}%</span>
          </div>
        </div>
      </div>

      {/* Total attempts */}
      <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
        <span className="font-bold text-slate-700">{summary!.totalAttempts}</span> total attempts across
        <span className="font-bold text-slate-700">{summary!.uniqueStudents}</span> unique students
      </div>

      {/* Per-question bar chart */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-extrabold text-slate-900 mb-1">Question-by-Question Performance</h3>
        <p className="text-xs text-slate-500 mb-5">Correct vs Incorrect per question (from real attempt data)</p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={questionStats} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} dx={-10} />
              <RechartsTooltip
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
                formatter={(value: any, name: string, props: any) => [
                  `${value} (${props?.payload?.successRate ?? 0}% success)`,
                  name,
                ]}
                labelFormatter={(label, payload) => {
                  const q = payload?.[0]?.payload as QuizQuestionStat | undefined;
                  return q ? `${label}: ${q.text.slice(0, 60)}${q.text.length > 60 ? '…' : ''}` : label;
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '16px' }} />
              <Bar dataKey="correctAttempts" name="Correct" stackId="a" fill="#22c55e" radius={[0, 0, 4, 4]} maxBarSize={48} />
              <Bar dataKey="incorrectAttempts" name="Incorrect" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-question detail rows */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-extrabold text-slate-700">Question Detail</h3>
        </div>
        <div className="divide-y divide-slate-50">
          {questionStats.map((q) => (
            <div key={q.id} className="px-5 py-3 flex items-center gap-4">
              <span className="text-xs font-extrabold text-slate-400 w-8 shrink-0">{q.label}</span>
              <p className="text-sm text-slate-700 flex-1 truncate">{q.text}</p>
              <div className="flex items-center gap-3 shrink-0 text-xs font-bold">
                <span className="text-green-600">{q.correctAttempts} ✓</span>
                <span className="text-red-500">{q.incorrectAttempts} ✗</span>
                <span className={`px-2 py-0.5 rounded-md ${
                  q.successRate >= 75 ? 'bg-emerald-50 text-emerald-700' :
                  q.successRate >= 50 ? 'bg-amber-50 text-amber-700' :
                  'bg-red-50 text-red-700'
                }`}>{q.successRate}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const DIFFICULTY_STYLES: Record<string, string> = {
  Easy: 'bg-green-50 text-green-700',
  Medium: 'bg-amber-50 text-amber-700',
  Hard: 'bg-red-50 text-red-700',
};

const QTYPE_LABELS: Record<string, string> = {
  mcq: 'Multiple Choice',
  true_false: 'True / False',
  text: 'Short Answer',
  image_upload: 'Image Upload',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminCurriculum() {
  // ── Navigation ──────────────────────────────────────────────────────────────
  const [view, setView] = useState<ViewLevel>('standards');
  const [selection, setSelection] = useState({ standardId: '', classId: '', topicId: '', subtopicId: '' });
  const [activeTab, setActiveTab] = useState<string>('video');

  // ── Data maps ───────────────────────────────────────────────────────────────
  const [standards, setStandards]     = useState<ApiStandard[]>([]);
  const [classesMap, setClassesMap]   = useState<Record<string, ApiClass[]>>({});
  const [topicsMap, setTopicsMap]     = useState<Record<string, ApiTopic[]>>({});
  const [subTopicsMap, setSubTopicsMap] = useState<Record<string, ApiSubTopic[]>>({});
  // N prerequisites per topic
  const [prereqsMap, setPrereqsMap]   = useState<Record<string, ApiPrereq[]>>({});
  // Questions keyed as `${contextType}:${contextId}`
  const [questionsMap, setQuestionsMap] = useState<Record<string, Question[]>>({});

  // ── Loading ─────────────────────────────────────────────────────────────────
  const [loadingStd, setLoadingStd] = useState(false);
  const [loadingCls, setLoadingCls] = useState(false);
  const [loadingTop, setLoadingTop] = useState(false);
  const [loadingSub, setLoadingSub] = useState(false);

  // ── Modal / form ────────────────────────────────────────────────────────────
  const [modal, setModal]     = useState<{ isOpen: boolean; type: string; payload: any }>({ isOpen: false, type: '', payload: null });
  const [formData, setFormData] = useState<any>({});
  const [saving, setSaving]   = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Toast ───────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const showToast = useCallback((ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const currentStandard  = standards.find(s => s.id === selection.standardId);
  const currentClasses   = classesMap[selection.standardId] ?? [];
  const currentClass     = currentClasses.find(c => c.id === selection.classId);
  const currentTopics    = topicsMap[selection.classId] ?? [];
  const currentTopic     = currentTopics.find(t => t.id === selection.topicId);
  const currentSubTopics = subTopicsMap[selection.topicId] ?? [];
  const currentSubtopic  = currentSubTopics.find(s => s.id === selection.subtopicId);
  const currentPrereqs   = prereqsMap[selection.topicId] ?? [];

  // Determine which prereq is selected from sidebar id like "prereq-{id}"
  const selectedPrereqId = selection.subtopicId.startsWith('prereq-') ? selection.subtopicId.slice(7) : null;
  const selectedPrereq   = selectedPrereqId ? currentPrereqs.find(p => p.id === selectedPrereqId) : null;
  const prereqQuestions  = selectedPrereqId ? (questionsMap[`prereq:${selectedPrereqId}`] ?? []) : [];

  const finalTestQuestions = questionsMap[`finaltest:${selection.topicId}`] ?? [];
  const subtopicQuestions  = questionsMap[`subtopic:${selection.subtopicId}`] ?? [];

  // ── Loaders ──────────────────────────────────────────────────────────────────

  const loadStandards = useCallback(async () => {
    setLoadingStd(true);
    const { data } = await apiFetch<{ standards: ApiStandard[] }>('/api/admin/standards');
    setStandards(data?.standards ?? []);
    setLoadingStd(false);
  }, []);

  const loadClasses = useCallback(async (standardId: string) => {
    setLoadingCls(true);
    const { data } = await apiFetch<{ classes: ApiClass[] }>(`/api/admin/standards/${standardId}/classes`);
    setClassesMap(m => ({ ...m, [standardId]: data?.classes ?? [] }));
    setLoadingCls(false);
  }, []);

  const loadTopics = useCallback(async (classId: string) => {
    setLoadingTop(true);
    const { data } = await apiFetch<{ topics: ApiTopic[] }>(`/api/admin/classes/${classId}/topics`);
    setTopicsMap(m => ({ ...m, [classId]: data?.topics ?? [] }));
    setLoadingTop(false);
  }, []);

  const loadSubTopics = useCallback(async (topicId: string) => {
    setLoadingSub(true);
    const { data } = await apiFetch<{ subTopics: ApiSubTopic[] }>(`/api/admin/topics/${topicId}/subtopics`);
    setSubTopicsMap(m => ({ ...m, [topicId]: data?.subTopics ?? [] }));
    setLoadingSub(false);
  }, []);

  const loadPrereqs = useCallback(async (topicId: string) => {
    const { data } = await apiFetch<{ prerequisites: ApiPrereq[] }>(`/api/admin/topics/${topicId}/prerequisite`);
    const prereqs = data?.prerequisites ?? [];
    setPrereqsMap(m => ({ ...m, [topicId]: prereqs }));
    // Load questions for all prereqs
    for (const p of prereqs) {
      const key = `prereq:${p.id}`;
      const { data: qd } = await apiFetch<{ questions: Question[] }>(`/api/admin/questions?contextType=prereq&contextId=${p.id}`);
      setQuestionsMap(m => ({ ...m, [key]: qd?.questions ?? [] }));
    }
  }, []);

  const loadQuestions = useCallback(async (contextType: string, contextId: string) => {
    const key = `${contextType}:${contextId}`;
    const { data } = await apiFetch<{ questions: Question[] }>(`/api/admin/questions?contextType=${contextType}&contextId=${contextId}`);
    setQuestionsMap(m => ({ ...m, [key]: data?.questions ?? [] }));
  }, []);

  // ── Effects ──────────────────────────────────────────────────────────────────

  useEffect(() => { loadStandards(); }, []);
  useEffect(() => { if (selection.standardId) loadClasses(selection.standardId); }, [selection.standardId]);
  useEffect(() => { if (selection.classId) loadTopics(selection.classId); }, [selection.classId]);

  useEffect(() => {
    if (view === 'subtopics' && selection.topicId) {
      loadSubTopics(selection.topicId);
      loadPrereqs(selection.topicId);
      loadQuestions('finaltest', selection.topicId);
    }
  }, [view, selection.topicId]);

  useEffect(() => {
    const id = selection.subtopicId;
    if (id && !id.startsWith('prereq-') && id !== 'prerequisites' && id !== 'preevaluation' && id !== 'finaltest') {
      loadQuestions('subtopic', id);
    }
  }, [selection.subtopicId]);

  // ── Navigation ────────────────────────────────────────────────────────────────

  const navigateTo = (level: ViewLevel, ids: Partial<typeof selection> = {}) => {
    setSelection(prev => ({ ...prev, ...ids }));
    setView(level);
    if (level === 'subtopics') setActiveTab('video');
  };

  // ── Modal helpers ─────────────────────────────────────────────────────────────

  const openModal = (type: string, payload: any = null) => {
    setSaveError(null);
    setModal({ isOpen: true, type, payload });
    if (type.startsWith('edit-')) {
      setFormData({ 
        ...payload,
        optionsArray: payload?.options?.length ? [...payload.options] : ['', '', '', ''],
      });
    } else if (type === 'add-topic') {
      setFormData({ order: (currentTopics.length) + 1 });
    } else if (['add-quiz', 'add-preeval-quiz', 'add-finaltest-quiz'].includes(type)) {
      setFormData({ type: 'mcq', difficulty: 'Medium', optionsArray: ['', '', '', ''] });
    } else if (type === 'add-prerequisite') {
      setFormData({ passingThreshold: 60, maxAIAttempts: 3 });
    } else if (type === 'add-subtopic') {
      setFormData({ passingThreshold: 60 });
    } else {
      setFormData({});
    }
  };

  const closeModal = () => { setModal({ isOpen: false, type: '', payload: null }); setSaveError(null); };

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    const { type, payload } = modal;

    try {
    if (type === 'add-standard') {
        const { error } = await apiFetch('/api/admin/standards', { method: 'POST', body: JSON.stringify({ name: formData.name, description: formData.description, order: Number(formData.order ?? 0) }) });
        if (error) throw new Error(error);
        await loadStandards(); closeModal();

    } else if (type === 'edit-standard') {
        const { error } = await apiFetch(`/api/admin/standards/${payload.id}`, { method: 'PUT', body: JSON.stringify({ name: formData.name, description: formData.description, order: Number(formData.order ?? payload.order ?? 0) }) });
        if (error) throw new Error(error);
        await loadStandards(); closeModal();

    } else if (type === 'add-class') {
        const { error } = await apiFetch(`/api/admin/standards/${selection.standardId}/classes`, { method: 'POST', body: JSON.stringify({ name: formData.name, passingThreshold: Number(formData.passingThreshold ?? 60) }) });
        if (error) throw new Error(error);
        await loadClasses(selection.standardId); closeModal();

    } else if (type === 'edit-class') {
        const { error } = await apiFetch(`/api/admin/classes/${payload.id}`, { method: 'PUT', body: JSON.stringify({ name: formData.name, passingThreshold: Number(formData.passingThreshold ?? 60) }) });
        if (error) throw new Error(error);
        await loadClasses(selection.standardId); closeModal();

    } else if (type === 'add-topic') {
        const { error } = await apiFetch(`/api/admin/classes/${selection.classId}/topics`, { method: 'POST', body: JSON.stringify({ name: formData.name, order: Number(formData.order ?? 0), finalTestThreshold: 60 }) });
        if (error) throw new Error(error);
        await loadTopics(selection.classId); closeModal();

    } else if (type === 'edit-topic') {
        const { error } = await apiFetch(`/api/admin/topics/${payload.id}`, { method: 'PUT', body: JSON.stringify({ name: formData.name, order: Number(formData.order ?? payload.order ?? 0) }) });
        if (error) throw new Error(error);
        await loadTopics(selection.classId); closeModal();

    } else if (type === 'add-subtopic') {
        const { error } = await apiFetch(`/api/admin/topics/${selection.topicId}/subtopics`, { method: 'POST', body: JSON.stringify({ name: formData.name, order: currentSubTopics.length, youtubeUrl: '', passingThreshold: Number(formData.passingThreshold ?? 60) }) });
        if (error) throw new Error(error);
        await loadSubTopics(selection.topicId); closeModal();

    } else if (type === 'edit-subtopic') {
        const { error } = await apiFetch(`/api/admin/subtopics/${payload.id}`, { method: 'PUT', body: JSON.stringify({ name: formData.name, passingThreshold: Number(formData.passingThreshold ?? payload.passingThreshold ?? 60) }) });
        if (error) throw new Error(error);
        await loadSubTopics(selection.topicId); closeModal();

    } else if (type === 'edit-video') {
        const { error } = await apiFetch(`/api/admin/subtopics/${selection.subtopicId}`, { method: 'PUT', body: JSON.stringify({ youtubeUrl: formData.videoUrl ?? '' }) });
        if (error) throw new Error(error);
        await loadSubTopics(selection.topicId); closeModal();

    } else if (type === 'add-prerequisite') {
        const { error } = await apiFetch(`/api/admin/topics/${selection.topicId}/prerequisite`, { method: 'POST', body: JSON.stringify({ name: formData.name ?? 'Prerequisite', description: formData.description ?? '', passingThreshold: Number(formData.passingThreshold ?? 60), maxAIAttempts: Number(formData.maxAIAttempts ?? 3) }) });
        if (error) throw new Error(error);
        await loadPrereqs(selection.topicId); closeModal();

    } else if (type === 'edit-prerequisite') {
        const { error } = await apiFetch(`/api/admin/prerequisites/${payload.id}`, { method: 'PUT', body: JSON.stringify({ name: formData.name, description: formData.description ?? '', passingThreshold: Number(formData.passingThreshold ?? 60), maxAIAttempts: Number(formData.maxAIAttempts ?? 3) }) });
        if (error) throw new Error(error);
        await loadPrereqs(selection.topicId); closeModal();

      } else if (['add-quiz', 'edit-quiz', 'add-preeval-quiz', 'edit-preeval-quiz', 'add-finaltest-quiz', 'edit-finaltest-quiz'].includes(type)) {
        const isPreeval   = type.includes('preeval');
        const isFinaltest = type.includes('finaltest');
        const contextType = isPreeval ? 'prereq' : isFinaltest ? 'finaltest' : 'subtopic';
        const contextId   = isPreeval ? (selectedPrereqId ?? '') : isFinaltest ? selection.topicId : selection.subtopicId;

        const qType = formData.type ?? 'mcq';
        const options = qType === 'mcq'
          ? (formData.optionsArray ?? []).filter((o: string) => o.trim() !== '')
          : qType === 'true_false' ? ['True', 'False'] : undefined;

        const body = {
          contextType, contextId,
          text: formData.text,
          type: qType,
          options: options ?? null,
          correctAnswer: formData.correctAnswer ?? null,
          imageUrl: formData.imageUrl?.trim() || null,
          difficulty: formData.difficulty ?? 'Medium',
          explanation: formData.explanation ?? '',
          order: formData.order ?? 0,
        };

        if (type.startsWith('edit-')) {
          const { error } = await apiFetch(`/api/admin/questions/${payload.id}`, { method: 'PUT', body: JSON.stringify(body) });
          if (error) throw new Error(error);
        } else {
          const { error } = await apiFetch('/api/admin/questions', { method: 'POST', body: JSON.stringify(body) });
          if (error) throw new Error(error);
        }
        await loadQuestions(contextType, contextId);
        closeModal();
      }
    } catch (err: any) {
      setSaveError(err.message);
    }
    setSaving(false);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    const { itemType, id } = modal.payload ?? {};
    if (!itemType || !id) return;
    const urlMap: Record<string, string> = {
      standard: `/api/admin/standards/${id}`,
      class:    `/api/admin/classes/${id}`,
      topic:    `/api/admin/topics/${id}`,
      subtopic: `/api/admin/subtopics/${id}`,
      prerequisite: `/api/admin/prerequisites/${id}`,
      quiz:         `/api/admin/questions/${id}`,
      'preeval-quiz': `/api/admin/questions/${id}`,
      'finaltest-quiz': `/api/admin/questions/${id}`,
    };
    const { error } = await apiFetch(urlMap[itemType], { method: 'DELETE' });
    if (error) { showToast(false, `Delete failed: ${error}`); closeModal(); return; }
    closeModal();
    if (itemType === 'standard') { await loadStandards(); setSelection(s => ({ ...s, standardId: '' })); setView('standards'); }
    else if (itemType === 'class') { await loadClasses(selection.standardId); setSelection(s => ({ ...s, classId: '' })); setView('classes'); }
    else if (itemType === 'topic') { await loadTopics(selection.classId); setSelection(s => ({ ...s, topicId: '' })); setView('topics'); }
    else if (itemType === 'subtopic') await loadSubTopics(selection.topicId);
    else if (itemType === 'prerequisite') { await loadPrereqs(selection.topicId); setSelection(s => ({ ...s, subtopicId: 'prerequisites' })); }
    else if (itemType === 'quiz') await loadQuestions('subtopic', selection.subtopicId);
    else if (itemType === 'preeval-quiz' && selectedPrereqId) await loadQuestions('prereq', selectedPrereqId);
    else if (itemType === 'finaltest-quiz') await loadQuestions('finaltest', selection.topicId);
  };

  // ── Import handlers ─────────────────────────────────────────────────────────

  const handleImportTopics = async (items: any[]) => {
    for (const item of items) {
      await apiFetch(`/api/admin/classes/${selection.classId}/topics`, { method: 'POST', body: JSON.stringify({ name: item.title ?? item.topic_title, order: Number(item.sequence ?? item.topic_sequence ?? 0), finalTestThreshold: 60 }) });
    }
    await loadTopics(selection.classId);
  };

  const handleImportSubtopics = async (items: any[]) => {
    for (const item of items) {
      await apiFetch(`/api/admin/topics/${selection.topicId}/subtopics`, { method: 'POST', body: JSON.stringify({ name: item.title ?? item.subtopic_title, order: currentSubTopics.length, youtubeUrl: item.videoUrl ?? item.subtopic_video ?? '', passingThreshold: 60 }) });
    }
    await loadSubTopics(selection.topicId);
  };

  const makeImportQuestions = (contextType: string, contextId: string) => async (items: any[]) => {
    for (const item of items) {
      const qType = item.type === 'boolean' ? 'true_false' : (item.type ?? 'mcq');
      await apiFetch('/api/admin/questions', { method: 'POST', body: JSON.stringify({ contextType, contextId, text: item.text ?? item.question_text ?? '', type: qType, options: item.options ?? null, correctAnswer: item.correctAnswer ?? item.correct_answer ?? null, imageUrl: null, difficulty: item.difficulty ?? 'Medium', explanation: item.explanation ?? '', order: 0 }) });
    }
    await loadQuestions(contextType, contextId);
  };

  // ── Breadcrumbs ───────────────────────────────────────────────────────────────

  const renderBreadcrumbs = () => (
      <div className="flex items-center gap-2 text-sm font-medium text-slate-600 overflow-x-auto whitespace-nowrap pb-4 mb-4 border-b border-slate-200">
        <div className="flex items-center gap-2 mr-2 pr-4 border-r border-slate-300">
          <Calculator className="w-5 h-5 text-blue-600" />
          <span className="font-bold text-slate-900">Curriculum</span>
        </div>
      <button onClick={() => navigateTo('standards')} className={`hover:text-blue-600 transition-colors ${view === 'standards' ? 'text-blue-600 font-bold' : ''}`}>Standards</button>
      {view !== 'standards' && currentStandard && (<><ChevronRight className="w-4 h-4 text-slate-300 shrink-0" /><button onClick={() => navigateTo('classes')} className={`hover:text-blue-600 transition-colors ${view === 'classes' ? 'text-blue-600 font-bold' : ''}`}>{currentStandard.name}</button></>)}
      {['topics', 'subtopics'].includes(view) && currentClass && (<><ChevronRight className="w-4 h-4 text-slate-300 shrink-0" /><button onClick={() => navigateTo('topics')} className={`hover:text-blue-600 transition-colors ${view === 'topics' ? 'text-blue-600 font-bold' : ''}`}>{currentClass.name}</button></>)}
      {view === 'subtopics' && currentTopic && (<><ChevronRight className="w-4 h-4 text-slate-300 shrink-0" /><span className="text-slate-900 font-bold">{currentTopic.name}</span></>)}
      </div>
    );

  // ── Standards view ─────────────────────────────────────────────────────────────

  const renderStandards = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-4 bg-white p-5 sm:px-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900">Curriculum Standards</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">Manage the top-level educational standards (e.g. CBSE, ICSE, Grade levels).</p>
        </div>
        <button onClick={() => openModal('add-standard')} className="px-5 py-2.5 bg-[#0084B4] text-white rounded-xl text-sm font-extrabold hover:bg-[#006A91] hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 shadow-sm shrink-0">
          <Plus className="w-4 h-4" /> Add Standard
        </button>
      </div>

      {loadingStd ? <Spinner /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {standards.map(std => (
            <div key={std.id} className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 group flex flex-col h-full relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-[#0084B4] opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex justify-between items-start mb-5">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm border border-blue-200/50">
                  <Layers className="w-7 h-7" />
                </div>
                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                  <button onClick={() => openModal('edit-standard', std)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => openModal('delete-confirm', { itemType: 'standard', id: std.id, name: std.name })} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-slate-900 mb-1.5 leading-tight">{std.name}</h3>
                <p className="text-sm font-semibold text-slate-500 bg-slate-50 inline-flex items-center px-2.5 py-1 rounded-lg border border-slate-100">{(classesMap[std.id] ?? []).length} Classes</p>
              </div>
              <button onClick={() => navigateTo('classes', { standardId: std.id })} className="mt-6 w-full py-3 bg-slate-50 hover:bg-[#0084B4] text-slate-700 hover:text-white font-extrabold rounded-xl transition-all text-sm flex items-center justify-center gap-2 group-hover:shadow-md">
                Manage Classes <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
            </div>
          ))}
          {standards.length === 0 && <div className="col-span-full"><EmptyState icon={<Layers className="w-12 h-12 text-slate-300" />} title="No Standards Found" desc="Get started by adding your first educational standard." /></div>}
        </div>
      )}
    </div>
  );

  // ── Classes view ──────────────────────────────────────────────────────────────

  const renderClasses = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-4 bg-white p-5 sm:px-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900">Classes in {currentStandard?.name}</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">Organize content into specific classes, grades, or sections.</p>
        </div>
        <button onClick={() => openModal('add-class')} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-extrabold hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 shadow-sm shrink-0">
          <Plus className="w-4 h-4" /> Add Class
        </button>
      </div>

      {loadingCls ? <Spinner /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {currentClasses.map(cls => (
            <div key={cls.id} className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 group flex flex-col h-full relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex justify-between items-start mb-5">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm border border-indigo-200/50">
                  <BookOpen className="w-7 h-7" />
                </div>
                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                  <button onClick={() => openModal('edit-class', cls)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => openModal('delete-confirm', { itemType: 'class', id: cls.id, name: cls.name })} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-slate-900 mb-1.5 leading-tight">{cls.name}</h3>
                <p className="text-sm font-semibold text-slate-500 bg-slate-50 inline-flex items-center px-2.5 py-1 rounded-lg border border-slate-100">{(topicsMap[cls.id] ?? []).length} Topics</p>
              </div>
              <button onClick={() => navigateTo('topics', { classId: cls.id })} className="mt-6 w-full py-3 bg-slate-50 hover:bg-indigo-600 text-slate-700 hover:text-white font-extrabold rounded-xl transition-all text-sm flex items-center justify-center gap-2 group-hover:shadow-md">
                Manage Topics <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
            </div>
          ))}
          {currentClasses.length === 0 && <div className="col-span-full"><EmptyState icon={<BookOpen className="w-12 h-12 text-slate-300" />} title="No Classes Found" desc="Add classes or sections to this standard." /></div>}
        </div>
      )}
    </div>
  );

  // ── Topics view ───────────────────────────────────────────────────────────────

  const renderTopics = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex sm:flex-row flex-col sm:justify-between sm:items-center gap-4 bg-white p-5 sm:px-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-black text-slate-900">Topics in {currentClass?.name}</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">Define the learning sequence and core subject modules.</p>
        </div>
        <button onClick={() => openModal('add-topic')} className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-extrabold hover:bg-emerald-700 hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 shadow-sm shrink-0">
          <Plus className="w-4 h-4" /> Add Topic
        </button>
      </div>

      {loadingTop ? <Spinner /> : (
        <>
          <div className="space-y-3">
            {currentTopics.map(topic => (
              <div key={topic.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-emerald-300 hover:shadow-md transition-all duration-300 group relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-emerald-400 to-emerald-600 opacity-50 group-hover:opacity-100 transition-opacity" />
                
                <div className="flex items-center gap-5 pl-2">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 font-black flex items-center justify-center border border-emerald-100 shadow-inner text-lg shrink-0">
                    {topic.order}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-lg mb-1">{topic.name}</h3>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                        {(subTopicsMap[topic.id] ?? []).length} Sub-topics
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 mr-1">
                    <button onClick={() => openModal('edit-topic', topic)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => openModal('delete-confirm', { itemType: 'topic', id: topic.id, name: topic.name })} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <button onClick={() => navigateTo('subtopics', { topicId: topic.id, subtopicId: 'prerequisites' })} className="px-5 py-2.5 bg-slate-50 hover:bg-emerald-600 text-slate-700 hover:text-white font-extrabold rounded-xl transition-all text-sm flex items-center gap-2 border border-slate-200 hover:border-emerald-600 hover:shadow-md group-hover:bg-slate-100">
                    Manage Content <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {currentTopics.length === 0 && (
              <div className="py-16 text-center bg-white border border-slate-200 border-dashed rounded-3xl">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ListTree className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-1">No Topics Found</h3>
                <p className="text-slate-500 font-medium">Add topics to build the curriculum sequence.</p>
              </div>
            )}
          </div>
          <div className="mt-6">
            <LevelImportPanel target="topics" accent="emerald" contextLabel={currentClass?.name} onImport={handleImportTopics} />
          </div>
        </>
      )}
    </div>
  );

  // ── Quiz card ─────────────────────────────────────────────────────────────────

  const renderQuizCard = (quiz: Question, index: number, editType: string, deleteType: string) => (
    <div key={quiz.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative group">
      <div className="absolute top-5 right-5 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => openModal(editType, quiz)} className="p-2 bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg"><Edit2 className="w-4 h-4" /></button>
        <button onClick={() => openModal('delete-confirm', { itemType: deleteType, id: quiz.id, name: 'Question' })} className="p-2 bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-700 rounded-lg"><Trash2 className="w-4 h-4" /></button>
      </div>
      {/* Badge row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center font-bold text-sm shrink-0">Q{index + 1}</span>
        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-bold uppercase tracking-wider">{QTYPE_LABELS[quiz.type] ?? quiz.type}</span>
        {quiz.difficulty && <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${DIFFICULTY_STYLES[quiz.difficulty] ?? ''}`}>{quiz.difficulty}</span>}
      </div>
      {/* Question image */}
      {quiz.imageUrl && (
        <div className="mb-4 rounded-xl overflow-hidden border border-slate-200 max-w-sm">
          <img src={quiz.imageUrl} alt="Question diagram" className="w-full object-contain max-h-48" />
        </div>
      )}
      {/* Question text with math */}
      <div className="text-base font-semibold text-slate-900 mb-5 pr-20 leading-relaxed">
        <MathText text={quiz.text} />
      </div>
      {/* MCQ / T-F options */}
      {(quiz.type === 'mcq' || quiz.type === 'true_false') && quiz.options && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          {quiz.options.map((opt, oIndex) => {
            const isCorrect = opt === quiz.correctAnswer;
            return (
              <div key={oIndex} className={`p-3.5 rounded-xl border-2 flex items-center justify-between ${isCorrect ? 'border-green-500 bg-green-50' : 'border-slate-100 bg-slate-50'}`}>
                <div className={`font-medium text-sm ${isCorrect ? 'text-green-900' : 'text-slate-700'}`}><MathText text={opt} /></div>
                {isCorrect && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 ml-2" />}
              </div>
            );
          })}
        </div>
      )}
      {/* Image upload hint */}
      {quiz.type === 'image_upload' && (
        <div className="mb-5 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 flex items-center gap-3">
          <Upload className="w-5 h-5 text-blue-500 shrink-0" />
          <span className="text-sm font-medium text-blue-800">Students upload a photo of their handwritten solution.</span>
        </div>
      )}
      {/* Short answer */}
      {quiz.type === 'text' && quiz.correctAnswer && (
        <div className="mb-5 p-4 rounded-xl border-2 border-green-500 bg-green-50 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <span className="text-[10px] font-bold text-green-700 uppercase tracking-widest block mb-0.5">Accepted Answer</span>
            <span className="font-medium text-green-900 text-sm"><MathText text={quiz.correctAnswer} /></span>
          </div>
        </div>
      )}
      {/* Explanation */}
      {quiz.explanation && (
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest block mb-1">Explanation</span>
          <p className="text-sm text-blue-900"><MathText text={quiz.explanation} /></p>
        </div>
      )}
    </div>
  );

  // renderAnalyticsPanel replaced by <QuizAnalyticsPanel> component above

  // ── Prerequisites panel (multiple) ────────────────────────────────────────────

  const renderPrerequisites = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Prerequisites</h2>
          <p className="text-sm text-slate-500 mt-0.5">Each prerequisite has its own passing threshold and test questions.</p>
        </div>
        <button onClick={() => openModal('add-prerequisite')} className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors shadow-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Add Prerequisite</button>
      </div>
      {currentPrereqs.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
          <Network className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 mb-2">No Prerequisites Configured</h3>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">Add prerequisites that students must pass before accessing this topic.</p>
          <button onClick={() => openModal('add-prerequisite')} className="px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-sm">Add First Prerequisite</button>
        </div>
      ) : (
        <div className="space-y-3">
          {currentPrereqs.map((prereq, i) => {
            const qCount = (questionsMap[`prereq:${prereq.id}`] ?? []).length;
            return (
              <div key={prereq.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm group">
                <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-extrabold text-sm">{i + 1}</div>
                    <div>
                      <h3 className="font-bold text-slate-900">{prereq.name}</h3>
                      {prereq.description && <p className="text-xs text-slate-500 mt-0.5">{prereq.description}</p>}
                </div>
                </div>
                  <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-bold text-slate-500 px-2 py-1 bg-slate-100 rounded-lg">{qCount} Q</span>
                    <button
                      onClick={() => { setSelection(p => ({ ...p, subtopicId: `prereq-${prereq.id}` })); setActiveTab('questions'); }}
                      className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg text-xs font-bold transition-colors">
                      Manage Questions
                    </button>
                    <button onClick={() => openModal('edit-prerequisite', prereq)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => openModal('delete-confirm', { itemType: 'prerequisite', id: prereq.id, name: prereq.name })} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
                <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                  <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded font-bold">{prereq.passingThreshold}% to pass</span>
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded font-bold">Max {prereq.maxAIAttempts} AI retakes</span>
        </div>
    </div>
                  );
                })}
          </div>
      )}
      </div>
    );

  // ── Prereq detail panel (questions for a selected prereq) ────────────────────

  const renderPrereqDetail = () => {
    if (!selectedPrereq) return null;
    const qKey = `prereq:${selectedPrereq.id}`;
    const questions = questionsMap[qKey] ?? [];
    const showAnalytics = activeTab === 'preeval-analytics';
    return (
    <div className="space-y-4">
        {/* Back + header */}
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => { setSelection(p => ({ ...p, subtopicId: 'prerequisites' })); }} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><ArrowLeft className="w-4 h-4" /></button>
        <div>
            <h2 className="text-xl font-extrabold text-slate-900">{selectedPrereq.name}</h2>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-bold">{selectedPrereq.passingThreshold}% to pass</span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-bold">Max {selectedPrereq.maxAIAttempts} AI retakes</span>
        </div>
      </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => openModal('edit-prerequisite', selectedPrereq)} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 flex items-center gap-1.5"><Edit2 className="w-3 h-3" /> Edit Config</button>
            <button onClick={() => openModal('add-preeval-quiz')} className="px-4 py-2 bg-orange-600 text-white rounded-xl text-sm font-bold hover:bg-orange-700 transition-colors shadow-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Add Question</button>
          </div>
        </div>
        {questions.length > 0 && (
          <div className="flex gap-1 border-b border-slate-200">
            <button onClick={() => setActiveTab('questions')} className={`px-4 py-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab !== 'preeval-analytics' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <HelpCircle className="w-4 h-4" /> Questions <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs ml-1">{questions.length}</span>
          </button>
            <button onClick={() => setActiveTab('preeval-analytics')} className={`px-4 py-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'preeval-analytics' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            <BarChart2 className="w-4 h-4" /> Analytics
          </button>
        </div>
      )}
      {showAnalytics ? (
          <QuizAnalyticsPanel contextType="prereq" contextId={selectedPrereq.id} accentColor="#f97316" />
        ) : questions.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
          <ClipboardCheck className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Questions Yet</h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">Create questions for this prerequisite test.</p>
        </div>
      ) : (
          <div className="space-y-4">{questions.map((q, i) => renderQuizCard(q, i, 'edit-preeval-quiz', 'preeval-quiz'))}</div>
        )}
        <LevelImportPanel target="questions" accent="orange" contextLabel={selectedPrereq.name} onImport={makeImportQuestions('prereq', selectedPrereq.id)} />
    </div>
    );
  };

  // ── Final test panel ─────────────────────────────────────────────────────────

  const renderFinalTest = () => {
    const showAnalytics = activeTab === 'finaltest-analytics';
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-amber-100 rounded-xl flex items-center justify-center"><Trophy className="w-4 h-4 text-amber-600" /></div>
              <h2 className="text-xl font-extrabold text-slate-900">Final Topic Test</h2>
        </div>
            <p className="text-sm text-slate-500">Comprehensive test after all sub-topics. {currentTopic?.finalTestThreshold ?? 60}% to pass.</p>
              </div>
          <button onClick={() => openModal('add-finaltest-quiz')} className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 transition-colors shadow-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Add Question</button>
            </div>
        <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
          <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div><p className="text-sm font-bold text-indigo-900 mb-0.5">AI-Assisted Feedback</p><p className="text-xs text-indigo-700">If a student fails, the AI analyses wrong answers and teaches before a retake.</p></div>
              </div>
        {finalTestQuestions.length > 0 && (
          <div className="flex gap-1 border-b border-slate-200">
            <button onClick={() => setActiveTab('video')} className={`px-4 py-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${!showAnalytics ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><HelpCircle className="w-4 h-4" /> Questions <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs ml-1">{finalTestQuestions.length}</span></button>
            <button onClick={() => setActiveTab('finaltest-analytics')} className={`px-4 py-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${showAnalytics ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><BarChart2 className="w-4 h-4" /> Analytics</button>
            </div>
        )}
        {showAnalytics ? (
          <QuizAnalyticsPanel contextType="finaltest" contextId={selection.topicId} accentColor="#d97706" />
        ) : finalTestQuestions.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-amber-200 rounded-2xl bg-amber-50">
            <Trophy className="w-16 h-16 text-amber-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Final Test Questions</h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">Add comprehensive questions to test student mastery.</p>
            <button onClick={() => openModal('add-finaltest-quiz')} className="px-6 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors shadow-sm">Create First Question</button>
              </div>
        ) : (
          <div className="space-y-4">{finalTestQuestions.map((q, i) => renderQuizCard(q, i, 'edit-finaltest-quiz', 'finaltest-quiz'))}</div>
        )}
        {!showAnalytics && <LevelImportPanel target="questions" accent="orange" contextLabel={`Final Test — ${currentTopic?.name}`} onImport={makeImportQuestions('finaltest', selection.topicId)} />}
              </div>
    );
  };

  // ── Subtopics split layout ─────────────────────────────────────────────────────

  const renderSubtopics = () => (
    <div className="flex flex-col md:flex-row gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[600px]">
      {/* ── Left sidebar ── */}
      <div className="w-full md:w-1/3 lg:w-72 flex flex-col gap-3 border-r border-slate-200 pr-5 shrink-0">
        <h2 className="text-lg font-extrabold text-slate-900">{currentTopic?.name}</h2>

        {/* Final test (always at top) */}
        {renderSidebarItem({ id: 'finaltest', label: 'Final Topic Test', icon: <Trophy className="w-4 h-4" />, count: finalTestQuestions.length, color: 'amber' })}

        <div className="h-px bg-slate-200 w-full" />

        {/* Prerequisites */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prerequisites</h3>
            <button onClick={() => { setSelection(p => ({ ...p, subtopicId: 'prerequisites' })); }} className={`text-[10px] font-bold px-2 py-0.5 rounded ${selection.subtopicId === 'prerequisites' ? 'bg-purple-100 text-purple-700' : 'text-slate-400 hover:text-slate-600'}`}>All</button>
          </div>
          <div className="space-y-1.5">
            {currentPrereqs.map(prereq => {
              const qCount = (questionsMap[`prereq:${prereq.id}`] ?? []).length;
              return renderSidebarItem({ id: `prereq-${prereq.id}`, label: prereq.name, icon: <Network className="w-4 h-4" />, count: qCount, color: 'purple' });
            })}
            <button onClick={() => { setSelection(p => ({ ...p, subtopicId: 'prerequisites' })); }} className="w-full py-2 border border-dashed border-slate-300 text-slate-500 hover:text-purple-600 hover:border-purple-300 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
              <Plus className="w-3 h-3" /> Add Prerequisite
            </button>
            </div>
          </div>

        <div className="h-px bg-slate-200 w-full" />

        {/* Sub-topics */}
        <div className="flex-1 overflow-y-auto space-y-1.5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Sub-topics</h3>
          {loadingSub ? <Spinner size="sm" /> : currentSubTopics.map((sub, index) => (
            <div key={sub.id} onClick={() => { setSelection(p => ({ ...p, subtopicId: sub.id })); setActiveTab('video'); }}
              className={`p-3 rounded-xl border-2 cursor-pointer transition-all group relative ${selection.subtopicId === sub.id ? 'border-blue-600 bg-blue-50' : 'border-transparent hover:bg-slate-50 hover:border-slate-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${selection.subtopicId === sub.id ? 'bg-blue-200 text-blue-800' : 'bg-slate-200 text-slate-600'}`}>{(currentTopic?.order ?? 1)}.{index + 1}</span>
                  <h4 className={`font-bold text-sm leading-snug ${selection.subtopicId === sub.id ? 'text-blue-900' : 'text-slate-700'}`}>{sub.name}</h4>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={e => { e.stopPropagation(); openModal('edit-subtopic', sub); }} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded"><Edit2 className="w-3 h-3" /></button>
                  <button onClick={e => { e.stopPropagation(); openModal('delete-confirm', { itemType: 'subtopic', id: sub.id, name: sub.name }); }} className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
              {selection.subtopicId === sub.id && (
                <p className="text-[10px] text-blue-600 font-bold mt-1 ml-8">{sub.passingThreshold}% to pass</p>
              )}
              </div>
            ))}
          {currentSubTopics.length === 0 && !loadingSub && <p className="py-6 text-center text-slate-500 text-sm">No sub-topics yet.</p>}
          <button onClick={() => openModal('add-subtopic')} className="w-full py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 mt-1">
              <Plus className="w-4 h-4" /> Add Sub-topic
            </button>
          <LevelImportPanel target="subtopics" accent="blue" contextLabel={currentTopic?.name} onImport={handleImportSubtopics} />
          </div>
        </div>

      {/* ── Right content ── */}
      <div className="flex-1 min-w-0">
        {selection.subtopicId === 'prerequisites' ? renderPrerequisites()
          : selection.subtopicId.startsWith('prereq-') ? renderPrereqDetail()
          : selection.subtopicId === 'finaltest' ? renderFinalTest()
          : currentSubtopic ? renderSubtopicContent()
          : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-20 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <FileText className="w-16 h-16 text-slate-300 mb-4" />
              <h3 className="text-xl font-bold text-slate-900 mb-2">Select a Section</h3>
              <p className="text-slate-500 max-w-md">Choose a prerequisite, final test, or sub-topic from the sidebar.</p>
      </div>
          )}
      </div>
    </div>
  );

  // ── Sidebar item renderer ─────────────────────────────────────────────────────

  const renderSidebarItem = ({ id, label, icon, count, color }: { id: string; label: string; icon: React.ReactNode; count?: number; color: string }) => {
    const active = selection.subtopicId === id;
    const colorMap: Record<string, { border: string; bg: string; text: string; badge: string; iconBg: string }> = {
      purple: { border: 'border-purple-600', bg: 'bg-purple-50', text: 'text-purple-900', badge: 'bg-purple-100 text-purple-700', iconBg: 'bg-purple-200 text-purple-700' },
      amber:  { border: 'border-amber-600', bg: 'bg-amber-50', text: 'text-amber-900', badge: 'bg-amber-100 text-amber-700', iconBg: 'bg-amber-200 text-amber-700' },
      blue:   { border: 'border-blue-600', bg: 'bg-blue-50', text: 'text-blue-900', badge: 'bg-blue-100 text-blue-700', iconBg: 'bg-blue-200 text-blue-700' },
    };
    const c = colorMap[color] ?? colorMap.blue;
    return (
      <div key={id} onClick={() => { setSelection(p => ({ ...p, subtopicId: id })); setActiveTab('video'); }}
        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${active ? `${c.border} ${c.bg} ${c.text}` : 'border-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-700'}`}>
        <div className={`p-1.5 rounded-lg shrink-0 ${active ? c.iconBg : 'bg-slate-100 text-slate-500'}`}>{icon}</div>
        <span className="font-bold text-sm flex-1 truncate">{label}</span>
        {count !== undefined && count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${active ? c.badge : 'bg-slate-100 text-slate-600'}`}>{count}Q</span>}
            </div>
    );
  };

  // ── Sub-topic content ──────────────────────────────────────────────────────────

  const renderSubtopicContent = () => {
    if (!currentSubtopic) return null;
    const showAnalytics = activeTab === 'quiz-analytics';
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900">{currentSubtopic.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">{currentSubtopic.passingThreshold}% passing threshold</p>
          </div>
        </div>
            <div className="flex gap-2 border-b border-slate-200">
          {(['video', 'quiz'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              {tab === 'video' ? <><PlayCircle className="w-4 h-4" /> Video Content</> : <><HelpCircle className="w-4 h-4" /> Quiz <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs ml-1">{subtopicQuestions.length}</span></>}
              </button>
          ))}
          {subtopicQuestions.length > 0 && (
            <button onClick={() => setActiveTab('quiz-analytics')} className={`px-4 py-2 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${showAnalytics ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><BarChart2 className="w-4 h-4" /> Analytics</button>
              )}
            </div>
            {activeTab === 'video' && (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-900">YouTube Video Lesson</h3>
              <button onClick={() => openModal('edit-video')} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200 flex items-center gap-2"><Edit2 className="w-4 h-4" /> {currentSubtopic.youtubeUrl ? 'Change URL' : 'Add URL'}</button>
                </div>
            {getYoutubeEmbedUrl(currentSubtopic.youtubeUrl ?? '') ? (
              <div className="relative w-full rounded-2xl overflow-hidden bg-slate-900 shadow-lg" style={{ paddingTop: '56.25%' }}>
                <iframe src={getYoutubeEmbedUrl(currentSubtopic.youtubeUrl!)!} title="Video" className="absolute top-0 left-0 w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  </div>
                ) : (
                  <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                    <Video className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No Video Added</h3>
                <button onClick={() => openModal('edit-video')} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-sm">Add YouTube URL</button>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'quiz' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div><h3 className="text-lg font-bold text-slate-900">Quiz Questions</h3><p className="text-sm text-slate-500">MCQ, True/False, Short Answer, or Image Upload.</p></div>
              <button onClick={() => openModal('add-quiz')} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 shadow-sm flex items-center gap-2"><Plus className="w-4 h-4" /> Add Question</button>
                  </div>
            {subtopicQuestions.length === 0 ? (
                  <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                    <HelpCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-slate-900 mb-2">No Questions Yet</h3>
                <button onClick={() => openModal('add-quiz')} className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-sm">Create First Question</button>
                  </div>
                ) : (
              <div className="space-y-4">{subtopicQuestions.map((q, i) => renderQuizCard(q, i, 'edit-quiz', 'quiz'))}</div>
            )}
            <LevelImportPanel target="questions" accent="emerald" contextLabel={currentSubtopic.name} onImport={makeImportQuestions('subtopic', selection.subtopicId)} />
              </div>
            )}
        {showAnalytics && (
          <QuizAnalyticsPanel contextType="subtopic" contextId={selection.subtopicId} accentColor="#3b82f6" />
        )}
    </div>
  );
  };

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.text}
          <button onClick={() => setToast(null)}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
        </div>
      )}

      <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
        {renderBreadcrumbs()}
        <div className="min-h-[500px]">
          {view === 'standards' && renderStandards()}
          {view === 'classes'   && renderClasses()}
          {view === 'topics'    && renderTopics()}
          {view === 'subtopics' && renderSubtopics()}
        </div>
      </div>

      {/* ── Delete confirm ─────────────────────────────────────────────────────────── */}
      <Modal isOpen={modal.isOpen && modal.type === 'delete-confirm'} onClose={closeModal} title="Confirm Deletion">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-8 h-8" /></div>
          <h4 className="text-lg font-bold text-slate-900 mb-2">Delete {modal.payload?.name}?</h4>
          <p className="text-slate-500 font-medium mb-6">This action cannot be undone and will remove all nested content.</p>
          <div className="flex gap-3">
            <button onClick={closeModal} className="flex-1 py-3 px-4 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
            <button onClick={handleDelete} className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-sm">Delete</button>
          </div>
        </div>
      </Modal>

      {/* ── Standard / Class / Topic form ────────────────────────────────────────── */}
      <Modal 
        isOpen={modal.isOpen && ['add-standard','edit-standard','add-class','edit-class','add-topic','edit-topic'].includes(modal.type)}
        onClose={closeModal} 
        title={modal.type.startsWith('add-') ? `Add ${modal.type.split('-').slice(1).map(w => w[0]!.toUpperCase() + w.slice(1)).join(' ')}` : `Edit ${modal.type.split('-').slice(1).map(w => w[0]!.toUpperCase() + w.slice(1)).join(' ')}`}
      >
        <form onSubmit={handleSave} className="space-y-5">
          <FormField label="Name / Title">
            <input type="text" required value={formData.name ?? ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className={inputCls} />
          </FormField>
          {(modal.type === 'add-standard' || modal.type === 'edit-standard') && (
            <FormField label="Description (optional)">
              <input type="text" value={formData.description ?? ''} onChange={e => setFormData({ ...formData, description: e.target.value })} className={inputCls} />
            </FormField>
          )}
          {(modal.type === 'add-topic' || modal.type === 'edit-topic') && (
            <FormField label="Sequence Order">
              <input type="number" required min="1" value={formData.order ?? ''} onChange={e => setFormData({ ...formData, order: e.target.value })} className={inputCls} />
            </FormField>
          )}
          {(modal.type === 'add-class' || modal.type === 'edit-class') && (
            <FormField label="Passing Threshold (%)">
              <input type="number" min="1" max="100" value={formData.passingThreshold ?? 60} onChange={e => setFormData({ ...formData, passingThreshold: e.target.value })} className={inputCls} />
            </FormField>
          )}
          {saveError && <ErrorBanner msg={saveError} />}
          <FormActions onCancel={closeModal} saving={saving} />
        </form>
      </Modal>

      {/* ── Sub-topic form ─────────────────────────────────────────────────────────── */}
      <Modal isOpen={modal.isOpen && (modal.type === 'add-subtopic' || modal.type === 'edit-subtopic')} onClose={closeModal} title={modal.type === 'add-subtopic' ? 'Add Sub-topic' : 'Edit Sub-topic'}>
        <form onSubmit={handleSave} className="space-y-5">
          <FormField label="Sub-topic Name">
            <input type="text" required value={formData.name ?? ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className={inputCls} placeholder="e.g. Introduction to Quadratic Equations" />
          </FormField>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700 block">Passing Threshold</label>
            <ThresholdSlider value={Number(formData.passingThreshold ?? 60)} onChange={val => setFormData({ ...formData, passingThreshold: val })} label="Minimum score to pass this sub-topic" />
          </div>
          {saveError && <ErrorBanner msg={saveError} />}
          <FormActions onCancel={closeModal} saving={saving} />
        </form>
      </Modal>

      {/* ── Video URL modal ────────────────────────────────────────────────────────── */}
      <Modal isOpen={modal.isOpen && modal.type === 'edit-video'} onClose={closeModal} title="Update Video URL">
        <form onSubmit={handleSave} className="space-y-5">
          <FormField label="YouTube URL">
            <input type="url" value={formData.videoUrl ?? currentSubtopic?.youtubeUrl ?? ''} onChange={e => setFormData({ ...formData, videoUrl: e.target.value })} className={inputCls} placeholder="https://youtube.com/watch?v=..." />
            <p className="text-xs text-slate-500 mt-1.5">Leave blank to remove the video.</p>
          </FormField>
          {saveError && <ErrorBanner msg={saveError} />}
          <FormActions onCancel={closeModal} saving={saving} saveLabel="Save Video" />
        </form>
      </Modal>

      {/* ── Prerequisite config modal ──────────────────────────────────────────────── */}
      <Modal isOpen={modal.isOpen && (modal.type === 'add-prerequisite' || modal.type === 'edit-prerequisite')} onClose={closeModal} title={modal.type === 'add-prerequisite' ? 'Add Prerequisite' : 'Edit Prerequisite'}>
        <form onSubmit={handleSave} className="space-y-5">
          <FormField label="Prerequisite Name">
            <input type="text" required value={formData.name ?? ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className={inputCls} placeholder="e.g. Basic Arithmetic" />
          </FormField>
          <FormField label="Description (optional)">
            <input type="text" value={formData.description ?? ''} onChange={e => setFormData({ ...formData, description: e.target.value })} className={inputCls} />
          </FormField>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700 block">Passing Threshold</label>
            <ThresholdSlider value={Number(formData.passingThreshold ?? 60)} onChange={val => setFormData({ ...formData, passingThreshold: val })} label="Minimum score to pass" />
          </div>
          <FormField label="Max AI Retake Attempts">
            <input type="number" min="1" max="10" value={formData.maxAIAttempts ?? 3} onChange={e => setFormData({ ...formData, maxAIAttempts: Number(e.target.value) })} className={inputCls} />
          </FormField>
          {saveError && <ErrorBanner msg={saveError} />}
          <FormActions onCancel={closeModal} saving={saving} saveLabel="Save" accentColor="bg-purple-600 hover:bg-purple-700" />
        </form>
      </Modal>

      {/* ── Quiz question modal ────────────────────────────────────────────────────── */}
      <Modal size="3xl" isOpen={modal.isOpen && ['add-quiz','edit-quiz','add-preeval-quiz','edit-preeval-quiz','add-finaltest-quiz','edit-finaltest-quiz'].includes(modal.type)} onClose={closeModal} title={modal.type.startsWith('add-') ? 'Add Question' : 'Edit Question'}>
        <QuizForm formData={formData} setFormData={setFormData} onSubmit={handleSave} saving={saving} saveError={saveError} onCancel={closeModal} />
      </Modal>
    </AdminLayout>
  );
}

// ─── Small shared helpers ─────────────────────────────────────────────────────

const inputCls = 'block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all outline-none font-medium text-slate-900';

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
          <div className="space-y-1.5">
      <label className="text-sm font-bold text-slate-700 block">{label}</label>
      {children}
          </div>
  );
}

function FormActions({ onCancel, saving, saveLabel = 'Save', accentColor = 'bg-blue-600 hover:bg-blue-700' }: { onCancel: () => void; saving: boolean; saveLabel?: string; accentColor?: string }) {
  return (
    <div className="pt-4 flex gap-3 border-t border-slate-100">
      <button type="button" onClick={onCancel} className="flex-1 py-3 px-4 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
      <button type="submit" disabled={saving} className={`flex-1 py-3 px-4 text-white rounded-xl font-bold disabled:opacity-60 transition-colors shadow-sm ${accentColor}`}>{saving ? 'Saving…' : saveLabel}</button>
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
      <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
      <p className="text-sm text-red-700 font-medium">{msg}</p>
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
      <div className="flex justify-center mb-3">{icon}</div>
      <h3 className="text-lg font-bold text-slate-900 mb-1">{title}</h3>
      <p className="text-slate-500">{desc}</p>
    </div>
  );
}

function Spinner({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7';
  return <div className={`py-8 flex justify-center`}><div className={`${s} border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin`} /></div>;
}

// ─── Quiz Form (separate to keep the main component clean) ───────────────────

function QuizForm({ formData, setFormData, onSubmit, saving, saveError, onCancel }: {
  formData: any;
  setFormData: (d: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  saving: boolean;
  saveError: string | null;
  onCancel: () => void;
}) {
  const qType: string = formData.type ?? 'mcq';
  const [mathPreview, setMathPreview] = useState(false);

  const set = (key: string, val: any) => setFormData({ ...formData, [key]: val });
  const setOption = (idx: number, val: string) => {
    const a = [...(formData.optionsArray ?? ['', '', '', ''])];
    a[idx] = val;
    set('optionsArray', a);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* ── Error banner at the top so it's always visible ── */}
      {saveError && <ErrorBanner msg={saveError} />}

      {/* ── Math notation tip ── */}
      <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700">
        <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>Use <code className="font-mono bg-indigo-100 px-1 rounded">$...$</code> for inline math and <code className="font-mono bg-indigo-100 px-1 rounded">$$...$$</code> for block math. e.g. <code className="font-mono bg-indigo-100 px-1 rounded">$x^2 + y^2 = r^2$</code></span>
      </div>

      {/* ── Question text ── */}
          <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-slate-700">Question Text</label>
          <button type="button" onClick={() => setMathPreview(v => !v)} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
            {mathPreview ? 'Edit' : 'Preview Math'}
          </button>
          </div>
        {mathPreview ? (
          <div className="min-h-[80px] px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold text-slate-900 leading-relaxed">
            <MathText text={formData.text ?? ''} />
          </div>
        ) : (
          <textarea required value={formData.text ?? ''} onChange={e => set('text', e.target.value)}
            className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all outline-none font-medium text-slate-900 min-h-[80px] resize-y"
            placeholder="Enter question text. Use $x^2$ for math." />
        )}
      </div>

      {/* ── Question image URL / Upload ── */}
      <div className="space-y-1.5">
        <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-slate-400" /> Question Image URL (optional)</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="url" value={formData.imageUrl ?? ''} onChange={e => set('imageUrl', e.target.value)}
            className="flex-1 block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all outline-none font-medium text-slate-900"
            placeholder="https://... (diagram or formula image)" />

          <label className="sm:w-[160px] inline-flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer">
            <Upload className="w-4 h-4 text-slate-500" />
            Upload Image
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  const token = localStorage.getItem('vidhyapika_token');
                  const fd = new FormData();
                  fd.append('file', file);
                  fd.append('folder', 'question-images');
                  const res = await fetch('/api/upload/image', {
                    method: 'POST',
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    body: fd,
                  });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.error ?? 'Upload failed');
                  set('imageUrl', json.url);
                } catch (err: any) {
                  // Reuse modal error banner
                  setFormData((d: any) => ({ ...d }));
                  // QuizForm already receives saveError from parent; keep it simple here:
                  alert(err.message);
                }
              }}
            />
          </label>
        </div>
        {formData.imageUrl && (
          <div className="rounded-xl overflow-hidden border border-slate-200 max-w-xs mt-2">
            <img src={formData.imageUrl} alt="preview" className="w-full object-contain max-h-40" onError={e => (e.currentTarget.style.display = 'none')} />
          </div>
        )}
          </div>

      {/* ── Type & difficulty ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-slate-700 block">Question Type</label>
          <select value={qType} onChange={e => set('type', e.target.value)}
            className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all outline-none font-medium text-slate-900">
            <option value="mcq">Multiple Choice (MCQ)</option>
            <option value="true_false">True / False</option>
                <option value="text">Short Answer</option>
            <option value="image_upload">Image Upload (student photo)</option>
              </select>
            </div>
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-slate-700 block">Difficulty</label>
          <select value={formData.difficulty ?? 'Medium'} onChange={e => set('difficulty', e.target.value)}
            className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all outline-none font-medium text-slate-900">
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
          </div>

      {/* ── Image upload info ── */}
      {qType === 'image_upload' && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <Upload className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-blue-900 mb-0.5">Image Upload Question</p>
            <p className="text-xs text-blue-700">Students will photograph their handwritten solution and upload it. The AI or admin will evaluate the submission.</p>
          </div>
        </div>
      )}

      {/* ── MCQ options ── */}
      {qType === 'mcq' && (
        <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div className="flex justify-between items-center">
            <label className="text-sm font-bold text-slate-700">Answer Options</label>
            <button type="button" onClick={() => set('optionsArray', [...(formData.optionsArray ?? []), ''])} className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"><Plus className="w-4 h-4" /> Add</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(formData.optionsArray ?? ['', '', '', '']).map((opt: string, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0 shadow-sm">{String.fromCharCode(65 + idx)}</div>
                <input type="text" required value={opt} onChange={e => setOption(idx, e.target.value)}
                  className="block w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none font-medium text-slate-900"
                  placeholder={`Option ${String.fromCharCode(65 + idx)}`} />
                {(formData.optionsArray ?? []).length > 2 && (
                  <button type="button" onClick={() => { const a = [...(formData.optionsArray ?? [])]; a.splice(idx, 1); set('optionsArray', a); }} className="p-1.5 text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

      {/* ── Correct answer ── */}
      {qType !== 'image_upload' && (
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-slate-700 block">
            {qType === 'text' ? 'Accepted Answer' : 'Correct Answer'}
          </label>
          {qType === 'true_false' ? (
            <select required value={formData.correctAnswer ?? 'True'} onChange={e => set('correctAnswer', e.target.value)}
              className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all outline-none font-medium text-slate-900">
                 <option value="True">True</option>
                 <option value="False">False</option>
               </select>
          ) : qType === 'mcq' ? (
            <select required value={formData.correctAnswer ?? ''} onChange={e => set('correctAnswer', e.target.value)}
              className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all outline-none font-medium text-slate-900">
                 <option value="" disabled>Select the correct option</option>
              {(formData.optionsArray ?? []).filter((o: string) => o.trim()).map((opt: string, idx: number) => (
                   <option key={idx} value={opt}>{String.fromCharCode(65 + idx)}: {opt}</option>
                 ))}
               </select>
            ) : (
            <input type="text" required value={formData.correctAnswer ?? ''} onChange={e => set('correctAnswer', e.target.value)}
              className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all outline-none font-medium text-slate-900"
              placeholder="Type the accepted answer (math notation supported)" />
            )}
          </div>
      )}

      {/* ── Explanation ── */}
      <div className="space-y-1.5">
        <label className="text-sm font-bold text-slate-700 block">Explanation (optional)</label>
        <textarea value={formData.explanation ?? ''} onChange={e => set('explanation', e.target.value)}
          className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm transition-all outline-none font-medium text-slate-900 min-h-[70px] resize-y"
          placeholder="Explain why this is correct. Math notation supported." />
          </div>

      <div className="pt-4 flex gap-3 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="flex-1 py-3 px-4 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition-colors">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-60 transition-colors shadow-sm">{saving ? 'Saving…' : 'Save Question'}</button>
          </div>
        </form>
  );
}
