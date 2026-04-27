import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Users, BookOpen, CheckCircle2, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useApiGet } from '../../hooks/useApi';

export function ParentDashboard() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApiGet<any>('/api/parent/dashboard');

  const child = data?.child;
  const curriculum = data?.curriculum;
  const topics = curriculum?.topics ?? [];

  const stats = useMemo(() => {
    const totalTopics = curriculum?.totalTopics ?? 0;
    const completedTopics = curriculum?.completedTopics ?? 0;
    const overallProgress = curriculum?.overallProgress ?? 0;
    const totalSub = topics.reduce((s: number, t: any) => s + (t.totalSubtopics ?? 0), 0);
    const doneSub = topics.reduce((s: number, t: any) => s + (t.subtopicsCompleted ?? 0), 0);
    const subRate = totalSub > 0 ? Math.round((doneSub / totalSub) * 100) : 0;
    return { totalTopics, completedTopics, overallProgress, subRate };
  }, [curriculum, topics]);

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
  const itemVariants = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 24 } } };

  return (
    <DashboardLayout>
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="w-full max-w-[1400px] mx-auto space-y-6">
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Parent Dashboard</h1>
            <p className="text-slate-500 font-medium mt-1">
              {child ? <>Child: <span className="font-bold text-slate-700">{child.name ?? child.email}</span></> : 'Loading child…'}
              {curriculum?.className ? <> · <span className="font-bold text-slate-700">{curriculum.className}</span></> : null}
            </p>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </motion.div>

        {loading && (
          <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200 p-8 flex items-center justify-center gap-3 text-slate-400 text-sm">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Loading progress…
          </motion.div>
        )}

        {!loading && error && (
          <motion.div variants={itemVariants} className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-800">Could not load parent dashboard</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
          </motion.div>
        )}

        {!loading && !error && data?.message && (
          <motion.div variants={itemVariants} className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900">No progress data yet</p>
              <p className="text-xs text-amber-700 mt-0.5">{data.message}</p>
            </div>
          </motion.div>
        )}

        {!loading && !error && curriculum && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {[
                { label: 'Overall Progress', value: `${stats.overallProgress}%`, icon: TrendingUp, bg: 'bg-blue-50', color: 'text-blue-600', border: 'border-blue-100' },
                { label: 'Topics Completed', value: `${stats.completedTopics}/${stats.totalTopics}`, icon: CheckCircle2, bg: 'bg-emerald-50', color: 'text-emerald-600', border: 'border-emerald-100' },
                { label: 'Subtopic Pass Rate', value: `${stats.subRate}%`, icon: BookOpen, bg: 'bg-indigo-50', color: 'text-indigo-600', border: 'border-indigo-100' },
                { label: 'Child Account', value: child?.name ?? '—', icon: Users, bg: 'bg-slate-50', color: 'text-slate-600', border: 'border-slate-100' },
              ].map(card => (
                <motion.div key={card.label} variants={itemVariants} className={`bg-white rounded-2xl p-5 border ${card.border} shadow-sm flex items-center gap-3`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${card.bg}`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-xl font-extrabold text-slate-900">{card.value}</p>
                    <p className="text-xs font-bold text-slate-400">{card.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Topic Progress</h2>
                <button onClick={() => navigate('/courses')} className="text-xs font-bold text-blue-600 hover:text-blue-700">
                  Open Student Curriculum →
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {topics.map((t: any) => {
                  const total = t.totalSubtopics ?? 0;
                  const done = t.subtopicsCompleted ?? 0;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  const status = t.progress?.completedAt ? 'Completed' : t.progress ? 'In Progress' : 'Not Started';
                  return (
                    <div key={t.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-slate-900 truncate">{t.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{status} · {done}/{total} subtopics</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-extrabold text-slate-900">{pct}%</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Progress</p>
                        </div>
                      </div>
                      <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {topics.length === 0 && (
                  <div className="py-10 text-center text-slate-400 text-sm">No topics found for this class yet.</div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </motion.div>
    </DashboardLayout>
  );
}

