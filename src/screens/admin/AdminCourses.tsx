import React, { useState } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { motion } from 'motion/react';
import { Search, Eye, RefreshCw, User, BookOpen, CheckCircle2, AlertTriangle, Brain } from 'lucide-react';
import { useApiGet, apiFetch } from '../../hooks/useApi';

type Student = {
  id: string;
  name: string | null;
  email: string;
  class_id?: string | null;
};

type FlaggedEntry = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  topicName: string;
  subTopicName?: string;
  flagType: string;
  flaggedAt: any;
};

export function AdminCourses() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const { data: studentsData, loading: studentsLoading } = useApiGet<{ students: Student[] }>('/api/admin/students');
  const { data: progressData, loading: progressLoading } = useApiGet<any>(
    selectedStudentId ? `/api/admin/students/${selectedStudentId}/progress` : '',
    [selectedStudentId]
  );

  const students = studentsData?.students ?? [];
  const filtered = students.filter(
    s => s.name?.toLowerCase().includes(searchTerm.toLowerCase()) || s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Student Progress</h1>
          <p className="text-sm text-slate-500 mt-1">View detailed learning progress for each student.</p>
        </div>

        <div className="flex gap-6">
          {/* Student list */}
          <div className="w-72 shrink-0 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search students…"
                className="pl-10 pr-4 py-2.5 w-full border border-slate-200 rounded-xl text-sm bg-white outline-none"
              />
            </div>

            {studentsLoading ? (
              <div className="py-8 flex justify-center">
                <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                {filtered.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-sm">No students found.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filtered.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStudentId(s.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${selectedStudentId === s.id ? 'bg-blue-50 border-l-2 border-blue-600' : ''}`}
                      >
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-extrabold shrink-0">
                          {(s.name ?? s.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{s.name ?? '—'}</p>
                          <p className="text-xs text-slate-500 truncate">{s.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Progress detail */}
          <div className="flex-1 min-w-0">
            {!selectedStudentId ? (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm py-24 flex flex-col items-center gap-4 text-center">
                <User className="w-12 h-12 text-slate-300" />
                <p className="text-slate-400 font-medium">Select a student to view their progress</p>
              </div>
            ) : progressLoading ? (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm py-24 flex justify-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : progressData ? (
              <div className="space-y-5">
                {/* Student header */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-extrabold">
                    {(progressData.student?.name ?? progressData.student?.email ?? 'S').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900">{progressData.student?.name ?? '—'}</h2>
                    <p className="text-sm text-slate-500">{progressData.student?.email}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-bold text-slate-500">
                        {progressData.quizAttempts?.length ?? 0} quiz attempts
                      </span>
                      <span className="text-xs font-bold text-indigo-600">
                        {progressData.aiSessions?.length ?? 0} AI sessions
                      </span>
                      {progressData.flags?.length > 0 && (
                        <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {progressData.flags.length} flagged
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Topics */}
                {progressData.topics?.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-extrabold text-slate-900">Topics</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {progressData.topics.map((topic: any) => {
                        const tp = progressData.topicProgress?.find((p: any) => p.topicId === topic.id);
                        return (
                          <div key={topic.id} className="px-5 py-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-bold text-slate-900">{topic.name}</p>
                              <div className="flex gap-2">
                                <StatusBadge status={tp?.prereqStatus ?? 'pending'} label="Prereq" />
                                <StatusBadge status={tp?.finalTestStatus ?? 'pending'} label="Final" />
                              </div>
                            </div>
                            {tp && (
                              <div className="flex gap-4 text-xs text-slate-500">
                                <span>Prereq attempts: {tp.prereqAttemptCount}</span>
                                <span>AI attempts: {tp.prereqAIAttemptCount}</span>
                                <span>Content unlocked: {tp.contentUnlocked ? 'Yes' : 'No'}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quiz attempts */}
                {progressData.quizAttempts?.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100">
                      <h3 className="font-extrabold text-slate-900">All Quiz Attempts ({progressData.quizAttempts.length})</h3>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                      {progressData.quizAttempts.map((a: any) => (
                        <div key={a.id} className="px-5 py-3 flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${a.passed ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <div className="flex-1">
                            <p className="text-sm font-bold text-slate-700 capitalize">{a.contextType}</p>
                            <p className="text-xs text-slate-500">{a.score}/{a.total} correct · {a.aiGenerated ? 'AI-generated test' : 'Admin-set test'}</p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${a.passed ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                            {a.passed ? 'Pass' : 'Fail'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Sessions */}
                {progressData.aiSessions?.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                      <Brain className="w-5 h-5 text-indigo-600" />
                      <h3 className="font-extrabold text-slate-900">AI Sessions ({progressData.aiSessions.length})</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {progressData.aiSessions.map((s: any) => (
                        <div key={s.id} className="px-5 py-3">
                          <p className="text-sm font-bold text-slate-800 capitalize">{s.contextType} session</p>
                          <p className="text-xs text-slate-500">{s.messages?.length ?? 0} messages · Status: {s.status}</p>
                          {s.lessonCards?.length > 0 && (
                            <p className="text-xs text-indigo-600 mt-0.5">{s.lessonCards.length} lesson cards generated</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm py-16 text-center text-slate-400 text-sm">
                No progress data found for this student.
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const colors: Record<string, string> = {
    passed: 'bg-emerald-50 text-emerald-700',
    failed: 'bg-orange-50 text-orange-700',
    flagged: 'bg-red-50 text-red-600',
    pending: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded ${colors[status] ?? colors.pending}`}>
      {label}: {status}
    </span>
  );
}
