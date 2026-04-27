import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles, Brain, AlertTriangle, Lightbulb, CheckCircle2,
  RotateCcw, ChevronRight, Send, Loader2
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

interface AITeachingPanelProps {
  topicId?: string;
  topicTitle: string;
  subTopicId?: string;
  subtopicTitle?: string;
  kind: 'prereq' | 'subtopic' | 'finaltest' | 'prerequisite' | 'final-test';
  contextId?: string;
  failedQuestions?: { questionId: string; text: string; studentAnswer?: string; correctAnswer?: string }[];
  /** Legacy prop: pre-fetched retake questions (bypasses AI generation) */
  retakeQuestions?: Question[];
  passingThreshold?: number;
  onPassed: () => void;
  onBack?: () => void;
}

type PanelState = 'loading' | 'teaching' | 'chat' | 'quiz' | 'passed' | 'error';

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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lessonCards, setLessonCards] = useState<LessonCard[]>([]);
  const [retakeQuestions, setRetakeQuestions] = useState<Question[]>([]);
  const [chatMessages, setChatMessages] = useState<{ role: 'tutor' | 'student'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [generatingTest, setGeneratingTest] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

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
    const res = await apiFetch<{ sessionId: string; lessonCards: LessonCard[] }>('/api/ai/teach', {
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
        type: q.type === 'true_false' ? 'boolean' : q.type === 'image_upload' ? 'image_upload' : 'mcq',
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
              className="bg-white border border-indigo-100 p-6 space-y-5 rounded-b-3xl shadow-sm">

              {/* AI lesson cards */}
              {lessonCards.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {lessonCards.map((card, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                      className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                        <Brain className="w-4 h-4 text-indigo-600" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">{card.title}</p>
                      <MathRenderer text={card.content} className="text-xs text-slate-500 leading-relaxed" block />
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Failed questions review */}
              {failedQuestions.length > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-sm font-bold text-amber-800">What you missed</p>
                  </div>
                  <div className="space-y-2">
                    {failedQuestions.map((q, i) => (
                      <div key={i} className="bg-white border border-amber-100 rounded-xl p-3 text-xs space-y-1">
                        <MathRenderer text={q.text} className="font-semibold text-slate-700" />
                        {q.studentAnswer && <p className="text-red-600">Your answer: <span className="font-medium">{q.studentAnswer}</span></p>}
                        {q.correctAnswer && <p className="text-emerald-600">Correct: <span className="font-medium">{q.correctAnswer}</span></p>}
                      </div>
                    ))}
                  </div>
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
                  <Sparkles className="w-4 h-4" />
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
                  ← Back to Lessons
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
                  Back to lessons
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
