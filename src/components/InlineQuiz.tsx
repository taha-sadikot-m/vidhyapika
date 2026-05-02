import React, { useState, useEffect, useRef } from 'react';
import { Question } from '../types';
import { 
  CheckCircle2, XCircle, AlertCircle, HelpCircle, 
  TrendingUp, Upload, Image as ImageIcon,
  ArrowRight, ArrowLeft, PlayCircle, LayoutGrid, Trash2, Check, Loader2,
  History, RotateCcw, ChevronRight, Sparkles,
} from 'lucide-react';
import { MathRenderer } from './MathRenderer';
import { motion, AnimatePresence } from 'framer-motion';
import { compressImagesToBase64 } from '../utils/imageCompress';
import { parseAnswerImageUrls } from '../utils/quizAnswerDisplay';
import { AiSessionRecallExplorer } from './AiSessionRecallExplorer';
import type { AiCoachingSessionSummary } from '../types/aiCoachingSession';

export { parseAnswerImageUrls };
export type { AiCoachingSessionSummary };

export interface QuizAttemptDetailAnswer {
  questionId: string;
  answer: string;
  correct: boolean;
  aiReasoning?: string;
}

export interface QuizAttemptRecord {
  score: number;
  total: number;
  date: string;
  /** When provided (e.g. from API), used for pass badge; otherwise derived from score % and threshold. */
  passed?: boolean;
  /** Saved AI-generated retake quiz attempt. */
  aiGenerated?: boolean;
  answers?: QuizAttemptDetailAnswer[];
}

/** Returned from `onSubmit` when the server grades the attempt (AI for text / image_upload). */
export type QuizSubmitGradingResult = {
  score: number;
  total: number;
  perQuestion: Record<
    string,
    { correct: boolean; aiReasoning?: string; evaluationFailed?: boolean }
  >;
  /** True when the AI could not finish grading; attempt was not saved server-side. */
  evaluationIncomplete?: boolean;
  /** When set (e.g. from `/api/student/quiz/submit`), overrides client % vs threshold for pass UI. */
  serverPassed?: boolean;
  /** Server escalated the learner after max AI retake failures. */
  flagged?: boolean;
};

function buildClientReviewGrading(questions: Question[], answers: Record<string, string>): QuizSubmitGradingResult {
  const perQuestion: QuizSubmitGradingResult['perQuestion'] = {};
  let score = 0;
  for (const q of questions) {
    const ok = (answers[q.id] ?? '') === (q.correctAnswer ?? '');
    if (ok) score++;
    perQuestion[q.id] = { correct: ok };
  }
  return { score, total: questions.length, perQuestion };
}

interface InlineQuizProps {
  title: string;
  questions: Question[];
  onSubmit: (
    score: number,
    total: number,
    answers?: Record<string, string>
  ) => void | Promise<void | QuizSubmitGradingResult | null>;
  initialAnswers?: Record<string, string>;
  isReviewMode?: boolean;
  attemptHistory?: QuizAttemptRecord[];
  /** Used to label past attempts as pass / not passed on the start screen (default 60). */
  passingThresholdPercent?: number;
  /**
   * When the quiz has no questions in the catalog, show the same full-page flow as a normal quiz
   * (not a separate “I understand” button). Typically wired to advance the learning path.
   */
  onEmptyQuizContinue?: () => void;
  /** Label for the primary button when `onEmptyQuizContinue` is used. */
  emptyQuizContinueLabel?: string;
  /** `split`: top “Start new quiz” bar, two columns — attempts | AI coaching summaries */
  startLayout?: 'default' | 'split';
  /** Shown in split layout, right column (e.g. from GET /api/student/ai-sessions) */
  aiCoachingSessions?: AiCoachingSessionSummary[];
  /**
   * Called after the learner finishes reading the post-submit review (Continue).
   * Use with embedded retake flows (e.g. AI coaching) so the parent can change mode without unmounting review early.
   */
  onQuizFullyReviewed?: () => void;
}

function formatAttemptDateLabel(dateStr: string): string {
  if (!dateStr) return '—';
  const t = Date.parse(dateStr);
  if (!Number.isNaN(t)) return new Date(t).toLocaleString();
  return dateStr;
}

function formatStoredAnswerForDisplay(
  answer: string,
  questionType?: string,
  options?: { maxTextLength?: number }
): string {
  if (!answer?.trim()) return '—';
  const t = questionType === 'image_upload';
  const looksJsonImages = answer.trim().startsWith('[') && (answer.includes('data:image') || answer.includes('"data:image'));
  if (t || looksJsonImages) return 'Image / file response (submitted)';
  const maxTextLength = options?.maxTextLength ?? 280;
  if (answer.length > maxTextLength) return `${answer.slice(0, maxTextLength)}…`;
  return answer;
}

