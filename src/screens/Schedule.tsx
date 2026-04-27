import React from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { motion } from 'motion/react';
import { Calendar as CalendarIcon, Clock, Video, Users, MapPin } from 'lucide-react';
import { useApiGet } from '../hooks/useApi';

export function Schedule() {
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

  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // Monday
  const end = new Date(start);
  end.setDate(start.getDate() + 6); // Sunday
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const { data, loading: isLoading, error } = useApiGet<{ events: any[] }>(`/api/student/schedule?start=${fmt(start)}&end=${fmt(end)}`, []);

  const month = today.toLocaleString(undefined, { month: 'short' });
  const dayNum = today.getDate();
  const weekday = today.toLocaleString(undefined, { weekday: 'long' });
  const todayKey = fmt(today);
  const todaysEvents = (data?.events ?? []).filter((e: any) => (e.startsAt ? fmt(new Date(e.startsAt)) : '') === todayKey);

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
            <h1 className="text-2xl font-extrabold text-slate-900">My Schedule</h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Your classes and events for today.</p>
          </div>
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button className="px-4 py-1.5 bg-slate-100 rounded-lg text-sm font-bold text-slate-800">Today</button>
            <button className="px-4 py-1.5 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">Week</button>
            <button className="px-4 py-1.5 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">Month</button>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 p-6 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-red-500 uppercase">{month}</span>
                <span className="text-lg font-extrabold text-slate-900 leading-none">{dayNum}</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{weekday}</h2>
                <p className="text-sm font-medium text-slate-500">{todaysEvents.length} events scheduled</p>
              </div>
            </div>
            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
              <CalendarIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 pb-4">
              {isLoading && (
                <div className="text-sm font-semibold text-slate-600">Loading schedule…</div>
              )}
              {error && (
                <div className="text-sm font-semibold text-red-600">{String((error as any)?.message ?? error)}</div>
              )}
              {!isLoading && !error && todaysEvents.length === 0 && (
                <div className="text-sm font-semibold text-slate-500">No events scheduled for today.</div>
              )}
              {todaysEvents.map((item: any) => (
                <motion.div key={item.id} variants={itemVariants} className="relative pl-8">
                  {/* Timeline Dot */}
                  <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-4 border-white shadow-sm ${item.type === 'live' ? 'bg-green-500' : 'bg-[#0084B4]'}`}></div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                    <div className="min-w-[100px] pt-0.5">
                      <p className="text-sm font-bold text-slate-900">
                        {item.startsAt ? new Date(item.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                      <p className="text-xs font-medium text-slate-500">
                        {item.endsAt && item.startsAt ? `${Math.max(0, Math.round((new Date(item.endsAt).getTime() - new Date(item.startsAt).getTime()) / 60000))} min` : ''}
                      </p>
                    </div>
                    
                    <div className={`flex-1 rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow ${item.type === 'live' ? 'bg-green-50' : 'bg-blue-50'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider bg-white/60 ${item.type === 'live' ? 'text-green-700' : 'text-blue-700'}`}>
                          {item.type ?? 'event'}
                        </span>
                        {item.type === 'live' ? (
                          <Video className="w-5 h-5 text-green-700" />
                        ) : (
                          <Clock className="w-5 h-5 text-blue-700" />
                        )}
                      </div>
                      <h3 className="font-bold text-slate-900 text-lg mb-1">{item.title}</h3>
                      <div className="flex flex-wrap gap-4 mt-3">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
                          <Users className="w-4 h-4" />
                          {item.instructor ?? '—'}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
                          <MapPin className="w-4 h-4" />
                          {item.location ?? '—'}
                        </div>
                      </div>
                      
                      {item.joinUrl && (
                        <a
                          href={item.joinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`mt-4 inline-flex w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-colors shadow-sm ${item.type === 'live' ? 'bg-green-600 hover:bg-green-700' : 'bg-[#0084B4] hover:bg-[#006A91]'}`}
                        >
                          Join
                        </a>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
