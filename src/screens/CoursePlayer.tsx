import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, CheckCircle2, ChevronRight,
  Video, Network, BookOpen, PlayCircle, HelpCircle, Sparkles,
} from 'lucide-react';
import { InlineQuiz } from '../components/InlineQuiz';
import { AITeachingPanel } from '../components/AITeachingPanel';
import { FinalTestScreen } from '../components/FinalTestScreen';
import { apiFetch, useApiGet } from '../hooks/useApi';
import type { StudentTopicProgress, StudentSubTopicProgress, Question } from '../types';

// ── Sub-step model: one screen per video/quiz ────────────────────────────────
type SubStep =
  | { kind: 'video'; sub: StudentSubTopicProgress }
  | { kind: 'quiz'; sub: StudentSubTopicProgress; questions: Question[] }
  | { kind: 'eval-quiz'; label: string; questions: Question[] };

function buildSubSteps(topic: StudentTopicProgress): SubStep[] {
  const out: SubStep[] = [];
  if ((topic.preEvaluationQuiz?.length ?? 0) > 0)
    out.push({ kind: 'eval-quiz', label: 'Pre-Evaluation', questions: topic.preEvaluationQuiz! });
  for (const sub of topic.subTopics) {
    if (sub.videoUrl) out.push({ kind: 'video', sub });
    if ((sub.quizzes?.length ?? 0) > 0) out.push({ kind: 'quiz', sub, questions: sub.quizzes! });
  }
  // Intentionally omit the topic-level post evaluation ("section end quiz") from the learning flow UI.
  return out;
}

