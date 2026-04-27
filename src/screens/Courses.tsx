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
  TrendingUp,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  ListChecks,
  Flag,
} from 'lucide-react';
import type { Question, StudentTopicProgress } from '../types';
import { useApiGet } from '../hooks/useApi';

function mapApiQuestion(q: any): Question {
  return {
    id: q.id,
    text: q.text ?? '',
    type: q.type === 'true_false' ? 'boolean' as const : q.type === 'image_upload' ? 'image_upload' as const : 'mcq' as const,
    options: q.options,
    correctAnswer: q.correctAnswer ?? '',
    explanation: q.explanation ?? '',
    difficulty: (['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : 'Medium') as 'Easy' | 'Medium' | 'Hard',
    imageUrl: q.imageUrl,
  };
}

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

  // Styling logic based on state
  const cardBorder = locked
    ? 'border-slate-200 bg-slate-50 opacity-80'
    : isCompleted
      ? 'border-emerald-200 bg-white shadow-sm hover:shadow-md'
      : isInProgress
        ? 'border-blue-300 bg-white shadow-md ring-4 ring-blue-50'
        : 'border-slate-200 bg-white shadow-sm hover:shadow-md';

  const iconBg = locked
    ? 'bg-slate-100 text-slate-400'
    : isCompleted
      ? 'bg-emerald-100 text-emerald-600'
      : isInProgress
        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-inner'
        : 'bg-slate-100 text-slate-600';

  const timelineColor = locked
    ? 'bg-slate-200'
    : isCompleted
      ? 'bg-emerald-400'
      : 'bg-blue-200';

  const dotColor = locked
    ? 'bg-slate-200 ring-white'
    : isCompleted
      ? 'bg-emerald-500 ring-emerald-50'
      : isInProgress
        ? 'bg-blue-500 ring-blue-100 animate-pulse'
        : 'bg-slate-300 ring-white';

  return (
    <div className="relative group">
      {/* Timeline Line */}
      <div className={`absolute left-8 top-14 bottom-[-2rem] w-1 rounded-full z-0 transition-colors duration-500 ${timelineColor}`} />

      <div className="relative z-10 flex gap-6 items-start">
        {/* Timeline Node */}
        <div className="shrink-0 mt-5 flex flex-col items-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm z-10 transition-all duration-300 ${iconBg}`}>
            {locked ? <Lock className="w-6 h-6" /> : isCompleted ? <CheckCircle2 className="w-7 h-7" /> : (idx + 1)}
          </div>
          <div className={`absolute top-24 w-3 h-3 rounded-full ring-4 z-10 transition-all duration-300 ${dotColor}`} />
        </div>

        {/* Content Card */}
        <div className={`flex-1 rounded-2xl border transition-all duration-300 overflow-hidden ${cardBorder}`}>
          <button
            type="button"
            onClick={onToggle}
            className="w-full text-left px-6 py-5 flex items-start sm:items-center justify-between gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <StatusPill 
                  label={locked ? 'Locked' : isCompleted ? 'Completed' : isInProgress ? 'In Progress' : 'Not Started'} 
                  status={locked ? 'locked' : isCompleted ? 'completed' : isInProgress ? 'in-progress' : 'not-started'} 
                />
                {!locked && prereqCount > 0 && (
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full ${prereqBlocked ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {prereqCleared}/{prereqCount} Prereqs
                  </span>
                )}
                {!locked && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    <ListChecks className="w-3.5 h-3.5" />
                    {doneSub}/{totalSub} Modules
                  </span>
                )}
              </div>
              <h3 className={`text-lg sm:text-xl font-extrabold truncate ${locked ? 'text-slate-500' : 'text-slate-900'}`}>
                {topic.title}
              </h3>
            </div>

            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4 shrink-0">
              {!locked && (
                <div className="text-right hidden sm:block">
                  <p className={`text-xl font-black leading-none ${isCompleted ? 'text-emerald-600' : 'text-blue-600'}`}>{topic.progress}%</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Progress</p>
                </div>
              )}
              <div className={`p-2 rounded-full transition-colors ${open ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </button>

          {!locked && (
            <div className="px-6 pb-4">
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-400 to-blue-600'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${topic.progress}%` }}
                />
              </div>
            </div>
          )}

          <motion.div
            initial={false}
            animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-2 border-t border-slate-100 bg-slate-50/50">
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

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-blue-200 transition-colors">
                  <Video className="w-5 h-5 text-slate-400 mb-2" />
                  <p className="text-2xl font-black text-slate-900">{videoCount}</p>
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mt-1">Videos</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-blue-200 transition-colors">
                  <HelpCircle className="w-5 h-5 text-slate-400 mb-2" />
                  <p className="text-2xl font-black text-slate-900">{quizCount}</p>
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mt-1">Questions</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-blue-200 transition-colors">
                  <ListChecks className="w-5 h-5 text-slate-400 mb-2" />
                  <p className="text-2xl font-black text-slate-900">{doneSub}<span className="text-slate-400 text-lg">/{totalSub}</span></p>
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mt-1">Subtopics</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-blue-200 transition-colors">
                  <ShieldCheck className="w-5 h-5 text-slate-400 mb-2" />
                  <p className="text-2xl font-black text-slate-900">{prereqCleared}<span className="text-slate-400 text-lg">/{prereqCount}</span></p>
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mt-1">Prereqs</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="text-sm font-medium text-slate-600 flex-1">
                  {action.label === 'Review' && 'You have completed this topic. Revisit content or retry quizzes anytime.'}
                  {action.label === 'Continue' && 'You are currently learning this topic. Resume where you left off.'}
                  {action.label === 'Start' && 'Ready to learn? Begin this topic now.'}
                  {action.label === 'Locked' && 'Finish previous topics to unlock this content.'}
                </div>
                <button
                  onClick={onGo}
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
  const hasRealData = !curriculumLoading && curriculums.length > 0;
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

  const standard = hasRealData ? '' : '';
  const section = activeCurriculum ? activeCurriculum.className : '';

  // Map real topics to the StudentTopicProgress shape for the existing UI
  const realTopics: StudentTopicProgress[] = activeCurriculum
    ? (activeCurriculum.topics ?? []).map((t: any) => {
        const prog = t.progress;
        const subTopics = t.subTopics ?? [];
        const subTopicsDone = subTopics.filter((st: any) => st.progress?.quizStatus === 'passed').length;
        return {
          id: t.id,
          title: t.name,
          status: prog?.completedAt ? 'completed' : (prog ? 'in-progress' : 'not-started') as 'completed' | 'in-progress' | 'not-started',
          progress: subTopics.length > 0 ? Math.round((subTopicsDone / subTopics.length) * 100) : 0,
          prerequisites: t.prerequisite ? [{
            id: t.prerequisite.id,
            title: t.prerequisite.name ?? 'Prerequisite Check',
            description: t.prerequisite.description,
            category: 'Intermediate' as const,
            passingThreshold: t.prerequisite.passingThreshold ?? 60,
            questions: (t.prerequisite.questions ?? []).map(mapApiQuestion),
          }] : [],
          prerequisiteScores: [],
          subtopicsCompleted: subTopicsDone,
          totalSubtopics: subTopics.length,
          finalTestQuiz: (t.finalTestQuestions ?? []).map(mapApiQuestion),
          subTopics: subTopics.map((st: any) => ({
            id: st.id,
            title: st.name,
            status: st.progress?.quizStatus === 'passed' ? 'completed' : st.progress ? 'in-progress' : 'not-started' as 'completed' | 'in-progress' | 'not-started',
            videoUrl: st.youtubeUrl,
            videoWatched: st.progress?.videoWatched ?? false,
            quizzes: (st.questions ?? []).map(mapApiQuestion),
          })),
        };
      })
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

        {/* Header + Legend */}
        <motion.div variants={itemVariants} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-900 via-[#0084B4] to-blue-500 p-8 sm:p-10 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
              <div className="text-white min-w-0">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-bold uppercase tracking-wider mb-4 border border-white/10">
                  <Sparkles className="w-3.5 h-3.5" /> Learning Journey
                </div>
                <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 text-white">Your Curriculum</h1>
                <p className="text-blue-100 text-lg font-medium">
                  {[standard, section].filter(Boolean).join(' · ')}{section ? ' · ' : ''}
                  <span className="font-bold text-white ml-1">{completedTopics}/{totalTopics} modules completed</span>
                </p>
              </div>

              <div className="w-full lg:w-[360px] bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-blue-100 uppercase tracking-wider">Overall Progress</p>
                  <TrendingUp className="w-5 h-5 text-white opacity-80" />
                </div>
                <div className="flex items-end gap-2 mb-4">
                  <p className="text-4xl font-black text-white leading-none">{overallProgress}%</p>
                </div>
                <div className="h-2.5 bg-black/20 rounded-full overflow-hidden border border-white/10">
                  <div className="h-full bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" style={{ width: `${overallProgress}%` }} />
                </div>
              </div>
            </div>
          </div>
          
          <div className="px-8 py-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-3 flex-wrap">
              <StatusPill label="Completed" status="completed" />
              <StatusPill label="In Progress" status="in-progress" />
              <StatusPill label="Not Started" status="not-started" />
              <StatusPill label="Locked" status="locked" />
            </div>

            {upNextTopic && (
              <button
                onClick={() => navigate('/learn', { state: { topicIdx: upNextIdx, studentTopic: upNextTopic, curriculums, selectedClassIdx } })}
                disabled={upNextIdx > 0 && topics[upNextIdx - 1]?.status === 'not-started'}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-extrabold transition-all shadow-sm
                  ${upNextIdx > 0 && topics[upNextIdx - 1]?.status === 'not-started'
                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                    : 'bg-[#0084B4] text-white hover:bg-[#006A91] hover:shadow-md'}`}
              >
                <PlayCircle className="w-5 h-5" /> Jump Back In <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>

        {/* Roadmap timeline */}
        <motion.div variants={itemVariants} className="px-2 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Learning Path</h2>
              <p className="text-sm font-medium text-slate-500 mt-1">
                Complete modules in sequence to master the curriculum.
              </p>
            </div>
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
                    navigate('/learn', { state: { topicIdx: idx, studentTopic: topic, curriculums, selectedClassIdx } });
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
