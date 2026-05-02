import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  Upload, Download, Clipboard, ChevronDown, ChevronRight,
  AlertTriangle, CheckCircle2, Info, X, FileText, Table2,
  Check, Square, CheckSquare, Trash2, Plus, Search, Loader2, RotateCcw,
} from 'lucide-react';
import {
  parseLevelData, generateLevelTemplateCSV, LEVEL_COLUMN_DOCS,
  validateLevelRows, rowsToItems, getLevelEditorColumns,
  getLevelCellEditor,
  normalizeEditableRowCells,
  type LevelParseTarget,
} from '../utils/csvImport';

// ─── Props ────────────────────────────────────────────────────────────────────

interface LevelImportPanelProps {
  /** Which data type this panel imports */
  target: LevelParseTarget;
  /** Accent colour class suffix — e.g. "blue", "purple", "orange", "emerald" */
  accent?: 'blue' | 'purple' | 'orange' | 'emerald' | 'indigo';
  /**
   * Called when user confirms upload.
   * Should perform the DB upload (preferably bulk) and can return row-indexed results.
   */
  onImport: (args: {
    items: any[];
    rows: Record<string, string>[];
  }) => void | Promise<{
    created: { index: number; id: string }[];
    errors: { index: number; message: string; field?: string }[];
  }>;
  /** Optional extra context label shown in the panel header */
  contextLabel?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCENT_CLASSES = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    btn: 'bg-blue-600 hover:bg-blue-700',    badge: 'bg-blue-100 text-blue-700'    },
  purple:  { bg: 'bg-purple-50',  border: 'border-purple-200',  text: 'text-purple-700',  btn: 'bg-purple-600 hover:bg-purple-700',  badge: 'bg-purple-100 text-purple-700'  },
  orange:  { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700',  btn: 'bg-orange-600 hover:bg-orange-700',  badge: 'bg-orange-100 text-orange-700'  },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', btn: 'bg-emerald-600 hover:bg-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700',  btn: 'bg-indigo-600 hover:bg-indigo-700',  badge: 'bg-indigo-100 text-indigo-700'  },
};

const TARGET_LABELS: Record<LevelParseTarget, string> = {
  topics: 'Topics',
  subtopics: 'Sub-topics',
  prerequisites: 'Prerequisites',
  questions: 'Quiz Questions',
};

const TARGET_PASTE_PLACEHOLDER: Record<LevelParseTarget, string> = {
  topics:
    'Paste Excel data here.\n\nExpected columns (copy header row too, or just data):\ntopic_title  topic_sequence\n\nExample (tab-separated from Excel):\nAlgebraic Expressions\t1\nLinear Equations\t2',
  subtopics:
    'Paste Excel data here.\n\nExpected columns:\nsubtopic_title  subtopic_video\n\nExample:\nIntroduction to Polynomials\thttps://youtube.com/...',
  prerequisites:
    'Paste Excel data here.\n\nExpected columns:\nprereq_title  prereq_category\n\nExample:\nBasic Arithmetic\tMajor',
  questions:
    'Paste Excel data here.\n\nColumns (image_url optional):\nquestion_text  image_url  question_type  option_a … option_d  correct_answer  explanation  difficulty\n\nTypes: mcq | true_false | text | image_upload\n\nExample:\nWhat is 2+2?\t\tmcq\t3\t4\t5\t6\t4\tTwo plus two equals four.\tEasy',
};

// ─── Preview table column defs per target ────────────────────────────────────

const PREVIEW_COLS: Record<LevelParseTarget, { key: string; label: string; width?: string }[]> = {
  topics: [
    { key: 'topic_title', label: 'Title' },
    { key: 'topic_sequence', label: 'Seq', width: 'w-16' },
  ],
  subtopics: [
    { key: 'subtopic_title', label: 'Sub-topic Title' },
    { key: 'subtopic_video', label: 'Video URL' },
  ],
  prerequisites: [
    { key: 'prereq_title', label: 'Prerequisite' },
    { key: 'prereq_category', label: 'Category', width: 'w-32' },
  ],
  questions: [
    { key: 'question_text', label: 'Question' },
    { key: 'question_type', label: 'Type', width: 'w-20' },
    { key: 'correct_answer', label: 'Answer', width: 'w-32' },
    { key: 'difficulty', label: 'Difficulty', width: 'w-24' },
  ],
};

