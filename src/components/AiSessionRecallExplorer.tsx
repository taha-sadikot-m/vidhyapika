import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Crosshair,
  GraduationCap,
  Dumbbell,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { MathRenderer, LatexBlock } from './MathRenderer';
import { MarkdownLesson } from './MarkdownLesson';
import type { AiCoachingSessionSummary } from '../types/aiCoachingSession';

type RecallTab = 'overview' | 'diagnose' | 'learn' | 'practice' | 'chat';

export function AiSessionRecallExplorer({ session }: { session: AiCoachingSessionSummary }) {
  const mistakes = session.mistakes ?? [];
  const lessons = session.lessonCards ?? [];
  const drills = session.drills ?? [];
  const messages = session.messages ?? [];

  const hasDetail =
    mistakes.length > 0 || lessons.length > 0 || drills.length > 0 || messages.length > 0;

  const defaultTab = useMemo((): RecallTab => {
    if (mistakes.length) return 'diagnose';
    if (lessons.length) return 'learn';
    if (drills.length) return 'practice';
    if (messages.length) return 'chat';
    return 'overview';
  }, [mistakes.length, lessons.length, drills.length, messages.length]);

  const [tab, setTab] = useState<RecallTab>(defaultTab);
  const [mi, setMi] = useState(0);
  const [li, setLi] = useState(0);
  const [di, setDi] = useState(0);

  useEffect(() => {
    setMi(0);
    setLi(0);
    setDi(0);
    setTab(defaultTab);
  }, [session.id, defaultTab]);

  if (!hasDetail) {
    return (
      <p className="text-slate-600 leading-relaxed text-sm px-1">
        Detailed coach text for this session isn&apos;t available (older session). New sessions store full lessons and
        analysis automatically.
      </p>
    );
  }

  const tabs: { id: RecallTab; label: string; Icon: typeof Crosshair; count?: number; tint: string }[] = [
    { id: 'overview', label: 'Map', Icon: LayoutDashboard, tint: 'slate' },
    {
      id: 'diagnose',
      label: 'Diagnose',
      Icon: Crosshair,
      count: mistakes.length,
      tint: 'amber',
    },
    { id: 'learn', label: 'Learn', Icon: GraduationCap, count: lessons.length, tint: 'indigo' },
    { id: 'practice', label: 'Practice', Icon: Dumbbell, count: drills.length, tint: 'emerald' },
    { id: 'chat', label: 'Chat', Icon: MessageCircle, count: messages.length, tint: 'violet' },
  ];

  const activeMistake = mistakes[mi];
  const activeLesson = lessons[li];
  const activeDrill = drills[di];

  return (
    <div className="flex w-full max-w-full flex-col gap-0 rounded-xl border border-indigo-100/80 bg-gradient-to-b from-white to-slate-50/90 shadow-inner overflow-hidden">
      {/* Primary navigation — pills + desktop rail */}
      <div className="flex flex-col lg:flex-row lg:items-stretch min-h-0 border-b border-indigo-100/90 bg-white/95">
        <nav
          className="flex lg:flex-col gap-1 p-2 lg:w-[11.5rem] lg:shrink-0 lg:border-r lg:border-indigo-100/80 overflow-x-auto lg:overflow-y-auto lg:max-h-[min(75vh,560px)]"
          aria-label="Session sections"
        >
          {tabs.map(({ id, label, Icon, count, tint }) => {
            const active = tab === id;
            const showCount =
              id !== 'overview' && count !== undefined && count > 0 && id !== 'chat' ? count : id === 'chat' && count ? count : null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-extrabold transition-all lg:w-full ${
                  active
                    ? tint === 'amber'
                      ? 'bg-amber-100 text-amber-950 ring-2 ring-amber-300/60 shadow-sm'
                      : tint === 'indigo'
                        ? 'bg-indigo-100 text-indigo-950 ring-2 ring-indigo-300/60 shadow-sm'
                        : tint === 'emerald'
                          ? 'bg-emerald-100 text-emerald-950 ring-2 ring-emerald-300/60 shadow-sm'
                          : tint === 'violet'
                            ? 'bg-violet-100 text-violet-950 ring-2 ring-violet-300/60 shadow-sm'
                            : 'bg-slate-900 text-white ring-2 ring-slate-700 shadow-sm'
                    : 'bg-slate-50/90 text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                <span className="truncate">{label}</span>
                {showCount != null ? (
                  <span className="ml-auto tabular-nums rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-black text-slate-700">
                    {showCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-h-[min(65vh,620px)] max-h-[min(75vh,720px)] flex flex-col min-w-0 border-t lg:border-t-0 border-indigo-100/80">
          {/* Panel header */}
          <div className="shrink-0 px-4 py-3 sm:px-5 border-b border-indigo-50 bg-indigo-50/40 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-indigo-700">
                {tab === 'overview' && 'Session map'}
                {tab === 'diagnose' && 'Step 1 · Diagnose'}
                {tab === 'learn' && 'Step 2 · Learn'}
                {tab === 'practice' && 'Step 3 · Practice'}
                {tab === 'chat' && 'Tutor chat'}
              </p>
              <p className="text-xs font-semibold text-slate-600 mt-0.5">
                {tab === 'overview' && 'Pick a lane above — each tab holds one kind of content only.'}
                {tab === 'diagnose' && 'One mistake at a time — expand sections inside each card.'}
                {tab === 'learn' && 'Flip lesson cards like a deck — full markdown & formulas preserved.'}
                {tab === 'practice' && 'One drill per screen — reveal hint / check / solution on purpose.'}
                {tab === 'chat' && 'Everything you and the tutor typed in this session.'}
              </p>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-5">
            {tab === 'overview' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setTab('diagnose')}
                  disabled={!mistakes.length}
                  className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 text-left shadow-sm transition hover:shadow-md disabled:opacity-40 disabled:pointer-events-none"
                >
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-900">Diagnose</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{mistakes.length}</p>
                  <p className="mt-1 text-xs text-amber-900/90 font-medium">Mistake intelligence · tap to open</p>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('learn')}
                  disabled={!lessons.length}
                  className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50/40 p-4 text-left shadow-sm transition hover:shadow-md disabled:opacity-40 disabled:pointer-events-none"
                >
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-900">Learn</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{lessons.length}</p>
                  <p className="mt-1 text-xs text-indigo-900/90 font-medium">Lesson cards · tap to open</p>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('practice')}
                  disabled={!drills.length}
                  className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50/40 p-4 text-left shadow-sm transition hover:shadow-md disabled:opacity-40 disabled:pointer-events-none"
                >
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-900">Practice</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{drills.length}</p>
                  <p className="mt-1 text-xs text-emerald-900/90 font-medium">Micro-drills · tap to open</p>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('chat')}
                  disabled={!messages.length}
                  className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50/40 p-4 text-left shadow-sm transition hover:shadow-md disabled:opacity-40 disabled:pointer-events-none"
                >
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-violet-900">Chat</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{messages.length}</p>
                  <p className="mt-1 text-xs text-violet-900/90 font-medium">Messages · tap to open</p>
                </button>
              </div>
            )}

            {tab === 'diagnose' && mistakes.length > 0 && activeMistake && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-900">
                    Mistake {mi + 1} / {mistakes.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={mi <= 0}
                      onClick={() => setMi((x) => Math.max(0, x - 1))}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-extrabold text-amber-950 shadow-sm disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" /> Prev
                    </button>
                    <button
                      type="button"
                      disabled={mi >= mistakes.length - 1}
                      onClick={() => setMi((x) => Math.min(mistakes.length - 1, x + 1))}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-extrabold text-amber-950 shadow-sm disabled:opacity-40"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border-2 border-amber-200/80 bg-white p-4 sm:p-5 shadow-sm space-y-4">
                  <p className="text-base font-black text-slate-900 leading-snug">{activeMistake.mistakeTitle}</p>
                  {(
                    [
                      { key: 'signal', title: 'What signaled the error', body: activeMistake.whatWentWrong },
                      { key: 'misconception', title: 'Likely misconception', body: activeMistake.likelyMisconception },
                      { key: 'fix', title: 'Corrective move', body: activeMistake.fix },
                      { key: 'pattern', title: 'Worked pattern', body: activeMistake.example },
                    ] as const
                  ).map(({ key, title, body }) => (
                    <details
                      key={key}
                      className="group rounded-xl border border-amber-100 bg-amber-50/30 open:bg-white open:shadow-sm"
                    >
                      <summary className="cursor-pointer list-none px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-950 [&::-webkit-details-marker]:hidden flex items-center justify-between gap-2">
                        {title}
                        <ChevronDown className="h-4 w-4 shrink-0 text-amber-800 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="border-t border-amber-100 bg-white px-3 py-3">
                        <MathRenderer text={body} className="text-sm text-slate-800 leading-relaxed" block />
                      </div>
                    </details>
                  ))}
                </div>
                <div className="flex justify-center gap-1.5 flex-wrap">
                  {mistakes.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Go to mistake ${i + 1}`}
                      onClick={() => setMi(i)}
                      className={`h-2.5 rounded-full transition-all ${
                        i === mi ? 'w-8 bg-amber-500' : 'w-2.5 bg-amber-200 hover:bg-amber-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {tab === 'learn' && lessons.length > 0 && activeLesson && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-900">
                    Card {li + 1} / {lessons.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={li <= 0}
                      onClick={() => setLi((x) => Math.max(0, x - 1))}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-extrabold text-indigo-950 shadow-sm disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" /> Prev
                    </button>
                    <button
                      type="button"
                      disabled={li >= lessons.length - 1}
                      onClick={() => setLi((x) => Math.min(lessons.length - 1, x + 1))}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-extrabold text-indigo-950 shadow-sm disabled:opacity-40"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border-2 border-indigo-200/70 bg-gradient-to-br from-white via-indigo-50/40 to-violet-50/30 p-5 sm:p-6 shadow-md space-y-4">
                  <p className="text-lg font-black text-slate-900">{activeLesson.title}</p>
                  <div className="rounded-xl border border-white/80 bg-white/80 p-4 shadow-inner">
                    <MarkdownLesson content={activeLesson.content} className="text-sm" />
                  </div>
                  {activeLesson.latex?.trim() ? (
                    <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 overflow-x-auto [&_.katex]:text-white">
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-200/90 mb-2">Key formula</p>
                      <LatexBlock latex={activeLesson.latex.trim()} />
                    </div>
                  ) : null}
                </div>
                <div className="flex justify-center gap-1.5 flex-wrap">
                  {lessons.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Go to lesson ${i + 1}`}
                      onClick={() => setLi(i)}
                      className={`h-2.5 rounded-full transition-all ${
                        i === li ? 'w-8 bg-indigo-600' : 'w-2.5 bg-indigo-200 hover:bg-indigo-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {tab === 'practice' && drills.length > 0 && activeDrill && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-900">
                    Drill {di + 1} / {drills.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={di <= 0}
                      onClick={() => setDi((x) => Math.max(0, x - 1))}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-extrabold text-emerald-950 shadow-sm disabled:opacity-40"
                    >
                      <ChevronLeft className="h-4 w-4" /> Prev
                    </button>
                    <button
                      type="button"
                      disabled={di >= drills.length - 1}
                      onClick={() => setDi((x) => Math.min(drills.length - 1, x + 1))}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-extrabold text-emerald-950 shadow-sm disabled:opacity-40"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border-2 border-emerald-200/80 bg-white p-4 sm:p-5 shadow-sm space-y-4">
                  <div className="text-sm font-bold text-slate-900">
                    <MathRenderer text={activeDrill.prompt} block />
                  </div>
                  <div className="grid gap-3">
                    <details className="rounded-xl border border-blue-100 bg-blue-50/50 open:shadow-sm">
                      <summary className="cursor-pointer px-3 py-2.5 text-xs font-extrabold text-blue-900">Hint</summary>
                      <div className="border-t border-blue-100 px-3 py-3">
                        <MathRenderer text={activeDrill.hint} className="text-sm" block />
                      </div>
                    </details>
                    <details className="rounded-xl border border-violet-100 bg-violet-50/50 open:shadow-sm">
                      <summary className="cursor-pointer px-3 py-2.5 text-xs font-extrabold text-violet-900">Quick check</summary>
                      <div className="border-t border-violet-100 px-3 py-3">
                        <MathRenderer text={activeDrill.checkYourself} className="text-sm" block />
                      </div>
                    </details>
                    <details className="rounded-xl border border-emerald-100 bg-emerald-50/50 open:shadow-sm">
                      <summary className="cursor-pointer px-3 py-2.5 text-xs font-extrabold text-emerald-900">Full solution</summary>
                      <div className="border-t border-emerald-100 px-3 py-3">
                        <MathRenderer text={activeDrill.solution} className="text-sm" block />
                      </div>
                    </details>
                  </div>
                </div>
                <div className="flex justify-center gap-1.5 flex-wrap">
                  {drills.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Go to drill ${i + 1}`}
                      onClick={() => setDi(i)}
                      className={`h-2.5 rounded-full transition-all ${
                        i === di ? 'w-8 bg-emerald-500' : 'w-2.5 bg-emerald-200 hover:bg-emerald-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {tab === 'chat' && messages.length > 0 && (
              <ul className="space-y-3 max-w-3xl mx-auto">
                {messages.map((msg, miIdx) => (
                  <li
                    key={`${session.id}-msg-${miIdx}`}
                    className={`rounded-2xl px-4 py-3 text-sm shadow-sm border ${
                      msg.role === 'tutor'
                        ? 'bg-indigo-50 text-slate-800 border-indigo-100 mr-8'
                        : 'bg-blue-600 text-white border-blue-700 ml-8'
                    }`}
                  >
                    <span className="text-[10px] font-extrabold uppercase opacity-80 block mb-1.5">
                      {msg.role === 'tutor' ? 'Tutor' : 'You'}
                    </span>
                    <MathRenderer text={msg.content} />
                  </li>
                ))}
              </ul>
            )}

            {tab === 'diagnose' && mistakes.length === 0 ? (
              <p className="text-sm text-slate-500">No mistake breakdown stored for this session.</p>
            ) : null}
            {tab === 'learn' && lessons.length === 0 ? (
              <p className="text-sm text-slate-500">No lesson cards stored for this session.</p>
            ) : null}
            {tab === 'practice' && drills.length === 0 ? (
              <p className="text-sm text-slate-500">No drills stored for this session.</p>
            ) : null}
            {tab === 'chat' && messages.length === 0 ? (
              <p className="text-sm text-slate-500">No chat messages stored for this session.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
