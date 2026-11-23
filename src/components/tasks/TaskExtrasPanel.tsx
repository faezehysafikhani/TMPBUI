import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Shapes } from 'lucide-react';
import type { Task } from '../../types';
import { inputClass, toLatinDigits } from '../admin/AdminUi';
import { JalaliDatePicker } from '../JalaliDatePicker';
import { userErrorMessage } from '../../utils/errorMessages';
import { getTaskExtras, saveTaskExtras } from '../../services/taskFeaturesApi';
import { formatJalaliDay, safeColor, useWorkTypes } from './taskLookups';
import type { TaskExtras, TaskFieldValue } from './types';

/** How a stored value reads (dates in Jalali, yes/no in words). */
function displayValue(field: TaskFieldValue): string {
  const v = field.value;
  if (v === null || v === '') return '—';
  if (field.kind === 'Boolean') return v === 'true' ? 'بله' : 'خیر';
  if (field.kind === 'Date') return formatJalaliDay(v);
  return v;
}

/**
 * «نوع فعالیت و فیلدها» in the task detail (CAT-251, CAT-252): the task's work type and its value for
 * each of the organization's fields. Nothing is shown when the organization defined neither.
 */
export const TaskExtrasPanel: React.FC<{ task: Task; canEdit: boolean }> = ({ task, canEdit }) => {
  const workTypes = useWorkTypes();
  const [extras, setExtras] = useState<TaskExtras | null>(null);
  const [editing, setEditing] = useState(false);
  const [workTypeId, setWorkTypeId] = useState<string>('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    getTaskExtras(task.id).then(setExtras).catch(() => setExtras(null));
  }, [task.id]);
  useEffect(load, [load]);

  const startEdit = () => {
    if (!extras) return;
    setWorkTypeId(extras.workTypeId || '');
    setValues(Object.fromEntries(extras.fields.map((f) => [f.fieldId, f.value ?? ''])));
    setError('');
    setEditing(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extras) return;
    setSaving(true);
    try {
      const payload = Object.fromEntries(extras.fields.map((f) => [f.fieldId, (values[f.fieldId] ?? '').trim() || null]));
      setExtras(await saveTaskExtras(task.id, workTypeId || null, payload));
      setEditing(false);
      setError('');
    } catch (err) {
      setError(userErrorMessage(err, 'نوع و فیلدهای فعالیت ذخیره نشد.'));
    } finally {
      setSaving(false);
    }
  };

  const activeTypes = workTypes.filter((w) => w.isActive || w.id === extras?.workTypeId);
  if (!extras || (activeTypes.length === 0 && extras.fields.length === 0)) return null;
  const currentType = workTypes.find((w) => w.id === extras.workTypeId);

  return (
    <section className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5" aria-label="نوع فعالیت و فیلدها">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-800 dark:text-slate-100">
          <Shapes className="w-4 h-4 text-indigo-500" />
          نوع فعالیت و فیلدها
        </h4>
        {canEdit && !editing && (
          <button type="button" onClick={startEdit} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
            <Pencil className="w-3.5 h-3.5" /> ویرایش
          </button>
        )}
      </div>

      {!editing && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {activeTypes.length > 0 && (
            <div className="flex gap-2">
              <dt className="text-slate-500 dark:text-slate-400 shrink-0">نوع:</dt>
              <dd className="font-bold text-slate-800 dark:text-slate-100">
                {extras.workTypeName ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: safeColor(currentType?.color) || '#94a3b8' }} />
                    {extras.workTypeName}
                  </span>
                ) : '—'}
              </dd>
            </div>
          )}
          {extras.fields.map((f) => (
            <div key={f.fieldId} className="flex gap-2 min-w-0">
              <dt className="text-slate-500 dark:text-slate-400 shrink-0">{f.name}{f.isRequired && <span className="text-rose-500">*</span>}:</dt>
              <dd className="font-semibold text-slate-800 dark:text-slate-100 break-words min-w-0">{displayValue(f)}</dd>
            </div>
          ))}
        </dl>
      )}

      {editing && (
        <form onSubmit={save} className="space-y-2.5">
          {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
          {activeTypes.length > 0 && (
            <label className="block">
              <span className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">نوع فعالیت</span>
              <select id="task-work-type" className={inputClass} value={workTypeId} onChange={(e) => setWorkTypeId(e.target.value)}>
                <option value="">بدون نوع</option>
                {activeTypes.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
          )}
          {extras.fields.map((f) => (
            <FieldInput key={f.fieldId} field={f} value={values[f.fieldId] ?? ''} onChange={(v) => setValues((prev) => ({ ...prev, [f.fieldId]: v }))} />
          ))}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50">{saving ? 'در حال ذخیره...' : 'ذخیره'}</button>
            <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer">انصراف</button>
          </div>
        </form>
      )}
    </section>
  );
};

const FieldInput: React.FC<{ field: TaskFieldValue; value: string; onChange: (value: string) => void }> = ({ field, value, onChange }) => {
  const id = `task-field-${field.fieldId}`;
  const label = (
    <span className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
      {field.name} {field.isRequired && <span className="text-rose-500">*</span>}
    </span>
  );
  switch (field.kind) {
    case 'Boolean':
      return (
        <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
          <input id={id} type="checkbox" checked={value === 'true'} onChange={(e) => onChange(e.target.checked ? 'true' : 'false')} />
          {field.name}
        </label>
      );
    case 'Choice':
      return (
        <label className="block">{label}
          <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} required={field.isRequired}>
            <option value="">انتخاب کنید</option>
            {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      );
    case 'Date':
      return (
        <div>{label}
          <JalaliDatePicker value={value || undefined} onChange={(v) => onChange(v || '')} ariaLabel={field.name} allowYearSelection />
        </div>
      );
    case 'Number':
      return (
        <label className="block">{label}
          <input id={id} className={inputClass} inputMode="decimal" dir="ltr" value={value} onChange={(e) => onChange(toLatinDigits(e.target.value))} required={field.isRequired} />
        </label>
      );
    default:
      return (
        <label className="block">{label}
          <input id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} maxLength={1000} required={field.isRequired} />
        </label>
      );
  }
};