// ─── Component ────────────────────────────────────────────────────────────────

export function LevelImportPanel({
  target,
  accent = 'blue',
  onImport,
  contextLabel,
}: LevelImportPanelProps) {
  const ac = ACCENT_CLASSES[accent];

  type PanelStep = 'collapsed' | 'input' | 'preview' | 'uploading' | 'done';
  const [step, setStep]               = useState<PanelStep>('collapsed');
  const [inputTab, setInputTab]       = useState<'file' | 'paste'>('file');
  const [pasteText, setPasteText]     = useState('');
  const [fileName, setFileName]       = useState('');
  const [parseResult, setParseResult] = useState<ReturnType<typeof parseLevelData> | null>(null);
  const [editableRows, setEditableRows] = useState<{ id: string; active: boolean; cells: Record<string, string> }[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [dragging, setDragging]       = useState(false);
  const [showCols, setShowCols]       = useState(false);
  const [query, setQuery]             = useState('');
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(10);
  const [uploadResult, setUploadResult] = useState<{ created: { index: number; id: string }[]; errors: { index: number; message: string; field?: string }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rowId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  const reset = () => {
    setStep('collapsed');
    setPasteText('');
    setFileName('');
    setParseResult(null);
    setEditableRows([]);
    setSelectedRowIds(new Set());
    setShowCols(false);
    setQuery('');
    setPage(1);
    setPageSize(10);
    setUploadResult(null);
  };

  // ── Parse helper ────────────────────────────────────────────────────────────
  const runParse = useCallback((text: string) => {
    const result = parseLevelData(text, target);
    setParseResult(result);
    const nextRows = (result.rows ?? []).map((cells) => ({
      id: rowId(),
      active: true,
      cells: normalizeEditableRowCells(target, { ...cells }),
    }));
    setEditableRows(nextRows);
    setSelectedRowIds(new Set(nextRows.map(r => r.id)));
    setUploadResult(null);
    setQuery('');
    setPage(1);
    setStep('preview');
  }, [target]);

  // ── File handling ───────────────────────────────────────────────────────────
  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? '';
      runParse(text);
    };
    reader.readAsText(file);
  }, [runParse]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  // ── Paste parse ─────────────────────────────────────────────────────────────
  const handleParsePaste = () => {
    if (!pasteText.trim()) return;
    setFileName('pasted data');
    runParse(pasteText);
  };

  // ── Editable rows + validation ───────────────────────────────────────────────
  const editorCols = useMemo(() => getLevelEditorColumns(target), [target]);

  const activeRows = useMemo(() => editableRows.filter(r => r.active), [editableRows]);
  const activeCells = useMemo(() => activeRows.map(r => r.cells), [activeRows]);

  const validation = useMemo(() => validateLevelRows(activeCells, target), [activeCells, target]);

  /** Map validation to stable row ids (fixes wrong highlights when search/filter is active). */
  const errorsByRowId = useMemo(() => {
    const by: Record<string, { column: string; message: string }[]> = {};
    for (const e of validation.rowErrors) {
      const id = activeRows[e.index]?.id;
      if (!id) continue;
      by[id] = by[id] ?? [];
      by[id]!.push({ column: e.column, message: e.message });
    }
    return by;
  }, [validation.rowErrors, activeRows]);

  const rowsWithIssueCount = useMemo(
    () => activeRows.reduce((n, r) => n + ((errorsByRowId[r.id]?.length ?? 0) > 0 ? 1 : 0), 0),
    [activeRows, errorsByRowId],
  );

  const queryLower = query.trim().toLowerCase();
  const filteredActiveRows = useMemo(() => {
    if (!queryLower) return activeRows;
    return activeRows.filter(r => {
      return editorCols.some((k) => (r.cells?.[k] ?? '').toLowerCase().includes(queryLower));
    });
  }, [activeRows, editorCols, queryLower]);

  const totalPages = Math.max(1, Math.ceil(filteredActiveRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredActiveRows.slice(start, start + pageSize);
  }, [filteredActiveRows, pageSize, safePage]);

  const toggleRowSelected = (rowId: string) => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      next.has(rowId) ? next.delete(rowId) : next.add(rowId);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedRowIds(prev => {
      const next = new Set(prev);
      pageRows.forEach(r => next.add(r.id));
      return next;
    });
  };

  const selectNone = () => setSelectedRowIds(new Set());

  const deleteSelected = () => {
    if (selectedRowIds.size === 0) return;
    setEditableRows(prev => prev.map(r => selectedRowIds.has(r.id) ? { ...r, active: false } : r));
    setSelectedRowIds(new Set());
  };

  const addRow = () => {
    const blank: Record<string, string> = {};
    editorCols.forEach(c => { blank[c] = ''; });
    const nr = { id: rowId(), active: true, cells: blank };
    setEditableRows(prev => [nr, ...prev]);
    setSelectedRowIds(prev => new Set(prev).add(nr.id));
    setPage(1);
  };

  const setCell = (rowId: string, key: string, value: string) => {
    setEditableRows(prev => prev.map(r => r.id === rowId ? { ...r, cells: { ...r.cells, [key]: value } } : r));
  };

  // ── Confirm upload ───────────────────────────────────────────────────────────
  const confirmUpload = async () => {
    const active = editableRows.filter(r => r.active);
    const rows = active.map(r => r.cells);
    const items = rowsToItems(rows, target);
    setStep('uploading');
    try {
      const res = await onImport({ items, rows });
      if (res && typeof (res as any).created !== 'undefined') {
        setUploadResult(res as any);
      } else {
        setUploadResult(null);
      }
      setStep('done');
    } catch (e: any) {
      setUploadResult({ created: [], errors: [{ index: 0, message: e?.message ?? 'Upload failed' }] });
      setStep('done');
    }
  };

  // ── Template download ────────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const csv = generateLevelTemplateCSV(target);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${target}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Collapsed toggle ─────────────────────────────────────────────────────────
  const header = (
    <button
      onClick={() => step === 'collapsed' ? setStep('input') : reset()}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border ${ac.border} ${ac.bg} ${ac.text} font-bold text-sm transition-colors hover:brightness-95`}
    >
      <span className="flex items-center gap-2">
        <Upload className="w-4 h-4" />
        Bulk Import {TARGET_LABELS[target]}
        {contextLabel && <span className="font-normal opacity-70 text-xs">— {contextLabel}</span>}
      </span>
      {step === 'collapsed' ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
  );

  if (step === 'collapsed') return <div>{header}</div>;

  // ── Done ─────────────────────────────────────────────────────────────────────
  if (step === 'done') return (
    <div className={`rounded-xl border ${ac.border} overflow-hidden`}>
      {header}
      <div className={`${ac.bg} px-5 py-6 flex flex-col items-center gap-3 text-center`}>
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-emerald-600" />
        </div>
        <p className={`font-bold ${ac.text}`}>Import complete!</p>
        {uploadResult && (
          <div className="w-full max-w-md text-left bg-white/60 border border-white/40 rounded-xl p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">Created</span>
              <span className="font-extrabold text-emerald-700">{uploadResult.created.length}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="font-bold text-slate-700">Errors</span>
              <span className={`font-extrabold ${uploadResult.errors.length ? 'text-red-700' : 'text-slate-500'}`}>{uploadResult.errors.length}</span>
            </div>
            {uploadResult.errors.length > 0 && (
              <div className="mt-2 max-h-28 overflow-y-auto space-y-1 pr-1">
                {uploadResult.errors.slice(0, 20).map((e, i) => (
                  <div key={i} className="bg-red-50 border border-red-200 rounded-lg px-2 py-1 text-red-700">
                    <span className="font-bold">Row {e.index + 1}</span>{e.field ? <span className="opacity-80"> [{e.field}]</span> : null}: {e.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <button onClick={reset} className={`px-4 py-2 text-xs font-bold rounded-lg text-white ${ac.btn}`}>
          Import More
        </button>
      </div>
    </div>
  );

  // ── Uploading ────────────────────────────────────────────────────────────────
  if (step === 'uploading') {
    return (
      <div className={`rounded-xl border ${ac.border} overflow-hidden`}>
        {header}
        <div className="p-6 bg-white flex flex-col items-center gap-3 text-center">
          <Loader2 className={`w-8 h-8 animate-spin ${ac.text}`} />
          <p className="text-sm font-bold text-slate-800">Uploading…</p>
          <p className="text-xs text-slate-500">Please wait while we create records in the database.</p>
        </div>
      </div>
    );
  }

  // ── Preview/Edit ─────────────────────────────────────────────────────────────
  if (step === 'preview' && parseResult) {
    const hasParseErrors = (parseResult.errors?.length ?? 0) > 0;
    const hasValidationErrors = validation.rowErrors.length > 0;
    const canUpload = activeRows.length > 0 && rowsWithIssueCount === 0;

    return (
      <div className={`rounded-xl border ${ac.border} overflow-hidden`}>
        {header}
        <div className="p-4 space-y-4 bg-white">
          {/* File badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <FileText className="w-3.5 h-3.5" />
              <span className="font-semibold">{fileName}</span>
              <span>— {parseResult.rowCount} row{parseResult.rowCount !== 1 ? 's' : ''} parsed</span>
            </div>
            <button
              onClick={() => { setStep('input'); setParseResult(null); }}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Change
            </button>
          </div>

          {/* Parse errors (skipped rows) */}
          {hasParseErrors && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                <AlertTriangle className="w-4 h-4" /> {parseResult.errors.length} row{parseResult.errors.length > 1 ? 's' : ''} with parse errors (skipped)
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                {parseResult.errors.map((err, i) => (
                  <div key={i} className="text-xs text-red-700 bg-red-100 rounded-lg px-3 py-1.5 font-medium">
                    <span className="font-bold">Row {err.row}</span>
                    {err.column && <span className="text-red-500"> [{err.column}]</span>}: {err.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Toolbar */}
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <button
                type="button"
                onClick={addRow}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-extrabold hover:bg-slate-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Row
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                disabled={selectedRowIds.size === 0}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-extrabold hover:bg-slate-50 disabled:opacity-40 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Remove Selected
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditableRows((parseResult.rows ?? []).map(c => ({
                    id: rowId(),
                    active: true,
                    cells: normalizeEditableRowCells(target, { ...c }),
                  })));
                  setSelectedRowIds(new Set());
                  setQuery('');
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-extrabold hover:bg-slate-50 flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  placeholder="Search rows…"
                  className="pl-9 pr-3 py-2 text-xs font-semibold w-full sm:w-64 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
              <div className={`text-[10px] font-extrabold px-2.5 py-2 rounded-xl ${ac.badge}`}>
                {activeRows.length} active • {activeRows.length - rowsWithIssueCount} valid row{activeRows.length - rowsWithIssueCount !== 1 ? 's' : ''}
                {rowsWithIssueCount > 0 ? ` • ${rowsWithIssueCount} with issues (${validation.rowErrors.length} messages)` : ''}
              </div>
            </div>
          </div>

          {/* Editable table */}
          {activeRows.length > 0 ? (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="border-b border-slate-200">
                      <th className="py-2.5 px-3 w-10"></th>
                      {editorCols.map((key) => (
                        <th key={key} className="py-2.5 px-3 font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageRows.map((r) => {
                      const rowIssues = errorsByRowId[r.id] ?? [];
                      const selected = selectedRowIds.has(r.id);
                      return (
                        <tr key={r.id} className={`transition-colors ${rowIssues.length ? 'bg-red-50/30' : selected ? 'bg-blue-50' : 'bg-white'} hover:bg-slate-50`}>
                          <td className="py-2 px-3 align-top">
                            <button
                              type="button"
                              onClick={() => toggleRowSelected(r.id)}
                              className="w-5 h-5 rounded border-2 flex items-center justify-center"
                            >
                              {selected ? <Check className="w-3 h-3" /> : null}
                            </button>
                            {rowIssues.length > 0 && (
                              <div className="mt-1 text-[10px] font-bold text-red-700 leading-tight max-w-[4.5rem]">
                                {rowIssues.map((issue, ii) => (
                                  <div key={ii} title={`${issue.column}: ${issue.message}`}>{issue.column}</div>
                                ))}
                              </div>
                            )}
                          </td>
                          {editorCols.map((k) => {
                            const ed = getLevelCellEditor(target, k, r.cells ?? {});
                            const cellErr = rowIssues.some(x => x.column === k);
                            const fieldCls = `w-full min-w-[140px] px-3 py-2 rounded-xl border text-xs font-semibold outline-none ${
                              cellErr
                                ? 'border-red-300 bg-red-50 focus:ring-2 focus:ring-red-500/10'
                                : 'border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500'
                            }`;
                            if (ed.kind === 'select') {
                              return (
                                <td key={k} className="py-2 px-3 align-top">
                                  <select
                                    value={r.cells?.[k] ?? ''}
                                    aria-label={k}
                                    onChange={(e) => setCell(r.id, k, e.target.value)}
                                    className={fieldCls}
                                  >
                                    {ed.options.map((o, oi) => (
                                      <option key={`${r.id}-${k}-${oi}-${o.value}`} value={o.value}>{o.label}</option>
                                    ))}
                                  </select>
                                </td>
                              );
                            }
                            return (
                              <td key={k} className="py-2 px-3 align-top">
                                <input
                                  value={r.cells?.[k] ?? ''}
                                  onChange={(e) => setCell(r.id, k, e.target.value)}
                                  className={`${fieldCls} min-w-[160px]`}
                                  placeholder={k}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            !hasParseErrors && (
              <div className="py-8 text-center text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                No valid rows found.
              </div>
            )
          )}

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-500 font-semibold">
              <span>Page</span>
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} className="px-2 py-1 border border-slate-200 rounded-lg hover:bg-slate-50">Prev</button>
              <span className="font-black text-slate-900">{safePage}</span>
              <span>of {totalPages}</span>
              <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-2 py-1 border border-slate-200 rounded-lg hover:bg-slate-50">Next</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-semibold">Rows/page</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="px-2 py-1 border border-slate-200 rounded-lg bg-white text-slate-700 font-bold"
              >
                {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button type="button" onClick={selectAllVisible} className="px-2 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 font-bold text-slate-600">Select page</button>
              <button type="button" onClick={selectNone} className="px-2 py-1 border border-slate-200 rounded-lg hover:bg-slate-50 font-bold text-slate-600">Clear</button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={reset} className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button
              onClick={confirmUpload}
              disabled={!canUpload}
              className={`flex-1 py-2.5 px-4 text-white rounded-xl text-sm font-bold transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${ac.btn}`}
            >
              Confirm Upload {activeRows.length > 0 ? `${activeRows.length} ` : ''}{TARGET_LABELS[target]}
            </button>
          </div>
          {hasValidationErrors && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 font-semibold">
              Fix the highlighted cells before uploading.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Input step ───────────────────────────────────────────────────────────────
  return (
    <div className={`rounded-xl border ${ac.border} overflow-hidden`}>
      {header}
      <div className="bg-white p-4 space-y-4">
        {/* Tab switcher */}
        <div className="flex gap-1 border-b border-slate-200">
          <button
            onClick={() => setInputTab('file')}
            className={`px-4 py-2 text-sm font-bold flex items-center gap-1.5 border-b-2 transition-colors ${inputTab === 'file' ? `border-${accent}-500 ${ac.text}` : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <Upload className="w-3.5 h-3.5" /> Upload File
          </button>
          <button
            onClick={() => setInputTab('paste')}
            className={`px-4 py-2 text-sm font-bold flex items-center gap-1.5 border-b-2 transition-colors ${inputTab === 'paste' ? `border-${accent}-500 ${ac.text}` : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <Clipboard className="w-3.5 h-3.5" /> Paste from Excel
          </button>
        </div>

        {/* File upload tab */}
        {inputTab === 'file' && (
          <div className="space-y-3">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all ${dragging ? `${ac.border} ${ac.bg}` : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'}`}
            >
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={onFileChange} />
              <Upload className={`w-8 h-8 mb-2 ${dragging ? ac.text : 'text-slate-400'}`} />
              <p className="text-sm font-bold text-slate-700">Drag & drop or click to browse</p>
              <p className="text-xs text-slate-400 mt-1">.csv, .tsv, .txt — UTF-8</p>
            </div>
            <button
              onClick={downloadTemplate}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-blue-500" /> Download Template CSV
            </button>
          </div>
        )}

        {/* Paste tab */}
        {inputTab === 'paste' && (
          <div className="space-y-3">
            <div className={`flex items-start gap-2 p-3 rounded-xl ${ac.bg} ${ac.border} border text-xs ${ac.text}`}>
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Select cells in Excel (including header row) → Ctrl+C → click in the box below → Ctrl+V.</span>
            </div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              onPaste={(e) => {
                // Paste fires before the clipboard is inserted; merge synchronously.
                // Do not read e.currentTarget inside setTimeout — React clears it and .value throws.
                const ta = e.currentTarget;
                const clip = e.clipboardData.getData('text/plain');
                const start = ta.selectionStart;
                const end = ta.selectionEnd;
                const next = ta.value.slice(0, start) + clip + ta.value.slice(end);
                if (next.trim()) {
                  setFileName('pasted data');
                  setPasteText(next);
                  runParse(next);
                }
              }}
              className="w-full min-h-[160px] px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
              placeholder={TARGET_PASTE_PLACEHOLDER[target]}
              spellCheck={false}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setPasteText(''); }}
                className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Clear
              </button>
              <button
                onClick={handleParsePaste}
                disabled={!pasteText.trim()}
                className={`flex-1 py-2 text-sm font-bold text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${ac.btn}`}
              >
                Re-parse from text
              </button>
            </div>
          </div>
        )}

        {/* Column reference (collapsible) */}
        <div>
          <button
            onClick={() => setShowCols(v => !v)}
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700"
          >
            <Table2 className="w-3.5 h-3.5" />
            Column Reference
            {showCols ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>

          {showCols && (
            <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-2 px-3 font-bold text-slate-500 uppercase tracking-wider">Column</th>
                    <th className="py-2 px-3 font-bold text-slate-500 uppercase tracking-wider">Description</th>
                    <th className="py-2 px-3 font-bold text-slate-500 uppercase tracking-wider text-center hidden sm:table-cell">Req</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {LEVEL_COLUMN_DOCS[target].map(doc => (
                    <tr key={doc.name} className="align-top">
                      <td className="py-2 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">{doc.name}</td>
                      <td className="py-2 px-3 text-slate-600">
                        {doc.description}
                        {doc.allowedValues && (
                          <span className="block text-indigo-600 font-semibold mt-0.5">Values: {doc.allowedValues}</span>
                        )}
                        <span className="block text-slate-400 mt-0.5">e.g. {doc.example}</span>
                      </td>
                      <td className="py-2 px-3 text-center hidden sm:table-cell">
                        {doc.required
                          ? <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-bold">Yes</span>
                          : <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded">No</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Cancel */}
        <div className="pt-1">
          <button onClick={reset} className="text-xs font-bold text-slate-400 hover:text-slate-600">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
