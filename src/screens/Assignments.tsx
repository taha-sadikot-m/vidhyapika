import React from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { motion } from 'motion/react';
import { Clock, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import { AssignmentCard } from '../components/AssignmentCard';
import { useApiGet } from '../hooks/useApi';
import type { Assignment } from '../types';

type ApiAssignment = {
  id: string;
  title: string;
  dueAt: string | null;
  type: string;
  status: string;
  submission: { status: 'not_submitted' | 'submitted' | 'graded'; score: number | null; feedback: string | null };
};

export function Assignments() {
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

  const { data, loading: isLoading, error } = useApiGet<{ assignments: ApiAssignment[]; class: { id: string; name: string } | null }>(
    '/api/student/assignments',
    []
  );

  const mapped: Assignment[] = (data?.assignments ?? []).map((a, idx) => {
    const due = a.dueAt ? new Date(a.dueAt).toLocaleDateString() : 'No due date';
    const status: Assignment['status'] =
      a.submission.status === 'graded' || a.submission.status === 'submitted' ? 'completed' : 'pending';
    const score = a.submission.score != null ? `${a.submission.score}` : undefined;

    return {
      id: idx + 1,
      title: a.title,
      subject: (data?.class?.name ?? 'Class'),
      dueDate: due,
      status,
      progress: 0,
      score,
    };
  });

  const todo = mapped.filter((a) => a.status !== 'completed');
  const inProgress: Assignment[] = [];
  const completed = mapped.filter((a) => a.status === 'completed');

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
            <h1 className="text-2xl font-extrabold text-slate-900">Assignments</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Track your tasks and deadlines.</p>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Calendar View
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-sm font-semibold text-slate-600">
            Loading assignments…
          </div>
        )}
        {error && (
          <div className="bg-white rounded-2xl border border-red-200 p-6 text-sm font-semibold text-red-600">
            {String((error as any)?.message ?? error)}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* To Do Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                To Do
              </h2>
              <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-full">{todo.length}</span>
            </div>
            
            {todo.map(assignment => (
              <AssignmentCard key={assignment.id} assignment={assignment} variants={itemVariants} />
            ))}
          </div>

          {/* In Progress Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                In Progress
              </h2>
              <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-full">{inProgress.length}</span>
            </div>

            {inProgress.map(assignment => (
              <AssignmentCard key={assignment.id} assignment={assignment} variants={itemVariants} />
            ))}
          </div>

          {/* Completed Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Completed
              </h2>
              <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-full">{completed.length}</span>
            </div>

            {completed.map(assignment => (
              <AssignmentCard key={assignment.id} assignment={assignment} variants={itemVariants} />
            ))}
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
