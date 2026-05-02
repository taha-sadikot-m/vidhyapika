import React from 'react';
import {
  CheckCircle2, Circle, Lock, Video, HelpCircle, ClipboardCheck, Network, ListOrdered,
} from 'lucide-react';
import type { StudentTopicProgress, Prerequisite } from '../types';
import type { SubStep } from '../utils/learningFlow';
import { isSubStepComplete } from '../utils/learningFlow';
import type { LearningStage, Phase } from '../utils/learningStageSelection';
import {
  isStageLocked,
  prereqCleared,
  stagesEqual,
  stageToSubStepIndex,
} from '../utils/learningStageSelection';

function RowButton({
  label,
  selected,
  done,
  locked,
  icon: Icon,
  indent,
  onClick,
}: {
  label: string;
  selected: boolean;
  done: boolean;
  locked: boolean;
  icon: React.ComponentType<{ className?: string }>;
  indent: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      className={`w-full text-left flex items-start gap-2 py-2 px-3 rounded-xl text-sm transition-colors ${
        selected
          ? 'bg-[#0084B4]/15 text-slate-900 font-extrabold ring-1 ring-[#0084B4]/30'
          : locked
            ? 'text-slate-400 cursor-not-allowed opacity-70'
            : 'text-slate-700 hover:bg-slate-100 font-semibold'
      } ${indent ? 'ml-4' : ''}`}
    >
      {locked ? (
        <Lock className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
      ) : done ? (
        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
      ) : (
        <Circle className="w-4 h-4 shrink-0 mt-0.5 text-slate-300" />
      )}
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${selected ? 'text-[#0084B4]' : 'text-slate-500'}`} />
      <span className="leading-snug min-w-0">{label}</span>
    </button>
  );
}

export function TopicLearningOutline({
  topic,
  prereqs,
  subSteps,
  hasFinalTest,
  learningPhase,
  currentStage,
  onSelectStage,
}: {
  topic: StudentTopicProgress;
  prereqs: Prerequisite[];
  subSteps: SubStep[];
  hasFinalTest: boolean;
  learningPhase: Phase;
  currentStage: LearningStage;
  onSelectStage: (s: LearningStage) => void;
}) {
  const cleared = prereqCleared(topic, prereqs);

  const preEvalComplete =
    (topic.preEvaluationQuiz?.length ?? 0) > 0 && !!topic.preEvaluationScore;

  function prereqDone(index: number): boolean {
    return (topic.prerequisiteScores?.length ?? 0) > index;
  }

  function subtopicVideoDone(subId: string): boolean {
    const s = topic.subTopics.find((x) => x.id === subId);
    if (!s?.videoUrl) return true;
    return !!s.videoWatched;
  }

  function subtopicQuizDone(subId: string): boolean {
    const s = topic.subTopics.find((x) => x.id === subId);
    return s?.status === 'completed';
  }

  function preEvalStageDone(): boolean {
    const idx = subSteps.findIndex((s) => s.kind === 'eval-quiz' && s.label === 'Pre-Evaluation');
    if (idx < 0) return true;
    return isSubStepComplete(subSteps[idx]!, topic);
  }

  return (
    <div className="p-4 space-y-6">
      <div>
        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-1 mb-2 flex items-center gap-1.5">
          <ListOrdered className="w-3.5 h-3.5" /> Topic path
        </p>
        <p className="text-xs text-slate-500 px-1 mb-3 leading-relaxed">
          {cleared ? 'Prerequisites cleared.' : 'Complete prerequisites to unlock modules.'}
        </p>
      </div>

      {(topic.preEvaluationQuiz?.length ?? 0) > 0 && (
        <section>
          <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider px-1 mb-1">Warm-up</p>
          <RowButton
            label="Pre-Evaluation"
            selected={stagesEqual(currentStage, { kind: 'pre-eval' })}
            done={preEvalStageDone()}
            locked={isStageLocked({ kind: 'pre-eval' }, topic, subSteps, prereqs, hasFinalTest)}
            icon={ClipboardCheck}
            indent={false}
            onClick={() => onSelectStage({ kind: 'pre-eval' })}
          />
        </section>
      )}

      {prereqs.length > 0 && (
        <section>
          <p className="text-[10px] font-extrabold text-purple-800 uppercase tracking-wider px-1 mb-1 flex items-center gap-1">
            <Network className="w-3 h-3" /> Prerequisites
          </p>
          <div className="space-y-0.5">
            {prereqs.map((p, i) => {
              const st: LearningStage = { kind: 'prereq', index: i };
              return (
                <RowButton
                  key={p.id}
                  label={p.title}
                  selected={stagesEqual(currentStage, st)}
                  done={prereqDone(i)}
                  locked={isStageLocked(st, topic, subSteps, prereqs, hasFinalTest)}
                  icon={Network}
                  indent={false}
                  onClick={() => onSelectStage(st)}
                />
              );
            })}
          </div>
        </section>
      )}

      <section>
        <p className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider px-1 mb-2">Modules</p>
        {topic.subTopics.length === 0 ? (
          <p className="text-xs text-slate-500 px-1">No modules in this topic.</p>
        ) : (
          <ul className="space-y-3">
            {topic.subTopics.map((sub, mi) => (
              <li key={sub.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2">
                <p className="text-[11px] font-extrabold text-slate-500 px-2 py-1">
                  {mi + 1}. {sub.title}
                </p>
                <div className="space-y-0.5 mt-1">
                  {sub.videoUrl ? (
                    <RowButton
                      label="Video"
                      selected={stagesEqual(currentStage, {
                        kind: 'subtopic',
                        subTopicId: sub.id,
                        part: 'video',
                      })}
                      done={subtopicVideoDone(sub.id)}
                      locked={isStageLocked(
                        { kind: 'subtopic', subTopicId: sub.id, part: 'video' },
                        topic,
                        subSteps,
                        prereqs,
                        hasFinalTest
                      )}
                      icon={Video}
                      indent
                      onClick={() =>
                        onSelectStage({ kind: 'subtopic', subTopicId: sub.id, part: 'video' })
                      }
                    />
                  ) : null}
                  {(sub.quizzes?.length ?? 0) > 0 ? (
                    <RowButton
                      label="Quiz"
                      selected={stagesEqual(currentStage, {
                        kind: 'subtopic',
                        subTopicId: sub.id,
                        part: 'quiz',
                      })}
                      done={subtopicQuizDone(sub.id)}
                      locked={isStageLocked(
                        { kind: 'subtopic', subTopicId: sub.id, part: 'quiz' },
                        topic,
                        subSteps,
                        prereqs,
                        hasFinalTest
                      )}
                      icon={HelpCircle}
                      indent
                      onClick={() =>
                        onSelectStage({ kind: 'subtopic', subTopicId: sub.id, part: 'quiz' })
                      }
                    />
                  ) : null}
                  {!sub.videoUrl && (sub.quizzes?.length ?? 0) === 0 ? (
                    <p className="text-xs text-slate-400 px-3 py-2">No video or quiz</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {hasFinalTest && (
        <section>
          <p className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider px-1 mb-1">Finish</p>
          <RowButton
            label="Final topic test"
            selected={stagesEqual(currentStage, { kind: 'final-test' })}
            done={!!topic.finalTestScore}
            locked={isStageLocked({ kind: 'final-test' }, topic, subSteps, prereqs, hasFinalTest)}
            icon={ClipboardCheck}
            indent={false}
            onClick={() => onSelectStage({ kind: 'final-test' })}
          />
        </section>
      )}

      {(learningPhase === 'complete' || topic.status === 'completed') && (
        <section>
          <RowButton
            label="Topic completed — summary"
            selected={stagesEqual(currentStage, { kind: 'complete-summary' })}
            done
            locked={false}
            icon={CheckCircle2}
            indent={false}
            onClick={() => onSelectStage({ kind: 'complete-summary' })}
          />
        </section>
      )}
    </div>
  );
}
