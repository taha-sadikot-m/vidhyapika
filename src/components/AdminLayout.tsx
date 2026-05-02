import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calculator, 
  Users, 
  ClipboardList,
  Calendar as CalendarIcon,
  Settings, 
  LogOut,
  Bell,
  Menu,
  X,
  Search,
  ShieldAlert,
  BarChart3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
    { name: 'Math Curriculum', href: '/admin/curriculum', icon: Calculator },
    { name: 'Students', href: '/admin/students', icon: Users },
    { name: 'Assignments', href: '/admin/assignments', icon: ClipboardList },
    { name: 'Schedule', href: '/admin/schedule', icon: CalendarIcon },
  ];

  const bottomNavigation = [
    { name: 'Settings', href: '/admin/settings', icon: Settings },
    { name: 'Logout', href: '/admin/login', icon: LogOut },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
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
        fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between h-20 px-6 pt-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-xl font-black text-white">V</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">Admin</span>
          </div>
          <button 
            className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 flex flex-col gap-1">
          <nav className="space-y-1.5">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    group flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all
                    ${isActive 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
                  `}
                >
                  <item.icon
                    className={`
                      mr-3 flex-shrink-0 h-5 w-5 transition-colors
                      ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}
                    `}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 space-y-1.5 mb-4">
          {bottomNavigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className="group flex items-center px-4 py-3 text-sm font-semibold rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <item.icon className="mr-3 flex-shrink-0 h-5 w-5 text-slate-400 group-hover:text-white" />
              {item.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="bg-slate-50 sticky top-0 z-30 pt-4 pb-2 px-4 sm:px-8">
          <div className="h-16 flex items-center justify-between bg-white rounded-2xl px-4 sm:px-6 shadow-sm border border-slate-200">
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
                    className="block w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 sm:text-sm transition-all outline-none font-medium text-slate-700 placeholder:text-slate-400"
                    placeholder="Search courses, students..."
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4 sm:space-x-6">
              <button className="text-slate-400 hover:text-slate-600 transition-colors relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
              </button>
              
              <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

              <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-bold text-slate-800 leading-none">System Admin</p>
                  <p className="text-[11px] font-medium text-slate-500 mt-1">Superuser</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center border-2 border-white shadow-sm">
                  <ShieldAlert className="w-5 h-5 text-white" />
                </div>
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
