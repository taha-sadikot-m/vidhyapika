import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Sparkles, CheckCircle2, XCircle, ChevronRight,
  RotateCcw, ClipboardCheck, Brain, AlertTriangle, Star,
  LayoutGrid, PlayCircle, HelpCircle, Upload, Loader2, Trash2, AlertCircle,
} from 'lucide-react';
import { AIBadge } from './ui/AIBadge';
import { AITeachingPanel } from './AITeachingPanel';
import { MathRenderer } from './MathRenderer';
import { apiFetch } from '../hooks/useApi';
import type { Question } from '../types';
import { compressImagesToBase64 } from '../utils/imageCompress';
import { parseAnswerImageUrls } from '../utils/quizAnswerDisplay';
import { gradingFromSubmitResponse } from '../utils/quizGrading';
import type { QuizSubmitGradingResult } from './InlineQuiz';

interface FinalTestScreenProps {
  topicTitle: string;
  topicId?: string;
  questions: Question[];
  videosWatched: number;
  /** Subtopic quizzes passed (modules with a quiz marked passed). */
  quizzesCompleted: number;
  /** Subtopics that include a quiz — used to label stats (e.g. 3 / 4). */
  subtopicQuizTotal?: number;
  onCompleted: () => void;
  onBack: () => void;
}

type TestState = 'intro' | 'testing' | 'results' | 'ai-teaching' | 'topic-complete';

