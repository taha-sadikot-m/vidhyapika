import React, { useMemo } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { motion } from 'motion/react';
import {
  Users, BookOpen, TrendingUp, FileQuestion, Layers, ClipboardList,
  Video, CheckCircle2, GraduationCap, Brain, AlertTriangle, RefreshCw,
  Activity, Target, Zap, BarChart3,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApiGet } from '../../hooks/useApi';
import type { ClassStat, PlatformSummary } from '../../components/admin/analyticsTypes';

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

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function AdminDashboard() {
  const navigate = useNavigate();

  const { data: dashData, loading, error, refetch } = useApiGet<{
    stats: DashStats;
    recentStudents: RecentStudent[];
  }>('/api/admin/dashboard');

  const { data: analyticsData, loading: analyticsLoading, error: analyticsError } = useApiGet<{
    platformSummary: PlatformSummary;
    classStats: ClassStat[];
  }>('/api/admin/analytics/overview');

  const stats = dashData?.stats;
  const recentStudents = dashData?.recentStudents ?? [];
  const platformSummary = analyticsData?.platformSummary;
  const classStats = analyticsData?.classStats ?? [];

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

  const classesAtRisk = useMemo(
    () => classStats.filter((c) => c.enrolled > 0 && c.avgPrereqPassRate < 50).length,
    [classStats],
  );

  const performanceSnapshot = useMemo(() => {
    if (!platformSummary || !stats) return [];
    return [
      {
        title: 'Avg pass rate',
        value: `${platformSummary.avgPassRate}%`,
        sub: `${platformSummary.totalTopicsWithData} topics with data`,
        icon: Target,
        iconColor:
          platformSummary.avgPassRate >= 75
            ? 'text-emerald-600'
            : platformSummary.avgPassRate >= 50
              ? 'text-amber-600'
              : 'text-red-600',
        bg:
          platformSummary.avgPassRate >= 75
            ? 'bg-emerald-50'
            : platformSummary.avgPassRate >= 50
              ? 'bg-amber-50'
              : 'bg-red-50',
        border:
          platformSummary.avgPassRate >= 75
            ? 'border-emerald-100'
            : platformSummary.avgPassRate >= 50
              ? 'border-amber-100'
              : 'border-red-100',
      },
      {
        title: 'AI intervention',
        value: `${platformSummary.avgAIInterventionRate}%`,
        sub: 'Learners using AI help',
        icon: Zap,
        iconColor: 'text-indigo-600',
        bg: 'bg-indigo-50',
        border: 'border-indigo-100',
      },
      {
        title: 'Completion rate',
        value: `${platformSummary.avgCompletionRate}%`,
        sub: `${platformSummary.totalAttempts.toLocaleString()} attempts`,
        icon: Activity,
        iconColor: 'text-purple-600',
        bg: 'bg-purple-50',
        border: 'border-purple-100',
      },
      {
        title: 'Students flagged',
        value: String(stats.flaggedStudents),
        sub: 'Need follow-up',
        icon: AlertTriangle,
        iconColor: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-100',
      },
      {
        title: 'Classes at risk',
        value: String(classesAtRisk),
        sub: 'Prereq pass under 50%',
        icon: GraduationCap,
        iconColor: classesAtRisk === 0 ? 'text-emerald-600' : 'text-red-600',
        bg: classesAtRisk === 0 ? 'bg-emerald-50' : 'bg-red-50',
        border: classesAtRisk === 0 ? 'border-emerald-100' : 'border-red-100',
      },
    ];
  }, [platformSummary, stats, classesAtRisk]);

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

        {/* ── Learning performance snapshot (top 5) ── */}
        {performanceSnapshot.length > 0 && (
          <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2 min-w-0">
                <BarChart3 className="w-5 h-5 text-indigo-600 shrink-0" />
                <div>
                  <h2 className="text-base font-bold text-slate-900">Learning performance</h2>
                  <p className="text-xs text-slate-500">Snapshot only — open analytics for charts, topics, and flags.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/analytics')}
                className="sm:ml-auto shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Full analytics <BarChart3 className="w-4 h-4 opacity-90" />
              </button>
            </div>
            <div className="p-5 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {performanceSnapshot.map((card, i) => (
                  <div key={i} className={`rounded-xl border ${card.border} ${card.bg} p-4`}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className={`w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center border border-white shadow-sm`}>
                        <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                      </div>
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">{card.title}</p>
                    <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{card.value}</p>
                    <p className="text-xs font-medium text-slate-600 mt-1">{card.sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {analyticsLoading && (
          <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-100 p-8 flex items-center justify-center gap-3 text-slate-400 text-sm">
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            Loading learning metrics…
          </motion.div>
        )}

        {analyticsError && !analyticsLoading && (
          <motion.div variants={itemVariants} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-800">Learning metrics temporarily unavailable</p>
              <p className="text-xs text-amber-600 mt-0.5">{analyticsError}</p>
              <button
                type="button"
                onClick={() => navigate('/admin/analytics')}
                className="mt-3 text-xs font-bold text-amber-900 underline hover:no-underline"
              >
                Try full analytics page →
              </button>
            </div>
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
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Manage Curriculum', desc: 'Standards, classes, topics, quizzes', icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', path: '/admin/curriculum' },
              { label: 'Manage Students', desc: 'Enrollments, parents, progress', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', path: '/admin/students' },
              { label: 'Learning analytics', desc: 'Topics, classes, flags, drill-down', icon: BarChart3, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', path: '/admin/analytics' },
              { label: 'View flagged', desc: `${stats.flaggedStudents} students need attention`, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', path: '/admin/students' },
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
    </AdminLayout>
  );
}
