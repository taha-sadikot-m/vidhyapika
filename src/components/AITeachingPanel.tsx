import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Brain, AlertTriangle, Lightbulb, CheckCircle2,
  RotateCcw, ChevronRight, Send, Loader2,
  BookOpen, ClipboardList, Dumbbell, MessageCircle,
  Crosshair, GraduationCap, ListChecks, ChevronLeft,
  Zap, Trophy,
} from 'lucide-react';
import { InlineQuiz, type QuizSubmitGradingResult } from './InlineQuiz';
import { AIBadge } from './ui/AIBadge';
import { MathRenderer, LatexBlock } from './MathRenderer';
import { MarkdownLesson } from './MarkdownLesson';
import { apiFetch } from '../hooks/useApi';
import type { Question } from '../types';

export type LessonCard = {
  title: string;
  content: string;
  latex?: string;
};

type MistakeInsight = {
  questionId: string;
  mistakeTitle: string;
  whatWentWrong: string;
  likelyMisconception: string;
  fix: string;
  example: string;
};

type MiniDrill = {
  prompt: string;
  hint: string;
  checkYourself: string;
  solution: string;
};

interface AITeachingPanelProps {
  topicId?: string;
  topicTitle: string;
  subTopicId?: string;
  subtopicTitle?: string;
  kind: 'prereq' | 'subtopic' | 'finaltest' | 'prerequisite' | 'final-test';
  contextId?: string;
  failedQuestions?: { questionId: string; text: string; type?: string; studentAnswer?: string; correctAnswer?: string; aiReasoning?: string }[];
  /** Legacy prop: pre-fetched retake questions (bypasses AI generation) */
  retakeQuestions?: Question[];
  passingThreshold?: number;
  onPassed: () => void;
  onBack?: () => void;
  /** After an AI retake is saved to the server, refresh topic / session data. */
  onRetakeRecorded?: () => void;
}

type PanelState = 'loading' | 'teaching' | 'chat' | 'quiz' | 'passed' | 'error';
type TeachTab = 'mistakes' | 'learn' | 'practice';

