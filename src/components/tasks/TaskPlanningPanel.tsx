import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Ban, CheckSquare, Link2, ListChecks, Loader2, Plus, Search, Square, Trash2, X } from 'lucide-react';
import type { Task } from '../../types';
import { STATUSES } from '../../types';
import { inputClass } from '../admin/AdminUi';
import { userErrorMessage } from '../../utils/errorMessages';
import { toPersianDigits } from '../../utils/helpers';
import {
  addCriterion,
  addTaskDependency,
  deleteCriterion,
  getTaskPlanning,
  removeTaskDependency,
  searchTasks,
  setCriterionMet,
  setTaskBlocker,
  STATUS_FROM_SERVER,
} from '../../services/taskFeaturesApi';
import type { TaskBrief, TaskListRow, TaskPlanning } from './types';

/**
 * «پیش‌نیازها و معیار پذیرش» in the task detail (CAT-73, CAT-180): the tasks this one waits for, those
 * waiting for it, a free-text blocker and the acceptance criteria. The server refuses to complete the
 * task while a dependency is open or a criterion is not met; only the owner or a task manager edits.
 */
export const TaskPlanningPanel: React.FC<{ task: Task; canEdit: boolean }> = ({ task, canEdit }) => {
  const [planning, setPlanning] = useState<TaskPlanning | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getTaskPlanning(task.id)
      .then((p) => { setPlanning(p); setError(''); })
      .catch((err) => setError(userErrorMessage(err, 'پیش‌نیازهای فعالیت خوانده نشد.')));
  }, [task.id]);
  useEffect(load, [load, task.updatedAt]);

  /** Every change answers with the whole planning, which replaces what is shown. */
  const run = async (action: () => Promise<TaskPlanning>, fallback: string) => {
    setBusy(true);
    try {
      setPlanning(await action());
      setError('');
      return true;
    } catch (err) {
      setError(userErrorMessage(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!planning) {
    return error ? <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p> : null;
  }
  const empty = !planning.blockedReason && planning.blockedBy.length === 0 && planning.blocking.length === 0 && planning.criteria.length === 0;
  if (empty && !canEdit) return null;

  const metCount = planning.criteria.filter((c) => c.isMet).length;

  return (
    <section className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3" aria-label="پیش‌نیازها و معیار پذیرش">
      <div className="flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-800 dark:text-slate-100">
          <ListChecks className="w-4 h-4 text-indigo-500" />
          پیش‌نیازها و معیار پذیرش
        </h4>
        {!planning.canComplete && task.status !== 'completed' && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
            هنوز قابل اتمام نیست
          </span>
        )}
      </div>

      {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <BlockerRow
        reason={planning.blockedReason}
        canEdit={canEdit}
        busy={busy}
        onSave={(reason) => run(() => setTaskBlocker(task.id, reason), 'مانع ذخیره نشد.')}
      />

      <div className="space-y-1.5">
        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">منتظر این فعالیت‌هاست</p>
        {planning.blockedBy.length === 0 && <p className="text-xs text-slate-400">وابستگی ثبت نشده است.</p>}
        {planning.blockedBy.map((b) => (
          <BriefRow
            key={b.id}
            brief={b}
            onRemove={canEdit ? () => run(() => removeTaskDependency(task.id, b.id), 'وابستگی حذف نشد.') : undefined}
            disabled={busy}
          />
        ))}
        {canEdit && (
          <DependencyPicker
            excludeIds={[task.id, ...planning.blockedBy.map((b) => b.id)]}
            disabled={busy}
            onPick={(id) => run(() => addTaskDependency(task.id, id), 'وابستگی ثبت نشد.')}
          />
        )}
      </div>

      {planning.blocking.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">این فعالیت‌ها منتظر این فعالیت هستند</p>
          {planning.blocking.map((b) => <BriefRow key={b.id} brief={b} />)}
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
          معیار پذیرش
          {planning.criteria.length > 0 && (
            <span className="font-medium text-slate-400 mr-1">({toPersianDigits(metCount)} از {toPersianDigits(planning.criteria.length)})</span>
          )}
        </p>
        {planning.criteria.length === 0 && <p className="text-xs text-slate-400">معیاری برای «تمام‌شده» تعریف نشده است.</p>}
        <ul className="space-y-1">
          {[...planning.criteria].sort((a, b) => a.sortOrder - b.sortOrder).map((c) => (
            <li key={c.id} className="flex items-start gap-2 group">
              <button
                type="button"
                disabled={!canEdit || busy}
                onClick={() => run(() => setCriterionMet(task.id, c.id, !c.isMet), 'معیار ذخیره نشد.')}
                className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-400 disabled:cursor-default cursor-pointer"
                aria-label={c.isMet ? 'برداشتن تیک' : 'زدن تیک'}
              >
                {c.isMet ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-400" />}
              </button>
              <span className={`flex-1 text-xs leading-relaxed ${c.isMet ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>{c.text}</span>
              {canEdit && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => deleteCriterion(task.id, c.id), 'معیار حذف نشد.')}
                  className="p-0.5 text-slate-300 hover:text-rose-500 cursor-pointer"
                  aria-label="حذف معیار"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {canEdit && <AddCriterion disabled={busy} onAdd={(text) => run(() => addCriterion(task.id, text), 'معیار ثبت نشد.')} />}
      </div>
    </section>
  );
};

const BriefRow: React.FC<{ brief: TaskBrief; onRemove?: () => void; disabled?: boolean }> = ({ brief, onRemove, disabled }) => {
  const status = STATUSES[STATUS_FROM_SERVER[brief.status]];
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
      <Link2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span className={`flex-1 text-xs font-semibold truncate ${brief.isDone ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`} title={brief.title}>{brief.title}</span>
      {status && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${status.badgeBg} ${status.badgeText}`}>{status.title}</span>}
      {onRemove && (
        <button type="button" disabled={disabled} onClick={onRemove} className="p-0.5 text-slate-400 hover:text-rose-500 cursor-pointer" aria-label="حذف وابستگی">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

const BlockerRow: React.FC<{ reason: string | null; canEdit: boolean; busy: boolean; onSave: (reason: string | null) => Promise<boolean> }> = ({ reason, canEdit, busy, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(reason || '');
  useEffect(() => setText(reason || ''), [reason]);

  if (editing) {
    return (
      <form
        className="flex gap-2"
        onSubmit={async (e) => { e.preventDefault(); if (await onSave(text)) setEditing(false); }}
      >
        <input id="task-blocker" className={inputClass} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="چه چیزی جلوی پیشرفت این فعالیت را گرفته است؟" autoFocus />
        <button type="submit" disabled={busy} className="px-3 rounded-xl bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50">ذخیره</button>
        <button type="button" onClick={() => { setText(reason || ''); setEditing(false); }} className="px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer">انصراف</button>
      </form>
    );
  }
  if (!reason && !canEdit) return null;
  return (
    <div className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs ${reason ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200' : 'border-dashed border-slate-200 dark:border-slate-700 text-slate-400'}`}>
      <Ban className="w-4 h-4 shrink-0 mt-0.5" />
      <span className="flex-1 leading-relaxed">{reason ? <><b>مانع: </b>{reason}</> : 'مانعی ثبت نشده است.'}</span>
      {canEdit && (
        <span className="flex gap-2 shrink-0">
          <button type="button" onClick={() => setEditing(true)} className="font-bold underline cursor-pointer">{reason ? 'ویرایش' : 'ثبت مانع'}</button>
          {reason && <button type="button" disabled={busy} onClick={() => onSave(null)} className="font-bold underline cursor-pointer">برداشتن</button>}
        </span>
      )}
    </div>
  );
};

const AddCriterion: React.FC<{ disabled: boolean; onAdd: (text: string) => Promise<boolean> }> = ({ disabled, onAdd }) => {
  const [text, setText] = useState('');
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (text.trim() && (await onAdd(text))) setText('');
      }}
    >
      <input id="task-new-criterion" className={inputClass} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="معیار جدید، مثلاً «تأیید واحد مالی گرفته شود»" />
      <button type="submit" disabled={disabled || !text.trim()} className="shrink-0 inline-flex items-center gap-1 px-3 rounded-xl bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50">
        <Plus className="w-3.5 h-3.5" /> افزودن
      </button>
    </form>
  );
};

/** Search the caller's tasks by title and pick the one this task waits for. */
const DependencyPicker: React.FC<{ excludeIds: string[]; disabled: boolean; onPick: (id: string) => Promise<boolean> }> = ({ excludeIds, disabled, onPick }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TaskListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    if (!open) return undefined;
    const current = ++seq.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchTasks(query)
        .then((page) => { if (current === seq.current) setResults(page.items || []); })
        .catch(() => { if (current === seq.current) setResults([]); })
        .finally(() => { if (current === seq.current) setLoading(false); });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
        <Plus className="w-3.5 h-3.5" /> افزودن پیش‌نیاز
      </button>
    );
  }
  const candidates = results.filter((r) => !excludeIds.includes(r.id));
  return (
    <div className="space-y-1.5 p-2 rounded-xl border border-indigo-100 dark:border-slate-700 bg-indigo-50/40 dark:bg-slate-800/40">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
        <input id="task-dependency-search" className={`${inputClass} pr-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی عنوان فعالیت..." autoFocus />
      </div>
      <div className="max-h-44 overflow-y-auto space-y-1">
        {loading && <p className="flex items-center gap-1 text-xs text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> در حال جستجو...</p>}
        {!loading && candidates.length === 0 && <p className="text-xs text-slate-400">فعالیتی پیدا نشد.</p>}
        {!loading && candidates.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={disabled}
            onClick={async () => { if (await onPick(r.id)) { setOpen(false); setQuery(''); } }}
            className="w-full text-right px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 cursor-pointer truncate"
          >
            {r.title}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setOpen(false)} className="text-xs font-bold text-slate-500 hover:underline cursor-pointer">بستن</button>
    </div>
  );
};