export function FinalTestScreen({
  topicTitle,
  topicId,
  questions,
  videosWatched,
  quizzesCompleted,
  subtopicQuizTotal,
  onCompleted,
  onBack,
}: FinalTestScreenProps) {
  const [testState, setTestState]       = useState<TestState>('intro');
  const [currentQ, setCurrentQ]         = useState(0);
  const [answers, setAnswers]           = useState<Record<string, string>>({});
  const [score, setScore]               = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [evaluationIncomplete, setEvaluationIncomplete] = useState(false);
  const [reviewGrading, setReviewGrading] = useState<QuizSubmitGradingResult | null>(null);
  const [passingThreshold, setPassingThreshold] = useState(60);
  const apiFailedQuestions              = useRef<{ questionId: string; text: string; type?: string; studentAnswer?: string; correctAnswer?: string; aiReasoning?: string }[]>([]);

  const q = questions[currentQ];
  const isLast = currentQ === questions.length - 1;
  const answeredCount = questions.reduce((a, qst) => a + (answers[qst.id] ? 1 : 0), 0);
  const pctDone = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;
  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
  const passed = !evaluationIncomplete && pct >= passingThreshold;

  const wrongAnswers = questions
    .filter(q => answers[q.id] && answers[q.id] !== q.correctAnswer)
    .map(q => ({
      questionId: q.id,
      questionText: q.text,
      type: q.type,
      yourAnswer: answers[q.id] ?? '',
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
    }));

  async function submitTest() {
    setSubmitting(true);
    let localScore = 0;
    questions.forEach(q => { if (answers[q.id] === q.correctAnswer) localScore++; });
    if (topicId) {
      const answersArray = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
      try {
        const res = await apiFetch<any>('/api/student/quiz/submit', {
          method: 'POST',
          body: JSON.stringify({
            contextType: 'finaltest',
            contextId: topicId,
            topicId,
            answers: answersArray,
          }),
        });
        if (res.data?.passingThreshold != null) {
          setPassingThreshold(Number(res.data.passingThreshold) || 60);
        }
        if (res.data?.evaluationIncomplete) {
          const g = gradingFromSubmitResponse(res.data);
          setReviewGrading(g);
          setEvaluationIncomplete(true);
          if (typeof res.data.score === 'number') localScore = res.data.score;
          setScore(localScore);
          setSubmitting(false);
          setTestState('results');
          return;
        }
        setEvaluationIncomplete(false);
        setReviewGrading(gradingFromSubmitResponse(res.data));
        if (res.data?.failedQuestions) {
          apiFailedQuestions.current = res.data.failedQuestions;
        }
        if (typeof res.data?.score === 'number') {
          localScore = res.data.score;
        }
      } catch {}
    } else {
      setEvaluationIncomplete(false);
      setReviewGrading(null);
    }
    setScore(localScore);
    setSubmitting(false);
    setTestState('results');
  }

  function handleTopicComplete() {
    setShowConfetti(true);
    setTimeout(() => setTestState('topic-complete'), 300);
  }

  if (questions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-4 bg-white">
        <div className="w-24 h-24 rounded-3xl bg-slate-100 flex items-center justify-center">
          <ClipboardCheck className="w-12 h-12 text-slate-400" />
        </div>
        <p className="text-slate-500 font-medium">No final test questions have been set for this topic yet.</p>
        <button onClick={onBack} className="text-sm font-black text-[#0084B4] hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full h-full overflow-hidden bg-slate-50 relative">
      <AnimatePresence mode="wait">

        {/* ── 1. Intro Screen (Expansive Hero) ──────────────────────────────────────── */}
        {testState === 'intro' && (
          <motion.div key="intro"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="flex-1 bg-white relative overflow-y-auto h-full w-full"
          >
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-br from-indigo-50 to-slate-50 border-l border-slate-100 hidden md:block" />
            
            <div className="relative z-10 w-full h-full min-h-[600px] flex flex-col md:flex-row items-center max-w-[1600px] mx-auto">
              {/* Left Hero */}
              <div className="flex-1 flex flex-col justify-center p-8 md:p-16 lg:p-24">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-indigo-500/20">
                  <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                </div>
                
                <p className="text-sm font-black text-indigo-600 uppercase tracking-widest mb-4">All Subtopics Complete!</p>
                <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-slate-900 mb-6 leading-tight">Final Topic Test</h1>
                <p className="text-lg sm:text-xl text-slate-500 font-medium leading-relaxed mb-10 max-w-2xl">
                  You've reached the final hurdle for <span className="font-bold text-slate-800">"{topicTitle}"</span>. Prove your mastery across all concepts to complete this topic and unlock your badge.
                </p>
                
                <button
                  onClick={() => {
                    setCurrentQ(0);
                    setAnswers({});
                    setEvaluationIncomplete(false);
                    setReviewGrading(null);
                    setTestState('testing');
                  }}
                  className="w-full sm:w-max px-12 py-5 flex items-center justify-center gap-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xl font-black rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
                >
                  <ClipboardCheck className="w-6 h-6" /> Begin Final Test <ChevronRight className="w-6 h-6" />
                </button>
              </div>

              {/* Right Stats & Info */}
              <div className="w-full md:w-[45%] lg:w-[40%] flex flex-col justify-center p-8 md:p-16">
                <div className="bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-8 shadow-xl mb-6">
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Your Journey So Far</p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col items-center text-center">
                      <p className="text-4xl font-black text-slate-900 mb-1">{videosWatched}</p>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Videos Watched</p>
                      <p className="text-[11px] font-semibold text-slate-400 mt-2 leading-snug">
                        Lessons with a video you finished
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col items-center text-center">
                      <p className="text-4xl font-black text-slate-900 mb-1 tabular-nums">
                        {quizzesCompleted}
                        {subtopicQuizTotal != null && subtopicQuizTotal > 0 ? (
                          <span className="text-xl font-extrabold text-slate-400">/{subtopicQuizTotal}</span>
                        ) : null}
                      </p>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Quizzes Passed</p>
                      <p className="text-[11px] font-semibold text-slate-400 mt-2 leading-snug">
                        Subtopic quizzes cleared (required to reach this test)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-50/80 backdrop-blur-xl border border-indigo-100 rounded-3xl p-8 shadow-sm">
                  <div className="flex items-start gap-4">
                    <Brain className="w-8 h-8 text-indigo-600 shrink-0" />
                    <div>
                      <p className="text-lg font-black text-indigo-900 mb-2">About this test</p>
                      <ul className="text-sm font-medium text-indigo-700/80 space-y-2">
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-500" /> {questions.length} questions covering all subtopics</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-500" /> Score 60% or above to pass</li>
                        <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-500" /> AI will assist if you need a retake</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── 2. Testing Layout (Two Columns) ─────────────────────────────── */}
        {testState === 'testing' && (
          <motion.div key="testing"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col md:flex-row bg-slate-50 w-full h-full overflow-hidden"
          >
            {/* LEFT: Main Question Content */}
            <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden relative">
              <div className="w-full p-4 sm:p-6 md:p-10 lg:p-16">
                <div className="w-full max-w-6xl mx-auto">
                  <AnimatePresence mode="wait">
                    <motion.div key={currentQ}
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-8"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-xl text-sm font-black tracking-wider border border-indigo-200">
                            Q{currentQ + 1}
                          </div>
                          <div className={`px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-widest border ${
                            q.difficulty === 'Easy' ? 'bg-green-50 border-green-200 text-green-700' :
                            q.difficulty === 'Medium' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                            'bg-red-50 border-red-200 text-red-700'
                          }`}>
                            {q.difficulty}
                          </div>
                        </div>
                        <AIBadge label="Final Test" size="sm" className="bg-indigo-100 text-indigo-800 border-indigo-200" />
                      </div>

                      <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-sm">
                        <div className="text-2xl sm:text-3xl font-bold text-slate-900 leading-relaxed overflow-x-auto">
                          <MathRenderer text={q.text} block />
                        </div>
                        {q.imageUrl && (
                          <div className="mt-8">
                            <img src={q.imageUrl} alt="Question context" className="rounded-2xl border border-slate-200 shadow-sm max-h-96 object-contain bg-slate-50 w-full" />
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-extrabold text-slate-500 uppercase tracking-widest mb-4">Your Answer</p>
                        <div className="flex flex-col gap-4">
                          {q.type === 'image_upload' ? (
                            <div className="space-y-4">
                              {/* Drop / Click zone */}
                              <label
                                className="flex flex-col items-center justify-center w-full border-2 border-dashed border-indigo-300 rounded-3xl cursor-pointer bg-indigo-50 hover:bg-indigo-100 transition-colors relative overflow-hidden group"
                                onDragOver={(e) => { e.preventDefault(); }}
                                onDrop={async (e) => {
                                  e.preventDefault();
                                  const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                                  if (!files.length) return;
                                  setUploadingImage(true);
                                  try {
                                    const urls = await compressImagesToBase64(files);
                                    setAnswers(prev => {
                                      const existing: string[] = (() => { try { return JSON.parse(prev[q.id] || '[]'); } catch { return prev[q.id] ? [prev[q.id]] : []; } })();
                                      return { ...prev, [q.id]: JSON.stringify([...existing, ...urls]) };
                                    });
                                  } catch { } finally { setUploadingImage(false); }
                                }}
                              >
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  multiple
                                  onChange={async (e) => {
                                    const files = Array.from(e.target.files || []);
                                    e.target.value = '';
                                    if (!files.length) return;
                                    setUploadingImage(true);
                                    try {
                                      const urls = await compressImagesToBase64(files);
                                      setAnswers(prev => {
                                        const existing: string[] = (() => { try { return JSON.parse(prev[q.id] || '[]'); } catch { return prev[q.id] ? [prev[q.id]] : []; } })();
                                        return { ...prev, [q.id]: JSON.stringify([...existing, ...urls]) };
                                      });
                                    } catch { } finally { setUploadingImage(false); }
                                  }}
                                />
                                <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                                  {uploadingImage ? (
                                    <><Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" /><p className="text-sm font-bold text-indigo-700">Uploading…</p></>
                                  ) : (
                                    <><Upload className="w-10 h-10 mb-3 text-indigo-400 group-hover:text-indigo-600 transition-colors" /><p className="mb-1 text-sm font-semibold"><span className="font-bold text-indigo-600">Click to upload</span> or drag and drop</p><p className="text-xs text-slate-400">Multiple images supported (PNG, JPG, GIF)</p></>
                                  )}
                                </div>
                              </label>

                              {/* Image grid */}
                              {(() => {
                                const urls: string[] = (() => { try { return JSON.parse(answers[q.id] || '[]'); } catch { return answers[q.id] ? [answers[q.id]] : []; } })();
                                if (!urls.length) return null;
                                return (
                                  <div className="space-y-2">
                                    <p className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">{urls.length} image{urls.length > 1 ? 's' : ''} uploaded</p>
                                    <div className="grid grid-cols-2 gap-3">
                                      {urls.map((url, idx) => (
                                        <div key={idx} className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group aspect-square">
                                          <img src={url} alt={`Page ${idx + 1}`} className="w-full h-full object-contain p-1" />
                                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                            <span className="text-white text-xs font-bold">Page {idx + 1}</span>
                                            <button type="button"
                                              onClick={() => setAnswers(prev => {
                                                const ex: string[] = (() => { try { return JSON.parse(prev[q.id] || '[]'); } catch { return []; } })();
                                                const next = ex.filter((_, i) => i !== idx);
                                                return { ...prev, [q.id]: next.length ? JSON.stringify(next) : '' };
                                              })}
                                              className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 hover:bg-red-700"
                                            >
                                              <Trash2 className="w-3 h-3" /> Remove
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          ) : q.type === 'text' ? (
                            <textarea
                              rows={6}
                              placeholder="Type your answer here..."
                              value={answers[q.id] || ''}
                              onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                              className="w-full p-5 border-2 border-slate-200 rounded-3xl resize-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none font-medium text-slate-700 placeholder:text-slate-400 text-lg"
                            />
                          ) : (
                            <div className="grid grid-cols-1 gap-4">
                              {(q.options?.length ? q.options : q.type === 'boolean' ? ['True', 'False'] : []).map((opt, i) => {
                                const isSelected = answers[q.id] === opt;
                                return (
                                  <button key={i} onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))}
                                    className={`relative text-left p-6 rounded-3xl border-2 transition-all duration-200 group overflow-hidden ${
                                      isSelected
                                        ? 'border-indigo-500 bg-indigo-50 shadow-md transform scale-[1.01]'
                                        : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-4 relative z-10">
                                      <span className={`shrink-0 flex items-center justify-center w-12 h-12 rounded-2xl border-2 text-base font-black transition-colors ${
                                        isSelected
                                          ? 'border-indigo-500 bg-indigo-500 text-white'
                                          : 'border-slate-300 text-slate-500 group-hover:border-indigo-300 group-hover:text-indigo-500'
                                      }`}>{String.fromCharCode(65 + i)}</span>
                                      <div className={`text-xl font-semibold overflow-x-auto flex-1 ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                                        <MathRenderer text={opt} />
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <div className="absolute right-6 top-1/2 -translate-y-1/2">
                                        <CheckCircle2 className="w-8 h-8 text-indigo-500" />
                                      </div>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* RIGHT: Navigation Sidebar */}
            <div className="w-full md:w-[320px] lg:w-[380px] shrink-0 bg-white border-t md:border-t-0 md:border-l border-slate-200 flex flex-col shadow-sm z-10 md:h-full md:overflow-hidden">
              <div className="p-8 border-b border-slate-100 bg-indigo-50/50">
                <p className="text-xs font-extrabold text-indigo-600 uppercase tracking-widest flex items-center gap-2 mb-3">
                  <LayoutGrid className="w-4 h-4" /> Final Test Progress
                </p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${pctDone}%` }} />
                  </div>
                  <span className="text-sm font-black text-slate-700">{answeredCount}/{questions.length}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {questions.map((ques, idx) => {
                    const isActive = idx === currentQ;
                    const isAnswered = !!answers[ques.id];
                    return (
                      <button key={ques.id} onClick={() => setCurrentQ(idx)}
                        className={`aspect-square rounded-2xl flex items-center justify-center text-base font-black transition-all border-2 ${
                          isActive
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-lg transform scale-110'
                            : isAnswered
                              ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                              : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-200 shrink-0 space-y-3">
                {currentQ < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentQ(q => q + 1)}
                    className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white text-base font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3"
                  >
                    Next Question <ChevronRight className="w-6 h-6" />
                  </button>
                ) : (
                  <button
                    onClick={() => setShowConfirm(true)}
                    disabled={submitting}
                    className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-slate-400 disabled:to-slate-500 text-white text-base font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3"
                  >
                    {submitting ? (
                      <><Loader2 className="w-6 h-6 animate-spin" /> AI is evaluating your answers…</>
                    ) : (
                      <>Submit Final Test <ClipboardCheck className="w-6 h-6" /></>
                    )}
                  </button>
                )}
                <p className="text-[11px] text-center font-medium text-slate-400">
                  {answeredCount} of {questions.length} answered
                </p>
              </div>
            </div>
          </motion.div>
        )}

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
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Submit Final Test?</h2>
                  <p className="text-sm text-slate-500 font-medium">This cannot be undone. Review your progress below.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
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
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-amber-800">
                    {questions.length - answeredCount} unanswered question{questions.length - answeredCount > 1 ? 's' : ''} will be marked incorrect.
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
                  onClick={() => { setShowConfirm(false); submitTest(); }}
                  disabled={submitting}
                  className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-2xl transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                  Yes, Submit
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* ── 3. Results Screen (Wide Dashboard) ───────────────────────────── */}
        {testState === 'results' && (
          <motion.div key="results"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex-1 bg-white overflow-y-auto h-full p-6 sm:p-10 lg:p-16"
          >
            <div className="w-full max-w-7xl mx-auto space-y-10">
              {evaluationIncomplete && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <AlertCircle className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-black text-amber-900">AI could not finish grading</p>
                      <p className="text-sm text-amber-800/90 mt-1 leading-relaxed">
                        Your final test was not saved yet. Fix your connection if needed, then retry. You can also go back
                        and edit answers.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setTestState('testing')}
                      className="px-5 py-3 rounded-xl border-2 border-amber-800/30 bg-white text-amber-900 text-sm font-black hover:bg-amber-100/50 transition-colors"
                    >
                      Edit answers
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitTest()}
                      disabled={submitting}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-sm font-black disabled:opacity-60 transition-colors"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Retry evaluation
                    </button>
                  </div>
                </div>
              )}

              {/* Massive Score Card */}
              <div className={`relative overflow-hidden flex flex-col md:flex-row items-center gap-8 md:gap-12 p-10 md:p-16 rounded-[3rem] border shadow-2xl ${evaluationIncomplete ? 'bg-gradient-to-br from-amber-500 to-orange-600 border-amber-400' : passed ? 'bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-400' : 'bg-gradient-to-br from-red-500 to-rose-600 border-red-400'} text-white`}>
                <div className="absolute -right-20 -top-20 w-96 h-96 bg-white/10 blur-3xl rounded-full" />
                <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-black/10 blur-3xl rounded-full" />
                
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className="w-32 h-32 md:w-40 md:h-40 bg-white/20 backdrop-blur-md rounded-[2rem] flex items-center justify-center shrink-0 border border-white/30 shadow-inner z-10"
                >
                  {evaluationIncomplete ? <AlertCircle className="w-16 h-16 md:w-20 md:h-20 text-white" /> : passed ? <Trophy className="w-16 h-16 md:w-20 md:h-20 text-white" /> : <RotateCcw className="w-16 h-16 md:w-20 md:h-20 text-white" />}
                </motion.div>
                
                <div className="flex-1 text-center md:text-left z-10">
                  <p className="text-lg md:text-xl font-bold text-white/80 uppercase tracking-widest mb-2">Final Test Results</p>
                  <h2 className="text-4xl md:text-6xl font-black mb-4">
                    {evaluationIncomplete ? 'Grading incomplete' : passed ? 'Congratulations!' : 'Keep Going!'}
                  </h2>
                  <p className="text-xl md:text-2xl font-medium text-white/90">
                    {evaluationIncomplete
                      ? 'Open-ended questions need a successful AI check before your score is saved.'
                      : <>You scored {score} out of {questions.length} correct.</>}
                  </p>
                </div>
                
                <div className="z-10 shrink-0">
                  <div className={`flex items-center justify-center w-40 h-40 md:w-48 md:h-48 rounded-full border-[12px] border-white/30 bg-black/10 backdrop-blur-sm`}>
                    <span className="text-5xl md:text-6xl font-black">{evaluationIncomplete ? '—' : `${pct}%`}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-end">
                {evaluationIncomplete ? null : passed ? (
                  <button onClick={handleTopicComplete} className="w-full sm:w-auto px-12 py-5 bg-gradient-to-r from-[#0084B4] to-[#006A91] text-white text-xl font-black rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3">
                    <Star className="w-6 h-6" /> Complete Topic <ChevronRight className="w-6 h-6" />
                  </button>
                ) : (
                  <button onClick={() => setTestState('ai-teaching')} className="w-full sm:w-auto px-12 py-5 bg-slate-900 text-white text-xl font-black rounded-2xl shadow-xl hover:shadow-2xl hover:bg-slate-800 hover:-translate-y-1 transition-all flex items-center justify-center gap-3">
                    <Brain className="w-6 h-6 text-indigo-400" /> Get AI Help & Retake <ChevronRight className="w-6 h-6" />
                  </button>
                )}
              </div>

              {/* Wide AI Analysis Box */}
              <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm p-8 md:p-12">
                <div className="flex items-center gap-4 mb-8 pb-8 border-b border-slate-100">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100">
                    <Brain className="w-8 h-8 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">AI Analysis & Review</h3>
                    <p className="text-slate-500 font-medium mt-1">
                      {passed ? 'You demonstrated strong understanding. Review any missed questions below.' : 'Let me help you understand where things went wrong.'}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {questions.map((ques, i) => {
                    const pq = reviewGrading?.perQuestion[ques.id];
                    const evalFailed = !!pq?.evaluationFailed;
                    const isCorrect = pq
                      ? !evalFailed && !!pq.correct
                      : answers[ques.id] === ques.correctAnswer;
                    const imgUrls = ques.type === 'image_upload' ? parseAnswerImageUrls(answers[ques.id] ?? '') : [];
                    return (
                      <div key={ques.id} className={`rounded-3xl border p-6 md:p-8 ${evalFailed ? 'bg-amber-50/80 border-amber-200' : isCorrect ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${evalFailed ? 'bg-amber-100 text-amber-700' : isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                            {evalFailed ? <AlertCircle className="w-6 h-6" /> : isCorrect ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Question {i + 1}</p>
                            <div className="text-xl font-bold text-slate-900 mb-6">
                              <MathRenderer text={ques.text} block />
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Your Answer</p>
                                {ques.type === 'image_upload' && imgUrls.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {imgUrls.map((url, ui) => (
                                      <img key={ui} src={url} alt="" className="max-h-40 rounded-lg border border-slate-200 object-contain" />
                                    ))}
                                  </div>
                                ) : (
                                  <p className={`text-lg font-bold ${evalFailed ? 'text-amber-800' : isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>{answers[ques.id] ?? 'Skipped'}</p>
                                )}
                              </div>
                              {!isCorrect && !evalFailed && (
                                <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 shadow-sm">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600/60 mb-2">Correct Answer</p>
                                  <p className="text-lg font-bold text-emerald-700">{ques.correctAnswer}</p>
                                </div>
                              )}
                            </div>

                            {(evalFailed || pq?.aiReasoning) && (
                              <div className={`mt-4 p-5 rounded-2xl border flex items-start gap-3 ${evalFailed ? 'bg-amber-50 border-amber-200' : 'bg-violet-50 border-violet-100'}`}>
                                {evalFailed ? <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" /> : <Sparkles className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />}
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest mb-1 text-slate-600">AI note</p>
                                  <p className="text-sm font-medium text-slate-800 whitespace-pre-wrap">{pq?.aiReasoning ?? (evalFailed ? 'Use “Retry evaluation” above.' : '')}</p>
                                </div>
                              </div>
                            )}
                            
                            {ques.explanation && (
                              <div className="mt-4 p-5 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3">
                                <HelpCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                <p className="text-sm font-medium text-slate-700 leading-relaxed">{ques.explanation}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── 4. AI Teaching ──────────────────────────────────────────────── */}
        {testState === 'ai-teaching' && (
          <div className="flex-1 w-full h-full">
            <AITeachingPanel
              topicTitle={topicTitle}
              kind="finaltest"
              topicId={topicId}
              contextId={topicId}
              failedQuestions={
                apiFailedQuestions.current.length > 0
                  ? apiFailedQuestions.current
                  : wrongAnswers.map((w) => ({
                      questionId: w.questionId,
                      text: w.questionText,
                      type: w.type,
                      studentAnswer: w.yourAnswer,
                      correctAnswer: w.correctAnswer ?? '',
                    }))
              }
              retakeQuestions={apiFailedQuestions.current.length === 0 ? questions : undefined}
              onPassed={handleTopicComplete}
              onBack={() => setTestState('results')}
            />
          </div>
        )}

        {/* ── 5. Topic Complete (Massive Hero) ────────────────────────────── */}
        {testState === 'topic-complete' && (
          <motion.div key="complete"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex-1 flex flex-col items-center justify-center p-8 bg-white text-center w-full h-full relative overflow-hidden"
          >
            {/* Background Confetti & Glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-amber-50 to-white" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-400/10 blur-[100px] rounded-full" />
            
            <div className="relative z-10 flex flex-col items-center">
              <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 3, type: 'tween', ease: 'easeInOut' }}
                className="w-40 h-40 md:w-48 md:h-48 bg-gradient-to-br from-amber-400 to-orange-500 rounded-[3rem] flex items-center justify-center shadow-2xl mb-12 border-4 border-white"
              >
                <Trophy className="w-20 h-20 md:w-24 md:h-24 text-white" />
              </motion.div>
              
              <h2 className="text-5xl md:text-7xl font-black text-slate-900 mb-6 tracking-tight">Topic Conquered!</h2>
              <p className="text-xl md:text-2xl text-slate-500 font-medium mb-12 max-w-2xl">
                You've fully mastered <span className="font-black text-slate-800">"{topicTitle}"</span>. All videos watched, all quizzes passed.
              </p>

              {/* Unlock badge */}
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 }}
                className="bg-amber-50 border-2 border-amber-200 rounded-3xl px-10 py-6 flex items-center gap-6 mb-16 shadow-xl shadow-amber-500/10"
              >
                <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center border border-amber-300">
                  <Star className="w-8 h-8 text-amber-600" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-amber-600 uppercase tracking-widest mb-1">Badge Unlocked</p>
                  <p className="text-2xl font-bold text-amber-900">Topic Master</p>
                </div>
              </motion.div>

              <button
                onClick={onCompleted}
                className="flex items-center gap-4 px-12 py-5 bg-slate-900 hover:bg-slate-800 text-white text-xl font-black rounded-2xl transition-all shadow-2xl hover:-translate-y-1"
              >
                Continue to Next Topic <ChevronRight className="w-7 h-7" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
