/** Student-facing recall payload for a saved AI coaching session (mirrors Firestore `aiSessions`). */
export type AiCoachingSessionSummary = {
  id: string;
  createdAtLabel: string;
  mistakeCount: number;
  lessonCount: number;
  drillCount: number;
  /** Present when API is called with `detail=1` — full recall of generated coach content. */
  lessonCards?: Array<{ title: string; content: string; latex?: string }>;
  mistakes?: Array<{
    questionId: string;
    mistakeTitle: string;
    whatWentWrong: string;
    likelyMisconception: string;
    fix: string;
    example: string;
  }>;
  drills?: Array<{
    prompt: string;
    hint: string;
    checkYourself: string;
    solution: string;
  }>;
  messages?: Array<{ role: 'tutor' | 'student'; content: string; timestamp: number }>;
};
