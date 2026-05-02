import type { StudentTopicProgress, Prerequisite } from '../types';
import type { SubStep } from './learningFlow';
import { allSubStepsComplete, isSubStepComplete } from './learningFlow';

export type Phase = 'complete' | 'prereq' | 'subtopic' | 'final-test';

export type LearningStage =
  | { kind: 'pre-eval' }
  | { kind: 'prereq'; index: number }
  | { kind: 'subtopic'; subTopicId: string; part: 'video' | 'quiz' }
  | { kind: 'final-test' }
  | { kind: 'complete-summary' };

export function prereqCleared(topic: StudentTopicProgress, prereqs: Prerequisite[]): boolean {
  return prereqs.length === 0 || (topic.prerequisiteScores?.length ?? 0) >= prereqs.length;
}

export function deriveDefaultStage(
  topic: StudentTopicProgress,
  flow: {
    startPhase: Phase;
    startPrereqIdx: number;
    startSubStepIdx: number;
    subSteps: SubStep[];
  }
): LearningStage {
  return indicesToStage(flow.startPhase, flow.startPrereqIdx, flow.startSubStepIdx, flow.subSteps);
}

export function indicesToStage(
  phase: Phase,
  prereqIdx: number,
  subStepIdx: number,
  subSteps: SubStep[]
): LearningStage {
  if (phase === 'complete') return { kind: 'complete-summary' };
  if (phase === 'final-test') return { kind: 'final-test' };
  if (phase === 'prereq') return { kind: 'prereq', index: prereqIdx };
  const step = subSteps[subStepIdx];
  if (!step) return { kind: 'complete-summary' };
  if (step.kind === 'eval-quiz' && step.label === 'Pre-Evaluation') return { kind: 'pre-eval' };
  if (step.kind === 'video') return { kind: 'subtopic', subTopicId: step.sub.id, part: 'video' };
  if (step.kind === 'quiz') return { kind: 'subtopic', subTopicId: step.sub.id, part: 'quiz' };
  return { kind: 'complete-summary' };
}

export function stageToIndices(
  stage: LearningStage,
  subSteps: SubStep[]
): { phase: Phase; prereqIdx: number; subStepIdx: number } {
  switch (stage.kind) {
    case 'complete-summary':
      return { phase: 'complete', prereqIdx: 0, subStepIdx: 0 };
    case 'final-test':
      return {
        phase: 'final-test',
        prereqIdx: 0,
        subStepIdx: subSteps.length > 0 ? subSteps.length - 1 : 0,
      };
    case 'prereq':
      return { phase: 'prereq', prereqIdx: stage.index, subStepIdx: 0 };
    case 'pre-eval': {
      const i = subSteps.findIndex((s) => s.kind === 'eval-quiz' && s.label === 'Pre-Evaluation');
      return { phase: 'subtopic', prereqIdx: 0, subStepIdx: i >= 0 ? i : 0 };
    }
    case 'subtopic': {
      const idx = subSteps.findIndex((s) => {
        if (stage.part === 'video') return s.kind === 'video' && s.sub.id === stage.subTopicId;
        return s.kind === 'quiz' && s.sub.id === stage.subTopicId;
      });
      return { phase: 'subtopic', prereqIdx: 0, subStepIdx: idx >= 0 ? idx : 0 };
    }
  }
}

export function stagesEqual(a: LearningStage, b: LearningStage): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'prereq' && b.kind === 'prereq') return a.index === b.index;
  if (a.kind === 'subtopic' && b.kind === 'subtopic')
    return a.subTopicId === b.subTopicId && a.part === b.part;
  return true;
}

/** Step index in subSteps for this stage; -1 if N/A */
export function stageToSubStepIndex(stage: LearningStage, subSteps: SubStep[]): number {
  if (stage.kind === 'pre-eval') {
    return subSteps.findIndex((s) => s.kind === 'eval-quiz' && s.label === 'Pre-Evaluation');
  }
  if (stage.kind === 'subtopic') {
    return subSteps.findIndex((s) => {
      if (stage.part === 'video') return s.kind === 'video' && s.sub.id === stage.subTopicId;
      return s.kind === 'quiz' && s.sub.id === stage.subTopicId;
    });
  }
  return -1;
}

export function isPreEvalLocked(): boolean {
  return false;
}

export function isPrereqStageLocked(index: number, topic: StudentTopicProgress): boolean {
  return index > (topic.prerequisiteScores?.length ?? 0);
}

export function isSubtopicStageLocked(
  stage: Extract<LearningStage, { kind: 'subtopic' }>,
  topic: StudentTopicProgress,
  subSteps: SubStep[],
  prereqs: Prerequisite[]
): boolean {
  if (!prereqCleared(topic, prereqs)) return true;
  const targetIdx = stageToSubStepIndex(stage, subSteps);
  if (targetIdx < 0) return true;
  for (let j = 0; j < targetIdx; j++) {
    if (!isSubStepComplete(subSteps[j]!, topic)) return true;
  }
  if (stage.part === 'quiz') {
    const sub = topic.subTopics.find((s) => s.id === stage.subTopicId);
    if (sub?.videoUrl && !sub.videoWatched) return true;
  }
  return false;
}

export function isFinalTestStageLocked(
  topic: StudentTopicProgress,
  subSteps: SubStep[],
  hasFinalTest: boolean,
  prereqs: Prerequisite[]
): boolean {
  if (!hasFinalTest) return true;
  if (!prereqCleared(topic, prereqs)) return true;
  return !allSubStepsComplete(subSteps, topic);
}

export function isStageLocked(
  stage: LearningStage,
  topic: StudentTopicProgress,
  subSteps: SubStep[],
  prereqs: Prerequisite[],
  hasFinalTest: boolean
): boolean {
  switch (stage.kind) {
    case 'pre-eval':
      return isPreEvalLocked();
    case 'prereq':
      return isPrereqStageLocked(stage.index, topic);
    case 'subtopic':
      return isSubtopicStageLocked(stage, topic, subSteps, prereqs);
    case 'final-test':
      return isFinalTestStageLocked(topic, subSteps, hasFinalTest, prereqs);
    case 'complete-summary':
      return false;
    default:
      return false;
  }
}
