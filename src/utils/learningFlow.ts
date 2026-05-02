import type { StudentTopicProgress, StudentSubTopicProgress, Question } from '../types';

export type SubStep =
  | { kind: 'video'; sub: StudentSubTopicProgress }
  | { kind: 'quiz'; sub: StudentSubTopicProgress; questions: Question[] }
  | { kind: 'eval-quiz'; label: string; questions: Question[] };

export function buildSubSteps(topic: StudentTopicProgress): SubStep[] {
  const out: SubStep[] = [];
  if ((topic.preEvaluationQuiz?.length ?? 0) > 0)
    out.push({ kind: 'eval-quiz', label: 'Pre-Evaluation', questions: topic.preEvaluationQuiz! });
  for (const sub of topic.subTopics) {
    if (sub.videoUrl) out.push({ kind: 'video', sub });
    if ((sub.quizzes?.length ?? 0) > 0) out.push({ kind: 'quiz', sub, questions: sub.quizzes! });
  }
  return out;
}

export function isSubStepComplete(s: SubStep, topic: StudentTopicProgress): boolean {
  if (s.kind === 'eval-quiz') {
    if (s.label === 'Pre-Evaluation') return !!topic.preEvaluationScore;
    if (s.label === 'Post-Evaluation') return !!topic.postEvaluationScore;
    return false;
  }
  if (s.kind === 'video') {
    if (!s.sub.videoUrl) return true;
    return !!s.sub.videoWatched;
  }
  if (s.kind === 'quiz') {
    return s.sub.status === 'completed';
  }
  return false;
}

export function allSubStepsComplete(subSteps: SubStep[], topic: StudentTopicProgress): boolean {
  return subSteps.length > 0 && subSteps.every((s) => isSubStepComplete(s, topic));
}

export function youtubeEmbed(url: string) {
  const m = url.match(/(?:youtu\.be\/|v=)([^#&?]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
}
