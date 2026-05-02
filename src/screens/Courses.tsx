import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { motion } from 'motion/react';
import {
  PlayCircle,
  CheckCircle2,
  HelpCircle,
  Video,
  ChevronRight,
  Lock,
  Network,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  ListChecks,
  Flag,
} from 'lucide-react';
import type { StudentTopicProgress } from '../types';
import { useApiGet } from '../hooks/useApi';
import { mapRawTopicToStudentTopic } from '../utils/studentCurriculumMap';

type NextAction = {
  label: 'Locked' | 'Start' | 'Continue' | 'Review';
  disabled: boolean;
  reason?: string;
};

function computeNextAction(topic: StudentTopicProgress, locked: boolean): NextAction {
  if (locked) return { label: 'Locked', disabled: true, reason: 'Complete the previous topic to unlock this.' };
  if (topic.status === 'completed') return { label: 'Review', disabled: false };
  if (topic.status === 'in-progress') return { label: 'Continue', disabled: false };
  return { label: 'Start', disabled: false };
}

function StatusPill({ label, status }: { label: string; status: 'completed' | 'in-progress' | 'not-started' | 'locked' }) {
  const map = {
    completed: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200',
    'in-progress': 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
    'not-started': 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
    locked: 'bg-slate-50 text-slate-400 ring-1 ring-slate-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shadow-sm ${map[status]}`}>
      {label}
    </span>
  );
}