function youtubeEmbed(url: string) {
  const m = url.match(/(?:youtu\.be\/|v=)([^#&?]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}

// ── AI teach config ──────────────────────────────────────────────────────────
interface AiConfig {
  topicTitle: string;
  subtopicTitle?: string;
  kind: 'prerequisite' | 'subtopic';
  topicId?: string;
  subTopicId?: string;
  contextId?: string;
  failedQuestions?: FailedQuestion[];
  retakeQuestions?: Question[];
  onPassed: () => void;
  onBack: () => void;
}

type FailedQuestion = { questionId: string; text: string; type?: string; studentAnswer?: string; correctAnswer?: string; aiReasoning?: string };

type Phase = 'complete' | 'prereq' | 'subtopic' | 'final-test';

// ── Shell: top progress bar + animated content swap ──────────────────────────
function LearnShell({ topicTitle, step, total, onBack, children }: {
  topicTitle: string; step: number; total: number;
  onBack: () => void; children: React.ReactNode;
}) {
  const pct = total > 0 ? Math.round((step / total) * 100) : 0;
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <header className="sticky top-0 z-40 px-4 py-3 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold text-[#0084B4] uppercase tracking-wider mb-0.5">
                Learning Mode
              </p>
              <p className="text-sm sm:text-base font-extrabold text-slate-900 truncate">{topicTitle}</p>
            </div>
          </div>

          <div className="w-full sm:w-72 shrink-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Progress</span>
              <span className="text-xs font-black text-slate-900">{step} / {total} <span className="text-slate-400 font-bold ml-1">({pct}%)</span></span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-400 to-[#0084B4] rounded-full"
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 80, damping: 20 }}
              />
            </div>
          </div>
        </div>
      </header>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: -10 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex-1 flex flex-col overflow-hidden"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export function CoursePlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as { topicIdx?: number; studentTopic?: StudentTopicProgress; curriculums?: any[]; selectedClassIdx?: number } | null);
  const topicIdx = state?.topicIdx ?? 0;

  // Load real curriculum as a fallback source of truth (no more “pure mock” fallback)
  const { data: curriculumData, loading: curriculumLoading } =
    useApiGet<{ curriculums: any[] }>('/api/student/curriculum', []);

  function mapApiQuestion(q: any): Question {
    return {
      id: q.id,
      text: q.text ?? '',
      type: q.type === 'true_false' ? ('boolean' as const)
        : q.type === 'image_upload' ? ('image_upload' as const)
          : q.type === 'text' ? ('text' as const)
            : ('mcq' as const),
      options: q.options,
      correctAnswer: q.correctAnswer ?? '',
      explanation: q.explanation ?? '',
      difficulty: (['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : 'Medium') as any,
      imageUrl: q.imageUrl,
    };
  }

  const topicFromCurriculum: StudentTopicProgress | null = useMemo(() => {
    const c = state?.curriculums ? state.curriculums[state.selectedClassIdx ?? 0] : curriculumData?.curriculums?.[0];
    if (!c) return null;
    const topics = (c.topics ?? []).map((t: any) => {
      const prog = t.progress;
      const subTopics = t.subTopics ?? [];
      const subDone = subTopics.filter((st: any) => st.progress?.quizStatus === 'passed').length;
      return {
        id: t.id,
        title: t.name,
        status: prog?.completedAt ? 'completed' : (prog ? 'in-progress' : 'not-started') as any,
        progress: subTopics.length > 0 ? Math.round((subDone / subTopics.length) * 100) : 0,
        prerequisites: t.prerequisite ? [{
          id: t.prerequisite.id,
          title: t.prerequisite.name ?? 'Prerequisite Check',
          description: t.prerequisite.description,
          category: 'Intermediate' as const,
          passingThreshold: t.prerequisite.passingThreshold ?? 60,
          questions: (t.prerequisite.questions ?? []).map(mapApiQuestion),
        }] : [],
        prerequisiteScores: [],
        subtopicsCompleted: subDone,
        totalSubtopics: subTopics.length,
        finalTestQuiz: (t.finalTestQuestions ?? []).map(mapApiQuestion),
        subTopics: subTopics.map((st: any) => ({
          id: st.id,
          title: st.name,
          status: st.progress?.quizStatus === 'passed' ? 'completed' : (st.progress ? 'in-progress' : 'not-started') as any,
          videoUrl: st.youtubeUrl,
          videoWatched: st.progress?.videoWatched ?? false,
          quizzes: (st.questions ?? []).map(mapApiQuestion),
          passingThreshold: st.passingThreshold ?? 60,
        })),
      } as StudentTopicProgress;
    });
    return topics[topicIdx] ?? topics[0] ?? null;
  }, [curriculumData, topicIdx, state?.curriculums, state?.selectedClassIdx]);

  // Prefer the topic passed from Courses navigation; otherwise use curriculum API.
  const topic: StudentTopicProgress | null = state?.studentTopic ?? topicFromCurriculum;
  const topicId = topic?.id;

  // Topic status endpoint provides attempt history + thresholds.
  const { data: topicStatus, refetch: refetchTopicStatus } = useApiGet<any>(
    topicId ? `/api/student/topics/${topicId}/status` : '/api/healthz',
    [topicId]
  );

  // Attempt history extracted from topic status API
  const prereqAttemptHistory = useMemo(() => {
    const a = topicStatus?.prereqAttempts ?? [];
    return a.map((x: any) => ({
      score: x.score ?? 0,
      total: x.total ?? 0,
      date: (x.timestamp && x.timestamp.seconds)
        ? new Date(x.timestamp.seconds * 1000).toLocaleString()
        : '',
    }));
  }, [topicStatus]);

  const finalAttemptHistory = useMemo(() => {
    const a = topicStatus?.finalTestAttempts ?? [];
    return a.map((x: any) => ({
      score: x.score ?? 0,
      total: x.total ?? 0,
      date: (x.timestamp && x.timestamp.seconds)
        ? new Date(x.timestamp.seconds * 1000).toLocaleString()
        : '',
    }));
  }, [topicStatus]);

  // If we can’t resolve a topic (e.g. user directly hits /learn), push them to Courses.
  useEffect(() => {
    if (!curriculumLoading && !topic) navigate('/courses', { replace: true });
  }, [curriculumLoading, topic, navigate]);

  if (!topic) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const prereqs = topic.prerequisites ?? [];
  const subSteps = buildSubSteps(topic);
  const hasFinalTest = (topic.finalTestQuiz?.length ?? 0) > 0;

  // ── Derive starting state from recorded topic progress ──────────────────
  const startPhase: Phase = (() => {
    if (topic.status === 'completed') return 'complete';
    if (topic.status === 'in-progress') {
      const scoreCount = topic.prerequisiteScores?.length ?? 0;
      return (prereqs.length === 0 || scoreCount >= prereqs.length) ? 'subtopic' : 'prereq';
    }
    return prereqs.length > 0 ? 'prereq' : 'subtopic';
  })();

  const startPrereqIdx = (() => {
    if (topic.status === 'in-progress' && prereqs.length > 0) {
      const scoreCount = topic.prerequisiteScores?.length ?? 0;
      return Math.min(scoreCount, Math.max(0, prereqs.length - 1));
    }
    return 0;
  })();

  // Walk subSteps to find the first step not yet completed
  const startSubStepIdx = (() => {
    if (topic.status === 'in-progress' && startPhase === 'subtopic') {
      for (let i = 0; i < subSteps.length; i++) {
        const s = subSteps[i];
        if (s.kind === 'eval-quiz') {
          if (s.label === 'Pre-Evaluation' && topic.preEvaluationScore) continue;
          if (s.label === 'Post-Evaluation' && topic.postEvaluationScore) continue;
          return i;
        } else if (s.sub.status !== 'completed') {
          return i;
        }
      }
    }
    return 0;
  })();

  const [phase, setPhase] = useState<Phase>(startPhase);
  const [prereqIdx, setPrereqIdx] = useState(startPrereqIdx);
  const [subStepIdx, setSubStepIdx] = useState(startSubStepIdx);
  const [quizResult, setQuizResult] = useState<{ passed: boolean } | null>(null);
  const [aiTeach, setAiTeach] = useState<AiConfig | null>(null);
  const lastFailedQuestions = useRef<FailedQuestion[]>([]);

  // Await quiz submission to the API — returns API result so we can block the UI on it
  async function submitQuizToApi(params: {
    contextType: 'prereq' | 'subtopic' | 'finaltest';
    contextId: string;
    topicId: string;
    subTopicId?: string;
    answers: Record<string, string>;
  }): Promise<{ passed: boolean; percentage: number } | null> {
    const answersArray = Object.entries(params.answers).map(([questionId, answer]) => ({ questionId, answer }));
    try {
      const res = await apiFetch<any>('/api/student/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({ ...params, answers: answersArray }),
      });
      if (res.data?.failedQuestions) {
        lastFailedQuestions.current = res.data.failedQuestions;
      }
      return res.data ? { passed: res.data.passed, percentage: res.data.percentage } : null;
    } catch {
      return null;
    }
  }

  // ── Progress ────────────────────────────────────────────────────────────
  const totalSteps = prereqs.length + subSteps.length + (hasFinalTest ? 1 : 0);
  const currentStep =
    phase === 'complete' ? totalSteps :
      phase === 'prereq' ? prereqIdx + 1 :
        phase === 'subtopic' ? prereqs.length + subStepIdx + 1 :
    /* final-test */        prereqs.length + subSteps.length + 1;

  // ── Navigation ──────────────────────────────────────────────────────────
  function advancePrereq() {
    setQuizResult(null);
    if (prereqIdx + 1 < prereqs.length) {
      setPrereqIdx(p => p + 1);
    } else {
      setPhase('subtopic');
      setPrereqIdx(0);
    }
  }

  function advanceSubStep() {
    setQuizResult(null);
    if (subStepIdx + 1 < subSteps.length) {
      setSubStepIdx(i => i + 1);
    } else if (hasFinalTest) {
      setPhase('final-test');
    } else {
      navigate('/courses');
    }
  }

  // ── AI Teach overlay ────────────────────────────────────────────────────
  if (aiTeach) {
    return (
      <LearnShell topicTitle={topic.title} step={currentStep} total={totalSteps} onBack={() => navigate('/courses')}>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-2xl mx-auto">
            <AITeachingPanel
              topicTitle={aiTeach.topicTitle}
              subtopicTitle={aiTeach.subtopicTitle}
              kind={aiTeach.kind}
              topicId={aiTeach.topicId}
              subTopicId={aiTeach.subTopicId}
              contextId={aiTeach.contextId}
              failedQuestions={aiTeach.failedQuestions}
              retakeQuestions={aiTeach.retakeQuestions}
              onPassed={() => { setAiTeach(null); lastFailedQuestions.current = []; aiTeach.onPassed(); }}
              onBack={() => { setAiTeach(null); aiTeach.onBack(); }}
            />
          </div>
        </div>
      </LearnShell>
    );
  }

  // ── Complete screen ────────────────────────────────────────────────────
  if (phase === 'complete') {
    const ftScore = topic.finalTestScore;
    const prereqsPassed = topic.prerequisiteScores?.length ?? 0;
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-slate-50 sticky top-0 z-30 pt-4 pb-2 px-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/courses')}
                className="p-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Curriculum Topic</p>
                <p className="text-sm font-extrabold text-slate-900 truncate">{topic.title}</p>
              </div>
            </div>
            <span className="text-[10px] font-extrabold px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full uppercase tracking-wider border border-emerald-200 shadow-sm">Completed</span>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
            {/* Trophy */}
            <div className="flex flex-col items-center gap-4 relative">
              <div className="absolute inset-0 bg-emerald-400/20 blur-3xl rounded-full w-48 h-48 mx-auto top-1/2 -translate-y-1/2" />
              <div className="w-28 h-28 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-[2rem] flex items-center justify-center shadow-lg shadow-emerald-200/50 rotate-3 hover:rotate-0 transition-transform duration-300 relative z-10 border border-emerald-300/50">
                <CheckCircle2 className="w-14 h-14 text-emerald-600 drop-shadow-md" />
              </div>
              <div className="relative z-10">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Mastered!</h1>
                <p className="text-slate-500 mt-2 text-base">You've successfully completed <span className="font-bold text-slate-800">{topic.title}</span>.</p>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-4">
              {prereqsPassed > 0 && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 hover:border-purple-200 hover:shadow-md transition-all">
                  <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-500 to-purple-700">{prereqsPassed}</p>
                  <p className="text-xs font-bold text-slate-400 mt-2 leading-tight uppercase tracking-wide">Prereqs</p>
                </div>
              )}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 hover:border-blue-200 hover:shadow-md transition-all">
                <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-500 to-blue-700">{topic.subtopicsCompleted}<span className="text-lg text-slate-300">/{topic.totalSubtopics}</span></p>
                <p className="text-xs font-bold text-slate-400 mt-2 leading-tight uppercase tracking-wide">Modules</p>
              </div>
              {ftScore && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 hover:border-emerald-200 hover:shadow-md transition-all">
                  <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 to-emerald-700">{Math.round((ftScore.score / ftScore.total) * 100)}%</p>
                  <p className="text-xs font-bold text-slate-400 mt-2 leading-tight uppercase tracking-wide">Test Score</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                onClick={() => navigate('/courses')}
                className="flex-1 py-4 px-6 bg-slate-900 text-white font-extrabold rounded-2xl hover:bg-slate-800 hover:shadow-lg transition-all shadow-md text-sm"
              >
                Back to Roadmap
              </button>
              <button
                onClick={() => {
                  setPhase(prereqs.length > 0 ? 'prereq' : 'subtopic');
                  setPrereqIdx(0);
                  setSubStepIdx(0);
                  setQuizResult(null);
                }}
                className="flex-1 py-4 px-6 bg-white border-2 border-slate-200 text-slate-700 font-extrabold rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all text-sm shadow-sm"
              >
                Review Topic
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ── Final Test ──────────────────────────────────────────────────────────
  if (phase === 'final-test') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-slate-50 sticky top-0 z-30 pt-4 pb-2 px-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => { setPhase('subtopic'); setSubStepIdx(subSteps.length > 0 ? subSteps.length - 1 : 0); }}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors text-sm font-extrabold shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Final test</p>
              <p className="text-sm font-extrabold text-slate-900 truncate">{topic.title}</p>
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4">
          <FinalTestScreen
            topicTitle={topic.title}
            topicId={topic.id}
            questions={topic.finalTestQuiz ?? []}
            videosWatched={topic.subTopics.filter(s => s.videoWatched).length}
            quizzesCompleted={topic.subTopics.filter(s => s.quizScore).length}
            onCompleted={() => navigate('/courses')}
            onBack={() => { setPhase('subtopic'); setSubStepIdx(subSteps.length > 0 ? subSteps.length - 1 : 0); }}
          />
        </div>
      </div>
    );
  }

  // ── Prereq screens ──────────────────────────────────────────────────────
  if (phase === 'prereq') {
    const prereq = prereqs[prereqIdx];
    const hasQuiz = (prereq.questions?.length ?? 0) > 0;

    return (
      <LearnShell topicTitle={topic.title} step={currentStep} total={totalSteps} onBack={() => navigate('/courses')}>
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mx-auto">

            <p className="text-xs font-extrabold text-purple-600 uppercase tracking-widest mb-5 flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5" />
              Prerequisite Check · {prereqIdx + 1} of {prereqs.length}
            </p>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 bg-purple-50 border-b border-purple-100">
                <h2 className="text-xl font-extrabold text-slate-900 mb-1">{prereq.title}</h2>
                {prereq.description && (
                  <p className="text-sm text-slate-600 leading-relaxed">{prereq.description}</p>
                )}
                <span className={`inline-block mt-3 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase
                  ${prereq.category === 'Major' ? 'bg-red-100 text-red-700'
                    : prereq.category === 'Intermediate' ? 'bg-orange-100 text-orange-700'
                      : 'bg-slate-100 text-slate-600'}`}>
                  {prereq.category}
                </span>
              </div>
              <div className="p-6">
                {!hasQuiz ? (
                  <button
                    onClick={advancePrereq}
                    className="w-full py-3.5 bg-purple-600 text-white font-extrabold rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    I understand this topic <ChevronRight className="w-5 h-5" />
                  </button>
                ) : (
                  <>
                    <div key={prereqIdx}>
                      <InlineQuiz
                        title={`Check: ${prereq.title}`}
                        questions={prereq.questions!}
                        attemptHistory={prereqAttemptHistory}
                        onSubmit={(score, total, answers) => {
                          const pct = total > 0 ? (score / total) * 100 : 100;
                          setQuizResult({ passed: pct >= (prereq.passingThreshold ?? 60) });
                          if (answers && topic.id && prereq.id) {
                            // Local fallback so AI coach has immediate context (API may return later)
                            lastFailedQuestions.current = (prereq.questions ?? [])
                              .filter((q) => (answers[q.id] ?? '').trim() !== '' && (answers[q.id] ?? '') !== (q.correctAnswer ?? ''))
                              .map((q) => ({
                                questionId: q.id,
                                text: q.text,
                                type: q.type,
                                studentAnswer: answers[q.id] ?? '',
                                correctAnswer: q.correctAnswer ?? '',
                                aiReasoning: '',
                              }));
                            submitQuizToApi({
                              contextType: 'prereq',
                              contextId: prereq.id,
                              topicId: topic.id,
                              answers,
                            });
                            // Refresh live attempt history + progress from backend
                            refetchTopicStatus();
                          }
                        }}
                      />
                    </div>
                    {quizResult && (
                      <div className="mt-4">
                        {quizResult.passed ? (
                          <button
                            onClick={advancePrereq}
                            className="w-full py-3 bg-purple-600 text-white font-extrabold rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                          >
                            Continue <ChevronRight className="w-5 h-5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setAiTeach({
                              topicTitle: topic.title,
                              kind: 'prerequisite',
                              topicId: topic.id,
                              contextId: prereq.id,
                              failedQuestions: lastFailedQuestions.current.length > 0
                                ? lastFailedQuestions.current : undefined,
                              retakeQuestions: lastFailedQuestions.current.length === 0
                                ? prereq.questions : undefined,
                              onPassed: advancePrereq,
                              onBack: () => { },
                            })}
                            className="w-full py-3 bg-indigo-600 text-white font-extrabold rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                          >
                            <Sparkles className="w-4 h-4" /> Get AI Help & Retake
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      </LearnShell>
    );
  }

  // ── Subtopic screens ────────────────────────────────────────────────────
  const step = subSteps[subStepIdx];

  if (!step) {
    return (
      <LearnShell topicTitle={topic.title} step={currentStep} total={totalSteps} onBack={() => navigate('/courses')}>
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div>
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No content available for this topic yet.</p>
            <button onClick={() => navigate('/courses')}
              className="mt-4 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold">
              Back to Curriculum
            </button>
          </div>
        </div>
      </LearnShell>
    );
  }

  // Video screen
  if (step.kind === 'video') {
    return (
      <LearnShell topicTitle={topic.title} step={currentStep} total={totalSteps} onBack={() => navigate('/courses')}>
        {/* Desktop: side-by-side. Mobile: stacked. */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-white max-w-[1600px] mx-auto w-full border-x border-slate-200/50 shadow-sm">

          {/* ── Video panel ── */}
          <div className="lg:flex-1 bg-black flex items-center justify-center overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="w-full" style={{ aspectRatio: '16 / 9', maxHeight: '100%' }}>
              <iframe
                src={youtubeEmbed(step.sub.videoUrl ?? '')}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={step.sub.title}
              />
            </div>
          </div>

          {/* ── Info panel ── */}
          <div className="lg:w-[400px] xl:w-[440px] shrink-0 bg-slate-50 border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col overflow-y-auto">
            <div className="flex-1 p-6 sm:p-8 flex flex-col gap-6">
              <div>
                <p className="text-[10px] font-extrabold text-[#0084B4] uppercase tracking-widest mb-3 flex items-center gap-1.5 bg-blue-100/50 w-max px-2.5 py-1 rounded-full border border-blue-200/50 shadow-sm">
                  <Video className="w-3.5 h-3.5" /> Lesson Video
                </p>
                <h2 className="text-2xl font-black text-slate-900 leading-tight">{step.sub.title}</h2>
                <p className="text-sm font-medium text-slate-500 mt-3 leading-relaxed">
                  Watch the full video carefully. The upcoming quiz questions will test your understanding of this material.
                </p>
              </div>

              {/* Step context */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:border-slate-300 transition-colors">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Current Topic</p>
                <p className="text-base font-extrabold text-slate-800">
                  {topic.title}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="h-1.5 flex-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-300 rounded-full" style={{ width: `${(currentStep / totalSteps) * 100}%` }} />
                  </div>
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider shrink-0">Step {currentStep} of {totalSteps}</p>
                </div>
              </div>
            </div>

            {/* CTA always visible at bottom of panel */}
            <div className="p-6 pt-0 shrink-0 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent">
              <button
                onClick={async () => {
                  // Mark video as watched via API if sub has a real ID
                  if (step.kind === 'video' && step.sub.id) {
                    apiFetch('/api/student/video/watched', {
                      method: 'POST',
                      body: JSON.stringify({ subTopicId: step.sub.id, topicId: topic.id }),
                    }).then(() => refetchTopicStatus()).catch(() => { });
                  }
                  advanceSubStep();
                }}
                className="w-full flex items-center justify-center gap-2 py-4 bg-[#0084B4] hover:bg-[#006A91] hover:shadow-lg hover:-translate-y-0.5 text-white font-extrabold rounded-2xl transition-all shadow-md active:translate-y-0"
              >
                <CheckCircle2 className="w-5 h-5" /> I've Watched This — Continue
              </button>
            </div>
          </div>

        </div>
      </LearnShell>
    );
  }

  // Quiz screen (subtopic-quiz and eval-quiz)
  const quizTitle = step.kind === 'eval-quiz'
    ? step.label
    : `Quiz: ${step.sub.title}`;
  const phaseLabel = step.kind === 'eval-quiz'
    ? step.label
    : step.sub.title;
  const offerAiHelp = step.kind === 'quiz';

  return (
    <LearnShell topicTitle={topic.title} step={currentStep} total={totalSteps} onBack={() => navigate('/courses')}>
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        <div className="flex-1 flex flex-col max-w-[1600px] w-full mx-auto h-full">
          <div key={subStepIdx} className="flex-1 flex flex-col h-full">
            <InlineQuiz
              title={quizTitle}
              questions={step.questions}
              onSubmit={async (score, total, answers) => {
                const localPct = total > 0 ? (score / total) * 100 : 100;
                const threshold = step.kind === 'quiz' ? (step.sub as any).passingThreshold ?? 60 : 60;
                if (answers && step.kind === 'quiz' && topic.id && step.sub.id) {
                  // Local fallback first (so coach has something even if API fails)
                  lastFailedQuestions.current = (step.questions ?? [])
                    .filter((q) => (answers[q.id] ?? '').trim() !== '' && (answers[q.id] ?? '') !== (q.correctAnswer ?? ''))
                    .map((q) => ({
                      questionId: q.id,
                      text: q.text,
                      type: q.type,
                      studentAnswer: answers[q.id] ?? '',
                      correctAnswer: q.correctAnswer ?? '',
                      aiReasoning: '',
                    }));
                  // Await API so failedQuestions (with AI reasoning) are ready before result banner shows
                  const apiResult = await submitQuizToApi({
                    contextType: 'subtopic',
                    contextId: step.sub.id,
                    topicId: topic.id,
                    subTopicId: step.sub.id,
                    answers,
                  });
                  // Prefer server-side pass/fail (accounts for AI-evaluated answers)
                  const passed = apiResult ? apiResult.passed : (localPct >= threshold);
                  setQuizResult({ passed });
                  refetchTopicStatus();
                } else {
                  setQuizResult({ passed: localPct >= threshold });
                }
              }}
            />
          </div>

          {quizResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-white border-t border-slate-200 flex justify-end shrink-0 shadow-sm"
            >
              {quizResult.passed || !offerAiHelp ? (
                <button
                  onClick={advanceSubStep}
                  className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-500 to-[#0084B4] text-white font-extrabold rounded-2xl hover:from-[#0084B4] hover:to-[#006A91] hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 shadow-md"
                >
                  Continue Journey <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={() => setAiTeach({
                    topicTitle: topic.title,
                    subtopicTitle: step.kind === 'quiz' ? step.sub.title : undefined,
                    kind: 'subtopic',
                    topicId: topic.id,
                    subTopicId: step.kind === 'quiz' ? step.sub.id : undefined,
                    contextId: step.kind === 'quiz' ? step.sub.id : undefined,
                    failedQuestions: lastFailedQuestions.current.length > 0
                      ? lastFailedQuestions.current : undefined,
                    retakeQuestions: lastFailedQuestions.current.length === 0
                      ? step.questions : undefined,
                    onPassed: advanceSubStep,
                    onBack: () => { },
                  })}
                  className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-500 to-indigo-700 text-white font-extrabold rounded-2xl hover:from-indigo-600 hover:to-indigo-800 hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 shadow-md"
                >
                  <Sparkles className="w-5 h-5" /> Get AI Help & Retake
                </button>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </LearnShell>
  );
}
