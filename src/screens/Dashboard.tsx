import React, { useMemo } from 'react';
import { Award, BookOpen, CheckCircle2, ChevronRight, PlayCircle, HelpCircle, Layers, Bot, Flame, TrendingUp } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { LearningPath } from '../components/LearningPath';
import { ProgressRing } from '../components/ui/ProgressRing';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useApiGet } from '../hooks/useApi';

const EMPTY_CURRICULUM = {
  standard: '',
  className: '',
  topics: [] as any[],
  completedTopics: 0,
  totalTopics: 0,
  overallProgress: 0,
  aiSessionCount: 0,
};

const QUICK_LINKS = [
  { id: 1, title: 'Curriculum', icon: BookOpen, color: 'text-blue-600', path: '/courses' },
  { id: 2, title: 'Assignments', icon: CheckCircle2, color: 'text-emerald-600', path: '/assignments' },
  { id: 3, title: 'Schedule', icon: TrendingUp, color: 'text-indigo-600', path: '/schedule' },
  { id: 4, title: 'Achievements', icon: Award, color: 'text-amber-600', path: '/achievements' },
];

export function Dashboard() {
  const navigate = useNavigate();
  const { data: curriculumData, loading: curriculumLoading, error: curriculumError } =
    useApiGet<{ curriculums: any[]; message?: string }>('/api/student/curriculum');
  const { data: meData } = useApiGet<{ user: { name: string | null; email: string } }>('/api/student/me', []);
  const { data: achievementsData } = useApiGet<{ streakDays: number; totalPoints: number; badges: { key: string; title: string; description: string; unlocked: boolean }[] }>('/api/student/achievements', []);
  const { data: assignmentsData } = useApiGet<{ assignments: any[] }>('/api/student/assignments', []);
  const today = new Date();
  const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const { data: todaySchedule } = useApiGet<{ events: any[] }>(`/api/student/schedule?start=${start}&end=${start}`, []);
  const { data: activityData } = useApiGet<{ items: { id: string; title: string; timestamp: string | null; meta: string }[] }>('/api/student/activity?limit=6', []);

  const hasReal = !curriculumLoading && curriculumData?.curriculums && curriculumData.curriculums.length > 0;

  const classesStats = useMemo(() => {
    if (!hasReal || !curriculumData?.curriculums) return [];
    return curriculumData.curriculums.map((c: any) => {
      const topics = (c.topics ?? []).map((t: any) => {
        const prog = t.progress;
        const subTopics = t.subTopics ?? [];
        const done = subTopics.filter((st: any) => st.progress?.quizStatus === 'passed').length;
        return {
          id: t.id,
          title: t.name,
          status: prog?.completedAt ? 'completed' : (prog ? 'in-progress' : 'not-started'),
          progress: subTopics.length > 0 ? Math.round((done / subTopics.length) * 100) : 0,
          prerequisites: t.prerequisite ? [t.prerequisite] : [],
          subtopicsCompleted: done,
          totalSubtopics: subTopics.length,
          finalTestQuiz: t.finalTestQuestions ?? [],
          subTopics: subTopics.map((st: any) => ({
            id: st.id,
            title: st.name,
            status: st.progress?.quizStatus === 'passed' ? 'completed' : (st.progress ? 'in-progress' : 'not-started'),
            videoUrl: st.youtubeUrl,
            videoWatched: st.progress?.videoWatched ?? false,
            quizzes: st.questions ?? [],
          })),
        };
      });
      const completedTopics = topics.filter((t: any) => t.status === 'completed').length;
      const totalTopics = topics.length;
      const overallProgress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
      
      const totalSubTopics = (c.topics ?? []).reduce((a: number, t: any) => a + (t.subTopics?.length ?? 0), 0);
      const doneSubTopics = (c.topics ?? []).reduce((a: number, t: any) => 
        a + (t.subTopics ?? []).filter((st: any) => st.progress?.quizStatus === 'passed').length, 0);

      return {
        classId: c.classId,
        className: c.className || 'Class',
        completedTopics,
        totalTopics,
        overallProgress,
        totalSubTopics,
        doneSubTopics,
        topics,
      };
    });
  }, [hasReal, curriculumData]);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  const totalSubTopics = classesStats.reduce((a, c) => a + c.totalSubTopics, 0);
  const doneSubTopics = classesStats.reduce((a, c) => a + c.doneSubTopics, 0);
  const completedTopics = classesStats.reduce((a, c) => a + c.completedTopics, 0);
  const totalTopics = classesStats.reduce((a, c) => a + c.totalTopics, 0);
  const passRate = totalSubTopics > 0 ? Math.round((doneSubTopics / totalSubTopics) * 100) : 0;

  const streakDays      = achievementsData?.streakDays ?? 0;
  const aiSessionTotal  = 0; // Keeping 0 for now
  const displayName     = meData?.user?.name ?? (meData?.user?.email?.split('@')?.[0] ?? 'Student');

  const pendingAssignments = (assignmentsData?.assignments ?? []).filter((a: any) => a.submission?.status === 'not_submitted');
  const dashboardAssignments = pendingAssignments.slice(0, 3).map((a: any) => ({
    id: a.id,
    due: a.dueAt ? new Date(a.dueAt).toLocaleDateString() : 'No due date',
    title: a.title,
    subject: 'Assignment',
    isUrgent: a.dueAt ? (new Date(a.dueAt).getTime() - Date.now()) < 48 * 60 * 60 * 1000 : false,
  }));

  const dashboardSchedule = (todaySchedule?.events ?? []).slice(0, 3).map((e: any) => ({
    id: e.id,
    time: e.startsAt ? new Date(e.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    title: e.title,
    teacher: '',
    type: e.type === 'live' ? 'live' : 'workshop',
  }));

  const badges = (achievementsData?.badges ?? []).slice(0, 6).map((b, idx) => ({
    id: idx + 1,
    title: b.title,
    unlocked: b.unlocked,
  }));

  return (
    <DashboardLayout>
      <motion.div variants={containerVariants} initial="hidden" animate="show"
        className="w-full max-w-[1600px] mx-auto space-y-6">

        {/* Loading / error / not enrolled states */}
        {curriculumLoading && (
          <motion.div variants={itemVariants} className="bg-white rounded-2xl border border-slate-200 p-8 flex items-center justify-center gap-3 text-slate-400 text-sm">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Loading your dashboard…
          </motion.div>
        )}

        {!curriculumLoading && curriculumError && (
          <motion.div variants={itemVariants} className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-800">Could not load your curriculum</p>
              <p className="text-xs text-red-600 mt-0.5">{curriculumError}</p>
            </div>
          </motion.div>
        )}

        {!curriculumLoading && !curriculumError && classesStats.length === 0 && (
          <motion.div variants={itemVariants} className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-amber-700" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-extrabold text-amber-900">Not enrolled in any class yet</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {curriculumData?.message ?? 'Ask your admin/teacher to enroll you to start learning.'}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Welcome Banner */}
        {classesStats.length > 0 && (
          <motion.div variants={itemVariants} className="flex flex-col gap-6">
            <div className="bg-gradient-to-r from-[#006A91] via-[#0084B4] to-[#00A8C8] rounded-3xl p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between relative overflow-hidden shadow-lg">
               <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-10 pointer-events-none hidden md:block">
                 <svg viewBox="0 0 400 300" fill="none" className="w-full h-full">
                   <circle cx="350" cy="50" r="120" fill="white" />
                   <circle cx="250" cy="250" r="80" fill="white" />
                 </svg>
               </div>
               <div className="relative z-10 space-y-3 text-center md:text-left max-w-xl">
                 <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                   <span>Welcome back, {displayName}!</span>{' '}
                   <span className="inline-flex align-middle"><Award className="w-6 h-6 text-white/90" /></span>
                 </h1>
                 <p className="text-blue-100 font-medium text-sm sm:text-base">
                   You are enrolled in {classesStats.length} {classesStats.length === 1 ? 'class' : 'classes'}. Select one below to continue your learning journey.
                 </p>
               </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-extrabold text-slate-900 px-1">Your Enrolled Classes</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classesStats.map((cls: any) => (
                  <button key={cls.classId} onClick={() => navigate(`/courses?classId=${cls.classId}`)} 
                    className="text-left bg-white border border-slate-200 hover:border-[#0084B4] hover:shadow-lg transition-all rounded-3xl p-6 group relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 opacity-50 group-hover:scale-110 transition-transform duration-500 pointer-events-none" />
                     <div className="flex justify-between items-start mb-6 relative z-10">
                       <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/50 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:shadow-sm transition-all duration-300">
                         <Layers className="w-6 h-6 text-[#0084B4]" />
                       </div>
                       <div className="text-right">
                         <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-0.5">Topics</p>
                         <p className="text-xl font-black text-slate-800">{cls.completedTopics}<span className="text-sm font-bold text-slate-400">/{cls.totalTopics}</span></p>
                       </div>
                     </div>
                     <h3 className="text-xl font-extrabold text-slate-900 mb-4 line-clamp-2 relative z-10">{cls.className}</h3>
                     <div className="space-y-2.5 relative z-10">
                       <div className="flex justify-between items-center text-xs font-bold">
                         <span className="text-slate-500">Class Progress</span>
                         <span className="text-[#0084B4]">{cls.overallProgress}%</span>
                       </div>
                       <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                         <div className="h-full bg-gradient-to-r from-[#006A91] to-[#00A8C8] rounded-full transition-all duration-1000" style={{ width: `${cls.overallProgress}%` }} />
                       </div>
                     </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Topics Completed', value: `${completedTopics}/${totalTopics}`, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'Current Streak',   value: `${streakDays} Days`,                                       icon: Flame,         color: 'text-orange-600', bg: 'bg-orange-50',  border: 'border-orange-100' },
            { label: 'AI Sessions Used', value: aiSessionTotal.toString(),                                   icon: Bot,           color: 'text-indigo-600', bg: 'bg-indigo-50',  border: 'border-indigo-100' },
            { label: 'Quiz Pass Rate',   value: `${passRate}%`,                                              icon: TrendingUp,    color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-100'   },
          ].map(stat => (
            <motion.div key={stat.label} variants={itemVariants}
              className={`bg-white rounded-2xl p-4 border ${stat.border} shadow-sm flex items-center gap-3`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${stat.bg}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xl font-extrabold text-slate-900">{stat.value}</p>
                <p className="text-xs font-bold text-slate-400">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main content: roadmap + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Learning Roadmap (left 2/3) */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Global Learning Path</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Your upcoming topics across all classes</p>
                </div>
              </div>
              <LearningPath topics={classesStats.flatMap(c => c.topics)} />
            </motion.div>

            {/* Recent Activity + Quick Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <h2 className="text-lg font-bold text-slate-800 mb-5">Recent Activity</h2>
                <div className="space-y-5">
                  {(activityData?.items ?? []).length === 0 ? (
                    <div className="text-sm font-semibold text-slate-500">No activity yet.</div>
                  ) : (
                    (activityData?.items ?? []).map((activity) => (
                      <div key={activity.id} className="flex gap-4">
                        <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-slate-800 leading-tight mb-0.5">{activity.title}</h4>
                          <p className="text-xs text-slate-500 font-medium">
                            {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : ''} {activity.meta ? `· ${activity.meta}` : ''}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>

              <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <h2 className="text-lg font-bold text-slate-800 mb-5">Quick Links</h2>
                <div className="grid grid-cols-2 gap-3">
                  {QUICK_LINKS.map(link => (
                    <button
                      key={link.id}
                      onClick={() => navigate(link.path)}
                      className="flex flex-col items-center justify-center p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors gap-2.5"
                    >
                      <link.icon className={`w-7 h-7 ${link.color}`} />
                      <span className="text-xs font-bold text-slate-700">{link.title}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">

            {/* Assignments */}
            <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-lg font-bold text-slate-800">Assignments</h2>
                <span className="bg-blue-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">{pendingAssignments.length} Pending</span>
              </div>
              <div className="space-y-4">
                {dashboardAssignments.length === 0 ? (
                  <div className="text-sm font-semibold text-slate-500">No pending assignments.</div>
                ) : dashboardAssignments.map(a => (
                  <div key={a.id} className="relative pl-4">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-full ${a.isUrgent ? 'bg-red-500' : 'bg-[#0084B4]'}`} />
                    <p className={`text-xs font-bold mb-0.5 ${a.isUrgent ? 'text-red-500' : 'text-slate-500'}`}>{a.due}</p>
                    <h4 className="text-sm font-bold text-slate-800 mb-0.5">{a.title}</h4>
                    <p className="text-xs text-slate-500 font-medium">{a.subject}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Today's Schedule */}
            <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 mb-5">Today's Schedule</h2>
              <div className="space-y-3">
                {dashboardSchedule.length === 0 ? (
                  <div className="text-sm font-semibold text-slate-500">No events today.</div>
                ) : dashboardSchedule.map(item => (
                  <div key={item.id} className="flex gap-3">
                    <div className="text-right min-w-[58px] pt-1 shrink-0">
                      <p className="text-xs font-bold text-slate-800">{item.time}</p>
                    </div>
                    <div className="flex-1 border border-slate-100 rounded-xl p-3 relative overflow-hidden">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.type === 'live' ? 'bg-[#7CB342]' : 'bg-[#0084B4]'}`} />
                      <h4 className="text-sm font-bold text-slate-800 mb-0.5">{item.title}</h4>
                      <p className="text-xs text-slate-500">{item.teacher}</p>
                      {item.type === 'live' && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#7CB342] animate-pulse" />
                          <span className="text-[10px] font-bold text-[#7CB342]">Live</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 bg-gradient-to-r from-[#7CB342] to-[#8BC34A] rounded-2xl p-4 flex items-center gap-3 text-white shadow-sm">
                <div className="bg-white/20 p-2 rounded-xl shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">Weekly Challenge</h4>
                  <p className="text-xs text-white/90">Complete your next topic today</p>
                </div>
              </div>
            </motion.div>

            {/* Badges Strip */}
            <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-lg font-bold text-slate-800">Badges</h2>
                <button onClick={() => navigate('/achievements')} className="text-sm font-bold text-[#0084B4] hover:underline flex items-center gap-1">
                  All <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {badges.length === 0 ? (
                  <div className="text-sm font-semibold text-slate-500 col-span-3">No badges yet.</div>
                ) : badges.map((badge) => (
                  <div key={badge.id} className={`flex flex-col items-center p-3 rounded-2xl border transition-all ${badge.unlocked ? `bg-emerald-50 border-transparent` : 'bg-slate-50 border-slate-100 opacity-50 grayscale'}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-1.5 ${badge.unlocked ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                      <Award className={`w-5 h-5 ${badge.unlocked ? 'text-emerald-600' : 'text-slate-400'}`} />
                    </div>
                    <p className="text-[10px] font-bold text-center text-slate-700 leading-tight">{badge.title}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}

