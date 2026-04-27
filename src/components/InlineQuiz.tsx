import React, { useState, useEffect, useRef } from 'react';
import { Question } from '../types';
import { 
  CheckCircle2, XCircle, AlertCircle, HelpCircle, 
  TrendingUp, Upload, Image as ImageIcon,
  ArrowRight, ArrowLeft, PlayCircle, LayoutGrid, Trash2, Check
} from 'lucide-react';
import { MathRenderer } from './MathRenderer';
import { motion, AnimatePresence } from 'framer-motion';

interface QuizAttemptRecord { score: number; total: number; date: string; }

interface InlineQuizProps {
  title: string;
  questions: Question[];
  onSubmit: (score: number, total: number, answers?: Record<string, string>) => void;
  initialAnswers?: Record<string, string>;
  isReviewMode?: boolean;
  attemptHistory?: QuizAttemptRecord[];
}

export function InlineQuiz({ title, questions, onSubmit, initialAnswers, isReviewMode, attemptHistory }: InlineQuizProps) {
  const [phase, setPhase] = useState<'start' | 'quiz' | 'review'>(isReviewMode ? 'review' : 'start');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers || {});
  const [uiError, setUiError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Reset state when questions change
  useEffect(() => {
    setPhase(isReviewMode ? 'review' : 'start');
    setCurrentQuestionIndex(0);
    setAnswers(initialAnswers || {});
    setUiError(null);
  }, [questions, initialAnswers, isReviewMode]);

  if (!questions || questions.length === 0) {
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

  const handleImageUpload = async (file: File) => {
    if (phase === 'review') return;
    setUiError(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', 'student-answers');
    const token = localStorage.getItem('vidhyapika_token');
    const res = await fetch('/api/upload/image', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: fd,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Upload failed');
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: json.url }));
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correctAnswer) score++;
    });
    return score;
  };

  const handleSubmit = () => {
    setPhase('review');
    const score = calculateScore();
    onSubmit(score, questions.length, answers);
  };

  // ── 1. Start Screen ──
  if (phase === 'start') {
    return (
      <div className="flex-1 bg-white relative overflow-y-auto h-full w-full">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-slate-50 border-l border-slate-100 hidden md:block" />
        
        <div className="relative z-10 w-full h-full min-h-[600px] flex flex-col md:flex-row items-center max-w-[1600px] mx-auto">
          {/* Left Hero */}
          <div className="flex-1 flex flex-col justify-center p-8 md:p-16 lg:p-24">
            <div className="w-16 h-16 sm:w-24 sm:h-24 bg-[#0084B4]/10 rounded-3xl flex items-center justify-center mb-8 shadow-sm border border-[#0084B4]/20">
              <HelpCircle className="w-8 h-8 sm:w-12 sm:h-12 text-[#0084B4]" />
            </div>
            
            <p className="text-sm font-black text-[#0084B4] uppercase tracking-widest mb-4">Quiz Room Environment</p>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-slate-900 mb-6 leading-tight">{title}</h1>
            <p className="text-lg sm:text-xl text-slate-500 font-medium leading-relaxed mb-10 max-w-2xl">
              You are about to enter the quiz room. Make sure you are fully prepared. You can navigate between questions, upload images for written solutions, and submit at any time.
            </p>
            
            <button
              onClick={() => setPhase('quiz')}
              className="w-full sm:w-max px-12 py-5 flex items-center justify-center gap-4 bg-slate-900 hover:bg-slate-800 text-white text-xl font-black rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
            >
              Enter Quiz Room <ArrowRight className="w-7 h-7" />
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
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 2. Results / Review Screen ──
  if (phase === 'review') {
    const score = calculateScore();
    const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
    const passed = pct >= 60;
    const allAttempts: QuizAttemptRecord[] = [
      ...(attemptHistory ?? []),
      { score, total: questions.length, date: new Date().toISOString().split('T')[0] },
    ];

    return (
      <div className="flex-1 bg-white overflow-y-auto h-full p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-7xl mx-auto">
          {/* Score dashboard */}
          <div className={`relative overflow-hidden flex flex-col sm:flex-row items-center sm:items-stretch gap-6 p-8 sm:p-12 rounded-3xl mb-12 border shadow-sm ${passed ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200' : 'bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200'}`}>
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/40 blur-2xl rounded-full" />
            
            <div className={`w-24 h-24 rounded-3xl flex items-center justify-center shrink-0 shadow-inner bg-white/60 border ${passed ? 'border-emerald-300' : 'border-amber-300'}`}>
              {passed ? <CheckCircle2 className="w-12 h-12 text-emerald-600" /> : <AlertCircle className="w-12 h-12 text-amber-600" />}
            </div>
            <div className="flex-1 text-center sm:text-left flex flex-col justify-center">
              <h2 className="text-3xl font-black text-slate-900 mb-2">
                {passed ? 'Great work!' : 'Quiz Done'}
              </h2>
              <p className={`text-base font-bold ${passed ? 'text-emerald-700' : 'text-amber-700'}`}>
                You got {score} out of {questions.length} correct.
                {!passed && ' Review the explanations below to improve.'}
              </p>
            </div>
            <div className="flex items-center justify-center shrink-0">
              <div className={`flex items-center justify-center w-28 h-28 rounded-full border-8 ${passed ? 'border-emerald-400 text-emerald-700' : 'border-amber-400 text-amber-700'} bg-white/50`}>
                <span className="text-3xl font-black">{pct}%</span>
              </div>
            </div>
          </div>

          {/* Review List */}
          <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-[#0084B4]" /> Question Review
          </h3>
          
          <div className="space-y-6">
            {questions.map((q, idx) => {
              const isCorrect = answers[q.id] === q.correctAnswer;
              return (
                <div key={q.id} className={`p-6 rounded-3xl border shadow-sm ${isCorrect ? 'bg-white border-emerald-200' : 'bg-white border-red-200'}`}>
                  <div className="flex items-start gap-4 mb-6 pb-6 border-b border-slate-100">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {isCorrect ? <Check className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
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
                        answers[q.id] ? <img src={answers[q.id]} alt="Your upload" className="max-h-32 rounded-lg border border-slate-200" /> : <p className="text-slate-500 font-medium italic">No image uploaded</p>
                      ) : (
                        <p className={`font-bold ${isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>{answers[q.id] || 'Skipped'}</p>
                      )}
                    </div>
                    
                    {!isCorrect && (
                      <div className="p-4 rounded-2xl border bg-emerald-50/50 border-emerald-100">
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Correct Answer</p>
                        {q.type === 'image_upload' ? (
                          <p className="text-emerald-700 font-bold italic">Manual grading required.</p>
                        ) : (
                          <p className="font-bold text-emerald-700">{q.correctAnswer}</p>
                        )}
                      </div>
                    )}
                  </div>

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
                      <label 
                        className={`block relative overflow-hidden transition-all duration-300 rounded-3xl border-2 border-dashed bg-white 
                          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}
                        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={async (e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file && file.type.startsWith('image/')) {
                            try { await handleImageUpload(file); } catch (err: any) { setUiError(err.message); }
                          } else {
                            setUiError("Please upload a valid image file.");
                          }
                        }}
                      >
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            try { await handleImageUpload(file); } catch (err: any) { setUiError(err.message); }
                          }}
                        />
                        <div className="flex flex-col items-center justify-center py-16 px-6 text-center cursor-pointer">
                          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                            <Upload className="w-8 h-8" />
                          </div>
                          <p className="text-lg font-bold text-slate-800">Click to upload or drag & drop</p>
                          <p className="text-sm font-medium text-slate-500 mt-2">Upload a clear photo of your handwritten solution.</p>
                        </div>
                      </label>

                      {answers[currentQuestion.id] && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative bg-white p-2 rounded-3xl border border-slate-200 shadow-sm group">
                          <img src={answers[currentQuestion.id]} alt="Uploaded answer" className="w-full object-contain rounded-2xl max-h-[400px]" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => setAnswers(prev => { const n = { ...prev }; delete n[currentQuestion.id]; return n; })}
                              className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 hover:bg-red-700 transition-colors"
                            >
                              <Trash2 className="w-5 h-5" /> Remove Image
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {currentQuestion.options?.map((option, idx) => {
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

        <div className="p-6 bg-slate-50 border-t border-slate-200 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
            <p className="text-xs font-semibold text-slate-500">You can submit the quiz at any time, even if questions are unanswered.</p>
          </div>
          <button
            onClick={handleSubmit}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white text-sm font-black rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            Submit Quiz <CheckCircle2 className="w-5 h-5" />
          </button>
        </div>
      </div>
      
    </div>
  );
}
