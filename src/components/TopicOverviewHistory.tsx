import React, { useMemo } from 'react';
import {
  Network, Video, HelpCircle, CheckCircle2, ClipboardList, ChevronDown,
} from 'lucide-react';
import type { Prerequisite, Question, StudentSubTopicProgress, StudentTopicProgress } from '../types';
import { parseAnswerImageUrls } from '../utils/quizAnswerDisplay';

type ApiAnswer = { questionId: string; answer: string; correct: boolean; aiReasoning?: string };

type ApiQuizAttempt = {
  id: string;
  score: number;
  total: number;
  passed: boolean;
  aiGenerated?: boolean;
  timestamp?: { seconds?: number; _seconds?: number };
  answers: ApiAnswer[];
};

function formatAttemptDate(ts: ApiQuizAttempt['timestamp']): string {
  const s = ts?.seconds ?? (ts as { _seconds?: number } | undefined)?._seconds;
  if (s != null) return new Date(s * 1000).toLocaleString();
  return '';
}

function buildQuestionLookup(topic: StudentTopicProgress): Map<string, { text: string; correctAnswer?: string; type?: Question['type'] }> {
  const m = new Map<string, { text: string; correctAnswer?: string; type?: Question['type'] }>();
  const addQs = (qs?: Question[]) => {
    for (const q of qs ?? []) m.set(q.id, { text: q.text, correctAnswer: q.correctAnswer, type: q.type });
  };
  for (const p of topic.prerequisites ?? []) addQs(p.questions);
  for (const st of topic.subTopics) addQs(st.quizzes);
  addQs(topic.finalTestQuiz);
  addQs(topic.preEvaluationQuiz);
  addQs(topic.postEvaluationQuiz);
  return m;
}

