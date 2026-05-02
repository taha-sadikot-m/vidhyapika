import React, { useMemo, useState } from 'react';
import {
  Target, Flag, Brain, ChevronUp, ChevronDown, ChevronsUpDown,
} from 'lucide-react';
import type { TopicStat } from './analyticsTypes';

export function healthColor(rate: number) {
  if (rate >= 75) return { bar: '#10b981', pill: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  if (rate >= 50) return { bar: '#f59e0b', pill: 'bg-amber-50 text-amber-700 border-amber-100' };
  return { bar: '#ef4444', pill: 'bg-red-50 text-red-700 border-red-100' };
}

function RatePill({ rate }: { rate: number }) {
  const c = healthColor(rate);
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-extrabold border ${c.pill}`}>
      {rate}%
    </span>
  );
}

function MiniProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-bold text-slate-500 w-7 text-right">{value}%</span>
    </div>
  );
}

type SortKey = 'prereqPassRate' | 'finalPassRate' | 'enrolled' | 'flaggedCount' | 'aiInterventionRate';

export function TopicDifficultyTable({
  topics,
  onDrilldown,
  pageSize = 8,
}: {
  topics: TopicStat[];
  onDrilldown: (t: TopicStat) => void;
  /** Set higher on full analytics page */
  pageSize?: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('prereqPassRate');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE = pageSize;

  const sorted = useMemo(() => {
    return [...topics].sort((a, b) => {
      const diff = (a[sortKey] as number) - (b[sortKey] as number);
      return sortAsc ? diff : -diff;
    });
  }, [topics, sortKey, sortAsc]);

  const paged = sorted.slice(page * PAGE, (page + 1) * PAGE);
  const totalPages = Math.ceil(sorted.length / PAGE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
      setPage(0);
    }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronsUpDown className="w-3 h-3 text-slate-300" />;
    return sortAsc ? (
      <ChevronUp className="w-3 h-3 text-indigo-500" />
    ) : (
      <ChevronDown className="w-3 h-3 text-indigo-500" />
    );
  }

  const th = (label: string, key: SortKey) => (
    <th
      className="py-3 px-4 text-left cursor-pointer select-none hover:bg-slate-100 transition-colors"
      onClick={() => toggleSort(key)}
    >
      <div className="flex items-center gap-1 text-xs font-bold text-slate-400 uppercase tracking-wider">
        {label} <SortIcon k={key} />
      </div>
    </th>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-red-500" />
          <h2 className="text-base font-bold text-slate-900">Topic Difficulty Ranking</h2>
          <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-md">
            {topics.length} topics
          </span>
        </div>
        <p className="text-xs text-slate-400">Click any row to see deep analytics</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Topic</th>
              <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Class</th>
              {th('Enrolled', 'enrolled')}
              {th('Prereq Pass', 'prereqPassRate')}
              {th('Final Pass', 'finalPassRate')}
              {th('Flags', 'flaggedCount')}
              {th('AI Rate', 'aiInterventionRate')}
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {paged.map((t) => (
              <tr
                key={t.topicId}
                className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                onClick={() => onDrilldown(t)}
              >
                <td className="py-3 px-4">
                  <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                    {t.topicName}
                  </p>
                  <p className="text-xs text-slate-400">{t.standardName}</p>
                </td>
                <td className="py-3 px-4 text-sm text-slate-600 font-medium">{t.className}</td>
                <td className="py-3 px-4 text-sm font-bold text-slate-700">{t.enrolled}</td>
                <td className="py-3 px-4 min-w-[120px]">
                  {t.enrolled > 0 ? (
                    <div className="space-y-1">
                      <RatePill rate={t.prereqPassRate} />
                      <MiniProgressBar value={t.prereqPassRate} color={healthColor(t.prereqPassRate).bar} />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300">No data</span>
                  )}
                </td>
                <td className="py-3 px-4 min-w-[120px]">
                  {t.enrolled > 0 ? (
                    <div className="space-y-1">
                      <RatePill rate={t.finalPassRate} />
                      <MiniProgressBar value={t.finalPassRate} color={healthColor(t.finalPassRate).bar} />
                    </div>
                  ) : (
                    <span className="text-xs text-slate-300">No data</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {t.flaggedCount > 0 ? (
                    <span className="flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-extrabold w-fit">
                      <Flag className="w-3 h-3" /> {t.flaggedCount}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {t.enrolled > 0 ? (
                    <span
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-extrabold w-fit ${
                        t.aiInterventionRate >= 50 ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-500'
                      }`}
                    >
                      <Brain className="w-3 h-3" /> {t.aiInterventionRate}%
                    </span>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="text-xs font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    Drilldown →
                  </span>
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={8} className="py-10 text-center text-slate-400 text-sm">
                  No topics with activity data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Showing {page * PAGE + 1}–{Math.min((page + 1) * PAGE, sorted.length)} of {sorted.length}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
