import React, { useState, useMemo } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { motion } from 'motion/react';
import {
  Users, BookOpen, TrendingUp, FileQuestion, Layers, ClipboardList,
  Video, CheckCircle2, GraduationCap, Brain, AlertTriangle, Flag, RefreshCw,
  Activity, Target, Zap, ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts';
import { useApiGet, apiFetch } from '../../hooks/useApi';
import { TopicDrilldownPanel } from '../../components/admin/TopicDrilldownPanel';

  const containerVariants = {
    hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type DashStats = {
  totalStudents: number;
  totalParents: number;
  totalStandards: number;
  totalClasses: number;
  totalTopics: number;
  totalSubTopics: number;
  totalQuestions: number;
  totalAISessions: number;
  flaggedStudents: number;
  videoCoverage: number;
};

type RecentStudent = { id: string; name: string | null; email: string; role: string };

type FlagEntry = {
  id: string;
  studentName: string;
  studentEmail: string;
  topicName: string;
  subTopicName?: string;
  flagType: string;
  flaggedAt: any;
};

type TopicStat = {
  topicId: string;
  topicName: string;
  topicOrder: number;
  classId: string;
  className: string;
  standardId: string;
  standardName: string;
  enrolled: number;
  prereqAttempted: number;
  prereqPassed: number;
  contentUnlocked: number;
  finalTestPassed: number;
  flaggedCount: number;
  avgPrereqAttempts: number;
  avgFinalAttempts: number;
  prereqPassRate: number;
  finalPassRate: number;
  aiInterventionRate: number;
  completionRate: number;
};

type ClassStat = {
  classId: string;
  className: string;
  standardId: string;
  standardName: string;
  enrolled: number;
  topicCount: number;
  avgPrereqPassRate: number;
  avgFinalPassRate: number;
  flaggedCount: number;
};

type PlatformSummary = {
  avgPassRate: number;
  avgAIInterventionRate: number;
  avgCompletionRate: number;
  totalAttempts: number;
  totalTopicsWithData: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function healthColor(rate: number) {
  if (rate >= 75) return { bar: '#10b981', pill: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  if (rate >= 50) return { bar: '#f59e0b', pill: 'bg-amber-50 text-amber-700 border-amber-100' };
  return { bar: '#ef4444', pill: 'bg-red-50 text-red-700 border-red-100' };
}

function RatePill({ rate }: { rate: number }) {
  const c = healthColor(rate);
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-extrabold border ${c.pill}`}>
      {rate}%
    </span>
  );
}

function MiniProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-bold text-slate-500 w-7 text-right">{value}%</span>
    </div>
  );
}

// Custom recharts tooltip for class chart
function ClassChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as ClassStat;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-xs space-y-1">
      <p className="font-extrabold text-slate-900 mb-1">{d.className}</p>
      <p className="text-slate-500">Standard: <strong className="text-slate-700">{d.standardName}</strong></p>
      <p className="text-slate-500">Enrolled: <strong className="text-slate-700">{d.enrolled}</strong></p>
      <p className="text-emerald-600">Prereq Pass Rate: <strong>{d.avgPrereqPassRate}%</strong></p>
      <p className="text-indigo-600">Final Pass Rate: <strong>{d.avgFinalPassRate}%</strong></p>
      {d.flaggedCount > 0 && <p className="text-red-600">Flagged: <strong>{d.flaggedCount}</strong></p>}
    </div>
  );
}

// ─── Topic Table ──────────────────────────────────────────────────────────────

type SortKey = 'prereqPassRate' | 'finalPassRate' | 'enrolled' | 'flaggedCount' | 'aiInterventionRate';

function TopicDifficultyTable({
  topics,
  onDrilldown,
}: {
  topics: TopicStat[];
  onDrilldown: (t: TopicStat) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('prereqPassRate');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE = 8;

  const sorted = useMemo(() => {
    return [...topics].sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number);
      return sortAsc ? diff : -diff;
    });
  }, [topics, sortKey, sortAsc]);

  const paged = sorted.slice(page * PAGE, (page + 1) * PAGE);
  const totalPages = Math.ceil(sorted.length / PAGE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(true); setPage(0); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronsUpDown className="w-3 h-3 text-slate-300" />;
    return sortAsc
      ? <ChevronUp className="w-3 h-3 text-indigo-500" />
      : <ChevronDown className="w-3 h-3 text-indigo-500" />;
  }

  const th = (label: string, key: SortKey) => (
    <th
      className="py-3 px-4 text-left cursor-pointer select-none hover:bg-slate-100 transition-colors"
      onClick={() => toggleSort(key)}
    >
      <div className="flex items-center gap-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
        {label} <SortIcon k={key} />
      </div>
    </th>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-red-500" />
          <h2 className="text-base font-bold text-slate-900">Topic Difficulty Ranking</h2>
          <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-md">
            {topics.length} topics
          </span>
        </div>
        <p className="text-xs text-slate-400">Click any row to see deep analytics</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Topic</th>
              <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Class</th>
              {th('Enrolled', 'enrolled')}
              {th('Prereq Pass', 'prereqPassRate')}
              {th('Final Pass', 'finalPassRate')}
              {th('Flags', 'flaggedCount')}
              {th('AI Rate', 'aiInterventionRate')}
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {paged.map((t) => (
              <tr
                key={t.topicId}
                className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                onClick={() => onDrilldown(t)}
              >
                <td className="py-3 px-4">
                  <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                    {t.topicName}
                  </p>
                  <p className="text-xs text-slate-400">{t.standardName}</p>
                </td>
                <td className="py-3 px-4 text-sm text-slate-600 font-medium">{t.className}</td>
                <td className="py-3 px-4 text-sm font-bold text-slate-700">{t.enrolled}</td>
                <td className="py-3 px-4 min-w-[120px]">
                  {t.enrolled > 0 ? (
                    <div className="space-y-1">
                      <RatePill rate={t.prereqPassRate} />
                      <MiniProgressBar value={t.prereqPassRate} color={healthColor(t.prereqPassRate).bar} />
                    </div>
                  ) : <span className="text-xs text-slate-300">No data</span>}
                </td>
                <td className="py-3 px-4 min-w-[120px]">
                  {t.enrolled > 0 ? (
                    <div className="space-y-1">
                      <RatePill rate={t.finalPassRate} />
                      <MiniProgressBar value={t.finalPassRate} color={healthColor(t.finalPassRate).bar} />
                    </div>
                  ) : <span className="text-xs text-slate-300">No data</span>}
                </td>
                <td className="py-3 px-4">
                  {t.flaggedCount > 0 ? (
                    <span className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-extrabold w-fit">
                      <Flag className="w-3 h-3" /> {t.flaggedCount}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {t.enrolled > 0 ? (
                    <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-extrabold w-fit ${
                      t.aiInterventionRate >= 50 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-500'
                    }`}>
                      <Brain className="w-3 h-3" /> {t.aiInterventionRate}%
                    </span>
                  ) : <span className="text-xs text-slate-300">—</span>}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-xs font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    Drilldown →
                  </span>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-slate-400 text-sm">
                  No topics with activity data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Showing {page * PAGE + 1}–{Math.min((page + 1) * PAGE, sorted.length)} of {sorted.length}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              ← Prev
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function AdminDashboard() {
  const navigate = useNavigate();

  const { data: dashData, loading, error, refetch } = useApiGet<{
    stats: DashStats;
    recentStudents: RecentStudent[];
  }>('/api/admin/dashboard');

  const { data: flagsData, error: flagsError } = useApiGet<{ flags: FlagEntry[] }>('/api/admin/flagged-students');

  const { data: analyticsData, loading: analyticsLoading, error: analyticsError } = useApiGet<{
    platformSummary: PlatformSummary;
    classStats: ClassStat[];
    topicStats: TopicStat[];
  }>('/api/admin/analytics/overview');

  const [resolveError, setResolveError] = useState<string | null>(null);
  const [drilldownTopic, setDrilldownTopic] = useState<TopicStat | null>(null);

  const handleResolveFlag = async (flagId: string) => {
    setResolveError(null);
    const { error: err } = await apiFetch(`/api/admin/flagged-students/${flagId}/resolve`, { method: 'POST' });
    if (err) { setResolveError(err); return; }
    refetch();
  };

  const stats = dashData?.stats;
  const recentStudents = dashData?.recentStudents ?? [];
  const flags = flagsData?.flags ?? [];
  const platformSummary = analyticsData?.platformSummary;
  const classStats = analyticsData?.classStats ?? [];
  const topicStats = analyticsData?.topicStats ?? [];

  const statCards = useMemo(() => stats ? [
    {
      title: 'Total Students',
      value: stats.totalStudents,
      sub: `${stats.totalParents} parents registered`,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
    },
    {
      title: 'Standards & Classes',
      value: `${stats.totalStandards} / ${stats.totalClasses}`,
      sub: `${stats.totalClasses} active classes`,
      icon: Layers,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-100',
    },
    {
      title: 'Curriculum Topics',
      value: stats.totalTopics,
      sub: `${stats.totalSubTopics} sub-topics total`,
      icon: BookOpen,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
    },
    {
      title: 'Quiz Questions',
      value: stats.totalQuestions,
      sub: `${stats.videoCoverage}% video coverage`,
      icon: FileQuestion,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-100',
    },
    {
      title: 'AI Sessions',
      value: stats.totalAISessions,
      sub: `${stats.flaggedStudents} students flagged`,
      icon: Brain,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-100',
    },
  ] : [], [stats]);

  const analyticsCards = useMemo(() => platformSummary ? [
    {
      title: 'Avg Pass Rate',
      value: `${platformSummary.avgPassRate}%`,
      sub: `Across ${platformSummary.totalTopicsWithData} active topics`,
      icon: Target,
      color: healthColor(platformSummary.avgPassRate).bar,
      iconColor: platformSummary.avgPassRate >= 75 ? 'text-emerald-600' : platformSummary.avgPassRate >= 50 ? 'text-amber-600' : 'text-red-600',
      bg: platformSummary.avgPassRate >= 75 ? 'bg-emerald-50' : platformSummary.avgPassRate >= 50 ? 'bg-amber-50' : 'bg-red-50',
      border: platformSummary.avgPassRate >= 75 ? 'border-emerald-100' : platformSummary.avgPassRate >= 50 ? 'border-amber-100' : 'border-red-100',
    },
    {
      title: 'AI Intervention Rate',
      value: `${platformSummary.avgAIInterventionRate}%`,
      sub: 'Students needing AI help',
      icon: Zap,
      iconColor: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-100',
    },
    {
      title: 'Completion Rate',
      value: `${platformSummary.avgCompletionRate}%`,
      sub: `${platformSummary.totalAttempts} total attempts logged`,
      icon: Activity,
      iconColor: 'text-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-100',
    },
  ] : [], [platformSummary]);

  // Top-5 classes for bar chart (those with data)
  const classChartData = classStats
    .filter((c) => c.enrolled > 0)
    .slice(0, 12);

  return (
    <AdminLayout>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-[1600px] mx-auto space-y-6 p-4 sm:p-6 lg:p-8"
      >
        {/* ── Header ── */}
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Platform Overview</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Live snapshot of students, curriculum, and content.</p>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </motion.div>

        {/* ── Loading / error ── */}
        {loading && (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && !loading && (
          <motion.div variants={itemVariants} className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-800">Could not load dashboard data</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </motion.div>
        )}

        {/* ── Stat Cards ── */}
        {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {statCards.map((card, i) => (
            <motion.div key={i} variants={itemVariants} className={`bg-white p-5 rounded-2xl border ${card.border} shadow-sm`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.bg}`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{card.title}</p>
              <p className="text-3xl font-extrabold text-slate-900 mb-1">{card.value}</p>
              <p className="text-xs font-medium text-slate-400">{card.sub}</p>
            </motion.div>
          ))}
        </div>
        )}

        {/* ── Analytics Summary Cards ── */}
        {platformSummary && (
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">Performance Analytics</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {analyticsCards.map((card, i) => (
                <div key={i} className={`bg-white p-5 rounded-2xl border ${card.border} shadow-sm`}>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.bg} mb-4`}>
                    <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                  </div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{card.title}</p>
                  <p className="text-3xl font-extrabold text-slate-900 mb-1">{card.value}</p>
                  <p className="text-xs font-medium text-slate-400">{card.sub}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {analyticsLoading && (
          <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-100 p-8 flex items-center justify-center gap-3 text-slate-400 text-sm">
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            Loading analytics…
          </motion.div>
        )}

        {analyticsError && !analyticsLoading && (
          <motion.div variants={itemVariants} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">Analytics temporarily unavailable</p>
              <p className="text-xs text-amber-600 mt-0.5">{analyticsError}</p>
            </div>
          </motion.div>
        )}

        {/* ── Class Performance Bar Chart ── */}
        {classChartData.length > 0 && (
          <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-900">Class Performance — Avg Pass Rates</h2>
              <span className="ml-auto text-xs text-slate-400">Hover for details</span>
            </div>
            <div className="px-4 py-5">
              <ResponsiveContainer width="100%" height={Math.max(200, classChartData.length * 52)}>
                <BarChart
                  data={classChartData}
                  layout="vertical"
                  margin={{ top: 4, right: 24, left: 12, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickFormatter={(v) => `${v}%`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="className"
                    width={110}
                    tick={{ fontSize: 12, fontWeight: 600, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ClassChartTooltip />} cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey="avgPrereqPassRate" name="Prereq Pass Rate" radius={[0, 6, 6, 0]} maxBarSize={24}>
                    {classChartData.map((entry, i) => (
                      <Cell key={i} fill={healthColor(entry.avgPrereqPassRate).bar} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 px-2">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-emerald-500" /><span className="text-xs text-slate-500">≥ 75% (Healthy)</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-amber-400" /><span className="text-xs text-slate-500">50–74% (Needs Attention)</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-400" /><span className="text-xs text-slate-500">&lt; 50% (Critical)</span></div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Resolve error ── */}
        {resolveError && (
          <motion.div variants={itemVariants} className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-800">Could not resolve flag</p>
              <p className="text-xs text-red-600 mt-0.5">{resolveError}</p>
            </div>
            <button onClick={() => setResolveError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">✕</button>
          </motion.div>
        )}

        {/* ── Flagged Students ── */}
        {flagsError && (
          <motion.div variants={itemVariants} className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-800">Could not load flagged students</p>
              <p className="text-xs text-red-600 mt-0.5">{flagsError}</p>
            </div>
          </motion.div>
        )}

        {!flagsError && flags.length > 0 && (
          <motion.div variants={itemVariants} className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-amber-900">Students Flagged — Need Attention</h2>
                <p className="text-xs text-amber-600">{flags.length} student{flags.length !== 1 ? 's have' : ' has'} failed after all AI attempts</p>
              </div>
              <button onClick={() => navigate('/admin/students')} className="ml-auto text-xs font-bold text-amber-700 hover:text-amber-900 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors">View All →</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {flags.slice(0, 6).map(flag => (
                <div key={flag.id} className="bg-white border border-amber-100 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-extrabold text-sm shrink-0">
                    {(flag.studentName ?? 'S').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{flag.studentName}</p>
                    <p className="text-xs text-slate-500 truncate">{flag.topicName}{flag.subTopicName ? ` › ${flag.subTopicName}` : ''} · {flag.flagType}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-lg">
                      <Flag className="w-3 h-3 text-red-500" />
                      <span className="text-[10px] font-extrabold text-red-600">Flagged</span>
                    </span>
                    <button onClick={() => handleResolveFlag(flag.id)} className="text-xs font-bold text-emerald-700 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors">Resolve</button>
                    </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Topic Difficulty Table ── */}
        {topicStats.length > 0 && (
        <motion.div variants={itemVariants}>
            <TopicDifficultyTable
              topics={topicStats}
              onDrilldown={(t) => setDrilldownTopic(t)}
          />
        </motion.div>
        )}

        {/* ── Two table panels ── */}
        {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-emerald-600" />
                  <h2 className="text-base font-bold text-slate-900">Curriculum Overview</h2>
                </div>
                <button onClick={() => navigate('/admin/curriculum')} className="text-xs font-bold text-emerald-600 hover:text-emerald-700">Manage →</button>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  { label: 'Standards', value: stats.totalStandards, icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { label: 'Classes', value: stats.totalClasses, icon: BookOpen, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Topics', value: stats.totalTopics, icon: ClipboardList, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Sub-topics', value: stats.totalSubTopics, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
                  { label: 'Quiz Questions', value: stats.totalQuestions, icon: FileQuestion, color: 'text-orange-600', bg: 'bg-orange-50' },
                  { label: 'Video Coverage', value: `${stats.videoCoverage}%`, icon: Video, color: 'text-pink-600', bg: 'bg-pink-50' },
                ].map((row, i) => (
                  <div key={i} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${row.bg} flex items-center justify-center`}>
                        <row.icon className={`w-4 h-4 ${row.color}`} />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{row.label}</span>
                    </div>
                    <span className="text-base font-extrabold text-slate-900">{row.value}</span>
            </div>
                ))}
              </div>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-base font-bold text-slate-900">Platform Activity</h2>
                </div>
                <button onClick={() => navigate('/admin/students')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">Students →</button>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  { label: 'Total Students', value: stats.totalStudents, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Parents Registered', value: stats.totalParents, icon: Users, color: 'text-slate-600', bg: 'bg-slate-50' },
                  { label: 'AI Sessions Total', value: stats.totalAISessions, icon: Brain, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { label: 'Flagged Students', value: stats.flaggedStudents, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
                  { label: 'Topics Completed', value: platformSummary ? `${platformSummary.totalTopicsWithData} active` : '—', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Avg Completion Rate', value: platformSummary ? `${platformSummary.avgCompletionRate}%` : '—', icon: GraduationCap, color: 'text-purple-600', bg: 'bg-purple-50' },
                ].map((row, i) => (
                  <div key={i} className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${row.bg} flex items-center justify-center`}>
                        <row.icon className={`w-4 h-4 ${row.color}`} />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{row.label}</span>
                    </div>
                    <span className="text-base font-extrabold text-slate-900">{row.value}</span>
            </div>
                ))}
              </div>
          </motion.div>
        </div>
        )}

        {/* ── Recent Students ── */}
        <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-bold text-slate-900">Recently Added Students</h2>
            </div>
            <button onClick={() => navigate('/admin/students')} className="text-xs font-bold text-blue-600 hover:text-blue-700">View All →</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Student</th>
                  <th className="py-3 px-5">Email</th>
                  <th className="py-3 px-5">Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentStudents.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-extrabold shrink-0">
                          {(s.name ?? s.email).charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-bold text-slate-900">{s.name ?? '—'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-5 text-sm text-slate-500">{s.email}</td>
                    <td className="py-3 px-5">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${s.role === 'admin' ? 'bg-purple-50 text-purple-700' : s.role === 'parent' ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700'}`}>
                        {s.role}
                      </span>
                    </td>
                  </tr>
                ))}
                {recentStudents.length === 0 && !loading && (
                  <tr><td colSpan={3} className="py-10 text-center text-slate-400 text-sm">No students added yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* ── Quick nav ── */}
        {stats && (
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Manage Curriculum', desc: 'Standards, classes, topics, quizzes', icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', path: '/admin/curriculum' },
              { label: 'Manage Students', desc: 'Enrollments, parents, progress', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', path: '/admin/students' },
              { label: 'View Flagged', desc: `${stats.flaggedStudents} students need attention`, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', path: '/admin/students' },
            ].map(card => (
              <button key={card.label} onClick={() => navigate(card.path)} className={`bg-white border ${card.border} p-5 rounded-2xl shadow-sm hover:shadow-md transition-all text-left group`}>
                <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center mb-3`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <p className="text-sm font-extrabold text-slate-900 mb-1">{card.label}</p>
                <p className="text-xs text-slate-500">{card.desc}</p>
              </button>
            ))}
          </motion.div>
        )}
      </motion.div>

      {/* ── Topic Drilldown Panel (slide-in) ── */}
      {drilldownTopic && (
        <TopicDrilldownPanel
          topicId={drilldownTopic.topicId}
          topicName={drilldownTopic.topicName}
          onClose={() => setDrilldownTopic(null)}
        />
      )}
    </AdminLayout>
  );
}
