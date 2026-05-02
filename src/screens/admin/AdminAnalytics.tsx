import React, { useMemo, useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { motion } from 'motion/react';
import {
  Activity, AlertTriangle, ArrowLeft, Brain, Flag, RefreshCw, Target, Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApiGet, apiFetch } from '../../hooks/useApi';
import { TopicDrilldownPanel } from '../../components/admin/TopicDrilldownPanel';
import { TopicDifficultyTable, healthColor } from '../../components/admin/TopicDifficultyTable';
import { ClassPerformanceChart } from '../../components/admin/ClassPerformanceChart';
import type { ClassStat, FlagEntry, PlatformSummary, TopicStat } from '../../components/admin/analyticsTypes';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
};

export function AdminAnalytics() {
  const navigate = useNavigate();
  const { data: analyticsData, loading, error, refetch } = useApiGet<{
    platformSummary: PlatformSummary;
    classStats: ClassStat[];
    topicStats: TopicStat[];
  }>('/api/admin/analytics/overview');

  const { data: flagsData, error: flagsError, refetch: refetchFlags } = useApiGet<{ flags: FlagEntry[] }>(
    '/api/admin/flagged-students'
  );

  const [resolveError, setResolveError] = useState<string | null>(null);
  const [drilldownTopic, setDrilldownTopic] = useState<TopicStat | null>(null);

  const platformSummary = analyticsData?.platformSummary;
  const classStats = analyticsData?.classStats ?? [];
  const topicStats = analyticsData?.topicStats ?? [];
  const flags = flagsData?.flags ?? [];

  const handleResolveFlag = async (flagId: string) => {
    setResolveError(null);
    const { error: err } = await apiFetch(`/api/admin/flagged-students/${flagId}/resolve`, { method: 'POST' });
    if (err) {
      setResolveError(err);
      return;
    }
    void refetchFlags();
  };

  const analyticsCards = useMemo(
    () =>
      platformSummary
        ? [
            {
              title: 'Avg Pass Rate',
              value: `${platformSummary.avgPassRate}%`,
              sub: `Across ${platformSummary.totalTopicsWithData} active topics`,
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
              title: 'AI Intervention Rate',
              value: `${platformSummary.avgAIInterventionRate}%`,
              sub: 'Students needing AI help after quiz failures',
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
          ]
        : [],
    [platformSummary]
  );

  const classesAtRisk = useMemo(
    () => classStats.filter((c) => c.enrolled > 0 && c.avgPrereqPassRate < 50).length,
    [classStats]
  );

  return (
    <AdminLayout>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-[1600px] mx-auto space-y-8 p-4 sm:p-6 lg:p-8 pb-16"
      >
        <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => navigate('/admin/dashboard')}
              className="mt-1 p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <p className="text-[11px] font-extrabold text-indigo-600 uppercase tracking-widest mb-1">Admin</p>
              <h1 className="text-2xl font-extrabold text-slate-900">Learning analytics</h1>
              <p className="text-sm font-medium text-slate-500 mt-1 max-w-2xl">
                Pass rates, class health, AI interventions, flags, and per-topic difficulty. Use this view for deep
                reviews; the dashboard shows a shorter summary.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              void refetch();
              void refetchFlags();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm shrink-0"
          >
            <RefreshCw className="w-4 h-4" /> Refresh data
          </button>
        </motion.div>

        {loading && (
          <div className="py-16 flex justify-center">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && !loading && (
          <motion.div variants={itemVariants} className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-sm font-bold text-red-800">Could not load analytics</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </motion.div>
        )}

        {!loading && !error && platformSummary && (
          <>
            <motion.section variants={itemVariants} className="scroll-mt-8">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-extrabold text-slate-900">Platform performance</h2>
              </div>
              <p className="text-sm text-slate-600 mb-4 max-w-3xl">
                High-level outcomes across all classes. Avg pass rate blends prerequisite and final outcomes where data
                exists.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {analyticsCards.map((card, i) => (
                  <div key={i} className={`bg-white p-6 rounded-2xl border ${card.border} shadow-sm`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.bg} mb-4`}>
                      <card.icon className={`w-6 h-6 ${card.iconColor}`} />
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{card.title}</p>
                    <p className="text-3xl font-extrabold text-slate-900 mb-1">{card.value}</p>
                    <p className="text-xs font-medium text-slate-500 leading-relaxed">{card.sub}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold border ${
                    classesAtRisk > 0
                      ? 'bg-amber-50 text-amber-900 border-amber-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-100'
                  }`}
                >
                  Classes with prereq pass &lt; 50%: <strong>{classesAtRisk}</strong>
                </span>
              </div>
            </motion.section>

            <motion.section variants={itemVariants} className="scroll-mt-8">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-extrabold text-slate-900">Class comparison</h2>
              </div>
              <p className="text-sm text-slate-600 mb-4 max-w-3xl">
                Prerequisite pass rate by class (bars). Compare cohorts and spot classes that need instructional support.
              </p>
              <ClassPerformanceChart classStats={classStats} />
            </motion.section>

            <motion.section variants={itemVariants} className="scroll-mt-8">
              <div className="flex items-center gap-2 mb-4">
                <Flag className="w-5 h-5 text-amber-600" />
                <h2 className="text-lg font-extrabold text-slate-900">Flagged students</h2>
              </div>
              <p className="text-sm text-slate-600 mb-4 max-w-3xl">
                Learners who exhausted AI-assisted retries on a prerequisite, subtopic quiz, or final test. Resolve when
                you&apos;ve followed up outside the platform.
              </p>
              {flagsError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4">
                  <p className="text-sm font-bold text-red-800">Could not load flags</p>
                  <p className="text-xs text-red-600">{flagsError}</p>
                </div>
              )}
              {resolveError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex justify-between items-start gap-3">
                  <p className="text-sm font-bold text-red-800">{resolveError}</p>
                  <button type="button" onClick={() => setResolveError(null)} className="text-red-400 hover:text-red-600">
                    ✕
                  </button>
                </div>
              )}
              {!flagsError && flags.length === 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-sm font-medium">
                  No open flags. Great job.
                </div>
              )}
              {!flagsError && flags.length > 0 && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5">
                  <p className="text-xs font-extrabold text-amber-800 uppercase tracking-wider mb-4">
                    {flags.length} open flag{flags.length !== 1 ? 's' : ''}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {flags.map((flag) => (
                      <div
                        key={flag.id}
                        className="bg-white border border-amber-100 rounded-xl p-4 flex items-center gap-3 shadow-sm"
                      >
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-extrabold text-sm shrink-0">
                          {(flag.studentName ?? 'S').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{flag.studentName}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {flag.topicName}
                            {flag.subTopicName ? ` › ${flag.subTopicName}` : ''} · {flag.flagType}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">{flag.studentEmail}</p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <span className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-lg justify-center">
                            <Flag className="w-3 h-3 text-red-500" />
                            <span className="text-[10px] font-extrabold text-red-600">Flagged</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleResolveFlag(flag.id)}
                            className="text-xs font-bold text-emerald-700 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                          >
                            Resolve
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.section>

            <motion.section variants={itemVariants} className="scroll-mt-8">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-extrabold text-slate-900">Topic difficulty & drill-down</h2>
              </div>
              <p className="text-sm text-slate-600 mb-4 max-w-3xl">
                Sort by prereq pass, final pass, flags, or AI rate. Open a topic for subtopic breakdowns, video/quiz
                funnels, and question-level stats.
              </p>
              {topicStats.length > 0 ? (
                <TopicDifficultyTable topics={topicStats} onDrilldown={setDrilldownTopic} pageSize={10} />
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-sm">
                  No topic-level analytics yet.
                </div>
              )}
            </motion.section>
          </>
        )}

        {!loading && !error && !platformSummary && (
          <motion.div variants={itemVariants} className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900">No platform summary returned</p>
              <p className="text-xs text-amber-700 mt-1">Try refreshing, or check that classes have enrolled students.</p>
            </div>
          </motion.div>
        )}
      </motion.div>

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
