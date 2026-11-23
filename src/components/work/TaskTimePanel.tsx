import React, { useCallback, useEffect, useState } from 'react';
import { Clock3, Pencil, Play, Plus, Square } from 'lucide-react';
import type { Task } from '../../types';
import { inputClass, toLatinDigits } from '../admin/AdminUi';
import { showToast } from '../../utils/toast';
import { userErrorMessage } from '../../utils/errorMessages';
import { toPersianDigits } from '../../utils/helpers';
import { can } from '../../utils/permissions';
import { getSessionUser } from '../../services/nexusApi';
import { getTaskTime, logTime, setTaskEstimate, startTimer, stopTimer, todayIso, WORK_PERMISSIONS } from '../../services/workApi';
import { formatMinutes, parseDuration, useRunningTimer } from './workShared';
import type { TaskTime } from './types';

/**
 * The task detail's time block (CAT-77, CAT-159): estimate against the time logged, a timer for this
 * task and a quick «ثبت زمان» for today. Track 2 owns this file; TaskDetailModal (Track 1) only renders it.
 */
export const TaskTimePanel: React.FC<{ task: Task }> = ({ task }) => {
  const me = getSessionUser();
  const canLog = can(me, WORK_PERMISSIONS.logTime);
  const canEstimate = can(me, WORK_PERMISSIONS.tasksEdit);
  const [time, setTime] = useState<TaskTime | null>(null);
  const [editingEstimate, setEditingEstimate] = useState(false);
  const [estimate, setEstimate] = useState('');
  const [logging, setLogging] = useState(false);
  const [duration, setDuration] = useState('');
  const [busy, setBusy] = useState(false);
  const { timer, elapsed, reload: reloadTimer } = useRunningTimer(canLog);

  const load = useCallback(() => {
    getTaskTime(task.id).then(setTime).catch(() => setTime(null));
  }, [task.id]);
  useEffect(load, [load]);

  if (!time || task.isRecurring) return null;
  if (!canLog && time.estimatedMinutes === null && time.actualMinutes === 0) return null;

  const timerHere = timer?.taskId === task.id;
  const pct = time.estimatedMinutes ? Math.round((time.actualMinutes / time.estimatedMinutes) * 100) : null;

  const run = async (action: () => Promise<unknown>, ok: string, fallback: string) => {
    setBusy(true);
    try {
      await action();
      showToast(ok, 'ok');
      load();
      reloadTimer();
      return true;
    } catch (err) {
      showToast(userErrorMessage(err, fallback), 'error');
      reloadTimer();
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    const minutes = estimate.trim() ? parseDuration(estimate) : null;
    if (estimate.trim() && (!minutes || minutes < 1)) { showToast('برآورد را مثل ۸:۰۰ (ساعت:دقیقه) یا ۴۸۰ (دقیقه) بنویسید.', 'error'); return; }
    if (await run(() => setTaskEstimate(task.id, minutes), minutes ? 'برآورد ذخیره شد.' : 'برآورد برداشته شد.', 'برآورد ذخیره نشد.')) setEditingEstimate(false);
  };

  const saveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const minutes = parseDuration(duration);
    if (!minutes || minutes < 1 || minutes > 1440) { showToast('مدت را مثل ۱:۳۰ یا ۹۰ بنویسید؛ حداکثر ۲۴ ساعت.', 'error'); return; }
    if (await run(() => logTime({ taskId: task.id, date: todayIso(), minutes }), `${formatMinutes(minutes)} برای امروز ثبت شد.`, 'زمان ثبت نشد.')) {
      setDuration('');
      setLogging(false);
    }
  };

  return (
    <section className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5" aria-label="زمان صرف‌شده">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-800 dark:text-slate-100">
          <Clock3 className="w-4 h-4 text-indigo-500" /> زمان صرف‌شده
        </h4>
        {canLog && task.status !== 'completed' && (
          <div className="flex gap-2">
            {timerHere ? (
              <button type="button" disabled={busy} onClick={() => run(stopTimer, 'زمان‌سنج متوقف و زمان ثبت شد.', 'زمان‌سنج متوقف نشد.')} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer disabled:opacity-50">
                <Square className="w-3.5 h-3.5" /> توقف ({formatMinutes(elapsed)})
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || !!timer}
                title={timer ? `زمان‌سنج روی «${timer.taskTitle || 'فعالیت دیگر'}» روشن است` : undefined}
                onClick={() => run(() => startTimer(task.id), 'زمان‌سنج شروع شد.', 'زمان‌سنج شروع نشد.')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300 text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" /> شروع زمان‌سنج
              </button>
            )}
            <button type="button" onClick={() => setLogging((v) => !v)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> ثبت زمان
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
        <span className="text-slate-500 dark:text-slate-400">ثبت‌شده: <b className="text-slate-800 dark:text-slate-100">{formatMinutes(time.actualMinutes)}</b></span>
        {!editingEstimate && (
          <span className="text-slate-500 dark:text-slate-400">
            برآورد: <b className="text-slate-800 dark:text-slate-100">{time.estimatedMinutes ? formatMinutes(time.estimatedMinutes) : 'ثبت نشده'}</b>
            {canEstimate && (
              <button type="button" onClick={() => { setEstimate(time.estimatedMinutes ? `${Math.floor(time.estimatedMinutes / 60)}:${String(time.estimatedMinutes % 60).padStart(2, '0')}` : ''); setEditingEstimate(true); }} className="mr-1.5 text-indigo-600 dark:text-indigo-400 cursor-pointer" aria-label="ویرایش برآورد">
                <Pencil className="w-3 h-3 inline" />
              </button>
            )}
          </span>
        )}
      </div>

      {pct !== null && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className={`h-full ${pct > 100 ? 'bg-rose-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <span className={`text-[11px] font-bold tabular-nums ${pct > 100 ? 'text-rose-600' : 'text-slate-500'}`}>{toPersianDigits(pct)}٪ برآورد</span>
        </div>
      )}

      {editingEstimate && (
        <form onSubmit={saveEstimate} className="flex gap-2">
          <input id="task-estimate" className={inputClass} dir="ltr" value={estimate} onChange={(e) => setEstimate(toLatinDigits(e.target.value))} placeholder="8:00" aria-label="برآورد (ساعت:دقیقه)" autoFocus />
          <button type="submit" disabled={busy} className="px-3 rounded-xl bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50">ذخیره</button>
          <button type="button" onClick={() => setEditingEstimate(false)} className="px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer">انصراف</button>
        </form>
      )}

      {logging && (
        <form onSubmit={saveLog} className="flex gap-2">
          <input id="task-log-duration" className={inputClass} dir="ltr" value={duration} onChange={(e) => setDuration(toLatinDigits(e.target.value))} placeholder="1:30" aria-label="مدت امروز (ساعت:دقیقه)" autoFocus />
          <button type="submit" disabled={busy} className="shrink-0 px-3 rounded-xl bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50">ثبت برای امروز</button>
        </form>
      )}
    </section>
  );
};
