import React from 'react';
import { Activity } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts';
import type { ClassStat } from './analyticsTypes';
import { healthColor } from './TopicDifficultyTable';

function ClassChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: ClassStat }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as ClassStat;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-xs space-y-1">
      <p className="font-extrabold text-slate-900 mb-1">{d.className}</p>
      <p className="text-slate-500">
        Standard: <strong className="text-slate-700">{d.standardName}</strong>
      </p>
      <p className="text-slate-500">
        Enrolled: <strong className="text-slate-700">{d.enrolled}</strong>
      </p>
      <p className="text-emerald-600">
        Prereq Pass Rate: <strong>{d.avgPrereqPassRate}%</strong>
      </p>
      <p className="text-indigo-600">
        Final Pass Rate: <strong>{d.avgFinalPassRate}%</strong>
      </p>
      {d.flaggedCount > 0 && (
        <p className="text-red-600">
          Flagged: <strong>{d.flaggedCount}</strong>
        </p>
      )}
    </div>
  );
}

export function ClassPerformanceChart({ classStats }: { classStats: ClassStat[] }) {
  const classChartData = classStats.filter((c) => c.enrolled > 0);
  if (classChartData.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
        <Activity className="w-5 h-5 text-indigo-600" />
        <h2 className="text-base font-bold text-slate-900">Class Performance — Avg Pass Rates</h2>
        <span className="ml-auto text-xs text-slate-400">Hover for details</span>
      </div>
      <div className="px-4 py-5">
        <ResponsiveContainer width="100%" height={Math.max(200, classChartData.length * 52)}>
          <BarChart
            data={classChartData}
            layout="vertical"
            margin={{ top: 4, right: 24, left: 12, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              tickFormatter={(v) => `${v}%`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="className"
              width={110}
              tick={{ fontSize: 12, fontWeight: 600, fill: '#475569' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ClassChartTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="avgPrereqPassRate" name="Prereq Pass Rate" radius={[0, 6, 6, 0]} maxBarSize={24}>
              {classChartData.map((entry, i) => (
                <Cell key={i} fill={healthColor(entry.avgPrereqPassRate).bar} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap items-center gap-4 mt-2 px-2">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span className="text-xs text-slate-500">≥ 75% (Healthy)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-400" />
            <span className="text-xs text-slate-500">50–74% (Needs Attention)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-400" />
            <span className="text-xs text-slate-500">&lt; 50% (Critical)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
