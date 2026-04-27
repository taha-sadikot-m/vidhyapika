import { LucideIcon } from 'lucide-react';

export interface Course {
  id: number;
  title: string;
  instructor: string;
  progress: number;
  totalLessons: number;
  completedLessons: number;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  image: string;
}

export interface DashboardCourse {
  id: number;
  subject: string;
  unit: string;
  progress: number;
  completed: number;
  total: number;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

export interface Assignment {
  id: number;
  title: string;
  subject: string;
  dueDate: string;
  status: 'urgent' | 'pending' | 'completed';
  progress: number;
  score?: string;
}

export interface DashboardAssignment {
  id: number;
  title: string;
  subject: string;
  due: string;
  isUrgent: boolean;
}

export interface ScheduleEvent {
  id: number;
  time: string;
  duration: string;
  title: string;
  type: string;
  instructor: string;
  location: string;
  color: string;
  bgColor: string;
  icon: LucideIcon;
}

export interface DashboardSchedule {
  id: number;
  title: string;
  teacher: string;
  time: string;
  type: 'live' | 'workshop';
  icon: LucideIcon;
}

export interface Activity {
  id: number;
  title: string;
  time: string;
  meta: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

export interface QuickLink {
  id: number;
  title: string;
  icon: LucideIcon;
  color: string;
}

export interface Badge {
  id: number;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  unlocked: boolean;
}

export interface Question {
  id: string;
  text: string;
  type: 'text' | 'mcq' | 'boolean' | 'image_upload';
  options?: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  imageUrl?: string;
}

export interface QuizAttempt {
  score: number;
  total: number;
  date: string;
}

export interface Prerequisite {
  id: string;
  title: string;
  description?: string;
  category: 'Major' | 'Intermediate' | 'Minor';
  questions?: Question[];
  passingThreshold?: number; // 0-100 percentage required to pass
}

export interface SubTopic { 
  id: string; 
  title: string; 
  videoUrl?: string;
  quizzes?: Question[];
  sequenceOrder?: number;
}

export interface Topic { 
  id: string; 
  title: string; 
  sequence: number;
  sequenceOrder?: number;
  subTopics: SubTopic[]; 
  prerequisites?: Prerequisite[];
  preEvaluationQuiz?: Question[];
  postEvaluationQuiz?: Question[];
  finalTestQuiz?: Question[]; // Admin-set end-of-topic test separate from post-eval
}

// ── AI-Assisted Learning Types ──────────────────────────────────────────────

export interface AIMessage {
  id: string;
  role: 'tutor' | 'student';
  content: string;
  timestamp: string;
}

export interface AISession {
  id: string;
  topicId: string;
  subtopicId?: string;
  kind: 'prerequisite' | 'subtopic' | 'final-test';
  messages: AIMessage[];
  generatedQuiz?: Question[];
  date: string;
  resolved: boolean; // whether student eventually passed after AI help
}

export type LearningState =
  | 'prerequisite-gate'
  | 'prereq-quiz'
  | 'prereq-failed'
  | 'ai-teaching'
  | 'ai-quiz'
  | 'video'
  | 'subtopic-quiz'
  | 'subtopic-failed'
  | 'final-test-intro'
  | 'final-test'
  | 'final-test-failed'
  | 'topic-complete';

export interface QuizContext {
  kind: 'prerequisite' | 'subtopic' | 'final-test';
  isAIGenerated: boolean;
  emphasizedQuestionIds?: string[];
  topicTitle?: string;
  subtopicTitle?: string;
}

export interface StudentSubTopicProgress {
  id: string;
  title: string;
  status: 'completed' | 'in-progress' | 'not-started';
  videoUrl?: string;
  videoWatched?: boolean;
  quizzes?: Question[];
  quizScore?: {
    score: number;
    total: number;
    date: string;
    pastAnswers?: Record<string, string>;
    attempts?: QuizAttempt[];
  };
}

export interface StudentTopicProgress {
  id: string;
  title: string;
  status: 'completed' | 'in-progress' | 'not-started';
  progress: number;
  prerequisites?: Prerequisite[];
  prerequisiteScores: {
    id: string;
    title: string;
    score: number;
    total: number;
    date: string;
    attempts?: QuizAttempt[];
  }[];
  preEvaluationQuiz?: Question[];
  preEvaluationScore?: {
    score: number;
    total: number;
    date: string;
    pastAnswers?: Record<string, string>;
    attempts?: QuizAttempt[];
  };
  sectionEndScore?: {
    score: number;
    total: number;
    date: string;
    pastAnswers?: Record<string, string>;
    attempts?: QuizAttempt[];
  };
  postEvaluationQuiz?: Question[];
  postEvaluationScore?: {
    score: number;
    total: number;
    date: string;
    pastAnswers?: Record<string, string>;
    attempts?: QuizAttempt[];
  };
  finalTestQuiz?: Question[];
  finalTestScore?: {
    score: number;
    total: number;
    date: string;
    attempts?: QuizAttempt[];
  };
  subtopicsCompleted: number;
  totalSubtopics: number;
  subTopics: StudentSubTopicProgress[];
  aiSessions?: AISession[];
  aiSessionCount?: number;
}

export interface StudentCurriculumProgress {
  standard: string;
  className: string;
  topics: StudentTopicProgress[];
  overallProgress: number;
  completedTopics: number;
  totalTopics: number;
  aiSessionCount?: number;
  lastAISession?: string;
}
