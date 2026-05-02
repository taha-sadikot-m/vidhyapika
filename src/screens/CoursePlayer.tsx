import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, CheckCircle2, ChevronRight, ChevronsLeft, ChevronsRight,
  Video, Network, BookOpen, Sparkles,
  List, X, ClipboardList,
} from 'lucide-react';
import { InlineQuiz, type QuizSubmitGradingResult, type AiCoachingSessionSummary } from '../components/InlineQuiz';
import { gradingFromSubmitResponse } from '../utils/quizGrading';
import { AITeachingPanel } from '../components/AITeachingPanel';
import { FinalTestScreen } from '../components/FinalTestScreen';
import { TopicOverviewHistory } from '../components/TopicOverviewHistory';
import { TopicLearningOutline } from '../components/TopicLearningOutline';
import { apiFetch, useApiGet } from '../hooks/useApi';
import type { StudentTopicProgress, Question } from '../types';
import { mapRawTopicToStudentTopic } from '../utils/studentCurriculumMap';
import {
  buildSubSteps,
  isSubStepComplete,
  allSubStepsComplete,
  youtubeEmbed,
} from '../utils/learningFlow';
import type { Phase, LearningStage } from '../utils/learningStageSelection';
import {
  indicesToStage,
  stageToIndices,
  prereqCleared,
} from '../utils/learningStageSelection';

function formatQuizAttemptTimestamp(ts?: { seconds?: number; _seconds?: number }): string {
  if (ts?.seconds != null) return new Date(ts.seconds * 1000).toLocaleString();
  if (ts?._seconds != null) return new Date(ts._seconds * 1000).toLocaleString();
  return '';
}