export function AITeachingPanel({
  topicId = '',
  topicTitle,
  subTopicId,
  subtopicTitle,
  kind,
  contextId = '',
  failedQuestions = [],
  retakeQuestions: legacyRetakeQuestions,
  passingThreshold = 60,
  onPassed,
  onBack,
  onRetakeRecorded,
}: AITeachingPanelProps) {
  // Normalize kind to new format
  const normalizedKind = (kind === 'prerequisite' ? 'prereq' : kind === 'final-test' ? 'finaltest' : kind) as 'prereq' | 'subtopic' | 'finaltest';
  const [panelState, setPanelState] = useState<PanelState>('loading');
  const [teachTab, setTeachTab] = useState<TeachTab>('mistakes');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lessonCards, setLessonCards] = useState<LessonCard[]>([]);
  const [mistakes, setMistakes] = useState<MistakeInsight[]>([]);
  const [drills, setDrills] = useState<MiniDrill[]>([]);
  const [retakeQuestions, setRetakeQuestions] = useState<Question[]>([]);
  const [chatMessages, setChatMessages] = useState<{ role: 'tutor' | 'student'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [generatingTest, setGeneratingTest] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const lastRetakeSubmitRef = useRef<{
    passed: boolean;
    flagged?: boolean;
    failedQuestions?: AITeachingPanelProps['failedQuestions'];
  } | null>(null);

  /** Failures driving the latest AI analysis & retake generation (updates after each coach session + after AI retake submit). */
  const [analysisFailures, setAnalysisFailures] = useState<NonNullable<AITeachingPanelProps['failedQuestions']>>(() => [
    ...failedQuestions,
  ]);
  useEffect(() => {
    setAnalysisFailures([...failedQuestions]);
  }, [failedQuestions]);

  const failureSource = useMemo(
    () => (analysisFailures.length > 0 ? analysisFailures : failedQuestions),
    [analysisFailures, failedQuestions],
  );

  const [mistakeIndex, setMistakeIndex] = useState(0);
  const [lessonIndex, setLessonIndex] = useState(0);
  const [drillIndex, setDrillIndex] = useState(0);
  const [openHint, setOpenHint] = useState<Record<number, boolean>>({});
  const [openVerify, setOpenVerify] = useState<Record<number, boolean>>({});
  const [openSolution, setOpenSolution] = useState<Record<number, boolean>>({});

  const mistakeList = useMemo(
    () =>
      mistakes.length > 0
        ? mistakes
        : failureSource.map((q, idx) => ({
            questionId: q.questionId ?? `q${idx + 1}`,
            mistakeTitle: 'Needs review',
            whatWentWrong: q.aiReasoning || 'This answer did not match the expected result.',
            likelyMisconception: 'A rule/step may have been applied incorrectly.',
            fix: 'Revisit the concept and solve step-by-step, checking each step.',
            example: 'Example: If $2(x+3)=14$, then $x=4$.',
          })),
    [mistakes, failureSource],
  );

  useEffect(() => {
    setMistakeIndex((i) => Math.max(0, Math.min(i, Math.max(0, mistakeList.length - 1))));
  }, [mistakeList.length]);

  useEffect(() => {
    setLessonIndex((i) => Math.max(0, Math.min(i, Math.max(0, lessonCards.length - 1))));
  }, [lessonCards.length]);

  useEffect(() => {
    setDrillIndex((i) => Math.max(0, Math.min(i, Math.max(0, drills.length - 1))));
  }, [drills.length]);

  useEffect(() => {
    if (teachTab === 'mistakes' && mistakeList.length === 0) {
      if (lessonCards.length > 0) setTeachTab('learn');
      else if (drills.length > 0) setTeachTab('practice');
    }
  }, [teachTab, mistakeList.length, lessonCards.length, drills.length]);

  const subjectLine = normalizedKind === 'prereq'
    ? `Let's strengthen the prerequisite: "${topicTitle}"`
    : normalizedKind === 'subtopic'
    ? `Let's revisit: "${subtopicTitle ?? topicTitle}"`
    : `Let's review the topic: "${topicTitle}"`;

  // If legacy retake questions are provided, use them directly
  useEffect(() => {
    if (legacyRetakeQuestions && legacyRetakeQuestions.length > 0) {
      setRetakeQuestions(legacyRetakeQuestions);
      setLessonCards([{
        title: 'Review Key Concepts',
        content: `Let's review the concepts in "${topicTitle}" that need more practice.`,
      }]);
      setChatMessages([{
        role: 'tutor',
        content: `Hello! I've prepared some lessons to help you. Go through them and feel free to ask questions!`,
      }]);
      setMistakes([]);
      setDrills([]);
      setTeachTab(failureSource.length > 0 ? 'mistakes' : 'learn');
      setPanelState('teaching');
    } else {
      startTeachingSession();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const startTeachingSession = async (failureOverride?: AITeachingPanelProps['failedQuestions']) => {
    setPanelState('loading');
    const fq = failureOverride !== undefined ? failureOverride : analysisFailures;
    const res = await apiFetch<{ sessionId: string; lessonCards: LessonCard[]; mistakes?: MistakeInsight[]; drills?: MiniDrill[] }>('/api/ai/teach', {
      method: 'POST',
      body: JSON.stringify({
        topicId,
        subTopicId,
        contextType: normalizedKind,
        failedQuestions: fq,
        ...(contextId ? { contextId } : {}),
      }),
    });

    if (res.error || !res.data) {
      setErrorMsg(res.error ?? 'Failed to start AI session');
      setPanelState('error');
      return;
    }

    setAnalysisFailures([...fq]);
    setSessionId(res.data.sessionId);
    setLessonCards(res.data.lessonCards);
    setMistakes(res.data.mistakes ?? []);
    setDrills(res.data.drills ?? []);
    setTeachTab((res.data.mistakes?.length ?? 0) > 0 ? 'mistakes' : (res.data.drills?.length ?? 0) > 0 ? 'practice' : 'learn');
    setChatMessages([{
      role: 'tutor',
      content: `Hello! I've prepared some lessons to help you understand the concepts you missed. Go through the lesson cards and feel free to ask me any questions!`,
    }]);
    setPanelState('teaching');
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !sessionId || chatLoading) return;
    const message = chatInput.trim();
    setChatInput('');
    setChatLoading(true);
    setChatMessages((prev) => [...prev, { role: 'student', content: message }]);

    const res = await apiFetch<{ response: string }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ sessionId, message }),
    });

    setChatLoading(false);
    if (res.data?.response) {
      setChatMessages((prev) => [...prev, { role: 'tutor', content: res.data!.response }]);
    }
  };

  const generateRetakeTest = async () => {
    setGeneratingTest(true);
    const res = await apiFetch<{ questions: Question[] }>('/api/ai/generate-test', {
      method: 'POST',
      body: JSON.stringify({
        topicId,
        subTopicId,
        contextType: normalizedKind,
        contextId,
        failedQuestions: analysisFailures,
        count: 5,
      }),
    });

    setGeneratingTest(false);

    if (res.error) {
      setErrorMsg(res.error);
      return;
    }

    if (res.data?.questions && res.data.questions.length > 0) {
      // Convert to frontend Question format
      const questions: Question[] = res.data.questions.map((q: any) => ({
        id: q.id,
        text: q.text,
        type: q.type === 'true_false' ? 'boolean' : q.type === 'image_upload' ? 'image_upload' : q.type === 'text' ? 'text' : 'mcq',
        options: q.options,
        correctAnswer: q.correctAnswer ?? '',
        explanation: '',
        difficulty: 'Medium' as const,
        imageUrl: q.imageUrl ?? undefined,
      }));
      setRetakeQuestions(questions);
      setPanelState('quiz');
    } else {
      setErrorMsg('Could not generate retake questions. Please try again.');
    }
  };

  const handleQuizComplete = async (
    clientScore: number,
    clientTotal: number,
    answers?: Record<string, string>,
  ): Promise<QuizSubmitGradingResult | null | void> => {
    if (!topicId || !contextId || !answers || Object.keys(answers).length === 0) {
      const pct = clientTotal > 0 ? (clientScore / clientTotal) * 100 : 0;
      lastRetakeSubmitRef.current = { passed: pct >= passingThreshold };
      return null;
    }

    const payload = {
      contextType: normalizedKind,
      contextId,
      topicId,
      answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
      ...(normalizedKind === 'subtopic'
        ? { subTopicId: subTopicId ?? contextId }
        : {}),
    };

    const res = await apiFetch<{
      success?: boolean;
      evaluationIncomplete?: boolean;
      score: number;
      total: number;
      passed: boolean;
      flagged?: boolean;
      failedQuestions?: AITeachingPanelProps['failedQuestions'];
      scoredAnswers?: Array<{
        questionId: string;
        correct: boolean;
        aiReasoning?: string;
        evaluationFailed?: boolean;
      }>;
    }>('/api/student/quiz/submit', { method: 'POST', body: JSON.stringify(payload) });

    if (res.error) {
      setErrorMsg(res.error);
      return null;
    }

    const data = res.data;
    if (!data) return null;

    const buildPerQuestion = () => {
      const perQuestion: QuizSubmitGradingResult['perQuestion'] = {};
      for (const row of data.scoredAnswers ?? []) {
        perQuestion[row.questionId] = {
          correct: row.correct,
          aiReasoning: row.aiReasoning,
          evaluationFailed: row.evaluationFailed,
        };
      }
      return perQuestion;
    };

    if (data.evaluationIncomplete) {
      return {
        score: data.score,
        total: data.total,
        perQuestion: buildPerQuestion(),
        evaluationIncomplete: true,
      };
    }

    lastRetakeSubmitRef.current = {
      passed: data.passed,
      flagged: !!data.flagged,
      failedQuestions: data.failedQuestions,
    };
    onRetakeRecorded?.();

    return {
      score: data.score,
      total: data.total,
      perQuestion: buildPerQuestion(),
      evaluationIncomplete: false,
      serverPassed: data.passed,
      flagged: !!data.flagged,
    };
  };

  const handleQuizFullyReviewed = () => {
    const r = lastRetakeSubmitRef.current;
    if (r?.flagged) {
      setErrorMsg(
        'You have used all AI coaching and retest attempts for this quiz. An instructor has been notified.',
      );
      setPanelState('error');
      return;
    }
    if (r?.passed) {
      setPanelState('passed');
      return;
    }
    const nextFq = r?.failedQuestions;
    void startTeachingSession(nextFq !== undefined ? nextFq : undefined);
  };

  function CarouselNav({
    total,
    index,
    setIndex,
    theme = 'indigo' as 'amber' | 'indigo' | 'emerald',
  }: {
    total: number;
    index: number;
    setIndex: React.Dispatch<React.SetStateAction<number>>;
    theme?: 'amber' | 'indigo' | 'emerald';
  }) {
    if (total <= 1) return null;
    const chip =
      theme === 'amber'
        ? 'from-amber-100 to-orange-100 border-amber-200/80 text-amber-950'
        : theme === 'emerald'
          ? 'from-emerald-100 to-teal-100 border-emerald-200/80 text-emerald-950'
          : 'from-indigo-100 to-violet-100 border-indigo-200/80 text-indigo-950';
    const dotOn = theme === 'amber' ? 'bg-amber-500' : theme === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-600';
    return (
      <div className="w-full max-w-full px-0 py-0 pb-4 mb-6 border-b border-slate-200">
        <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span
            className={`inline-flex w-fit items-center gap-2 rounded-full border bg-gradient-to-r px-3 py-1.5 text-[11px] font-black uppercase tracking-wide ${chip}`}
          >
            <Zap className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            Checkpoint {index + 1} / {total}
          </span>
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
            <button
              type="button"
              disabled={index <= 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 shadow-sm transition-colors hover:bg-indigo-50/80 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <button
              type="button"
              disabled={index >= total - 1}
              onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 shadow-sm transition-colors hover:bg-indigo-50/80 disabled:pointer-events-none disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-4 flex w-full justify-center gap-2 px-0" role="tablist" aria-label="Progress">
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Go to item ${i + 1} of ${total}`}
              onClick={() => setIndex(i)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                i === index ? `min-w-[2rem] ${dotOn} shadow-sm` : 'w-2.5 bg-slate-200 hover:bg-slate-300'
              }`}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="w-full max-w-none min-w-0"
    >
      {/* Full-width hero — no outer card chrome */}
      <header className="w-full border-b border-indigo-500/25 bg-gradient-to-r from-indigo-600 to-purple-600 px-4 pb-5 sm:px-6 md:px-8 pt-4">
        <div className="w-full max-w-none">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">Your AI Tutor</h2>
              <AIBadge label="AI Teaching Session" size="sm" className="bg-white/20 text-white mt-0.5" />
            </div>
          </div>
          <p className="text-indigo-100 text-sm font-medium leading-relaxed">{subjectLine}</p>
        </div>
      </header>

      <AnimatePresence mode="wait">

        {/* Loading */}
        {panelState === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="w-full max-w-none px-4 sm:px-6 md:px-8 pt-6 pb-10 flex flex-col items-start justify-start gap-4">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin shrink-0" />
            <p className="text-sm text-slate-600 font-medium text-left max-w-2xl">Your AI tutor is analyzing your mistakes…</p>
          </motion.div>
        )}

        {/* Error */}
        {panelState === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="w-full max-w-none py-10 px-4 sm:px-6 md:px-8 flex flex-col items-start justify-start gap-4 text-left">
            <AlertTriangle className="w-10 h-10 text-red-400 shrink-0" />
            <p className="text-sm text-slate-600">{errorMsg}</p>
            <button type="button" onClick={() => void startTeachingSession()} className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl">
              Try Again
            </button>
          </motion.div>
        )}

        {/* Teaching */}
        {panelState === 'teaching' && (
          <motion.div
            key="teaching"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-none min-w-0 min-h-[40vh] py-4 sm:py-8 px-4 sm:px-6 lg:px-10"
          >
            <div className="w-full max-w-none space-y-8">

              {/* Session metrics — compact strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-white shadow-sm border border-amber-200 text-amber-700 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-black tabular-nums text-slate-900">{failureSource.length}</p>
                    <p className="text-[10px] font-extrabold text-amber-800/70 uppercase tracking-widest">Missed</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50/40 p-4 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-white shadow-sm border border-indigo-200 text-indigo-700 flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-black tabular-nums text-slate-900">{lessonCards.length}</p>
                    <p className="text-[10px] font-extrabold text-indigo-800/70 uppercase tracking-widest">Lesson cards</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50/40 p-4 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-white shadow-sm border border-emerald-200 text-emerald-700 flex items-center justify-center">
                    <Dumbbell className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-black tabular-nums text-slate-900">{drills.length}</p>
                    <p className="text-[10px] font-extrabold text-emerald-800/70 uppercase tracking-widest">Mini drills</p>
                  </div>
                </div>
              </div>

              {/* Learning journey — segmented stepper */}
              <nav className="rounded-3xl border border-slate-200/80 bg-slate-50/80 p-2 sm:p-3" aria-label="Coach sections">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3">
                  {([
                    { id: 'mistakes' as const, step: 1, title: 'Diagnose', sub: 'Errors & feedback', Icon: Crosshair, badge: mistakes.length || failureSource.length },
                    { id: 'learn' as const, step: 2, title: 'Learn', sub: 'Guided explanations', Icon: GraduationCap, badge: lessonCards.length },
                    { id: 'practice' as const, step: 3, title: 'Practice', sub: 'Short reps', Icon: ListChecks, badge: drills.length },
                  ]).map(({ id, step, title, sub, Icon, badge }) => {
                    const active = teachTab === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setTeachTab(id)}
                        className={`group relative flex w-full text-left gap-3 sm:gap-4 rounded-2xl border px-4 py-3.5 transition-all ${
                          active
                            ? 'border-indigo-300 bg-white shadow-md shadow-indigo-500/10 ring-2 ring-indigo-500/20'
                            : 'border-transparent bg-white/60 hover:bg-white hover:border-slate-200'
                        }`}
                      >
                        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-black ${
                          active ? 'border-indigo-200 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-600'
                        }`}>
                          {step}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
                            <span className={`text-sm font-black tracking-tight ${active ? 'text-slate-900' : 'text-slate-700'}`}>{title}</span>
                            <span className={`text-[10px] font-black tabular-nums rounded-full px-2 py-0.5 ${
                              active ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {badge}
                            </span>
                          </div>
                          <p className={`mt-0.5 text-xs font-medium leading-snug ${active ? 'text-slate-600' : 'text-slate-500'}`}>{sub}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </nav>

              {/* Primary actions — top placement */}
              <div className="flex w-full max-w-full flex-col gap-3 px-0 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setPanelState('chat')}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-indigo-300 bg-white py-3.5 text-sm font-extrabold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-50"
                >
                  <MessageCircle className="h-4 w-4" />
                  Ask AI Tutor
                </button>
                <button
                  type="button"
                  onClick={generateRetakeTest}
                  disabled={generatingTest}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-extrabold text-white shadow-md transition-all hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60"
                >
                  {generatingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  {generatingTest ? 'Generating…' : "I'm Ready — Take the New Test"}
                  {!generatingTest && <ChevronRight className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/90 px-4 py-3">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                <p className="text-xs font-medium leading-relaxed text-blue-900">
                  <span className="font-bold">Pro tip:</span> Stuck between steps? Jump into chat or use checkpoints below —
                  small wins beat cramming.
                </p>
              </div>

              {/* Tab content — one focused item per section */}
              {teachTab === 'mistakes' && (
                <div className="space-y-6">
                  <div className="border-b border-slate-200 pb-5">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-amber-800/90">Step 1 — Diagnose</p>
                    <h3 className="mt-1 flex items-center gap-2 text-xl font-black tracking-tight text-slate-900">
                      <Trophy className="h-6 w-6 text-amber-500" aria-hidden />
                      Turn mistakes into XP
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      Tough topics stick when you see exactly what went wrong. Use <span className="font-bold text-slate-800">Back / Next</span> or the dots — each checkpoint is one clear boss fight, not a wall of text.
                    </p>
                  </div>

                  {mistakeList.length === 0 ? (
                    <p className="text-sm text-slate-600">Nothing to diagnose here.</p>
                  ) : (
                    <>
                      <CarouselNav
                        total={mistakeList.length}
                        index={mistakeIndex}
                        setIndex={setMistakeIndex}
                        theme="amber"
                      />
                      {(() => {
                        const m = mistakeList[mistakeIndex];
                        const fq = failureSource.find((x) => x.questionId === m.questionId);
                        return (
                          <article className="space-y-8 rounded-2xl border border-amber-100/80 bg-gradient-to-b from-amber-50/40 via-white to-white p-5 shadow-sm ring-1 ring-amber-100/50 sm:p-7">
                            <header className="space-y-3">
                              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Issue {mistakeIndex + 1}</p>
                              <h4 className="text-lg font-black text-slate-900 leading-snug">{m.mistakeTitle}</h4>
                              {fq?.text && (
                                <div className="rounded-xl bg-slate-100/80 px-4 py-3 text-sm font-semibold text-slate-800 overflow-x-auto">
                                  <MathRenderer text={fq.text} />
                                </div>
                              )}
                            </header>

                            {fq && (
                              <section className="space-y-3">
                                <h5 className="text-xs font-black uppercase tracking-widest text-slate-500">Your attempt vs expected</h5>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="rounded-xl bg-red-50/80 px-4 py-3 border-l-4 border-red-400">
                                    <p className="text-[10px] font-extrabold text-red-700 uppercase tracking-widest mb-2">Your answer</p>
                                    {fq.type === 'image_upload' && fq.studentAnswer?.startsWith('data:image') ? (
                                      <img src={fq.studentAnswer} alt="Student upload" className="max-h-44 rounded-lg border border-red-200 bg-white" />
                                    ) : (
                                      <p className="text-sm font-bold text-red-900 break-words">{fq.studentAnswer || '—'}</p>
                                    )}
                                    {fq.aiReasoning && (
                                      <p className="mt-2 text-xs text-red-800/90 leading-relaxed pt-2 border-t border-red-100">{fq.aiReasoning}</p>
                                    )}
                                  </div>
                                  <div className="rounded-xl bg-emerald-50/80 px-4 py-3 border-l-4 border-emerald-400">
                                    <p className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-widest mb-2">Expected</p>
                                    <p className="text-sm font-bold text-emerald-950 break-words">{fq.correctAnswer || '—'}</p>
                                  </div>
                                </div>
                              </section>
                            )}

                            <section className="space-y-6 divide-y divide-slate-200">
                              <div className="pt-2 space-y-2">
                                <h5 className="text-xs font-black uppercase tracking-widest text-slate-500">1 · What signaled the error</h5>
                                <MathRenderer text={m.whatWentWrong} className="text-sm text-slate-800 leading-relaxed" block />
                              </div>
                              <div className="pt-6 space-y-2">
                                <h5 className="text-xs font-black uppercase tracking-widest text-slate-500">2 · Likely misconception</h5>
                                <MathRenderer text={m.likelyMisconception} className="text-sm text-slate-800 leading-relaxed" block />
                              </div>
                              <div className="pt-6 space-y-2">
                                <h5 className="text-xs font-black uppercase tracking-widest text-indigo-700">3 · Corrective move</h5>
                                <MathRenderer text={m.fix} className="text-sm text-indigo-950/95 leading-relaxed" block />
                              </div>
                              <div className="pt-6 space-y-2">
                                <h5 className="text-xs font-black uppercase tracking-widest text-slate-500">4 · Worked pattern</h5>
                                <MathRenderer text={m.example} className="text-sm text-slate-800 leading-relaxed" block />
                              </div>
                            </section>
                          </article>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}

              {teachTab === 'learn' && (
                <div className="space-y-6">
                  <div className="border-b border-slate-200 pb-5">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-indigo-800/90">Step 2 — Learn</p>
                    <h3 className="mt-1 flex items-center gap-2 text-xl font-black tracking-tight text-slate-900">
                      <Sparkles className="h-6 w-6 text-indigo-500" aria-hidden />
                      Level up — bite-sized lessons
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      Each card unlocks the next idea. The progress bar is your quest map — finish the deck and you&apos;re
                      ready for drills.
                    </p>
                    {lessonCards.length > 0 && (
                      <div className="mt-4 h-2.5 w-full max-w-md overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                          style={{
                            width: `${Math.round(((lessonIndex + 1) / lessonCards.length) * 100)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {lessonCards.length > 0 ? (
                    <>
                      <CarouselNav
                        total={lessonCards.length}
                        index={lessonIndex}
                        setIndex={setLessonIndex}
                        theme="indigo"
                      />
                      {(() => {
                        const card = lessonCards[lessonIndex];
                        const i = lessonIndex;
                        const pct = Math.round(((i + 1) / lessonCards.length) * 100);
                        return (
                          <motion.article
                            key={i}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="relative overflow-hidden rounded-3xl border-2 border-indigo-200/60 bg-gradient-to-br from-white via-indigo-50/30 to-violet-50/40 p-6 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-100 sm:p-8"
                          >
                            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-indigo-400/10 blur-2xl" aria-hidden />
                            <div className="relative flex flex-col gap-6">
                              <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md">
                                    <Brain className="h-6 w-6" />
                                  </div>
                                  <div className="min-w-0 space-y-1">
                                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-700">
                                      Lesson unlock · {i + 1}/{lessonCards.length}
                                    </p>
                                    <h4 className="text-xl font-black leading-snug text-slate-900">{card.title}</h4>
                                  </div>
                                </div>
                                <span className="rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wide text-indigo-800 shadow-sm">
                                  {pct}% deck
                                </span>
                              </div>
                              <div className="rounded-2xl border border-white/80 bg-white/70 p-4 shadow-inner backdrop-blur-sm sm:p-5">
                                <MarkdownLesson content={card.content} className="text-sm" />
                              </div>
                              {card.latex && (
                                <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/50 bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-950 px-5 py-4 text-white shadow-xl ring-1 ring-amber-400/30">
                                  <div className="mb-3 flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-amber-300" aria-hidden />
                                    <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-amber-200">
                                      Power-up · Key formula
                                    </p>
                                  </div>
                                  <div className="overflow-x-auto text-base leading-relaxed [&_.katex]:text-white [&_.katex-display]:my-2">
                                    <LatexBlock latex={card.latex.trim()} />
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.article>
                        );
                      })()}
                    </>
                  ) : (
                    <p className="text-sm text-slate-600">No lesson cards yet. Try again, or ask in chat.</p>
                  )}
                </div>
              )}

              {teachTab === 'practice' && (
                <div className="space-y-6">
                  <div className="border-b border-slate-200 pb-5">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-800/90">Step 3 — Practice</p>
                    <h3 className="mt-1 flex items-center gap-2 text-xl font-black tracking-tight text-slate-900">
                      <ListChecks className="h-6 w-6 text-emerald-500" aria-hidden />
                      Training rounds — micro-drills
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      Treat each drill like a mini-game: try solo first, then tap <span className="font-semibold">Hint</span>,{' '}
                      <span className="font-semibold">Quick check</span>, and <span className="font-semibold">Full solution</span> only when you’re ready — no spoilers.
                    </p>
                  </div>

                  {drills.length > 0 ? (
                    <>
                      <CarouselNav
                        total={drills.length}
                        index={drillIndex}
                        setIndex={setDrillIndex}
                        theme="emerald"
                      />
                      {(() => {
                        const d = drills[drillIndex];
                        const idx = drillIndex;
                        return (
                          <div className="space-y-6 rounded-2xl border border-emerald-100/90 bg-gradient-to-b from-emerald-50/50 to-white p-5 shadow-sm ring-1 ring-emerald-100/60 sm:p-7">
                            <section className="space-y-3">
                              <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-800">
                                Round {idx + 1} · Training mode
                              </p>
                              <div className="text-lg font-bold leading-relaxed text-slate-900">
                                <MathRenderer text={d.prompt} block />
                              </div>
                            </section>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                              <button
                                type="button"
                                onClick={() => setOpenHint((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-extrabold transition-colors ${
                                  openHint[idx]
                                    ? 'border-blue-300 bg-blue-50 text-blue-900'
                                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <Lightbulb className="h-4 w-4 shrink-0" />
                                {openHint[idx] ? 'Hide hint' : 'Hint'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setOpenVerify((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-extrabold transition-colors ${
                                  openVerify[idx]
                                    ? 'border-violet-300 bg-violet-50 text-violet-900'
                                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <ListChecks className="h-4 w-4 shrink-0" />
                                {openVerify[idx] ? 'Hide quick check' : 'Quick check'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setOpenSolution((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-extrabold transition-colors ${
                                  openSolution[idx]
                                    ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                                    : 'border-emerald-200 bg-emerald-50/70 text-emerald-900 hover:bg-emerald-50'
                                }`}
                              >
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                {openSolution[idx] ? 'Hide solution' : 'Full solution'}
                              </button>
                            </div>

                            {openHint[idx] && (
                              <section className="rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-3">
                                <p className="text-[10px] font-extrabold text-blue-800 uppercase tracking-widest mb-2">Scaffold</p>
                                <MathRenderer text={d.hint} className="text-sm text-blue-950/90 leading-relaxed" block />
                              </section>
                            )}

                            {!openVerify[idx] ? (
                              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-4 text-sm text-slate-600">
                                <span className="font-bold text-slate-800">Quick check is hidden.</span>{' '}
                                Try the problem first, then tap <span className="font-bold">Quick check</span> to see the tutor’s short verification — before opening the full solution.
                              </div>
                            ) : (
                              <section className="rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-3">
                                <p className="text-[10px] font-extrabold text-violet-800 uppercase tracking-widest mb-2">Quick check</p>
                                <MathRenderer text={d.checkYourself} className="text-sm font-semibold text-slate-900 leading-relaxed" block />
                              </section>
                            )}

                            {openSolution[idx] && (
                              <section className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3">
                                <p className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-widest mb-2">Reference solution</p>
                                <MathRenderer text={d.solution} className="text-sm text-emerald-950/95 leading-relaxed" block />
                              </section>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <p className="text-sm text-slate-600">No drills yet. Reload the session or ask in chat.</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Chat */}
          {panelState === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-white border border-indigo-100 rounded-b-3xl shadow-sm">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AIBadge size="sm" />
                  <span className="text-sm font-bold text-slate-700">Chat with AI Tutor</span>
                </div>
                <button onClick={() => setPanelState('teaching')} className="text-xs font-bold text-slate-500 hover:text-slate-700">
                  ← Back to Coach
                </button>
              </div>

              {/* Chat messages */}
              <div className="h-72 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === 'tutor'
                        ? 'bg-indigo-50 text-slate-800 rounded-tl-none'
                        : 'bg-blue-600 text-white rounded-tr-none'
                    }`}>
                      <MathRenderer text={msg.content} />
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-indigo-50 rounded-2xl rounded-tl-none px-4 py-2.5">
                      <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat input */}
              <div className="p-4 border-t border-slate-100 flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendChat();
                    }
                  }}
                  placeholder="Ask anything about this topic…"
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <button onClick={handleSendChat} disabled={chatLoading || !chatInput.trim()}
                  className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-60 transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>

              <div className="px-4 pb-4">
                <button onClick={generateRetakeTest} disabled={generatingTest}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-extrabold rounded-2xl transition-colors disabled:opacity-60">
                  {generatingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  {generatingTest ? 'Generating…' : 'Take Retake Test'}
                </button>
              </div>
            </motion.div>
          )}

          {/* Quiz */}
          {panelState === 'quiz' && (
            <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-white border border-indigo-100 p-5 rounded-b-3xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AIBadge size="md" />
                  <span className="text-sm font-bold text-slate-700">Personalized Retake Quiz</span>
                </div>
                <button onClick={() => setPanelState('teaching')} className="text-xs text-slate-500 hover:text-slate-700 underline">
                  Back to coach
                </button>
              </div>
              {retakeQuestions.length > 0 ? (
                <div className="min-h-[min(75vh,56rem)] flex flex-col">
                  <InlineQuiz
                    title="AI Personalized Retake"
                    questions={retakeQuestions}
                    passingThresholdPercent={passingThreshold}
                    onSubmit={handleQuizComplete}
                    onQuizFullyReviewed={handleQuizFullyReviewed}
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-slate-400">No questions available. Please go back and try again.</div>
              )}
            </motion.div>
          )}

          {/* Passed */}
          {panelState === 'passed' && (
            <motion.div key="passed"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-white border border-emerald-100 p-8 rounded-b-3xl shadow-sm flex flex-col items-center gap-4 text-center">
              <motion.div
                initial={{ scale: 0.5 }} animate={{ scale: [0.5, 1.2, 1] }}
                transition={{ type: 'tween', duration: 0.4 }}
                className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center"
              >
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </motion.div>
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-1">Great job! You passed!</h3>
                <p className="text-sm text-slate-500 max-w-xs">
                  The AI helped you understand the key concepts. You're ready to continue.
                </p>
              </div>
              <button onClick={onPassed}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl transition-colors">
                Continue Learning <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
    </motion.div>
  );
}