function RoadmapTopicItem({
  topic,
  idx,
  locked,
  open,
  onToggle,
  onGo,
}: {
  topic: StudentTopicProgress;
  idx: number;
  locked: boolean;
  open: boolean;
  onToggle: () => void;
  onGo: () => void;
}) {
  const isCompleted = topic.status === 'completed';
  const isInProgress = topic.status === 'in-progress';
  const action = computeNextAction(topic, locked);

  const prereqCount = topic.prerequisites?.length ?? 0;
  const prereqCleared = topic.prerequisiteScores?.length ?? 0;
  const prereqBlocked = prereqCount > 0 && prereqCleared < prereqCount;

  const totalSub = topic.totalSubtopics ?? topic.subTopics.length;
  const doneSub = topic.subtopicsCompleted ?? topic.subTopics.filter((s) => s.status === 'completed').length;

  const videoCount = topic.subTopics.filter((s) => !!s.videoUrl).length;
  const quizCount = topic.subTopics.reduce((a, s) => a + (s.quizzes?.length ?? 0), 0)
    + (topic.preEvaluationQuiz?.length ?? 0)
    + (topic.postEvaluationQuiz?.length ?? 0)
    + (topic.finalTestQuiz?.length ?? 0);

  const cardShell = locked
    ? 'border-slate-200/90 bg-slate-50/80 opacity-90'
    : isCompleted
      ? 'border-emerald-200/70 bg-white'
      : isInProgress
        ? 'border-[#0084B4]/25 bg-white shadow-[0_4px_24px_rgba(0,132,180,0.08)]'
        : 'border-slate-200/80 bg-white';

  const accentBar =
    locked ? 'bg-slate-200' : isCompleted ? 'bg-emerald-500' : isInProgress ? 'bg-[#0084B4]' : 'bg-slate-300';

  const iconBg = locked
    ? 'bg-slate-200/80 text-slate-500'
    : isCompleted
      ? 'bg-emerald-500 text-white'
      : isInProgress
        ? 'bg-[#0084B4] text-white'
        : 'bg-slate-100 text-slate-700';

  const timelineColor = locked ? 'bg-slate-200/90' : isCompleted ? 'bg-emerald-300/80' : 'bg-sky-200/90';

  return (
    <div className="relative group">
      <div
        className={`absolute left-[1.875rem] top-[4.25rem] bottom-[-1.5rem] w-px rounded-full z-0 ${timelineColor}`}
        aria-hidden
      />

      <div className="relative z-10 flex gap-5 sm:gap-6 items-start">
        <div className="shrink-0 mt-6 flex flex-col items-center w-[3.75rem]">
          <div
            className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-sm sm:text-base font-black shadow-sm z-10 ring-4 ring-[#F8F9FA] ${iconBg}`}
          >
            {locked ? <Lock className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden /> : isCompleted ? <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7" aria-hidden /> : idx + 1}
          </div>
        </div>

        <div
          className={`flex-1 min-w-0 rounded-2xl border transition-shadow duration-300 overflow-hidden hover:shadow-md ${cardShell}`}
        >
          <div className={`h-1 w-full ${accentBar}`} aria-hidden />

          <div className="w-full px-5 py-5 sm:px-6 sm:py-6 flex items-start justify-between gap-4">
            <button
              type="button"
              onClick={() => onGo()}
              disabled={locked}
              className="flex-1 min-w-0 text-left disabled:cursor-not-allowed disabled:opacity-60 group/title"
            >
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <StatusPill
                  label={locked ? 'Locked' : isCompleted ? 'Completed' : isInProgress ? 'In progress' : 'Not started'}
                  status={locked ? 'locked' : isCompleted ? 'completed' : isInProgress ? 'in-progress' : 'not-started'}
                />
                {!locked && prereqCount > 0 && (
                  <span
                    className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-lg ${
                      prereqBlocked ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    Prereqs {prereqCleared}/{prereqCount}
                  </span>
                )}
                {!locked && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">
                    <ListChecks className="w-3.5 h-3.5 shrink-0" aria-hidden />
                    Modules {doneSub}/{totalSub}
                  </span>
                )}
              </div>
              <h3
                className={`text-lg sm:text-xl font-black tracking-tight leading-snug ${locked ? 'text-slate-500' : 'text-slate-900 group-hover/title:text-[#006A91]'}`}
              >
                {topic.title}
              </h3>
              {!locked && (
                <p className="text-xs font-semibold text-slate-500 mt-2">
                  Open to see outline, videos, and quizzes — picks up where you left off.
                </p>
              )}
            </button>

            <div className="flex flex-col items-end gap-3 shrink-0">
              {!locked && (
                <div className="text-right hidden sm:block">
                  <p
                    className={`text-2xl font-black tabular-nums leading-none ${isCompleted ? 'text-emerald-600' : 'text-[#0084B4]'}`}
                  >
                    {topic.progress}%
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Topic progress</p>
                </div>
              )}
              <button
                type="button"
                aria-expanded={open}
                aria-label={open ? 'Collapse topic details' : 'Expand topic details'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle();
                }}
                className={`p-2.5 rounded-xl border transition-colors ${open ? 'bg-slate-100 border-slate-200' : 'border-transparent hover:bg-slate-100 hover:border-slate-200'}`}
              >
                <ChevronDown
                  className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
          </div>

          {!locked && (
            <div className="px-5 sm:px-6 pb-5">
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-[#0084B4]'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${topic.progress}%` }}
                />
              </div>
            </div>
          )}

          <motion.div
            initial={false}
            animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-5 sm:px-6 pb-6 pt-1 border-t border-slate-100/90 bg-gradient-to-b from-slate-50/90 to-slate-50/40">
              {locked && action.reason && (
                <div className="mb-5 flex items-start gap-3 bg-slate-100 border border-slate-200 rounded-xl p-4">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Lock className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-slate-800">Topic Locked</p>
                    <p className="text-xs font-medium text-slate-500 mt-1">{action.reason}</p>
                  </div>
                </div>
              )}

              {!locked && prereqBlocked && (
                <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Flag className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-amber-900">Prerequisites Required</p>
                    <p className="text-xs font-medium text-amber-700 mt-1">
                      Clear the prerequisite assessments to unlock the main learning content for this topic.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { icon: Video, value: videoCount, label: 'Videos' },
                  { icon: HelpCircle, value: quizCount, label: 'Questions' },
                  { icon: ListChecks, value: `${doneSub}/${totalSub}`, label: 'Modules' },
                  { icon: ShieldCheck, value: `${prereqCleared}/${prereqCount}`, label: 'Prereqs' },
                ].map(({ icon: Icon, value, label }) => (
                  <div
                    key={label}
                    className="bg-white/90 border border-slate-200/80 rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500">
                        <Icon className="w-4 h-4" aria-hidden />
                      </div>
                      <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">{label}</p>
                    </div>
                    <p className="text-2xl font-black text-slate-900 tabular-nums">{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between bg-white/95 p-4 sm:p-5 rounded-2xl border border-slate-200/80">
                <div className="text-sm font-medium text-slate-600 flex-1">
                  {action.label === 'Review' && 'You have completed this topic. Revisit content or retry quizzes anytime.'}
                  {action.label === 'Continue' && 'You are currently learning this topic. Resume where you left off.'}
                  {action.label === 'Start' && 'Ready to learn? Begin this topic now.'}
                  {action.label === 'Locked' && 'Finish previous topics to unlock this content.'}
                </div>
                <button
                  onClick={() => onGo()}
                  disabled={action.disabled}
                  className={`shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-extrabold transition-all shadow-sm
                    ${action.disabled
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : action.label === 'Review'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:shadow-md'
                        : action.label === 'Continue'
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 hover:shadow-md'
                          : 'bg-slate-900 text-white hover:bg-slate-800 hover:shadow-md'}`}
                >
                  {action.label === 'Locked'
                    ? <><Lock className="w-4 h-4" /> Locked</>
                    : action.label === 'Review'
                      ? <><CheckCircle2 className="w-4 h-4" /> Review Topic</>
                      : action.label === 'Continue'
                        ? <><PlayCircle className="w-4 h-4 fill-current" /> Continue Learning</>
                        : <><Sparkles className="w-4 h-4" /> Start Topic</>}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export function Courses() {
  const navigate = useNavigate();

  // Try to load real curriculums from API; fall back to mock data
  const { data: curriculumData, loading: curriculumLoading, error: curriculumError } =
    useApiGet<{ curriculums: any[]; message?: string }>('/api/student/curriculum');

  const curriculums = curriculumData?.curriculums ?? [];
  const notEnrolled = !curriculumLoading && curriculums.length === 0;

  // Use URL param to set initial selection if provided, otherwise default to 0
  const searchParams = new URLSearchParams(window.location.search);
  const classIdParam = searchParams.get('classId');

  const [selectedClassIdx, setSelectedClassIdx] = useState(0);

  useEffect(() => {
    if (classIdParam && curriculums.length > 0) {
      const idx = curriculums.findIndex(c => c.classId === classIdParam);
      if (idx !== -1 && idx !== selectedClassIdx) {
        setSelectedClassIdx(idx);
      }
    }
  }, [classIdParam, curriculums, selectedClassIdx]);

  const activeCurriculum = curriculums[selectedClassIdx] || null;

  const section = activeCurriculum ? activeCurriculum.className : '';

  // Map real topics to the StudentTopicProgress shape for the existing UI
  const realTopics: StudentTopicProgress[] = activeCurriculum
    ? (activeCurriculum.topics ?? []).map(mapRawTopicToStudentTopic)
    : [];

  const topics = realTopics;
  const completedTopics = topics.filter(t => t.status === 'completed').length;
  const totalTopics = topics.length;
  const overallProgress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  const inProgressTopic = topics.find(t => t.status === 'in-progress');
  const firstUnlockedIdx = topics.findIndex((t, i) => !(i > 0 && topics[i - 1].status === 'not-started'));
  const firstActionableIdx = topics.findIndex((t, i) => {
    const locked = i > 0 && topics[i - 1].status === 'not-started';
    if (locked) return false;
    return t.status !== 'completed';
  });
  const upNextIdx = (firstActionableIdx >= 0 ? firstActionableIdx : (firstUnlockedIdx >= 0 ? firstUnlockedIdx : 0));
  const upNextTopic = topics[upNextIdx];

  const containerVariants = {
    hidden: { opacity: 0 },
    show:   { opacity: 1, transition: { staggerChildren: 0.07 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } },
  };

  const [openId, setOpenId] = useState<string | null>(null);
  const isMobile = typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false;
  useEffect(() => {
    // Mobile: keep roadmap compact by default.
    if (isMobile) return;
    if (!openId && upNextTopic?.id) setOpenId(upNextTopic.id);
  }, [openId, upNextTopic?.id, isMobile]);

  return (
    <DashboardLayout>
      <motion.div
        variants={containerVariants} initial="hidden" animate="show"
        className="w-full max-w-[1600px] mx-auto space-y-6"
      >
        {curriculumLoading && (
          <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200 p-8 flex items-center justify-center gap-3 text-slate-500 text-sm font-semibold">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Loading your curriculum…
          </motion.div>
        )}

        {/* ── Class Selector ─────────────────────────────────────────────────── */}
        {!curriculumLoading && curriculums.length > 1 && (
          <motion.div variants={itemVariants} className="mb-6">
            <h2 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider mb-3">Your Enrollments</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {curriculums.map((c, i) => (
                <button
                  key={c.classId}
                  onClick={() => { setSelectedClassIdx(i); setOpenId(null); }}
                  className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all duration-300 ${i === selectedClassIdx ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200' : 'bg-white border-slate-200 text-slate-900 hover:border-blue-300 hover:shadow-sm'}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${i === selectedClassIdx ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>
                    <Network className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-extrabold truncate ${i === selectedClassIdx ? 'text-white' : 'text-slate-900'}`}>{c.className}</p>
                    <p className={`text-xs font-semibold mt-0.5 ${i === selectedClassIdx ? 'text-blue-100' : 'text-slate-500'}`}>
                      {c.topics?.length ?? 0} Topics
                    </p>
                  </div>
                  {i === selectedClassIdx && <CheckCircle2 className="w-5 h-5 text-white" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {!curriculumLoading && curriculumError && (
          <motion.div variants={itemVariants} className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <HelpCircle className="w-5 h-5 text-red-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-extrabold text-red-900">Could not load curriculum</p>
                <p className="text-xs font-semibold text-red-700 mt-0.5">{String(curriculumError)}</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-white border border-red-200 rounded-xl text-xs font-bold text-red-800 hover:bg-red-100 transition-colors"
              >
                Retry
              </button>
            </div>
          </motion.div>
        )}

        {notEnrolled && (
          <motion.div variants={itemVariants} className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-amber-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-extrabold text-amber-900">You’re not enrolled in any class yet</p>
                <p className="text-xs text-amber-700 mt-0.5">Ask your admin/teacher to assign a class to unlock your curriculum.</p>
              </div>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 bg-white border border-amber-200 rounded-xl text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </motion.div>
        )}

        {/* Roadmap timeline */}
        <motion.div variants={itemVariants} className="px-2 sm:px-6 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold text-[#0084B4] uppercase tracking-widest mb-1">
                {section || 'Curriculum'}
              </p>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Learning path</h2>
              <p className="text-sm text-slate-600 mt-2 max-w-xl leading-relaxed">
                Work through topics in order.{totalTopics > 0 ? ` ${completedTopics} of ${totalTopics} completed · ${overallProgress}% overall.` : ''}
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <StatusPill label="Completed" status="completed" />
                <StatusPill label="In Progress" status="in-progress" />
                <StatusPill label="Not Started" status="not-started" />
                <StatusPill label="Locked" status="locked" />
              </div>
            </div>
            {upNextTopic && (
              <button
                type="button"
                onClick={() =>
                  navigate('/learn', {
                    state: { topicIdx: upNextIdx, studentTopic: upNextTopic, curriculums, selectedClassIdx },
                  })
                }
                disabled={upNextIdx > 0 && topics[upNextIdx - 1]?.status === 'not-started'}
                className={`shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-extrabold transition-all
                  ${upNextIdx > 0 && topics[upNextIdx - 1]?.status === 'not-started'
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-900 text-white hover:bg-slate-800 shadow-md hover:shadow-lg'}`}
              >
                <PlayCircle className="w-5 h-5" aria-hidden />
                Resume / next topic
                <ChevronRight className="w-4 h-4 opacity-80" aria-hidden />
              </button>
            )}
          </div>

          {topics.length === 0 && !curriculumLoading && !curriculumError && !notEnrolled && (
            <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 border-dashed">
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ListChecks className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No topics found</h3>
              <p className="text-slate-500 mt-1">Your class doesn't have any topics assigned yet.</p>
            </div>
          )}

          <div className="space-y-6 pb-20 overflow-hidden">
            {topics.map((topic, idx) => {
              const locked = idx > 0 && topics[idx - 1].status === 'not-started';
              const open = openId === topic.id;
              return (
                <RoadmapTopicItem
                  key={topic.id}
                  topic={topic}
                  idx={idx}
                  locked={locked}
                  open={open}
                  onToggle={() => setOpenId((p) => (p === topic.id ? null : topic.id))}
                  onGo={() => {
                    navigate('/learn', {
                      state: {
                        topicIdx: idx,
                        studentTopic: topic,
                        curriculums,
                        selectedClassIdx,
                      },
                    });
                  }}
                />
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