/** Maps Firestore/API quiz attempt into InlineQuiz `attemptHistory` items (includes per-question answers when stored). */
function mapApiQuizAttemptForHistory(x: {
  score?: number;
  total?: number;
  passed?: boolean;
  aiGenerated?: boolean;
  timestamp?: { seconds?: number; _seconds?: number };
  answers?: Array<{ questionId: string; answer?: string; correct?: boolean; aiReasoning?: string }>;
}) {
  return {
    score: x.score ?? 0,
    total: x.total ?? 0,
    passed: typeof x.passed === 'boolean' ? x.passed : undefined,
    aiGenerated: x.aiGenerated === true,
    date: formatQuizAttemptTimestamp(x.timestamp),
    answers: Array.isArray(x.answers)
      ? x.answers.map((a) => ({
          questionId: a.questionId,
          answer: a.answer ?? '',
          correct: !!a.correct,
          aiReasoning: a.aiReasoning,
        }))
      : undefined,
  };
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

// ── Main component ───────────────────────────────────────────────────────────
export function CoursePlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as {
    topicIdx?: number;
    studentTopic?: StudentTopicProgress;
    curriculums?: any[];
    selectedClassIdx?: number;
  } | null);
  const topicIdx = state?.topicIdx ?? 0;

  const { data: curriculumData, loading: curriculumLoading, refetch: refetchCurriculum } =
    useApiGet<{ curriculums: any[] }>('/api/student/curriculum', []);

  const topicFromCurriculum: StudentTopicProgress | null = useMemo(() => {
    const idx = state?.selectedClassIdx ?? 0;
    const fromApi = curriculumData?.curriculums?.length
      ? curriculumData.curriculums[idx] ?? curriculumData.curriculums[0]
      : null;
    const c = fromApi ?? (state?.curriculums ? state.curriculums[idx] ?? state.curriculums[0] : null);
    if (!c) return null;
    const topics = (c.topics ?? []).map(mapRawTopicToStudentTopic);
    return topics[topicIdx] ?? topics[0] ?? null;
  }, [curriculumData, topicIdx, state?.curriculums, state?.selectedClassIdx]);

  const topic: StudentTopicProgress | null = topicFromCurriculum ?? state?.studentTopic ?? null;
  const topicId = topic?.id;

  const { data: topicStatus, refetch: refetchTopicStatus } = useApiGet<any>(
    topicId ? `/api/student/topics/${topicId}/status` : '/api/healthz',
    [topicId]
  );

  const flow = useMemo(() => {
    if (!topic) return null;
    const prereqs = topic.prerequisites ?? [];
    const subSteps = buildSubSteps(topic);
    const hasFinalTest = (topic.finalTestQuiz?.length ?? 0) > 0;
    const prereqsDone =
      prereqs.length === 0 ||
      (topic.prerequisiteScores?.length ?? 0) >= prereqs.length;
    const subsAllDone = allSubStepsComplete(subSteps, topic);

    const startPhase: Phase = (() => {
      if (topic.status === 'completed') return 'complete';
      if (!prereqsDone) return 'prereq';
      if (hasFinalTest && subsAllDone) {
        if (topic.finalTestScore) return 'complete';
        return 'final-test';
      }
      return 'subtopic';
    })();

    const startPrereqIdx = (() => {
      if (prereqs.length > 0 && !prereqsDone) {
        const scoreCount = topic.prerequisiteScores?.length ?? 0;
        return Math.min(scoreCount, Math.max(0, prereqs.length - 1));
      }
      return 0;
    })();

    const startSubStepIdx = (() => {
      if (startPhase !== 'subtopic') return 0;
      for (let i = 0; i < subSteps.length; i++) {
        if (!isSubStepComplete(subSteps[i]!, topic)) return i;
      }
      return Math.max(0, subSteps.length - 1);
    })();

    return { prereqs, subSteps, hasFinalTest, startPhase, startPrereqIdx, startSubStepIdx };
  }, [topic]);

  const [phase, setPhase] = useState<Phase>('subtopic');
  const [prereqIdx, setPrereqIdx] = useState(0);
  const [subStepIdx, setSubStepIdx] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [outlineDrawerOpen, setOutlineDrawerOpen] = useState(false);
  /** Desktop (md+): topic path column visible */
  const [desktopOutlineExpanded, setDesktopOutlineExpanded] = useState(true);
  const [quizResult, setQuizResult] = useState<{ passed: boolean } | null>(null);
  const [aiTeach, setAiTeach] = useState<AiConfig | null>(null);
  const lastFailedQuestions = useRef<FailedQuestion[]>([]);

  const applyLearningStage = useCallback((s: LearningStage) => {
    if (!flow) return;
    const { phase: p, prereqIdx: pi, subStepIdx: si } = stageToIndices(s, flow.subSteps);
    setPhase(p);
    setPrereqIdx(pi);
    setSubStepIdx(si);
    setQuizResult(null);
    setOutlineDrawerOpen(false);
  }, [flow]);

  const currentStage = useMemo(() => {
    if (!flow) return { kind: 'complete-summary' } as LearningStage;
    return indicesToStage(phase, prereqIdx, subStepIdx, flow.subSteps);
  }, [flow, phase, prereqIdx, subStepIdx]);

  const prereqAttemptHistory = useMemo(() => {
    if (!topic) return [];
    const pid = topic.prerequisites?.[prereqIdx]?.id;
    const blocks = topicStatus?.prereqQuizAttempts ?? [];
    const block = pid ? blocks.find((x: { prerequisiteId: string }) => x.prerequisiteId === pid) : null;
    const a = block?.attempts ?? [];
    return a.map(mapApiQuizAttemptForHistory);
  }, [topicStatus, topic, prereqIdx]);

  const currentSubStep = flow?.subSteps[subStepIdx];

  const quizAiSessionsUrl = useMemo(() => {
    if (!topicId || !flow) return '/api/healthz';
    if (phase === 'prereq') {
      const pid = flow.prereqs[prereqIdx]?.id;
      if (!pid) return '/api/healthz';
      return `/api/student/ai-sessions?topicId=${encodeURIComponent(topicId)}&contextType=prereq&contextId=${encodeURIComponent(pid)}&detail=1`;
    }
    if (
      phase === 'subtopic' &&
      currentSubStep?.kind === 'quiz' &&
      'sub' in currentSubStep &&
      currentSubStep.sub?.id
    ) {
      return `/api/student/ai-sessions?topicId=${encodeURIComponent(topicId)}&contextType=subtopic&contextId=${encodeURIComponent(currentSubStep.sub.id)}&detail=1`;
    }
    return '/api/healthz';
  }, [
    topicId,
    flow,
    phase,
    prereqIdx,
    currentSubStep?.kind,
    currentSubStep && 'sub' in currentSubStep ? currentSubStep.sub?.id : undefined,
    subStepIdx,
  ]);

  const { data: aiSessionsPayload, refetch: refetchAiSessions } = useApiGet<{
    sessions: Array<{
      id: string;
      createdAt: string | null;
      mistakeCount: number;
      lessonCount: number;
      drillCount: number;
      lessonCards?: Array<{ title: string; content: string; latex?: string }>;
      mistakes?: Array<{
        questionId: string;
        mistakeTitle: string;
        whatWentWrong: string;
        likelyMisconception: string;
        fix: string;
        example: string;
      }>;
      drills?: Array<{
        prompt: string;
        hint: string;
        checkYourself: string;
        solution: string;
      }>;
      messages?: Array<{ role: 'tutor' | 'student'; content: string; timestamp: number }>;
    }>;
  }>(quizAiSessionsUrl, [quizAiSessionsUrl]);

  const aiCoachingSummaries: AiCoachingSessionSummary[] = useMemo(
    () =>
      (aiSessionsPayload?.sessions ?? []).map((s) => ({
        id: s.id,
        createdAtLabel: s.createdAt ? new Date(s.createdAt).toLocaleString() : '—',
        mistakeCount: s.mistakeCount,
        lessonCount: s.lessonCount,
        drillCount: s.drillCount,
        lessonCards: s.lessonCards,
        mistakes: s.mistakes,
        drills: s.drills,
        messages: s.messages,
      })),
    [aiSessionsPayload],
  );

  const prevAiTeachRef = useRef<AiConfig | null>(null);
  useEffect(() => {
    if (prevAiTeachRef.current && !aiTeach) {
      void refetchAiSessions();
    }
    prevAiTeachRef.current = aiTeach;
  }, [aiTeach, refetchAiSessions]);

  useEffect(() => {
    if (!flow) return;
    setPhase(flow.startPhase);
    setPrereqIdx(flow.startPrereqIdx);
    setSubStepIdx(flow.startSubStepIdx);
    setQuizResult(null);
  }, [topic?.id, flow?.startPhase, flow?.startPrereqIdx, flow?.startSubStepIdx]);

  useEffect(() => {
    if (historyOpen && topicId) void refetchTopicStatus();
  }, [historyOpen, topicId, refetchTopicStatus]);

  useEffect(() => {
    if (!curriculumLoading && !topic) navigate('/courses', { replace: true });
  }, [curriculumLoading, topic, navigate]);

  if (!topic || !flow) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { prereqs, subSteps, hasFinalTest } = flow;
  const learntTopic = topic;

  async function submitQuizToApi(params: {
    contextType: 'prereq' | 'subtopic' | 'finaltest';
    contextId: string;
    topicId: string;
    subTopicId?: string;
    answers: Record<string, string>;
  }): Promise<{
    passed: boolean;
    percentage: number;
    grading: QuizSubmitGradingResult | null;
    evaluationIncomplete?: boolean;
  } | null> {
    const answersArray = Object.entries(params.answers).map(([questionId, answer]) => ({ questionId, answer }));
    try {
      const res = await apiFetch<any>('/api/student/quiz/submit', {
        method: 'POST',
        body: JSON.stringify({ ...params, answers: answersArray }),
      });
      if (!res.data) return null;
      if (res.data.evaluationIncomplete) {
        return {
          passed: false,
          percentage: res.data.percentage ?? 0,
          grading: gradingFromSubmitResponse(res.data),
          evaluationIncomplete: true,
        };
      }
      if (res.data?.failedQuestions) {
        lastFailedQuestions.current = res.data.failedQuestions;
      }
      return {
        passed: res.data.passed,
        percentage: res.data.percentage,
        grading: gradingFromSubmitResponse(res.data),
        evaluationIncomplete: false,
      };
    } catch {
      return null;
    }
  }

  const totalSteps = prereqs.length + subSteps.length + (hasFinalTest ? 1 : 0);
  const currentStep =
    phase === 'complete' ? totalSteps :
      phase === 'prereq' ? prereqIdx + 1 :
        phase === 'subtopic' ? prereqs.length + subStepIdx + 1 :
          prereqs.length + subSteps.length + 1;

  const pct = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;

  function advancePrereq() {
    setQuizResult(null);
    if (prereqIdx + 1 < prereqs.length) {
      setPrereqIdx((p) => p + 1);
    } else {
      setPhase('subtopic');
      setPrereqIdx(0);
      if (subSteps.length > 0) {
        let i = 0;
        for (; i < subSteps.length; i++) {
          if (!isSubStepComplete(subSteps[i]!, learntTopic)) break;
        }
        setSubStepIdx(Math.min(i, subSteps.length - 1));
      } else {
        setSubStepIdx(0);
      }
    }
  }

  function advanceSubStep() {
    setQuizResult(null);
    if (subStepIdx + 1 < subSteps.length) {
      setSubStepIdx((i) => i + 1);
    } else if (hasFinalTest) {
      setPhase('final-test');
    } else {
      navigate('/courses');
    }
  }

  const topicPrereqCleared = prereqCleared(learntTopic, prereqs);

  function renderMainPane() {
    if (phase === 'complete') {
      const ftScore = learntTopic.finalTestScore;
      const prereqsPassed = learntTopic.prerequisiteScores?.length ?? 0;
      return (
        <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
          <div className="max-w-md w-full text-center space-y-8">
            <div className="flex flex-col items-center gap-4 relative">
              <div className="absolute inset-0 bg-emerald-400/20 blur-3xl rounded-full w-48 h-48 mx-auto top-1/2 -translate-y-1/2" />
              <div className="w-28 h-28 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-[2rem] flex items-center justify-center shadow-lg shadow-emerald-200/50 rotate-3 hover:rotate-0 transition-transform duration-300 relative z-10 border border-emerald-300/50">
                <CheckCircle2 className="w-14 h-14 text-emerald-600 drop-shadow-md" />
              </div>
              <div className="relative z-10">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Mastered!</h1>
                <p className="text-slate-500 mt-2 text-base">
                  You&apos;ve successfully completed <span className="font-bold text-slate-800">{learntTopic.title}</span>.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {prereqsPassed > 0 && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
                  <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-500 to-purple-700">{prereqsPassed}</p>
                  <p className="text-xs font-bold text-slate-400 mt-2 leading-tight uppercase tracking-wide">Prereqs</p>
                </div>
              )}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
                <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-blue-500 to-blue-700">
                  {learntTopic.subtopicsCompleted}<span className="text-lg text-slate-300">/{learntTopic.totalSubtopics}</span>
                </p>
                <p className="text-xs font-bold text-slate-400 mt-2 leading-tight uppercase tracking-wide">Modules</p>
              </div>
              {ftScore && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
                  <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 to-emerald-700">
                    {Math.round((ftScore.score / ftScore.total) * 100)}%
                  </p>
                  <p className="text-xs font-bold text-slate-400 mt-2 leading-tight uppercase tracking-wide">Test Score</p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-4 pt-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/courses')}
                  className="flex-1 py-4 px-6 bg-slate-900 text-white font-extrabold rounded-2xl hover:bg-slate-800 transition-all shadow-md text-sm"
                >
                  Back to Roadmap
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhase(prereqs.length > 0 ? 'prereq' : 'subtopic');
                    setPrereqIdx(0);
                    setSubStepIdx(0);
                    setQuizResult(null);
                  }}
                  className="flex-1 py-4 px-6 bg-white border-2 border-slate-200 text-slate-700 font-extrabold rounded-2xl hover:bg-slate-50 transition-all text-sm shadow-sm"
                >
                  Review Topic
                </button>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="w-full py-3.5 px-6 rounded-2xl border-2 border-[#0084B4]/25 text-[#0084B4] font-extrabold text-sm hover:bg-sky-50/80 transition-colors"
              >
                Topic map &amp; quiz history
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (phase === 'final-test') {
      const subtopicQuizCount = learntTopic.subTopics.filter((s) => (s.quizzes?.length ?? 0) > 0).length;
      const videosWatchedCount = learntTopic.subTopics.filter((s) => !!s.videoUrl && s.videoWatched).length;
      const quizzesPassedCount = learntTopic.subTopics.filter(
        (s) => (s.quizzes?.length ?? 0) > 0 && s.status === 'completed'
      ).length;
      return (
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          <FinalTestScreen
            topicTitle={learntTopic.title}
            topicId={learntTopic.id}
            questions={learntTopic.finalTestQuiz ?? []}
            videosWatched={videosWatchedCount}
            quizzesCompleted={quizzesPassedCount}
            subtopicQuizTotal={subtopicQuizCount}
            onCompleted={async () => {
              await refetchTopicStatus();
              await refetchCurriculum();
              navigate('/courses');
            }}
            onBack={() => {
              setPhase('subtopic');
              setSubStepIdx(subSteps.length > 0 ? subSteps.length - 1 : 0);
            }}
          />
        </div>
      );
    }

    if (phase === 'prereq') {
      const prereq = prereqs[prereqIdx];
      return (
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 min-h-0 w-full">
          <div className="w-full max-w-none mx-auto">
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
                <span
                  className={`inline-block mt-3 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase
                  ${prereq.category === 'Major' ? 'bg-red-100 text-red-700'
                    : prereq.category === 'Intermediate' ? 'bg-orange-100 text-orange-700'
                      : 'bg-slate-100 text-slate-600'}`}
                >
                  {prereq.category}
                </span>
              </div>
              <div className="px-0 pt-0 pb-6 sm:px-6">
                <div key={prereqIdx} className="min-h-[420px] w-full max-w-full">
                  <InlineQuiz
                    title={`Check: ${prereq.title}`}
                    questions={prereq.questions ?? []}
                    attemptHistory={prereqAttemptHistory}
                    passingThresholdPercent={prereq.passingThreshold ?? 60}
                    onEmptyQuizContinue={advancePrereq}
                    emptyQuizContinueLabel="Continue to next step"
                    startLayout="split"
                    aiCoachingSessions={aiCoachingSummaries}
                    onSubmit={async (score, total, answers) => {
                      const threshold = prereq.passingThreshold ?? 60;
                      if (!answers || !learntTopic.id || !prereq.id) {
                        const pct = total > 0 ? (score / total) * 100 : 100;
                        setQuizResult({ passed: pct >= threshold });
                        return null;
                      }
                      const apiResult = await submitQuizToApi({
                        contextType: 'prereq',
                        contextId: prereq.id,
                        topicId: learntTopic.id,
                        answers,
                      });
                      if (apiResult?.evaluationIncomplete) {
                        setQuizResult(null);
                        return apiResult.grading;
                      }
                      if (apiResult) {
                        setQuizResult({ passed: apiResult.passed });
                      } else {
                        const pct = total > 0 ? (score / total) * 100 : 100;
                        setQuizResult({ passed: pct >= threshold });
                      }
                      void refetchTopicStatus();
                      return apiResult?.grading ?? null;
                    }}
                  />
                </div>
                {(prereq.questions?.length ?? 0) > 0 && quizResult && (
                  <div className="mt-4 px-4 sm:px-0">
                    {quizResult.passed ? (
                      <button
                        type="button"
                        onClick={advancePrereq}
                        className="w-full py-3 bg-purple-600 text-white font-extrabold rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                      >
                        Continue <ChevronRight className="w-5 h-5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAiTeach({
                          topicTitle: learntTopic.title,
                          kind: 'prerequisite',
                          topicId: learntTopic.id,
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
              </div>
            </div>
          </div>
        </div>
      );
    }

    const step = subSteps[subStepIdx];
    if (!step) {
      return (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div>
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No content available for this topic yet.</p>
            <button
              type="button"
              onClick={() => navigate('/courses')}
              className="mt-4 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold"
            >
              Back to Curriculum
            </button>
          </div>
        </div>
      );
    }

    if (step.kind === 'video') {
      return (
        <div className="flex-1 flex flex-col min-h-0 bg-slate-950 overflow-hidden">
          <div className="flex-1 flex flex-col items-center justify-center min-h-0 p-2 sm:p-4 md:p-6">
            <div className="w-full max-w-[1400px] mx-auto aspect-video min-h-[200px] max-h-[min(85dvh,920px)]">
              <iframe
                src={youtubeEmbed(step.sub.videoUrl ?? '')}
                className="w-full h-full rounded-lg sm:rounded-xl shadow-2xl ring-1 ring-white/10"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={step.sub.title}
              />
            </div>
          </div>
          <div className="shrink-0 bg-white border-t border-slate-200/90 shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
            <div className="max-w-[1400px] mx-auto px-3 sm:px-5 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex-1 min-w-0 flex items-start gap-3">
                <div className="mt-0.5 p-2 rounded-lg bg-[#0084B4]/10 text-[#0084B4] shrink-0">
                  <Video className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold text-[#0084B4] uppercase tracking-wider">Lesson video</p>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug line-clamp-2">
                    {step.sub.title}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] sm:text-xs text-slate-500">
                    <span className="font-semibold text-slate-600 truncate max-w-[200px] sm:max-w-none">{learntTopic.title}</span>
                    <span className="text-slate-300 hidden sm:inline">·</span>
                    <span className="font-bold text-slate-500">Step {currentStep} / {totalSteps}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-500">Quiz follows this video</span>
                  </div>
                  <div className="mt-2 h-1 max-w-xs rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#0084B4]/80 transition-[width] duration-300"
                      style={{ width: `${totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (step.kind === 'video' && step.sub.id) {
                    apiFetch('/api/student/video/watched', {
                      method: 'POST',
                      body: JSON.stringify({ subTopicId: step.sub.id, topicId: learntTopic.id }),
                    }).then(() => refetchTopicStatus()).catch(() => { });
                  }
                  advanceSubStep();
                }}
                className="shrink-0 w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3.5 sm:py-3 px-5 sm:px-6 bg-[#0084B4] hover:bg-[#006A91] text-white text-sm font-extrabold rounded-xl sm:rounded-2xl transition-all shadow-md active:scale-[0.99]"
              >
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                Watched — continue
              </button>
            </div>
          </div>
        </div>
      );
    }

    const quizTitle = step.kind === 'eval-quiz' ? step.label : `Quiz: ${step.sub.title}`;
    const offerAiHelp = step.kind === 'quiz';

    const subtopicAttemptHistory =
      step.kind === 'quiz'
        ? (() => {
            const block = (topicStatus?.subtopicQuizAttempts ?? []).find(
              (x: { subTopicId: string }) => x.subTopicId === step.sub.id
            );
            const attempts = block?.attempts ?? [];
            return attempts.map(mapApiQuizAttemptForHistory);
          })()
        : [];

    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 min-h-0">
        <div className="flex-1 flex flex-col w-full max-w-none mx-auto h-full min-h-0">
          <div key={subStepIdx} className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            <InlineQuiz
              title={quizTitle}
              questions={step.questions}
              attemptHistory={step.kind === 'quiz' ? subtopicAttemptHistory : undefined}
              passingThresholdPercent={
                step.kind === 'quiz' ? ((step.sub as { passingThreshold?: number }).passingThreshold ?? 60) : 60
              }
              startLayout={step.kind === 'quiz' ? 'split' : 'default'}
              aiCoachingSessions={step.kind === 'quiz' ? aiCoachingSummaries : []}
              onSubmit={async (score, total, answers) => {
                const localPct = total > 0 ? (score / total) * 100 : 100;
                const threshold = step.kind === 'quiz' ? (step.sub as { passingThreshold?: number }).passingThreshold ?? 60 : 60;
                if (answers && step.kind === 'quiz' && learntTopic.id && step.sub.id) {
                  const apiResult = await submitQuizToApi({
                    contextType: 'subtopic',
                    contextId: step.sub.id,
                    topicId: learntTopic.id,
                    subTopicId: step.sub.id,
                    answers,
                  });
                  if (apiResult?.evaluationIncomplete) {
                    setQuizResult(null);
                    return apiResult.grading;
                  }
                  const passed = apiResult ? apiResult.passed : (localPct >= threshold);
                  setQuizResult({ passed });
                  void refetchTopicStatus();
                  return apiResult?.grading ?? null;
                }
                setQuizResult({ passed: localPct >= threshold });
                return null;
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
                  type="button"
                  onClick={advanceSubStep}
                  className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-500 to-[#0084B4] text-white font-extrabold rounded-2xl hover:from-[#0084B4] hover:to-[#006A91] transition-all flex items-center justify-center gap-3 shadow-md"
                >
                  Continue Journey <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setAiTeach({
                    topicTitle: learntTopic.title,
                    subtopicTitle: step.kind === 'quiz' ? step.sub.title : undefined,
                    kind: 'subtopic',
                    topicId: learntTopic.id,
                    subTopicId: step.kind === 'quiz' ? step.sub.id : undefined,
                    contextId: step.kind === 'quiz' ? step.sub.id : undefined,
                    failedQuestions: lastFailedQuestions.current.length > 0
                      ? lastFailedQuestions.current : undefined,
                    retakeQuestions: lastFailedQuestions.current.length === 0
                      ? step.questions : undefined,
                    onPassed: advanceSubStep,
                    onBack: () => { },
                  })}
                  className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-500 to-indigo-700 text-white font-extrabold rounded-2xl transition-all flex items-center justify-center gap-3 shadow-md"
                >
                  <Sparkles className="w-5 h-5" /> Get AI Help & Retake
                </button>
              )}
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  const outlineInner = (
    <TopicLearningOutline
      topic={learntTopic}
      prereqs={prereqs}
      subSteps={subSteps}
      hasFinalTest={hasFinalTest}
      learningPhase={phase}
      currentStage={currentStage}
      onSelectStage={applyLearningStage}
    />
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans">
      <header className="sticky top-0 z-40 px-3 sm:px-4 py-3 bg-white/90 backdrop-blur-md border-b border-slate-200/60 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-4 w-full mx-auto px-1 sm:px-0">
          <button
            type="button"
            onClick={() => navigate('/courses')}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 shrink-0"
            aria-label="Back to roadmap"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 shrink-0"
            onClick={() => setOutlineDrawerOpen(true)}
            aria-label="Open topic outline"
          >
            <List className="w-5 h-5" />
          </button>
          <button
            type="button"
            className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200/80 shrink-0"
            onClick={() => setDesktopOutlineExpanded((v) => !v)}
            aria-expanded={desktopOutlineExpanded}
            aria-label={desktopOutlineExpanded ? 'Hide topic path sidebar' : 'Show topic path sidebar'}
          >
            {desktopOutlineExpanded ? (
              <ChevronsLeft className="w-4 h-4" />
            ) : (
              <ChevronsRight className="w-4 h-4" />
            )}
            <span className="text-[10px] font-extrabold uppercase tracking-wide">Path</span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold text-[#0084B4] uppercase tracking-wider mb-0.5">Learning</p>
            <p className="text-sm font-extrabold text-slate-900 truncate">{learntTopic.title}</p>
          </div>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            title="See every quiz attempt, score, and the answers you submitted for this topic"
            aria-label="Open quiz history: scores and your answers for this topic"
            className="hidden sm:flex flex-col items-stretch gap-0.5 shrink-0 pl-2.5 pr-3 py-2 rounded-xl border border-sky-200/90 bg-gradient-to-b from-sky-50/90 to-sky-50/50 hover:from-sky-100 hover:to-sky-50 shadow-sm text-left transition-colors"
          >
            <span className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-[#0084B4] shrink-0" aria-hidden />
              <span className="text-[11px] font-extrabold text-slate-900 leading-tight">Quiz history</span>
            </span>
            <span className="text-[9px] font-semibold text-slate-600 leading-snug pl-[1.5rem]">
              Scores &amp; your answers
            </span>
          </button>
          <div className="hidden sm:block w-48 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase">Progress</span>
              <span className="text-xs font-black text-slate-900">{currentStep}/{totalSteps} ({pct}%)</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-400 to-[#0084B4] rounded-full"
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 80, damping: 20 }}
              />
            </div>
          </div>
        </div>
        <div className="sm:hidden w-full mx-auto mt-2 px-1 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            title="Quiz attempts, scores, and your answers"
            aria-label="Open quiz history: scores and your answers"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-sky-200 bg-sky-50/90 text-left shadow-sm"
          >
            <ClipboardList className="w-3.5 h-3.5 text-[#0084B4] shrink-0" aria-hidden />
            <span className="flex flex-col leading-tight">
              <span className="text-[10px] font-extrabold text-slate-900">Quiz history</span>
              <span className="text-[9px] font-semibold text-slate-600">Scores &amp; answers</span>
            </span>
          </button>
          <span className="text-[10px] font-black text-slate-600">{currentStep}/{totalSteps} ({pct}%)</span>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside
          className={`hidden md:flex flex-col shrink-0 bg-white overflow-hidden border-slate-200 transition-[width,border-color] duration-200 ease-out ${
            desktopOutlineExpanded ? 'w-80 lg:w-96 border-r' : 'w-0 border-r-0'
          }`}
        >
          <div
            className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden transition-opacity duration-200 ${
              desktopOutlineExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {outlineInner}
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-slate-50">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${phase}-${prereqIdx}-${subStepIdx}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-h-0"
            >
              {renderMainPane()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {outlineDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close outline"
            onClick={() => setOutlineDrawerOpen(false)}
          />
          <div className="relative w-[min(100vw-2.5rem,20rem)] max-w-full h-full bg-white shadow-2xl overflow-y-auto flex flex-col border-r border-slate-200">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-3 py-2 flex items-center justify-between z-10">
              <span className="text-sm font-extrabold text-slate-800">Topic outline</span>
              <button
                type="button"
                className="p-2 rounded-lg hover:bg-slate-100"
                onClick={() => setOutlineDrawerOpen(false)}
                aria-label="Close"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            {outlineInner}
          </div>
        </div>
      )}

      {historyOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6 bg-black/50"
          onClick={() => setHistoryOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white w-full sm:rounded-2xl sm:max-w-3xl sm:max-h-[90vh] max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 bg-white">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold text-[#0084B4] uppercase tracking-wider">Quiz history</p>
                <p className="text-sm font-extrabold text-slate-900 truncate">{learntTopic.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <TopicOverviewHistory
                topic={learntTopic}
                topicStatus={topicStatus}
                prereqs={prereqs}
                prereqCleared={topicPrereqCleared}
                hasFinalTest={hasFinalTest}
              />
            </div>
          </div>
        </div>
      )}

      {aiTeach && (
        <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col">
          <header className="shrink-0 px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/courses')}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <p className="text-sm font-extrabold text-slate-900 truncate">AI teaching</p>
          </header>
          <div className="flex-1 overflow-y-auto min-h-0 w-full p-0">
            <div className="w-full max-w-none">
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
                onRetakeRecorded={() => {
                  void refetchAiSessions();
                  void refetchTopicStatus();
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
