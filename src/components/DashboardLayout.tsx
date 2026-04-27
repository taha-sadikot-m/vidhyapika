import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  ClipboardList, 
  Calendar as CalendarIcon, 
  Award, 
  Settings, 
  LogOut,
  Bell,
  HelpCircle,
  Menu,
  X,
  Search
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { motion, AnimatePresence } from 'motion/react';
import { useApiGet } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const { data: curriculumData } = useApiGet<{ curriculums: any[] }>('/api/student/curriculum', []);
  const { data: notificationsSummary } = useApiGet<{ unreadCount: number }>('/api/student/notifications/summary', []);
  const notEnrolled = curriculumData && (!curriculumData.curriculums || curriculumData.curriculums.length === 0);
  const { user } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Curriculum', href: '/courses', icon: BookOpen },
    { name: 'Assignments', href: '/assignments', icon: ClipboardList },
    { name: 'Schedule', href: '/schedule', icon: CalendarIcon },
    { name: 'Achievements', href: '/achievements', icon: Award },
  ];

  const bottomNavigation = [
    { name: 'Settings', href: '/settings', icon: Settings },
    { name: 'Logout', href: '/login', icon: LogOut },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex font-sans">
      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-20 px-6 pt-4">
          <Logo className="scale-90 origin-left" />
          <button 
            className="lg:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-1">
          <nav className="space-y-1.5">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              const isLearningLink = item.href !== '/dashboard';
              const disabled = notEnrolled && isLearningLink;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={(e) => { if (disabled) e.preventDefault(); }}
                  className={`
                    group flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all
                    ${isActive 
                      ? 'bg-white text-[#0084B4] shadow-[0_2px_10px_rgba(0,0,0,0.05)] border border-slate-100' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
                    ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-auto hover:bg-transparent hover:text-slate-500' : ''}
                  `}
                >
                  <item.icon
                    className={`
                      mr-3 flex-shrink-0 h-5 w-5 transition-colors
                      ${isActive ? 'text-[#0084B4]' : 'text-slate-400 group-hover:text-slate-600'}
                    `}
                    aria-hidden="true"
                  />
                  <div className="flex-1">
                    <div>{item.name}</div>
                    {disabled && <div className="text-[10px] font-bold text-slate-400 mt-0.5">Assign class to unlock</div>}
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 px-2">
            <button className="w-full bg-[#0084B4] hover:bg-[#006A91] text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-md shadow-[#0084B4]/20">
              Start Learning
            </button>
          </div>
        </div>

        <div className="p-4 space-y-1.5 mb-4">
          {bottomNavigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className="group flex items-center px-4 py-3 text-sm font-semibold rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <item.icon className="mr-3 flex-shrink-0 h-5 w-5 text-slate-400 group-hover:text-slate-600" />
              {item.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="bg-[#F8F9FA] sticky top-0 z-30 pt-4 pb-2 px-4 sm:px-8">
          <div className="h-16 flex items-center justify-between bg-white rounded-2xl px-4 sm:px-6 shadow-sm border border-slate-100">
            <div className="flex items-center gap-4 flex-1">
              <button
                type="button"
                className="lg:hidden p-2 rounded-full text-slate-500 hover:bg-slate-100 transition-colors"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu className="h-6 w-6" />
              </button>
              
              <div className="hidden md:block flex-1 max-w-md">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-11 pr-4 py-2.5 bg-slate-100 border-transparent rounded-full focus:bg-white focus:ring-2 focus:ring-[#0084B4]/20 focus:border-[#0084B4] sm:text-sm transition-all outline-none font-medium text-slate-700 placeholder:text-slate-400"
                    placeholder="Search lessons, topics, or help..."
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4 sm:space-x-6">
              <button className="text-slate-400 hover:text-slate-600 transition-colors relative">
                <Bell className="h-5 w-5" />
                {!!notificationsSummary?.unreadCount && (
                  <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </button>
              
              <button className="text-slate-400 hover:text-slate-600 transition-colors">
                <HelpCircle className="h-5 w-5" />
              </button>

              <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

              <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-bold text-slate-800 leading-none">{user?.name ?? user?.email ?? '—'}</p>
                  <p className="text-[11px] font-medium text-slate-500 mt-1">
                    {user?.role === 'student'
                      ? (curriculumData?.curriculums?.[0]?.className ?? (notEnrolled ? 'Not enrolled' : '—'))
                      : (user?.role ?? '')}
                  </p>
                </div>
                <img
                  className="h-10 w-10 rounded-full object-cover border-2 border-white shadow-sm"
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user?.email ?? 'user')}`}
                  alt="Student profile"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 pt-4">
          {children}
        </main>
      </div>
    </div>
  );
}
