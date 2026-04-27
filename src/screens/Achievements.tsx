import React from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { motion } from 'motion/react';
import { Award, Trophy, Star, Zap, Target, Crown } from 'lucide-react';
import { useApiGet } from '../hooks/useApi';

export function Achievements() {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  const { data, loading: isLoading, error } = useApiGet<{
    streakDays: number;
    totalPoints: number;
    badges: { key: string; title: string; description: string; unlocked: boolean }[];
  }>('/api/student/achievements', []);

  const badges = data?.badges ?? [];
  const earnedCount = badges.filter((b) => b.unlocked).length;

  return (
    <DashboardLayout>
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="w-full max-w-[1600px] mx-auto space-y-6"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Achievements</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Track your progress and earn rewards.</p>
          </div>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <motion.div variants={itemVariants} className="bg-gradient-to-br from-[#0084B4] to-[#006A91] rounded-3xl p-6 text-white shadow-md relative overflow-hidden">
            <Trophy className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10" />
            <div className="relative z-10">
              <p className="text-blue-100 font-bold text-sm uppercase tracking-wider mb-1">Total Points</p>
              <h2 className="text-4xl font-extrabold">{data?.totalPoints ?? 0}</h2>
              <p className="text-sm font-medium text-blue-100 mt-4">Points earned from quizzes, videos, and completions</p>
            </div>
          </motion.div>
          
          <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
            <div className="w-16 h-16 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-3">
              <Zap className="w-8 h-8" />
            </div>
            <p className="text-slate-500 font-bold text-sm uppercase tracking-wider mb-1">Current Streak</p>
            <h2 className="text-3xl font-extrabold text-slate-900">{data?.streakDays ?? 0} Days</h2>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
            <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-3">
              <Star className="w-8 h-8" />
            </div>
            <p className="text-slate-500 font-bold text-sm uppercase tracking-wider mb-1">Badges Earned</p>
            <h2 className="text-3xl font-extrabold text-slate-900">{earnedCount} / {badges.length}</h2>
          </motion.div>
        </div>

        {/* Badges Grid */}
        <motion.div variants={itemVariants} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-6">Your Badges</h2>
          {isLoading && (
            <div className="text-sm font-semibold text-slate-600">Loading achievements…</div>
          )}
          {error && (
            <div className="text-sm font-semibold text-red-600">{String((error as any)?.message ?? error)}</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {badges.map((badge, idx) => (
              <div 
                key={badge.key ?? idx} 
                className={`p-5 rounded-2xl border transition-all ${
                  badge.unlocked 
                    ? 'border-slate-200 bg-white hover:shadow-md' 
                    : 'border-slate-100 bg-slate-50 opacity-60 grayscale'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${badge.unlocked ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 mb-1">{badge.title}</h3>
                    <p className="text-xs font-medium text-slate-500 leading-snug">{badge.description}</p>
                    {!badge.unlocked && (
                      <div className="mt-3 w-full bg-slate-200 rounded-full h-1.5">
                        <div className="bg-slate-400 h-1.5 rounded-full" style={{ width: '40%' }}></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