function AttemptBreakdownBlocks({
  questions,
  selectedAtt,
  maxTextLength = 50_000,
}: {
  questions: Question[];
  selectedAtt: QuizAttemptRecord;
  maxTextLength?: number;
}) {
  return (
    <div className="space-y-6 md:space-y-8">
      {!selectedAtt.answers?.length ? (
        <p className="text-base text-slate-600 leading-relaxed max-w-3xl">
          Per-question answers are not stored for this attempt. You still have the overall score and date in your
          history.
        </p>
      ) : null}
      {questions.map((q, qIdx) => {
        const row = selectedAtt.answers?.find((a) => a.questionId === q.id);
        const hasRow = Boolean(row);
        const correct = row?.correct ?? false;
        return (
          <article
            key={q.id}
            className={`rounded-2xl border shadow-sm overflow-hidden ${
              !hasRow
                ? 'border-slate-200 bg-slate-50/40'
                : correct
                  ? 'border-emerald-200/90 bg-emerald-50/20'
                  : 'border-red-200/90 bg-red-50/15'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/80 bg-white/60 px-5 py-3 md:px-8 md:py-4">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">
                Question {qIdx + 1} of {questions.length}
              </span>
              {hasRow ? (
                <span
                  className={`text-xs font-extrabold uppercase px-3 py-1 rounded-full shrink-0 ${
                    correct ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {correct ? 'Correct' : 'Incorrect'}
                </span>
              ) : (
                <span className="text-xs font-extrabold uppercase px-3 py-1 rounded-full bg-slate-200 text-slate-700">
                  No record
                </span>
              )}
            </div>
            <div className="px-5 py-5 md:px-8 md:py-8 lg:px-10 lg:py-10">
              <div className="text-base md:text-lg font-bold text-slate-900 leading-relaxed max-w-none overflow-x-auto">
                <MathRenderer text={q.text} block />
              </div>
              {q.imageUrl && (
                <img
                  src={q.imageUrl}
                  alt="Question context"
                  className="mt-5 max-h-64 md:max-h-80 w-auto rounded-xl border border-slate-200"
                />
              )}
              <div className="mt-6 md:mt-8 grid gap-6 md:grid-cols-2 md:gap-8">
                <div className="min-w-0 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 md:p-5">
                  <p className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-2">Your answer</p>
                  {hasRow && (q.type === 'image_upload' || parseAnswerImageUrls(row!.answer).length > 0) ? (
                    (() => {
                      const urls = parseAnswerImageUrls(row!.answer);
                      return urls.length > 0 ? (
                        <div className="flex flex-wrap gap-3">
                          {urls.map((url, i) => (
                            <a
                              key={i}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl border border-slate-200 overflow-hidden bg-white shrink-0"
                            >
                              <img
                                src={url}
                                alt={`Your submission ${i + 1}`}
                                className="max-h-64 max-w-[min(100%,280px)] object-contain block"
                              />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm font-medium text-slate-500 italic">No image data in this attempt.</p>
                      );
                    })()
                  ) : (
                    <p className="text-sm md:text-base font-semibold text-slate-800 whitespace-pre-wrap break-words">
                      {hasRow ? formatStoredAnswerForDisplay(row!.answer, q.type, { maxTextLength }) : '—'}
                    </p>
                  )}
                </div>
                {hasRow && !correct && (
                  <div className="min-w-0 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 md:p-5">
                    <p className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-2">Expected</p>
                    <div className="text-sm md:text-base font-semibold text-emerald-900">
                      <MathRenderer text={q.correctAnswer || '—'} block />
                    </div>
                  </div>
                )}
              </div>
              {hasRow && row!.aiReasoning?.trim() && (
                <div className="mt-6 md:mt-8 pt-6 border-t border-slate-200">
                  <p className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-2">Feedback</p>
                  <p className="text-sm md:text-base text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {row!.aiReasoning}
                  </p>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function InlineQuiz({
  title,
  questions,
  onSubmit,
  initialAnswers,
  isReviewMode,
  attemptHistory,
  passingThresholdPercent = 60,
  onEmptyQuizContinue,
  emptyQuizContinueLabel = 'Continue',
  startLayout = 'default',
  aiCoachingSessions = [],
  onQuizFullyReviewed,
}: InlineQuizProps) {
  const [phase, setPhase] = useState<'start' | 'quiz' | 'review'>(isReviewMode ? 'review' : 'start');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers || {});
  const [uiError, setUiError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  /** Index into `attemptHistory` (same order as API: newest first). */
  const [selectedPastAttemptIndex, setSelectedPastAttemptIndex] = useState<number | null>(null);
  /** Server / AI grading for review screen; null until submit or review-only mode (client fallback). */
  const [reviewGrading, setReviewGrading] = useState<QuizSubmitGradingResult | null>(null);
  /** Split start screen: which tab is visible */
  const [splitStartTab, setSplitStartTab] = useState<'history' | 'coaching'>('history');

  // Reset state when questions change
  useEffect(() => {
    setPhase(isReviewMode ? 'review' : 'start');
    setCurrentQuestionIndex(0);
    setAnswers(initialAnswers || {});
    setUiError(null);
    setSelectedPastAttemptIndex(null);
    setReviewGrading(null);
  }, [questions, initialAnswers, isReviewMode]);

  useEffect(() => {
    setSelectedPastAttemptIndex(null);
  }, [attemptHistory]);

  useEffect(() => {
    setSplitStartTab('history');
  }, [questions]);

  if (!questions || questions.length === 0) {
    if (onEmptyQuizContinue) {
      return (
        <div className="flex-1 flex flex-col min-h-0 h-full w-full bg-white overflow-hidden">
          <div className="flex-1 flex flex-col md:flex-row bg-slate-50 w-full h-full min-h-[420px]">
            <div className="flex-1 flex flex-col justify-center p-8 md:p-16 lg:p-24">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#0084B4]/10 rounded-3xl flex items-center justify-center mb-8 shadow-sm border border-[#0084B4]/20">
                <HelpCircle className="w-8 h-8 sm:w-10 sm:h-10 text-[#0084B4]" />
              </div>
              <p className="text-sm font-black text-[#0084B4] uppercase tracking-widest mb-4">Prerequisite</p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 mb-4 leading-tight">{title}</h1>
              <p className="text-base sm:text-lg text-slate-500 font-medium leading-relaxed mb-8 max-w-2xl">
                There are no quiz questions attached to this check yet. You can continue to the next part of the
                topic when you&apos;re ready.
              </p>
              <button
                type="button"
                onClick={onEmptyQuizContinue}
                className="w-full sm:w-max px-10 py-4 flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white text-lg font-black rounded-2xl transition-all shadow-lg"
              >
                {emptyQuizContinueLabel} <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <div className="w-full md:w-[40%] flex flex-col justify-center p-8 md:p-12 border-t md:border-t-0 md:border-l border-slate-200 bg-white">
              <p className="text-xs font-extrabold text-slate-500 uppercase tracking-widest mb-4">Summary</p>
              <p className="text-sm text-slate-600 leading-relaxed">
                This screen uses the same layout as the quiz room. Once your teacher adds questions, your attempts and
                history will appear here.
              </p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-white">
        <div className="text-center text-slate-500 max-w-sm">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-lg font-bold text-slate-700">No questions available.</p>
          <p className="text-sm mt-1">This quiz is empty.</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = questions.reduce((a, q) => a + (answers[q.id] ? 1 : 0), 0);
  const pctDone = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  const handleOptionSelect = (option: string) => {
    if (phase === 'review') return;
    setUiError(null);
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: option }));
  };

  const [uploadingImage, setUploadingImage] = useState(false);

  // Client-side compression — no server upload, works on all hosting environments
  const handleImageUpload = async (files: File[]) => {
    if (phase === 'review') return;
    setUiError(null);
    setUploadingImage(true);
    try {
      const base64Urls = await compressImagesToBase64(files);
      setAnswers(prev => {
        const existing: string[] = (() => { try { return JSON.parse(prev[currentQuestion.id] || '[]'); } catch { return prev[currentQuestion.id] ? [prev[currentQuestion.id]] : []; } })();
        return { ...prev, [currentQuestion.id]: JSON.stringify([...existing, ...base64Urls]) };
      });
    } catch (err: any) {
      setUiError(err.message ?? 'Image processing failed');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeUploadedImage = (questionId: string, idx: number) => {
    setAnswers(prev => {
      const existing: string[] = (() => { try { return JSON.parse(prev[questionId] || '[]'); } catch { return []; } })();
      const next = existing.filter((_, i) => i !== idx);
      return { ...prev, [questionId]: next.length ? JSON.stringify(next) : '' };
    });
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correctAnswer) score++;
    });
    return score;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setUiError(null);
    try {
      const raw = await onSubmit(calculateScore(), questions.length, answers);
      if (
        raw &&
        typeof raw === 'object' &&
        'evaluationIncomplete' in raw &&
        raw.evaluationIncomplete &&
        typeof (raw as QuizSubmitGradingResult).score === 'number' &&
        (raw as QuizSubmitGradingResult).perQuestion
      ) {
        const g = raw as QuizSubmitGradingResult;
        setReviewGrading({
          score: g.score,
          total: g.total,
          perQuestion: g.perQuestion,
          evaluationIncomplete: true,
        });
        setPhase('review');
        return;
      }
      if (
        raw &&
        typeof raw === 'object' &&
        raw.perQuestion &&
        Object.keys(raw.perQuestion).length > 0 &&
        typeof raw.score === 'number' &&
        typeof raw.total === 'number'
      ) {
        const ext = raw as QuizSubmitGradingResult;
        setReviewGrading({
          score: raw.score,
          total: raw.total,
          perQuestion: raw.perQuestion,
          evaluationIncomplete: false,
          ...(typeof ext.serverPassed === 'boolean' ? { serverPassed: ext.serverPassed } : {}),
          ...(ext.flagged ? { flagged: true } : {}),
        });
      } else {
        setReviewGrading(buildClientReviewGrading(questions, answers));
      }
      setPhase('review');
    } catch (e: any) {
      setUiError(e?.message ?? 'Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── 1. Start Screen ──
  if (phase === 'start') {
    const pastAttempts = attemptHistory ?? [];
    const hasPast = pastAttempts.length > 0;
    const selectedAtt =
      selectedPastAttemptIndex !== null ? pastAttempts[selectedPastAttemptIndex] ?? null : null;
    const selectedAttemptNum =
      selectedPastAttemptIndex !== null ? pastAttempts.length - selectedPastAttemptIndex : null;

    if (hasPast && selectedAtt != null && selectedAttemptNum != null) {
      const pct = selectedAtt.total > 0 ? Math.round((selectedAtt.score / selectedAtt.total) * 100) : 0;
      const passed =
        typeof selectedAtt.passed === 'boolean'
          ? selectedAtt.passed
          : pct >= passingThresholdPercent;
      return (
        <div className="flex-1 flex flex-col min-h-0 h-full w-full bg-white overflow-hidden">
          <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-3 md:px-6 md:py-4 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedPastAttemptIndex(null)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-extrabold text-slate-800 shadow-sm hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084B4]"
            >
              <ArrowLeft className="w-5 h-5 shrink-0" aria-hidden />
              All attempts
            </button>
            <div className="hidden sm:block h-8 w-px bg-slate-200 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
                Attempt {selectedAttemptNum} · Full review
              </p>
              <p className="text-sm md:text-base font-black text-slate-900">{title}</p>
              <p className="text-xs text-slate-600 mt-1">
                {formatAttemptDateLabel(selectedAtt.date)} · {selectedAtt.score}/{selectedAtt.total} correct ({pct}
                %){' '}
                <span className={passed ? 'text-emerald-700 font-bold' : 'text-amber-800 font-bold'}>
                  · {passed ? 'Passed' : 'Not passed'}
                </span>
              </p>
            </div>
          </header>
          <div className="flex-1 min-h-0 overflow-y-auto w-full overscroll-y-contain">
            <div className="w-full max-w-[1600px] mx-auto px-4 md:px-8 lg:px-10 py-6 md:py-10 pb-24">
              <AttemptBreakdownBlocks questions={questions} selectedAtt={selectedAtt} />
            </div>
          </div>
        </div>
      );
    }

    if (startLayout === 'split') {
      const goQuiz = () => setPhase('quiz');
      const attemptList = (
        <ul
          className="w-full max-w-full rounded-none sm:rounded-xl border-y sm:border border-slate-200 sm:border-x bg-white divide-y divide-slate-200 overflow-hidden shadow-sm"
          role="list"
        >
          {pastAttempts.map((att, i) => {
            const pct = att.total > 0 ? Math.round((att.score / att.total) * 100) : 0;
            const passed =
              typeof att.passed === 'boolean' ? att.passed : pct >= passingThresholdPercent;
            const attemptNum = pastAttempts.length - i;
            return (
              <li key={`${att.date}-${att.score}-${att.total}-${i}`}>
                <button
                  type="button"
                  onClick={() => setSelectedPastAttemptIndex(i)}
                  className="w-full flex flex-wrap items-center justify-between gap-3 sm:gap-4 px-4 py-3.5 sm:px-5 sm:py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0084B4]"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
                    <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider shrink-0">
                      Attempt {attemptNum}
                    </span>
                    <span className="text-lg sm:text-xl font-black text-slate-900 tabular-nums shrink-0">
                      {att.score}/{att.total}
                      <span className="text-sm font-extrabold text-slate-500 ml-1.5">({pct}%)</span>
                    </span>
                    <span className="text-xs font-semibold text-slate-500 min-w-0 truncate max-w-[220px] sm:max-w-md">
                      {formatAttemptDateLabel(att.date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        passed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {passed ? 'Passed' : 'Not passed'}
                    </span>
                    {att.aiGenerated ? (
                      <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                        AI
                      </span>
                    ) : null}
                    <ChevronRight className="w-5 h-5 text-slate-400" aria-hidden />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      );

      return (
        <div className="flex-1 flex flex-col min-h-0 h-full w-full max-w-full bg-white overflow-hidden">
          <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-4 md:px-6 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Quiz</p>
              <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight truncate">{title}</h2>
            </div>
            <button
              type="button"
              onClick={goQuiz}
              className="shrink-0 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-extrabold shadow-md transition-colors"
            >
              {hasPast ? (
                <>
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  Start new quiz
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 shrink-0" />
                  Start quiz
                </>
              )}
            </button>
          </header>

          <nav
            className="shrink-0 flex w-full max-w-full border-b border-slate-200 bg-white"
            aria-label="Quiz history and coaching"
          >
            <button
              type="button"
              role="tab"
              aria-selected={splitStartTab === 'history'}
              onClick={() => setSplitStartTab('history')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-2 text-sm font-extrabold transition-colors border-b-2 -mb-px min-w-0 ${
                splitStartTab === 'history'
                  ? 'border-[#0084B4] text-[#0084B4] bg-slate-50/80'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
              }`}
            >
              <History className="w-4 h-4 shrink-0" aria-hidden />
              <span className="truncate">Past attempts</span>
              {hasPast ? (
                <span className="tabular-nums rounded-full bg-[#0084B4]/15 text-[#0084B4] px-2 py-0.5 text-[10px] font-black shrink-0">
                  {pastAttempts.length}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={splitStartTab === 'coaching'}
              onClick={() => setSplitStartTab('coaching')}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-2 text-sm font-extrabold transition-colors border-b-2 -mb-px min-w-0 ${
                splitStartTab === 'coaching'
                  ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden />
              <span className="truncate">AI coaching</span>
              {aiCoachingSessions.length > 0 ? (
                <span className="tabular-nums rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 text-[10px] font-black shrink-0">
                  {aiCoachingSessions.length}
                </span>
              ) : null}
            </button>
          </nav>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain w-full max-w-full px-0 py-0">
            <div className="w-full max-w-full px-0">
              {splitStartTab === 'history' && (
                <div className="w-full space-y-3 pt-3 pb-2">
                  <p className="text-xs text-slate-600 leading-relaxed px-4 sm:px-5">
                    Tap a row for a full-page review of every question and your answers.
                  </p>
                  {hasPast ? (
                    attemptList
                  ) : (
                    <p className="text-sm text-slate-500 mx-4 sm:mx-5 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center leading-relaxed">
                      No attempts yet. Finish a quiz once and your history will show up here.
                    </p>
                  )}
                </div>
              )}

              {splitStartTab === 'coaching' && (
                <div className="w-full max-w-full flex flex-col items-center justify-center gap-4 pt-3 pb-6 px-4 sm:px-5">
                  <p className="text-xs text-slate-600 leading-relaxed text-center max-w-2xl">
                    Each saved tutor run opens in its own explorer: use the map, then switch lanes (Diagnose → Learn →
                    Practice → Chat) so nothing is one endless scroll.
                  </p>
                  {aiCoachingSessions.length > 0 ? (
                    <ul className="w-full max-w-full flex flex-col items-center justify-center gap-4">
                      {aiCoachingSessions.map((s) => (
                        <li key={s.id} className="w-full max-w-5xl mx-auto">
                          <details className="group rounded-2xl border border-indigo-200/90 bg-white shadow-md overflow-hidden open:shadow-lg transition-shadow">
                            <summary className="cursor-pointer list-none px-4 py-4 sm:px-5 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3 text-center sm:text-left [&::-webkit-details-marker]:hidden border-b border-indigo-50 bg-gradient-to-r from-indigo-50/90 to-violet-50/40">
                              <span className="text-sm font-bold text-slate-900">{s.createdAtLabel}</span>
                              <span className="text-[10px] font-extrabold uppercase tracking-wide text-indigo-900 bg-white px-3 py-1.5 rounded-full border border-indigo-100 shadow-sm mx-auto sm:mx-0">
                                {s.mistakeCount} mistakes · {s.lessonCount} lessons · {s.drillCount} drills
                              </span>
                            </summary>
                            <div className="p-3 sm:p-4 bg-slate-50/50">
                              <AiSessionRecallExplorer session={s} />
                            </div>
                          </details>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500 w-full max-w-2xl rounded-xl border border-dashed border-indigo-100 bg-indigo-50/30 px-4 py-6 text-center leading-relaxed">
                      No AI coaching saved yet. After you open AI help from a failed attempt, session summaries appear
                      here.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="w-full max-w-full px-3 sm:px-4 pb-6 pt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-slate-100 mt-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-2xl font-black text-slate-900 tabular-nums">{questions.length}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Questions</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="text-2xl font-black text-slate-900 tabular-nums">Any</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Time limit</p>
              </div>
              {hasPast ? (
                <div className="rounded-xl border border-[#0084B4]/20 bg-[#0084B4]/5 px-3 py-3 col-span-2 sm:col-span-1">
                  <p className="text-[10px] font-extrabold text-[#0084B4] uppercase tracking-wider">Attempts on file</p>
                  <p className="text-2xl font-black text-slate-900 tabular-nums mt-0.5">{pastAttempts.length}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 bg-white relative overflow-y-auto h-full w-full min-h-0">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-slate-50 border-l border-slate-100 hidden md:block" />

        {hasPast && (
          <div className="relative z-20 w-full border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
            <div className="w-full max-w-[1600px] mx-auto px-6 md:px-10 lg:px-14 py-6 md:py-8">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-lg md:text-xl font-black text-slate-900 flex items-center gap-2.5">
                    <span className="p-2 rounded-xl bg-[#0084B4]/10 text-[#0084B4]">
                      <History className="w-5 h-5" />
                    </span>
                    Your quiz attempts
                  </h2>
                  <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
                    Tap a row to open a full-page review of every question and your answers — best for long stems and
                    large quizzes. Start a new attempt when you&apos;re ready; your history stays saved.
                  </p>
                </div>
              </div>
              <ul
                className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 overflow-hidden shadow-sm"
                role="list"
              >
                {pastAttempts.map((att, i) => {
                  const pct = att.total > 0 ? Math.round((att.score / att.total) * 100) : 0;
                  const passed =
                    typeof att.passed === 'boolean' ? att.passed : pct >= passingThresholdPercent;
                  const attemptNum = pastAttempts.length - i;
                  return (
                    <li key={`${att.date}-${att.score}-${att.total}-${i}`}>
                      <button
                        type="button"
                        onClick={() => setSelectedPastAttemptIndex(i)}
                        className="w-full flex flex-wrap items-center justify-between gap-3 sm:gap-4 px-4 py-3.5 sm:px-5 sm:py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0084B4]"
                      >
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
                          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider shrink-0">
                            Attempt {attemptNum}
                          </span>
                          <span className="text-lg sm:text-xl font-black text-slate-900 tabular-nums shrink-0">
                            {att.score}/{att.total}
                            <span className="text-sm font-extrabold text-slate-500 ml-1.5">({pct}%)</span>
                          </span>
                          <span className="text-xs font-semibold text-slate-500 min-w-0 truncate max-w-[220px] sm:max-w-md">
                            {formatAttemptDateLabel(att.date)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                              passed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {passed ? 'Passed' : 'Not passed'}
                          </span>
                          {att.aiGenerated ? (
                            <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                              AI
                            </span>
                          ) : null}
                          <ChevronRight className="w-5 h-5 text-slate-400" aria-hidden />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        <div className="relative z-10 w-full h-full min-h-[520px] flex flex-col md:flex-row items-center max-w-[1600px] mx-auto">
          {/* Left Hero */}
          <div className="flex-1 flex flex-col justify-center p-8 md:p-16 lg:p-24">
            <div className="w-16 h-16 sm:w-24 sm:h-24 bg-[#0084B4]/10 rounded-3xl flex items-center justify-center mb-8 shadow-sm border border-[#0084B4]/20">
              <HelpCircle className="w-8 h-8 sm:w-12 sm:h-12 text-[#0084B4]" />
            </div>

            <p className="text-sm font-black text-[#0084B4] uppercase tracking-widest mb-4">Quiz Room Environment</p>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-slate-900 mb-6 leading-tight">{title}</h1>
            <p className="text-lg sm:text-xl text-slate-500 font-medium leading-relaxed mb-6 max-w-2xl">
              {hasPast
                ? 'Ready for another try? You can answer all questions again. Your new attempt will be recorded along with the ones above.'
                : 'You are about to enter the quiz room. Make sure you are fully prepared. You can navigate between questions, upload images for written solutions, and submit at any time.'}
            </p>

            <button
              type="button"
              onClick={() => setPhase('quiz')}
              className="w-full sm:w-max px-12 py-5 flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white text-xl font-black rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              {hasPast ? (
                <>
                  <RotateCcw className="w-7 h-7 shrink-0" />
                  Start new attempt
                </>
              ) : (
                <>
                  Enter Quiz Room <ArrowRight className="w-7 h-7 shrink-0" />
                </>
              )}
            </button>
          </div>

          {/* Right Stats */}
          <div className="w-full md:w-[40%] lg:w-[35%] flex flex-col justify-center p-8 md:p-16">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-6">
              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex items-center gap-6">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                  <LayoutGrid className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-4xl font-black text-slate-900">{questions.length}</p>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Questions</p>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex items-center gap-6">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                  <PlayCircle className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-4xl font-black text-slate-900">Any</p>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Time Limit</p>
                </div>
              </div>

              {hasPast && (
                <div className="bg-[#0084B4]/5 rounded-3xl p-6 border border-[#0084B4]/20 sm:col-span-2 md:col-span-1">
                  <p className="text-xs font-extrabold text-[#0084B4] uppercase tracking-wider mb-1">Attempts on file</p>
                  <p className="text-3xl font-black text-slate-900">{pastAttempts.length}</p>
                  <p className="text-sm font-medium text-slate-600 mt-1">Shown above — add another anytime.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. Results / Review Screen ──
  if (phase === 'review') {
    const grading = reviewGrading ?? buildClientReviewGrading(questions, answers);
    const score = grading.score;
    const totalQ = grading.total > 0 ? grading.total : questions.length;
    const pct = totalQ > 0 ? Math.round((score / totalQ) * 100) : 0;
    const passed =
      typeof grading.serverPassed === 'boolean' ? grading.serverPassed : pct >= passingThresholdPercent;
    const usedAiGrading = Object.values(grading.perQuestion).some((v) => !!(v.aiReasoning?.trim()));
    const evalIncomplete = !!grading.evaluationIncomplete;

    const isQuestionCorrect = (q: Question) =>
      grading.perQuestion[q.id]?.evaluationFailed
        ? false
        : grading.perQuestion[q.id]?.correct ??
          (answers[q.id] ?? '') === (q.correctAnswer ?? '');

    return (
      <div className="flex-1 bg-white overflow-y-auto h-full p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-7xl mx-auto">
          {evalIncomplete && (
            <div className="mb-8 rounded-2xl border border-amber-300 bg-amber-50 p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <AlertCircle className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-black text-amber-900">AI could not finish grading</p>
                    <p className="text-sm text-amber-800/90 mt-1 leading-relaxed">
                      Your answers were not saved yet. Check your connection, then retry. Multiple-choice questions
                      above are still scored; open answers that failed show “Could not grade” below.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPhase('quiz');
                    setShowConfirm(false);
                    setCurrentQuestionIndex(0);
                  }}
                  className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-sm font-black transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Back to questions
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0084B4] hover:bg-[#006A91] text-white text-sm font-black transition-colors disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Retry evaluation
                </button>
              </div>
            </div>
          )}

          {/* Score dashboard */}
          <div className={`relative overflow-hidden flex flex-col sm:flex-row items-center sm:items-stretch gap-6 p-8 sm:p-12 rounded-3xl mb-12 border shadow-sm ${evalIncomplete ? 'bg-gradient-to-br from-amber-50 to-slate-50 border-amber-200' : passed ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200' : 'bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200'}`}>
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/40 blur-2xl rounded-full" />
            
            <div className={`w-24 h-24 rounded-3xl flex items-center justify-center shrink-0 shadow-inner bg-white/60 border ${evalIncomplete ? 'border-amber-300' : passed ? 'border-emerald-300' : 'border-amber-300'}`}>
              {evalIncomplete ? <AlertCircle className="w-12 h-12 text-amber-600" /> : passed ? <CheckCircle2 className="w-12 h-12 text-emerald-600" /> : <AlertCircle className="w-12 h-12 text-amber-600" />}
            </div>
            <div className="flex-1 text-center sm:text-left flex flex-col justify-center">
              <h2 className="text-3xl font-black text-slate-900 mb-2">
                {evalIncomplete ? 'Grading incomplete' : passed ? 'Great work!' : 'Quiz Done'}
              </h2>
              <p className={`text-base font-bold ${evalIncomplete ? 'text-amber-800' : passed ? 'text-emerald-700' : 'text-amber-700'}`}>
                {evalIncomplete
                  ? 'Open-ended questions need a successful AI check before your attempt is saved.'
                  : <>You got {score} out of {totalQ} correct.{!passed && ' Review the explanations below to improve.'}</>}
              </p>
              {usedAiGrading && (
                <p className="text-sm font-semibold text-slate-600 mt-2">
                  Short answers and image uploads were checked with AI (not only exact text match).
                </p>
              )}
            </div>
            <div className="flex items-center justify-center shrink-0">
              <div className={`flex items-center justify-center w-28 h-28 rounded-full border-8 ${evalIncomplete ? 'border-amber-400 text-amber-800' : passed ? 'border-emerald-400 text-emerald-700' : 'border-amber-400 text-amber-700'} bg-white/50`}>
                <span className="text-3xl font-black">{evalIncomplete ? '—' : `${pct}%`}</span>
              </div>
            </div>
          </div>

          {/* Review List */}
          <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-[#0084B4]" /> Question Review
          </h3>
          
          <div className="space-y-6">
            {questions.map((q, idx) => {
              const evalFailed = !!grading.perQuestion[q.id]?.evaluationFailed;
              const isCorrect = isQuestionCorrect(q);
              const aiNote = grading.perQuestion[q.id]?.aiReasoning?.trim();
              const imageUrls = q.type === 'image_upload' ? parseAnswerImageUrls(answers[q.id] ?? '') : [];
              return (
                <div key={q.id} className={`p-6 rounded-3xl border shadow-sm ${evalFailed ? 'bg-amber-50/80 border-amber-200' : isCorrect ? 'bg-white border-emerald-200' : 'bg-white border-red-200'}`}>
                  <div className="flex items-start gap-4 mb-6 pb-6 border-b border-slate-100">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${evalFailed ? 'bg-amber-100 text-amber-700' : isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {evalFailed ? <AlertCircle className="w-5 h-5" /> : isCorrect ? <Check className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-slate-400 uppercase tracking-widest mb-2">Question {idx + 1}</p>
                      <div className="text-lg font-bold text-slate-900 leading-relaxed overflow-x-auto">
                        <MathRenderer text={q.text} block />
                      </div>
                      {q.imageUrl && <img src={q.imageUrl} alt="Question context" className="mt-4 max-h-48 rounded-xl border border-slate-200" />}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 mb-6">
                    <div className={`p-4 rounded-2xl border ${isCorrect ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
                      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Your Answer</p>
                      {q.type === 'image_upload' ? (
                        imageUrls.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {imageUrls.map((url, i) => (
                              <img key={i} src={url} alt={`Your upload ${i + 1}`} className="max-h-40 rounded-lg border border-slate-200 object-contain" />
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-500 font-medium italic">No image uploaded</p>
                        )
                      ) : (
                        <p className={`font-bold whitespace-pre-wrap break-words ${isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>{answers[q.id] || 'Skipped'}</p>
                      )}
                    </div>
                    
                    {!isCorrect && (
                      <div className="p-4 rounded-2xl border bg-emerald-50/50 border-emerald-100">
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Expected</p>
                        {q.type === 'image_upload' ? (
                          <div className="text-sm font-bold text-emerald-800 space-y-2">
                            <p className="font-semibold text-slate-600">Reference / rubric:</p>
                            <MathRenderer text={q.correctAnswer || '—'} block />
                          </div>
                        ) : (
                          <div className="font-bold text-emerald-800">
                            <MathRenderer text={q.correctAnswer} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {(aiNote || evalFailed) && (
                    <div className={`p-5 rounded-2xl border flex items-start gap-3 mb-4 ${evalFailed ? 'bg-amber-50 border-amber-200' : 'bg-violet-50/80 border-violet-100'}`}>
                      {evalFailed ? <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" /> : <Sparkles className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />}
                      <div>
                        <p className={`text-[10px] font-extrabold uppercase tracking-widest mb-1 ${evalFailed ? 'text-amber-800' : 'text-violet-600'}`}>
                          {evalFailed ? 'Could not grade' : 'AI feedback'}
                        </p>
                        <p className="text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">{aiNote || 'Use “Retry evaluation” above to try again.'}</p>
                      </div>
                    </div>
                  )}

                  {q.explanation && (
                    <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-extrabold text-blue-500 uppercase tracking-widest mb-1">Explanation</p>
                        <p className="text-sm font-medium text-slate-700 leading-relaxed">{q.explanation}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {onQuizFullyReviewed && !evalIncomplete && (
            <div className="mt-10 flex flex-col items-center gap-3 border-t border-slate-200 pt-8">
              {grading.flagged && (
                <p className="text-sm font-semibold text-amber-900 text-center max-w-xl">
                  This quiz has been escalated for instructor support after repeated AI retake attempts.
                </p>
              )}
              <button
                type="button"
                onClick={() => onQuizFullyReviewed()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-8 py-4 text-sm font-black text-white shadow-md transition-colors hover:bg-indigo-700"
              >
                {passed ? 'Continue' : 'Back to AI Coach'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── 3. Quiz Room Layout (Two Columns) ──
  return (
    <div className="flex-1 flex flex-col md:flex-row bg-slate-50 w-full h-full overflow-hidden">
      
      {/* LEFT: Main Question Content */}
      <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden relative">
        <div className="w-full p-4 sm:p-6 md:p-10 lg:p-16">
          <div className="w-full max-w-6xl mx-auto">
            {uiError && (
              <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm font-bold text-red-800">{uiError}</p>
              </div>
            )}
            
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-8"
              >
                {/* Question Header */}
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-black tracking-wider">
                    Q{currentQuestionIndex + 1}
                  </div>
                  <div className={`px-2 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-widest border ${
                    currentQuestion.difficulty === 'Easy' ? 'bg-green-50 border-green-200 text-green-700' :
                    currentQuestion.difficulty === 'Medium' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                    'bg-red-50 border-red-200 text-red-700'
                  }`}>
                    {currentQuestion.difficulty}
                  </div>
                </div>

                {/* Question Text & Math */}
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="text-xl sm:text-2xl font-bold text-slate-900 leading-relaxed overflow-x-auto">
                    <MathRenderer text={currentQuestion.text} block />
                  </div>
                  {currentQuestion.imageUrl && (
                    <div className="mt-8">
                      <img src={currentQuestion.imageUrl} alt="Question context" className="rounded-2xl border border-slate-200 shadow-sm max-h-80 object-contain bg-slate-50 w-full" />
                    </div>
                  )}
                </div>

                {/* Answer Inputs */}
                <div>
                  <p className="text-sm font-extrabold text-slate-500 uppercase tracking-widest mb-4">Your Answer</p>
                  
                  {currentQuestion.type === 'image_upload' ? (
                    <div className="space-y-4">
                      {/* Drop / Click Zone */}
                      <label
                        className={`block relative overflow-hidden transition-all duration-300 rounded-3xl border-2 border-dashed bg-white cursor-pointer
                          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={async (e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                          if (files.length) { await handleImageUpload(files); }
                          else { setUiError('Please drop valid image files.'); }
                        }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            e.target.value = '';
                            if (files.length) await handleImageUpload(files);
                          }}
                        />
                        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                          {uploadingImage ? (
                            <>
                              <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" />
                              <p className="text-base font-bold text-slate-700">Uploading…</p>
                            </>
                          ) : (
                            <>
                              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                                <Upload className="w-8 h-8" />
                              </div>
                              <p className="text-lg font-bold text-slate-800">Click or drag & drop images</p>
                              <p className="text-sm font-medium text-slate-500 mt-1">You can upload multiple pages / photos</p>
                            </>
                          )}
                        </div>
                      </label>

                      {/* Uploaded Images Grid */}
                      {(() => {
                        const urls: string[] = (() => { try { return JSON.parse(answers[currentQuestion.id] || '[]'); } catch { return answers[currentQuestion.id] ? [answers[currentQuestion.id]] : []; } })();
                        if (!urls.length) return null;
                        return (
                          <div className="space-y-3">
                            <p className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">{urls.length} image{urls.length > 1 ? 's' : ''} uploaded</p>
                            <div className="grid grid-cols-2 gap-3">
                              {urls.map((url, idx) => (
                                <motion.div
                                  key={idx}
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group aspect-square"
                                >
                                  <img src={url} alt={`Page ${idx + 1}`} className="w-full h-full object-contain p-1" />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                    <span className="text-white text-xs font-bold">Page {idx + 1}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeUploadedImage(currentQuestion.id, idx)}
                                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 hover:bg-red-700 transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" /> Remove
                                    </button>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : currentQuestion.type === 'text' ? (
                    <textarea
                      rows={6}
                      placeholder="Type your answer here..."
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => handleOptionSelect(e.target.value)}
                      className="w-full p-4 border-2 border-slate-200 rounded-2xl resize-none focus:border-[#0084B4] focus:ring-4 focus:ring-[#0084B4]/10 transition-all outline-none font-medium text-slate-700 placeholder:text-slate-400"
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {(currentQuestion.options?.length ? currentQuestion.options : currentQuestion.type === 'boolean' ? ['True', 'False'] : []).map((option, idx) => {
                        const isSelected = answers[currentQuestion.id] === option;
                        return (
                          <button
                            key={idx}
                            onClick={() => handleOptionSelect(option)}
                            className={`relative text-left p-6 rounded-2xl border-2 transition-all duration-200 group overflow-hidden ${
                              isSelected
                                ? 'border-[#0084B4] bg-blue-50/50 shadow-md transform scale-[1.01]'
                                : 'border-slate-200 bg-white hover:border-[#0084B4]/50 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-4 relative z-10">
                              <span className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-xl border-2 text-sm font-black transition-colors ${
                                isSelected
                                  ? 'border-[#0084B4] bg-[#0084B4] text-white'
                                  : 'border-slate-300 text-slate-500 group-hover:border-[#0084B4]/50 group-hover:text-[#0084B4]'
                              }`}>
                                {String.fromCharCode(65 + idx)}
                              </span>
                              <div className={`text-lg font-semibold overflow-x-auto flex-1 ${isSelected ? 'text-[#0084B4]' : 'text-slate-700'}`}>
                                <MathRenderer text={option} />
                              </div>
                            </div>
                            {isSelected && (
                              <div className="absolute right-6 top-1/2 -translate-y-1/2">
                                <CheckCircle2 className="w-6 h-6 text-[#0084B4]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* RIGHT: Navigation Sidebar */}
      <div className="w-full md:w-[320px] lg:w-[360px] shrink-0 bg-white border-t md:border-t-0 md:border-l border-slate-200 flex flex-col shadow-sm z-10 md:h-full md:overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <p className="text-xs font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
            <LayoutGrid className="w-4 h-4" /> Quiz Navigation
          </p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-[#0084B4] transition-all duration-500" style={{ width: `${pctDone}%` }} />
            </div>
            <span className="text-xs font-black text-slate-700">{answeredCount}/{questions.length}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, idx) => {
              const isActive = idx === currentQuestionIndex;
              const isAnswered = !!answers[q.id];
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={`aspect-square rounded-xl flex items-center justify-center text-sm font-black transition-all border-2 ${
                    isActive
                      ? 'border-[#0084B4] bg-[#0084B4] text-white shadow-md transform scale-110'
                      : isAnswered
                        ? 'border-[#0084B4]/30 bg-blue-50 text-[#0084B4] hover:bg-blue-100'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 shrink-0 space-y-3">
          {/* Next button on all questions except the last */}
          {currentQuestionIndex < questions.length - 1 ? (
            <button
              onClick={() => setCurrentQuestionIndex(i => i + 1)}
              className="w-full py-4 bg-[#0084B4] hover:bg-[#006d96] text-white text-sm font-black rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              Next Question <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={submitting}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-70 text-white text-sm font-black rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Evaluating with AI…</>
              ) : (
                <>Submit Quiz <CheckCircle2 className="w-5 h-5" /></>
              )}
            </button>
          )}
          <p className="text-[11px] text-center font-medium text-slate-400">
            {answeredCount} of {questions.length} answered
          </p>
        </div>
      </div>

      {/* ── Confirmation Modal ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900">Submit Quiz?</h2>
                <p className="text-sm text-slate-500 font-medium">Please review your progress before submitting.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-green-700">{answeredCount}</p>
                <p className="text-xs font-bold text-green-600 uppercase tracking-wider mt-1">Answered</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
                <p className="text-3xl font-black text-red-700">{questions.length - answeredCount}</p>
                <p className="text-xs font-bold text-red-600 uppercase tracking-wider mt-1">Unanswered</p>
              </div>
            </div>

            {questions.length - answeredCount > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs font-semibold text-amber-800">
                  You have {questions.length - answeredCount} unanswered question{questions.length - answeredCount > 1 ? 's' : ''}. Unanswered questions will be marked incorrect.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-3 border-2 border-slate-200 text-slate-700 font-black rounded-2xl hover:bg-slate-50 transition-all text-sm"
              >
                Go Back
              </button>
              <button
                onClick={() => { setShowConfirm(false); handleSubmit(); }}
                disabled={submitting}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Yes, Submit
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
