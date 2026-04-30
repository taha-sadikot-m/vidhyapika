import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Brain, AlertTriangle, Lightbulb, CheckCircle2,
  RotateCcw, ChevronRight, Send, Loader2, LayoutGrid,
  BookOpen, ClipboardList, Dumbbell, MessageCircle
} from 'lucide-react';
import { InlineQuiz } from './InlineQuiz';
import { AIBadge } from './ui/AIBadge';
import { MathRenderer } from './MathRenderer';
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
  const [expandedMistakeId, setExpandedMistakeId] = useState<string | null>(null);
  const [openHint, setOpenHint] = useState<Record<number, boolean>>({});
  const [openSolution, setOpenSolution] = useState<Record<number, boolean>>({});

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
      setTeachTab(failedQuestions.length > 0 ? 'mistakes' : 'learn');
      setPanelState('teaching');
    } else {
      startTeachingSession();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const startTeachingSession = async () => {
    setPanelState('loading');
    const res = await apiFetch<{ sessionId: string; lessonCards: LessonCard[]; mistakes?: MistakeInsight[]; drills?: MiniDrill[] }>('/api/ai/teach', {
      method: 'POST',
      body: JSON.stringify({
        topicId,
        subTopicId,
        contextType: normalizedKind,
        failedQuestions,
      }),
    });

    if (res.error || !res.data) {
      setErrorMsg(res.error ?? 'Failed to start AI session');
      setPanelState('error');
      return;
    }

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
        failedQuestions,
        count: 5,
      }),
    });

    setGeneratingTest(false);

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

  const handleQuizComplete = async (score: number, total: number) => {
    const pct = total > 0 ? (score / total) * 100 : 0;
    if (pct >= passingThreshold) {
      setPanelState('passed');
    } else {
      setPanelState('teaching');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className="w-full space-y-5"
    >
      {/* Header */}
      <div className="rounded-3xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 pt-6 pb-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">Your AI Tutor</h2>
              <AIBadge label="AI Teaching Session" size="sm" className="bg-white/20 text-white mt-0.5" />
            </div>
          </div>
          <p className="text-indigo-100 text-sm font-medium">{subjectLine}</p>
        </div>

        {/* Content area */}
        <AnimatePresence mode="wait">

          {/* Loading */}
          {panelState === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white border border-indigo-100 p-10 rounded-b-3xl flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-sm text-slate-600 font-medium">Your AI tutor is analyzing your mistakes…</p>
            </motion.div>
          )}

          {/* Error */}
          {panelState === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white border border-red-100 p-8 rounded-b-3xl flex flex-col items-center gap-4 text-center">
              <AlertTriangle className="w-10 h-10 text-red-400" />
              <p className="text-sm text-slate-600">{errorMsg}</p>
              <button onClick={startTeachingSession} className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl">
                Try Again
              </button>
            </motion.div>
          )}

          {/* Teaching */}
          {panelState === 'teaching' && (
            <motion.div key="teaching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="bg-white border border-indigo-100 p-6 sm:p-8 space-y-6 rounded-b-3xl shadow-sm">

              {/* Overview cards (quiz-grade organization) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-black text-slate-900">{failedQuestions.length}</p>
                    <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Missed Questions</p>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-black text-slate-900">{lessonCards.length}</p>
                    <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Lesson Cards</p>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Dumbbell className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-black text-slate-900">{drills.length}</p>
                    <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Mini Drills</p>
                  </div>
                </div>
              </div>

              {/* Section tabs */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setTeachTab('mistakes')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-sm font-extrabold transition-colors ${
                    teachTab === 'mistakes'
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" /> Mistakes
                </button>
                <button
                  type="button"
                  onClick={() => setTeachTab('learn')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-sm font-extrabold transition-colors ${
                    teachTab === 'learn'
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <BookOpen className="w-4 h-4" /> Learn
                </button>
                <button
                  type="button"
                  onClick={() => setTeachTab('practice')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-sm font-extrabold transition-colors ${
                    teachTab === 'practice'
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Dumbbell className="w-4 h-4" /> Practice
                </button>
              </div>

              {/* Tab content */}
              {teachTab === 'mistakes' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <p className="text-sm font-black text-slate-900">Mistake diagnosis</p>
                    <p className="text-xs font-bold text-slate-400">({mistakes.length || failedQuestions.length} items)</p>
                  </div>

                  {(mistakes.length > 0 ? mistakes : failedQuestions.map((q, idx) => ({
                    questionId: q.questionId ?? `q${idx + 1}`,
                    mistakeTitle: 'Needs review',
                    whatWentWrong: q.aiReasoning || 'This answer did not match the expected result.',
                    likelyMisconception: 'A rule/step may have been applied incorrectly.',
                    fix: 'Revisit the concept and solve step-by-step, checking each step.',
                    example: 'Example: If $2(x+3)=14$, then $x=4$.',
                  }))).map((m, i) => {
                    const fq = failedQuestions.find((x) => x.questionId === m.questionId);
                    const expanded = expandedMistakeId === m.questionId;
                    return (
                      <div key={`${m.questionId}-${i}`} className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedMistakeId((prev) => prev === m.questionId ? null : m.questionId)}
                          className="w-full text-left p-5 sm:p-6 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                              <span className="font-black text-sm">{i + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Mistake</p>
                              <p className="text-base sm:text-lg font-black text-slate-900">{m.mistakeTitle}</p>
                              {fq?.text && (
                                <div className="mt-3 text-sm font-semibold text-slate-700 overflow-x-auto">
                                  <MathRenderer text={fq.text} />
                                </div>
                              )}
                            </div>
                            <div className="shrink-0">
                              <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                            </div>
                          </div>
                        </button>

                        {expanded && (
                          <div className="p-5 sm:p-6 pt-0 space-y-4">
                            {fq && (
                              <div className="grid sm:grid-cols-2 gap-3">
                                <div className="p-4 rounded-2xl border bg-red-50/60 border-red-100">
                                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Your answer</p>
                                  {fq.type === 'image_upload' && fq.studentAnswer?.startsWith('data:image') ? (
                                    <img src={fq.studentAnswer} alt="Student upload" className="max-h-40 rounded-xl border border-red-200 bg-white" />
                                  ) : (
                                    <p className="text-sm font-bold text-red-700 break-words">{fq.studentAnswer || '—'}</p>
                                  )}
                                  {fq.aiReasoning && (
                                    <p className="mt-2 text-xs font-medium text-red-700/90">{fq.aiReasoning}</p>
                                  )}
                                </div>
                                <div className="p-4 rounded-2xl border bg-emerald-50/60 border-emerald-100">
                                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Expected</p>
                                  <p className="text-sm font-bold text-emerald-700 break-words">{fq.correctAnswer || '—'}</p>
                                </div>
                              </div>
                            )}

                            <div className="grid md:grid-cols-2 gap-3">
                              <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">What went wrong</p>
                                <MathRenderer text={m.whatWentWrong} className="text-sm font-medium text-slate-700" block />
                              </div>
                              <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Likely misconception</p>
                                <MathRenderer text={m.likelyMisconception} className="text-sm font-medium text-slate-700" block />
                              </div>
                              <div className="p-4 rounded-2xl border border-indigo-100 bg-indigo-50/40">
                                <p className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest mb-2">Fix</p>
                                <MathRenderer text={m.fix} className="text-sm font-medium text-indigo-900/90" block />
                              </div>
                              <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Example</p>
                                <MathRenderer text={m.example} className="text-sm font-medium text-slate-700" block />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {teachTab === 'learn' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-indigo-600 shrink-0" />
                    <p className="text-sm font-black text-slate-900">Personalized lessons</p>
                    <p className="text-xs font-bold text-slate-400">({lessonCards.length} cards)</p>
                  </div>

                  {lessonCards.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {lessonCards.map((card, i) => (
                        <motion.div key={i}
                          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06 }}
                          className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"
                        >
                          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center border border-indigo-200">
                              <Brain className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Lesson {i + 1}</p>
                              <p className="text-sm font-black text-slate-900 truncate">{card.title}</p>
                            </div>
                          </div>
                          <div className="p-5">
                            <MathRenderer text={card.content} className="text-sm text-slate-700 font-medium leading-relaxed" block />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl p-5">
                      No lesson cards yet. Try again, or ask in chat.
                    </div>
                  )}
                </div>
              )}

              {teachTab === 'practice' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Dumbbell className="w-5 h-5 text-emerald-600 shrink-0" />
                    <p className="text-sm font-black text-slate-900">Mini practice drills</p>
                    <p className="text-xs font-bold text-slate-400">({drills.length} drills)</p>
                  </div>

                  {drills.length > 0 ? (
                    <div className="space-y-3">
                      {drills.map((d, idx) => (
                        <div key={idx} className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                          <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/40 flex items-start gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200">
                              <span className="font-black text-sm">{idx + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Drill</p>
                              <div className="text-sm font-semibold text-slate-800 overflow-x-auto">
                                <MathRenderer text={d.prompt} block />
                              </div>
                            </div>
                          </div>
                          <div className="p-5 sm:p-6 space-y-3">
                            <div className="flex flex-col sm:flex-row gap-2">
                              <button
                                type="button"
                                onClick={() => setOpenHint((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                                className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-700 font-extrabold text-sm hover:bg-slate-50 transition-colors"
                              >
                                {openHint[idx] ? 'Hide hint' : 'Reveal hint'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setOpenSolution((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                                className="flex-1 py-3 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-extrabold text-sm hover:bg-emerald-100 transition-colors"
                              >
                                {openSolution[idx] ? 'Hide solution' : 'Reveal solution'}
                              </button>
                            </div>

                            {openHint[idx] && (
                              <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/40 flex items-start gap-3">
                                <Lightbulb className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                                <MathRenderer text={d.hint} className="text-sm font-medium text-blue-900/90" block />
                              </div>
                            )}

                            <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Check yourself</p>
                              <MathRenderer text={d.checkYourself} className="text-sm font-black text-slate-900" block />
                            </div>

                            {openSolution[idx] && (
                              <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40">
                                <p className="text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest mb-2">Solution</p>
                                <MathRenderer text={d.solution} className="text-sm font-medium text-emerald-900/90" block />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl p-5">
                      No drills yet. Try reloading the AI session, or ask the tutor in chat.
                    </div>
                  )}
                </div>
              )}

              {/* Tip */}
              <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <Lightbulb className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 font-medium leading-relaxed">
                  <span className="font-bold">Tip:</span> Have questions? Ask your AI tutor in the chat below before taking the retake test.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => setPanelState('chat')}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-white border border-indigo-300 text-indigo-700 text-sm font-extrabold rounded-2xl hover:bg-indigo-50 transition-colors">
                  <MessageCircle className="w-4 h-4" />
                  Ask AI Tutor
                </button>
                <button onClick={generateRetakeTest} disabled={generatingTest}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-extrabold rounded-2xl transition-colors disabled:opacity-60">
                  {generatingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  {generatingTest ? 'Generating…' : "I'm Ready — Take the New Test"}
                  {!generatingTest && <ChevronRight className="w-4 h-4" />}
                </button>
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
                <InlineQuiz
                  title="AI Personalized Retake"
                  questions={retakeQuestions}
                  onSubmit={handleQuizComplete}
                />
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
      </div>
    </motion.div>
  );
}
