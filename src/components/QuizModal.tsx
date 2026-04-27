import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Question } from '../types';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { MathRenderer } from './MathRenderer';

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  questions: Question[];
  onSubmit: (score: number, total: number, answers: Record<string, string>) => void;
  initialAnswers?: Record<string, string>;
  isReviewMode?: boolean;
}

export function QuizModal({ isOpen, onClose, title, questions, onSubmit, initialAnswers, isReviewMode }: QuizModalProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers || {});
  const [isSubmitted, setIsSubmitted] = useState(isReviewMode || false);

  if (!questions || questions.length === 0) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={title}>
        <div className="p-6 text-center text-slate-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p>No questions available for this quiz yet.</p>
        </div>
      </Modal>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const handleOptionSelect = (option: string) => {
    if (isSubmitted) return;
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: option }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    setIsSubmitted(true);
    let score = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correctAnswer) {
        score++;
      }
    });
    onSubmit(score, questions.length, answers);
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correctAnswer) score++;
    });
    return score;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="p-6">
        {!isSubmitted ? (
          <>
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-bold ${
                currentQuestion.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                currentQuestion.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {currentQuestion.difficulty}
              </span>
            </div>

            <div className="mb-8">
              <div className="text-lg font-bold text-slate-900 mb-6">
                <MathRenderer text={currentQuestion.text} block />
              </div>
              {currentQuestion.imageUrl && (
                <img src={currentQuestion.imageUrl} alt="Question" className="max-h-48 rounded-xl mb-4 border border-slate-200" />
              )}
              
              <div className="space-y-3">
                {currentQuestion.options?.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOptionSelect(option)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      answers[currentQuestion.id] === option 
                        ? 'border-blue-500 bg-blue-50 text-blue-900' 
                        : 'border-slate-200 hover:border-blue-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className="inline-block w-6 h-6 rounded-full border-2 border-current text-center leading-5 mr-3 text-sm font-bold">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <MathRenderer text={option} />
                  </button>
                ))}
                {currentQuestion.type === 'image_upload' && (
                  <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                    <p className="text-sm text-slate-500 mb-2">Upload your handwritten solution</p>
                    <input type="file" accept="image/*" className="text-sm text-slate-600" onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleOptionSelect(`[image: ${e.target.files[0].name}]`);
                      }
                    }} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100">
              <button
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
                className="px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-50"
              >
                Previous
              </button>
              
              {isLastQuestion ? (
                <button
                  onClick={handleSubmit}
                  disabled={Object.keys(answers).length < questions.length}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  Submit Quiz
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  disabled={!answers[currentQuestion.id]}
                  className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                >
                  Next
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Quiz Completed!</h2>
            <p className="text-slate-500 mb-8">You scored {calculateScore()} out of {questions.length}</p>
            
            <div className="space-y-6 text-left mb-8">
              {questions.map((q, idx) => {
                const isCorrect = answers[q.id] === q.correctAnswer;
                return (
                  <div key={q.id} className={`p-4 rounded-xl border ${isCorrect ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex items-start gap-3">
                      {isCorrect ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
                      <div>
                        <div className="font-bold text-slate-900 mb-2">{idx + 1}. <MathRenderer text={q.text} /></div>
                        <p className="text-sm text-slate-600 mb-1">Your answer: <span className="font-semibold"><MathRenderer text={answers[q.id] ?? '—'} /></span></p>
                        {!isCorrect && <p className="text-sm text-slate-600 mb-2">Correct: <span className="font-semibold"><MathRenderer text={q.correctAnswer ?? ''} /></span></p>}
                        {q.explanation && <p className="text-sm text-slate-500 mt-2 bg-white/50 p-2 rounded">{q.explanation}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={onClose}
              className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-colors"
            >
              Close & Return
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
