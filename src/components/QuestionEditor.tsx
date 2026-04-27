import React, { useState } from 'react';
import { Plus, X, Image, CheckCircle2, AlertTriangle, Eye } from 'lucide-react';
import { MathRenderer } from './MathRenderer';
import { apiFetch } from '../hooks/useApi';

type QuestionType = 'mcq' | 'true_false' | 'image_upload';
type QuestionContextType = 'prereq' | 'subtopic' | 'finaltest';

type QuestionEditorProps = {
  contextType: QuestionContextType;
  contextId: string;
  label: string;
  onSaved: () => void;
  onCancel: () => void;
};

export function QuestionEditor({ contextType, contextId, label, onSaved, onCancel }: QuestionEditorProps) {
  const [qType, setQType] = useState<QuestionType>('mcq');
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [options, setOptions] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [order, setOrder] = useState(0);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => setOptions([...options, '']);
  const removeOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
    if (correctAnswer === options[index]) setCorrectAnswer('');
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImg(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'questions');

    const token = localStorage.getItem('vidhyapika_token');
    const res = await fetch('/api/upload/image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (data.url) setImageUrl(data.url);
    setUploadingImg(false);
  };

  const handleSave = async () => {
    if (!text.trim()) {
      setSaveMsg({ ok: false, text: 'Question text is required.' });
      return;
    }
    if (qType === 'mcq' && options.filter(Boolean).length < 2) {
      setSaveMsg({ ok: false, text: 'At least 2 options required for MCQ.' });
      return;
    }
    if ((qType === 'mcq' || qType === 'true_false') && !correctAnswer) {
      setSaveMsg({ ok: false, text: 'Please select the correct answer.' });
      return;
    }

    setSaving(true);
    setSaveMsg(null);

    const body: any = {
      contextType,
      contextId,
      text,
      type: qType,
      order,
    };

    if (imageUrl) body.imageUrl = imageUrl;
    if (qType === 'mcq') body.options = options.filter(Boolean);
    if (qType === 'true_false') body.options = ['True', 'False'];
    if (qType !== 'image_upload') body.correctAnswer = correctAnswer;

    const res = await apiFetch('/api/admin/questions', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (res.error) {
      setSaveMsg({ ok: false, text: res.error });
    } else {
      setSaveMsg({ ok: true, text: 'Question saved!' });
      setTimeout(() => onSaved(), 800);
    }
  };

  const trueOrFalseOptions = ['True', 'False'];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-extrabold text-slate-900">Add Question — {label}</h3>
        <button onClick={onCancel} className="p-1.5 hover:bg-slate-100 rounded-lg">
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      {/* Question Type */}
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-2">Question Type</label>
        <div className="flex gap-2">
          {(['mcq', 'true_false', 'image_upload'] as QuestionType[]).map((t) => (
            <button
              key={t}
              onClick={() => { setQType(t); setCorrectAnswer(''); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${qType === t ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {t === 'mcq' ? 'Multiple Choice' : t === 'true_false' ? 'True / False' : 'Image Upload'}
            </button>
          ))}
        </div>
      </div>

      {/* Question Text */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-bold text-slate-600">Question Text (supports LaTeX: $...$)</label>
          <button onClick={() => setPreview(!preview)} className="flex items-center gap-1 text-xs font-bold text-blue-600">
            <Eye className="w-3.5 h-3.5" /> {preview ? 'Edit' : 'Preview'}
          </button>
        </div>
        {preview ? (
          <div className="min-h-[80px] border border-slate-200 rounded-xl px-4 py-3 bg-slate-50">
            <MathRenderer text={text || 'Nothing to preview'} className="text-sm text-slate-800" />
          </div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
            placeholder="Enter question text. Use $...$ for inline math, $$...$$ for block math."
          />
        )}
      </div>

      {/* Question Image */}
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Question Image (optional)</label>
        {imageUrl ? (
          <div className="relative inline-block">
            <img src={imageUrl} alt="Question" className="max-h-40 rounded-xl border border-slate-200" />
            <button onClick={() => setImageUrl('')} className="absolute top-1 right-1 p-1 bg-white rounded-full border border-slate-200 hover:bg-red-50">
              <X className="w-3 h-3 text-red-500" />
            </button>
          </div>
        ) : (
          <label className={`flex items-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 transition-colors ${uploadingImg ? 'opacity-60 pointer-events-none' : ''}`}>
            <Image className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-500">
              {uploadingImg ? 'Uploading…' : 'Click to upload image (JPEG, PNG, WebP)'}
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
          </label>
        )}
      </div>

      {/* MCQ Options */}
      {qType === 'mcq' && (
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-2">Answer Options</label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  onClick={() => setCorrectAnswer(opt)}
                  className={`w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${correctAnswer === opt ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'}`}
                >
                  {correctAnswer === opt && <span className="block w-2 h-2 rounded-full bg-white mx-auto" />}
                </button>
                <input
                  value={opt}
                  onChange={(e) => handleOptionChange(i, e.target.value)}
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder={`Option ${i + 1} (LaTeX supported)`}
                />
                {options.length > 2 && (
                  <button onClick={() => removeOption(i)} className="p-1.5 hover:bg-red-50 rounded-lg">
                    <X className="w-3.5 h-3.5 text-red-500" />
                  </button>
                )}
              </div>
            ))}
            {options.length < 6 && (
              <button onClick={addOption} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">
                <Plus className="w-3.5 h-3.5" /> Add Option
              </button>
            )}
          </div>
          {correctAnswer && (
            <p className="text-xs text-emerald-600 font-medium mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Correct: <MathRenderer text={correctAnswer} />
            </p>
          )}
        </div>
      )}

      {/* True / False */}
      {qType === 'true_false' && (
        <div>
          <label className="block text-xs font-bold text-slate-600 mb-2">Correct Answer</label>
          <div className="flex gap-3">
            {trueOrFalseOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setCorrectAnswer(opt)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${correctAnswer === opt ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Image Upload info */}
      {qType === 'image_upload' && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 font-medium">
          Students will upload an image of their handwritten solution. This type is manually reviewed by the admin.
        </div>
      )}

      {/* Order */}
      <div>
        <label className="block text-xs font-bold text-slate-600 mb-1">Display Order</label>
        <input
          type="number"
          value={order}
          onChange={(e) => setOrder(Number(e.target.value))}
          className="w-24 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none"
        />
      </div>

      {saveMsg && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${saveMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {saveMsg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {saveMsg.text}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
        <button onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-60">
          {saving ? 'Saving…' : 'Save Question'}
        </button>
      </div>
    </div>
  );
}
