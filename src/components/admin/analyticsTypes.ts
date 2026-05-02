export type FlagEntry = {
  id: string;
  studentName: string;
  studentEmail: string;
  topicName: string;
  subTopicName?: string;
  flagType: string;
  flaggedAt: unknown;
};

export type TopicStat = {
  topicId: string;
  topicName: string;
  topicOrder: number;
  classId: string;
  className: string;
  standardId: string;
  standardName: string;
  enrolled: number;
  prereqAttempted: number;
  prereqPassed: number;
  contentUnlocked: number;
  finalTestPassed: number;
  flaggedCount: number;
  avgPrereqAttempts: number;
  avgFinalAttempts: number;
  prereqPassRate: number;
  finalPassRate: number;
  aiInterventionRate: number;
  completionRate: number;
};

export type ClassStat = {
  classId: string;
  className: string;
  standardId: string;
  standardName: string;
  enrolled: number;
  topicCount: number;
  avgPrereqPassRate: number;
  avgFinalPassRate: number;
  flaggedCount: number;
};

export type PlatformSummary = {
  avgPassRate: number;
  avgAIInterventionRate: number;
  avgCompletionRate: number;
  totalAttempts: number;
  totalTopicsWithData: number;
};
