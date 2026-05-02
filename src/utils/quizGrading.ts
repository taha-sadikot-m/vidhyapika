import type { QuizSubmitGradingResult } from '../components/InlineQuiz';

/** Maps `/api/student/quiz/submit` JSON into InlineQuiz grading state (includes AI failure flags). */
export function gradingFromSubmitResponse(d: any): QuizSubmitGradingResult | null {
  const rows = d?.scoredAnswers;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const perQuestion: QuizSubmitGradingResult['perQuestion'] = {};
  for (const r of rows) {
    if (r?.questionId) {
      perQuestion[r.questionId] = {
        correct: !!r.correct,
        aiReasoning: r.aiReasoning,
        evaluationFailed: !!r.evaluationFailed,
      };
    }
  }
  const score =
    typeof d.score === 'number'
      ? d.score
      : Object.values(perQuestion).filter((x) => x.correct).length;
  const total = typeof d.total === 'number' ? d.total : Object.keys(perQuestion).length;
  return {
    score,
    total,
    perQuestion,
    evaluationIncomplete: !!d.evaluationIncomplete,
  };
}