function QuizAttemptBlock({
  att,
  attemptNumber,
  questionLookup,
}: {
  att: ApiQuizAttempt;
  attemptNumber: number;
  questionLookup: Map<string, { text: string; correctAnswer?: string; type?: Question['type'] }>;
}) {
  const date = formatAttemptDate(att.timestamp);
  const pct = att.total > 0 ? Math.round((att.score / att.total) * 100) : 0;
  return (
    <details className="group rounded-xl border border-slate-200 bg-slate-50/80 open:bg-white open:shadow-sm transition-all">
      <summary className="cursor-pointer list-none flex items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 transition-transform group-open:rotate-180" />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm min-w-0">
          <span className="font-extrabold text-slate-900">Attempt {attemptNumber}</span>
          <span className="text-slate-500 font-medium">{date || '—'}</span>
          <span className="font-bold text-slate-700">
            {att.score}/{att.total} ({pct}%)
          </span>
          <span
            className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              att.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}
          >
            {att.passed ? 'Passed' : 'Not passed'}
          </span>
          {att.aiGenerated ? (
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
              AI retake
            </span>
          ) : null}
        </div>
      </summary>
      <div className="px-4 pb-4 border-t border-slate-100 space-y-3">
        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider pt-3">Your answers</p>
        {(att.answers ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No answer detail stored for this attempt.</p>
        ) : (
          (att.answers ?? []).map((a) => {
            const meta = questionLookup.get(a.questionId);
            const imageUrls = parseAnswerImageUrls(a.answer ?? '');
            const showImages = meta?.type === 'image_upload' || imageUrls.length > 0;
            return (
              <div
                key={`${att.id}-${a.questionId}`}
                className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-sm space-y-1.5"
              >
                <p className="font-semibold text-slate-800 leading-snug">{meta?.text ?? 'Question'}</p>
                {showImages ? (
                  <div className="space-y-2">
                    <p className="text-slate-600 font-medium">Your answer (images)</p>
                    {imageUrls.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {imageUrls.map((url, i) => (
                          <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-slate-200 overflow-hidden bg-white inline-block"
                          >
                            <img
                              src={url}
                              alt={`Your upload ${i + 1}`}
                              className="max-h-40 max-w-[200px] object-contain block"
                            />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 text-xs italic">No image data stored for this answer.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-600">
                    Your answer:{' '}
                    <span className="font-medium text-slate-900 break-words whitespace-pre-wrap">
                      {a.answer?.trim() ? a.answer : '—'}
                    </span>
                  </p>
                )}
                {meta?.correctAnswer != null && meta.correctAnswer !== '' && (
                  <p className="text-xs text-slate-500">
                    Expected: <span className="font-medium text-slate-700">{meta.correctAnswer}</span>
                  </p>
                )}
                <p className={`text-xs font-bold ${a.correct ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {a.correct ? 'Correct' : 'Incorrect'}
                </p>
                {a.aiReasoning ? (
                  <p className="text-xs text-slate-600 mt-2 pl-2 border-l-2 border-indigo-200 leading-relaxed">
                    {a.aiReasoning}
                  </p>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </details>
  );
}

function attemptsForPrereq(topicStatus: unknown, prereqId: string): ApiQuizAttempt[] {
  const blocks = (topicStatus as { prereqQuizAttempts?: { prerequisiteId: string; attempts: ApiQuizAttempt[] }[] })
    ?.prereqQuizAttempts;
  return blocks?.find((b) => b.prerequisiteId === prereqId)?.attempts ?? [];
}

function attemptsForSubtopic(topicStatus: unknown, subTopicId: string): ApiQuizAttempt[] {
  const blocks = (topicStatus as { subtopicQuizAttempts?: { subTopicId: string; attempts: ApiQuizAttempt[] }[] })
    ?.subtopicQuizAttempts;
  return blocks?.find((b) => b.subTopicId === subTopicId)?.attempts ?? [];
}

function finalAttempts(topicStatus: unknown): ApiQuizAttempt[] {
  return (topicStatus as { finalTestAttempts?: ApiQuizAttempt[] })?.finalTestAttempts ?? [];
}

export function TopicOverviewHistory({
  topic,
  topicStatus,
  prereqs,
  prereqCleared,
  hasFinalTest,
}: {
  topic: StudentTopicProgress;
  topicStatus: unknown;
  prereqs: Prerequisite[];
  prereqCleared: boolean;
  hasFinalTest: boolean;
}) {
  const questionLookup = useMemo(() => buildQuestionLookup(topic), [topic]);

  const anyAttempts =
    prereqs.some((p) => attemptsForPrereq(topicStatus, p.id).length > 0) ||
    topic.subTopics.some((s) => attemptsForSubtopic(topicStatus, s.id).length > 0) ||
    finalAttempts(topicStatus).length > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-gradient-to-r from-slate-50 to-blue-50/40 border-b border-slate-100 flex items-start gap-3">
        <ClipboardList className="w-5 h-5 text-[#0084B4] shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-extrabold text-slate-900">Quiz history & your answers</h3>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            Every submitted quiz is saved. Expand an attempt to see questions, what you chose, and whether each item was
            marked correct.
          </p>
        </div>
      </div>

      <div className="p-5 space-y-8">
        {!anyAttempts && (
          <p className="text-sm text-slate-500 text-center py-4">
            No quiz attempts yet for this topic. After you submit a quiz, your scores and answers will show up here.
          </p>
        )}

        {prereqs.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Network className="w-4 h-4 text-purple-600" />
              <h4 className="text-xs font-extrabold text-purple-900 uppercase tracking-wider">Prerequisites</h4>
            </div>
            <ul className="space-y-4">
              {prereqs.map((p, i) => {
                const attempts = attemptsForPrereq(topicStatus, p.id);
                const n = attempts.length;
                return (
                  <li key={p.id} className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-black text-slate-400 w-5 shrink-0">{i + 1}</span>
                        <span className="text-sm font-bold text-slate-900">{p.title}</span>
                      </div>
                      {prereqCleared ? (
                        <span className="text-[10px] font-extrabold text-emerald-600 flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Cleared
                        </span>
                      ) : i < (topic.prerequisiteScores?.length ?? 0) ? (
                        <span className="text-[10px] font-extrabold text-amber-600 shrink-0">In progress</span>
                      ) : (
                        <span className="text-[10px] font-extrabold text-slate-400 shrink-0">Not started</span>
                      )}
                    </div>
                    {(p.questions?.length ?? 0) > 0 && (
                      <p className="text-[11px] text-slate-500 mt-2 ml-7">
                        {n === 0 ? 'No attempts yet.' : `${n} quiz attempt${n === 1 ? '' : 's'} recorded.`}
                      </p>
                    )}
                    {n > 0 && (
                      <div className="mt-3 ml-7 space-y-2">
                        {attempts.map((att, idx) => (
                          <QuizAttemptBlock
                            key={att.id}
                            att={att}
                            attemptNumber={attempts.length - idx}
                            questionLookup={questionLookup}
                          />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section>
          <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-3">Modules</h4>
          {topic.subTopics.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No modules yet.</p>
          ) : (
            <ul className="space-y-4">
              {topic.subTopics.map((sub: StudentSubTopicProgress, i: number) => {
                const attempts = attemptsForSubtopic(topicStatus, sub.id);
                const n = attempts.length;
                return (
                  <li key={sub.id} className="rounded-xl border border-slate-100 bg-slate-50/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-black text-slate-400 w-5 shrink-0">{i + 1}</span>
                        <span className="text-sm font-bold text-slate-900 truncate">{sub.title}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-extrabold shrink-0">
                        {sub.videoUrl ? (
                          <span
                            className={
                              sub.videoWatched
                                ? 'text-emerald-600 flex items-center gap-1'
                                : 'text-amber-600 flex items-center gap-1'
                            }
                          >
                            <Video className="w-3 h-3" />
                            {sub.videoWatched ? 'Video done' : 'Video'}
                          </span>
                        ) : (
                          <span className="text-slate-400">No video</span>
                        )}
                        {(sub.quizzes?.length ?? 0) > 0 ? (
                          <span
                            className={
                              sub.status === 'completed'
                                ? 'text-emerald-600 flex items-center gap-1'
                                : 'text-blue-600 flex items-center gap-1'
                            }
                          >
                            <HelpCircle className="w-3 h-3" />
                            {sub.status === 'completed' ? 'Quiz done' : 'Quiz'}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {(sub.quizzes?.length ?? 0) > 0 && (
                      <p className="text-[11px] text-slate-500 mt-2 ml-7">
                        {n === 0 ? 'No quiz attempts yet.' : `${n} quiz attempt${n === 1 ? '' : 's'} — expand to review answers.`}
                      </p>
                    )}
                    {n > 0 && (
                      <div className="mt-3 ml-7 space-y-2">
                        {attempts.map((att, idx) => (
                          <QuizAttemptBlock
                            key={att.id}
                            att={att}
                            attemptNumber={attempts.length - idx}
                            questionLookup={questionLookup}
                          />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {hasFinalTest && (
          <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-sm font-bold text-slate-800">Final topic test</span>
              {topic.finalTestScore ? (
                <span className="text-[10px] font-extrabold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Passed
                </span>
              ) : (
                <span className="text-[10px] font-extrabold text-slate-500">After all modules</span>
              )}
            </div>
            {finalAttempts(topicStatus).length === 0 ? (
              <p className="text-[11px] text-slate-500">No final test attempts yet.</p>
            ) : (
              <div className="space-y-2 mt-3">
                {finalAttempts(topicStatus).map((att, idx) => (
                  <QuizAttemptBlock
                    key={att.id}
                    att={att}
                    attemptNumber={finalAttempts(topicStatus).length - idx}
                    questionLookup={questionLookup}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
