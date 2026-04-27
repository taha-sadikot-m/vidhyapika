import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  X, Users, CheckCircle2, AlertTriangle, Brain, Video, BookOpen,
  ChevronRight, Flag, TrendingDown, Loader2,
} from 'lucide-react';
import { apiFetch } from '../../hooks/useApi';
import { useNavigate } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

type FunnelData = {
  enrolled: number;
  prereqAttempted: number;
  prereqPassed: number;
  contentUnlocked: number;
  allSubtopicsDone: number;
  finalTestAttempted: number;
  finalTestPassed: number;
  flaggedCount: number;
};

type SubtopicStat = {
  id: string;
  name: string;
  order: number;
  hasVideo: boolean;
  videoWatchRate: number;
  quizPassRate: number;
  avgAttempts: number;
  aiInterventionCount: number;
};

type PrereqStat = {
  id: string;
  name: string;
  passingThreshold: number;
  maxAIAttempts: number;
  aiSessionCount: number;
};

type StrugglingStudent = {
  id: string;
  name: string | null;
  email: string;
  status: string;
};

type TopicAnalytics = {
  topic: { id: string; name: string; description: string | null; className: string; finalTestThreshold: number };
  funnel: FunnelData;
  subtopicStats: SubtopicStat[];
  prereqStats: PrereqStat[];
  strugglingStudents: StrugglingStudent[];
  totalAISessions: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(num: number, den: number) {
  if (!den) return 0;
  return Math.round((num / den) * 100);
}

function healthColor(rate: number) {
  if (rate >= 75) return { bar: '#10b981', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' };
  if (rate >= 50) return { bar: '#f59e0b', text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' };
  return { bar: '#ef4444', text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' };
}

function RatePill({ rate }: { rate: number }) {
  const c = healthColor(rate);
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-extrabold ${c.bg} ${c.text} ${c.border} border`}>
      {rate}%
    </span>
  );
}

function MiniBar({ value, max = 100, color = '#6366f1' }: { value: number; max?: number; color?: string }) {
  const w = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${w}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold text-slate-600 w-9 text-right shrink-0">{value}%</span>
    </div>
  );
}

// ─── Funnel Stepper ───────────────────────────────────────────────────────────

function FunnelStepper({ funnel }: { funnel: FunnelData }) {
  const steps = [
    { label: 'Enrolled', count: funnel.enrolled, icon: Users, color: 'bg-blue-500', fromPrev: null },
    { label: 'Prereq Attempted', count: funnel.prereqAttempted, icon: BookOpen, color: 'bg-indigo-500', fromPrev: funnel.enrolled },
    { label: 'Prereq Passed', count: funnel.prereqPassed, icon: CheckCircle2, color: 'bg-violet-500', fromPrev: funnel.prereqAttempted },
    { label: 'Content Unlocked', count: funnel.contentUnlocked, icon: CheckCircle2, color: 'bg-purple-500', fromPrev: funnel.prereqPassed },
    { label: 'All Subtopics Done', count: funnel.allSubtopicsDone, icon: BookOpen, color: 'bg-emerald-500', fromPrev: funnel.contentUnlocked },
    { label: 'Final Test Passed', count: funnel.finalTestPassed, icon: CheckCircle2, color: 'bg-teal-500', fromPrev: funnel.allSubtopicsDone },
  ];

  return (
    <div className="space-y-1">
      {steps.map((step, i) => {
        const convRate = step.fromPrev !== null ? pct(step.count, step.fromPrev) : 100;
        return (
          <div key={i}>
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className={`w-8 h-8 rounded-lg ${step.color} flex items-center justify-center shrink-0`}>
                <step.icon className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800">{step.label}</p>
                <p className="text-xs text-slate-500">
                  {step.fromPrev !== null ? `${convRate}% of previous stage` : 'Starting point'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-extrabold text-slate-900">{step.count}</p>
                <p className="text-xs text-slate-400">students</p>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex items-center gap-2 px-4 py-0.5">
                <div className="w-0.5 h-4 bg-slate-200 ml-3.5" />
                <span className="text-[10px] text-slate-400 font-medium">
                  {pct(steps[i + 1]!.count, step.count)}% continue
                </span>
              </div>
            )}
          </div>
        );
      })}

      {funnel.flaggedCount > 0 && (
        <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100 mt-2">
          <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center shrink-0">
            <Flag className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-red-800">Flagged (Need Attention)</p>
            <p className="text-xs text-red-600">Failed all AI attempts</p>
          </div>
          <p className="text-xl font-extrabold text-red-700 shrink-0">{funnel.flaggedCount}</p>
        </div>
      )}
    </div>
  );
}

// ─── Custom Tooltip for recharts ──────────────────────────────────────────────

function SubtopicTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-bold text-slate-900 mb-1">{d?.name}</p>
      <p className="text-indigo-600">Video Watch: <strong>{d?.videoWatchRate}%</strong></p>
      <p className="text-emerald-600">Quiz Pass: <strong>{d?.quizPassRate}%</strong></p>
      <p className="text-slate-500">Avg Attempts: <strong>{d?.avgAttempts}</strong></p>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  topicId: string;
  topicName: string;
  onClose: () => void;
}

export function TopicDrilldownPanel({ topicId, topicName, onClose }: Props) {
  const navigate = useNavigate();
  const [data, setData] = useState<TopicAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'funnel' | 'subtopics' | 'prereqs' | 'students'>('funnel');

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiFetch<TopicAnalytics>(`/api/admin/analytics/topic/${topicId}`).then(({ data: d, error: e }) => {
      if (e) setError(e);
      else setData(d);
      setLoading(false);
    });
  }, [topicId]);

  const tabs = [
    { id: 'funnel', label: 'Student Funnel' },
    { id: 'subtopics', label: 'Subtopics' },
    { id: 'prereqs', label: 'Prerequisites' },
    { id: 'students', label: 'Struggling' },
  ] as const;

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        key="panel"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        className="fixed right-0 top-0 h-full w-full max-w-2xl z-50 bg-white shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <TrendingDown className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Topic Analytics</p>
            <h2 className="text-base font-extrabold text-slate-900 truncate">{topicName}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 shrink-0 bg-white">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-xs font-bold transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
              {tab.id === 'students' && data && data.strugglingStudents.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[10px] font-extrabold">
                  {data.strugglingStudents.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800">Failed to load analytics</p>
                <p className="text-xs text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Summary bar */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  {
                    label: 'Enrolled',
                    value: data.funnel.enrolled,
                    icon: Users,
                    color: 'text-blue-600',
                    bg: 'bg-blue-50',
                  },
                  {
                    label: 'Final Passed',
                    value: data.funnel.finalTestPassed,
                    icon: CheckCircle2,
                    color: 'text-emerald-600',
                    bg: 'bg-emerald-50',
                  },
                  {
                    label: 'AI Sessions',
                    value: data.totalAISessions,
                    icon: Brain,
                    color: 'text-indigo-600',
                    bg: 'bg-indigo-50',
                  },
                ].map((card) => (
                  <div key={card.label} className={`${card.bg} rounded-xl p-3 text-center`}>
                    <card.icon className={`w-5 h-5 ${card.color} mx-auto mb-1`} />
                    <p className="text-xl font-extrabold text-slate-900">{card.value}</p>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{card.label}</p>
                  </div>
                ))}
              </div>

              {/* Tab: Funnel */}
              {activeTab === 'funnel' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">
                    Student Progression Funnel
                  </h3>
                  <FunnelStepper funnel={data.funnel} />
                </div>
              )}

              {/* Tab: Subtopics */}
              {activeTab === 'subtopics' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">
                    Per-Subtopic Performance
                  </h3>

                  {data.subtopicStats.length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-sm">No subtopics configured.</div>
                  )}

                  {/* Bar chart */}
                  {data.subtopicStats.length > 0 && (
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                      <p className="text-xs font-bold text-slate-500 mb-3">Quiz Pass Rate by Subtopic</p>
                      <ResponsiveContainer width="100%" height={Math.max(120, data.subtopicStats.length * 40)}>
                        <BarChart
                          data={data.subtopicStats}
                          layout="vertical"
                          margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                        >
                          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fontWeight: 600 }} />
                          <Tooltip content={<SubtopicTooltip />} />
                          <Bar dataKey="quizPassRate" radius={[0, 4, 4, 0]} maxBarSize={20}>
                            {data.subtopicStats.map((entry, i) => (
                              <Cell key={i} fill={healthColor(entry.quizPassRate).bar} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Detail rows */}
                  <div className="space-y-2">
                    {data.subtopicStats.map((st) => (
                      <div key={st.id} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <p className="text-sm font-bold text-slate-900">{st.name}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            {st.hasVideo && (
                              <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[10px] font-bold">
                                <Video className="w-3 h-3" /> Video
                              </span>
                            )}
                            <RatePill rate={st.quizPassRate} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          {st.hasVideo && (
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-500 w-24 shrink-0">Video Watch</span>
                              <MiniBar value={st.videoWatchRate} color="#3b82f6" />
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-500 w-24 shrink-0">Quiz Pass</span>
                            <MiniBar value={st.quizPassRate} color={healthColor(st.quizPassRate).bar} />
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[11px] text-slate-400">
                              Avg {st.avgAttempts} attempts
                            </span>
                            {st.aiInterventionCount > 0 && (
                              <span className="flex items-center gap-1 text-[11px] text-indigo-500">
                                <Brain className="w-3 h-3" /> {st.aiInterventionCount} AI sessions
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab: Prerequisites */}
              {activeTab === 'prereqs' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">
                    Prerequisites
                  </h3>
                  {data.prereqStats.length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-sm">No prerequisites configured.</div>
                  )}
                  {data.prereqStats.map((pr) => (
                    <div key={pr.id} className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-bold text-slate-900">{pr.name}</p>
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100 shrink-0">
                          Pass ≥ {pr.passingThreshold}%
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-1">
                        <span>Max AI attempts: <strong className="text-slate-700">{pr.maxAIAttempts}</strong></span>
                        {pr.aiSessionCount > 0 && (
                          <span className="flex items-center gap-1 text-indigo-500">
                            <Brain className="w-3 h-3" /> {pr.aiSessionCount} AI sessions
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tab: Struggling Students */}
              {activeTab === 'students' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">
                    Struggling Students
                  </h3>
                  {data.strugglingStudents.length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-sm">No struggling students — all doing well!</div>
                  )}
                  <div className="space-y-2">
                    {data.strugglingStudents.map((s) => (
                      <div key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                        s.status === 'flagged'
                          ? 'bg-red-50 border-red-100'
                          : 'bg-amber-50 border-amber-100'
                      }`}>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-sm shrink-0 ${
                          s.status === 'flagged'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {(s.name ?? s.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{s.name ?? '—'}</p>
                          <p className="text-xs text-slate-500 truncate">{s.email}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-extrabold ${
                            s.status === 'flagged'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {s.status === 'flagged' ? 'Flagged' : 'Stuck'}
                          </span>
                          <button
                            onClick={() => navigate('/admin/students')}
                            className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-600 hover:text-indigo-700 transition-colors"
                          >
                            View <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
