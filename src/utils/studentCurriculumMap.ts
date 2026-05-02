import type { Question, StudentTopicProgress } from '../types';

export function mapApiQuestionToStudent(q: any): Question {
  return {
    id: q.id,
    text: q.text ?? '',
    type:
      q.type === 'true_false'
        ? ('boolean' as const)
        : q.type === 'image_upload'
          ? ('image_upload' as const)
          : q.type === 'text'
            ? ('text' as const)
            : ('mcq' as const),
    options: q.options,
    correctAnswer: q.correctAnswer ?? '',
    explanation: q.explanation ?? '',
    difficulty: (['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : 'Medium') as
      | 'Easy'
      | 'Medium'
      | 'Hard',
    imageUrl: q.imageUrl,
  };
}

function prerequisiteScoresFromApi(t: {
  progress?: { prereqStatus?: string };
  prerequisite?: { id: string; name?: string } | null;
}): StudentTopicProgress['prerequisiteScores'] {
  const prog = t.progress;
  const prereq = t.prerequisite;
  if (!prereq) return [];
  const st = prog?.prereqStatus;
  if (st === 'passed' || st === 'flagged') {
    return [
      {
        id: prereq.id,
        title: prereq.name ?? 'Prerequisite',
        score: 1,
        total: 1,
        date: '',
      },
    ];
  }
  return [];
}

function finalTestScoreFromApi(prog: any): StudentTopicProgress['finalTestScore'] {
  if (prog?.finalTestStatus === 'passed' || prog?.finalTestStatus === 'flagged' || prog?.completedAt) {
    return { score: 1, total: 1, date: '' };
  }
  return undefined;
}

/** Map one API topic (from /api/student/curriculum) to StudentTopicProgress for the player & roadmap. */
export function mapRawTopicToStudentTopic(t: any): StudentTopicProgress {
  const prog = t.progress;
  const subTopics = t.subTopics ?? [];
  const subTopicsDone = subTopics.filter((st: any) => {
    const qs = st.progress?.quizStatus;
    return qs === 'passed' || qs === 'flagged';
  }).length;
  const qmap = mapApiQuestionToStudent;
  return {
    id: t.id,
    title: t.name,
    status: prog?.completedAt
      ? 'completed'
      : (prog ? 'in-progress' : 'not-started') as 'completed' | 'in-progress' | 'not-started',
    progress: subTopics.length > 0 ? Math.round((subTopicsDone / subTopics.length) * 100) : 0,
    prerequisites: t.prerequisite
      ? [
          {
            id: t.prerequisite.id,
            title: t.prerequisite.name ?? 'Prerequisite Check',
            description: t.prerequisite.description,
            category: 'Intermediate' as const,
            passingThreshold: t.prerequisite.passingThreshold ?? 60,
            questions: (t.prerequisite.questions ?? []).map(qmap),
          },
        ]
      : [],
    prerequisiteScores: prerequisiteScoresFromApi(t),
    subtopicsCompleted: subTopicsDone,
    totalSubtopics: subTopics.length,
    finalTestQuiz: (t.finalTestQuestions ?? []).map(qmap),
    finalTestScore: finalTestScoreFromApi(prog),
    subTopics: subTopics.map((st: any) => {
      const quizList = (st.questions ?? []).map(qmap);
      const qs = st.progress?.quizStatus;
      const quizCleared = qs === 'passed' || qs === 'flagged';
      return {
        id: st.id,
        title: st.name,
        status: quizCleared
          ? 'completed'
          : st.progress
            ? 'in-progress'
            : ('not-started' as 'completed' | 'in-progress' | 'not-started'),
        videoUrl: st.youtubeUrl,
        videoWatched: st.progress?.videoWatched ?? false,
        quizzes: quizList,
        passingThreshold: st.passingThreshold ?? 60,
        quizScore:
          quizCleared && quizList.length > 0
            ? { score: 1, total: 1, date: '' }
            : undefined,
      };
    }),
  };
}
