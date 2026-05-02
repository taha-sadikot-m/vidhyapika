/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useApiGet } from './hooks/useApi';
import { Login } from './screens/Login';
import { ForgotPassword } from './screens/ForgotPassword';
import { ResetPassword } from './screens/ResetPassword';
import { Dashboard } from './screens/Dashboard';
import { Courses } from './screens/Courses';
import { CoursePlayer } from './screens/CoursePlayer';
import { Assignments } from './screens/Assignments';
import { Schedule } from './screens/Schedule';
import { Achievements } from './screens/Achievements';
import { Settings } from './screens/Settings';

// Admin Pages
import { AdminLogin } from './screens/admin/AdminLogin';
import { AdminForgotPassword } from './screens/admin/AdminForgotPassword';
import { AdminDashboard } from './screens/admin/AdminDashboard';
import { AdminAnalytics } from './screens/admin/AdminAnalytics';
import { AdminCourses } from './screens/admin/AdminCourses';
import { AdminCurriculum } from './screens/admin/AdminCurriculum';
import { AdminStudents } from './screens/admin/AdminStudents';
import { AdminAssignments } from './screens/admin/AdminAssignments';
import { AdminSchedule } from './screens/admin/AdminSchedule';

// Parent Pages
import { ParentLogin } from './screens/parent/ParentLogin';
import { ParentDashboard } from './screens/parent/ParentDashboard';

// Guard: redirects to /admin/login when not authenticated as admin
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { token, isAdmin } = useAuth();
  if (!token || !isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}

function ParentRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  if (!token || user?.role !== 'parent') {
    return <Navigate to="/parent/login" replace />;
  }
  return <>{children}</>;
}

function EnrollmentRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const { data, loading } = useApiGet<{ curriculums: any[] }>('/api/student/curriculum', []);

  if (!token || user?.role !== 'student') return <Navigate to="/login" replace />;
  if (loading) return <div className="min-h-screen bg-slate-50" />;
  if (!data?.curriculums || data.curriculums.length === 0) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
    <Router>
      <Routes>
        {/* Student Routes */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/courses" element={<EnrollmentRoute><Courses /></EnrollmentRoute>} />
        <Route path="/learn" element={<EnrollmentRoute><CoursePlayer /></EnrollmentRoute>} />
        <Route path="/assignments" element={<EnrollmentRoute><Assignments /></EnrollmentRoute>} />
        <Route path="/schedule" element={<EnrollmentRoute><Schedule /></EnrollmentRoute>} />
        <Route path="/achievements" element={<EnrollmentRoute><Achievements /></EnrollmentRoute>} />
        <Route path="/settings" element={<Settings />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
        <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
        <Route path="/admin/courses" element={<AdminRoute><AdminCourses /></AdminRoute>} />
        <Route path="/admin/curriculum" element={<AdminRoute><AdminCurriculum /></AdminRoute>} />
        <Route path="/admin/students" element={<AdminRoute><AdminStudents /></AdminRoute>} />
        <Route path="/admin/assignments" element={<AdminRoute><AdminAssignments /></AdminRoute>} />
        <Route path="/admin/schedule" element={<AdminRoute><AdminSchedule /></AdminRoute>} />

        {/* Parent Routes */}
        <Route path="/parent" element={<Navigate to="/parent/login" replace />} />
        <Route path="/parent/login" element={<ParentLogin />} />
        <Route path="/parent/dashboard" element={<ParentRoute><ParentDashboard /></ParentRoute>} />

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
    </AuthProvider>
  );
}
