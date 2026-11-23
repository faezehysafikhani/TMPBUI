import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, Pencil, Play, Plus, Send, Square, Timer, Trash2, Users } from 'lucide-react';
import type { User } from '../../types';
import {
  AdminCard,
  AdminDialog,
  Field,
  IconAction,
  inputClass,
  Notice,
  PillTabs,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  TabItem,
  toLatinDigits,
} from '../admin/AdminUi';
import { JalaliDatePicker } from '../JalaliDatePicker';
import { appConfirm } from '../../utils/appDialog';
import { showToast } from '../../utils/toast';
import { userErrorMessage } from '../../utils/errorMessages';
import { toPersianDigits } from '../../utils/helpers';
import { can } from '../../utils/permissions';
import { getSessionUser } from '../../services/nexusApi';
import { fetchAllUsersPB } from '../../services/dataService';
import {
  addDays,
  deleteTimeEntry,
  getTimesheetWeek,
  getWorkload,
  logTime,
  startTimer,
  stopTimer,
  submitTimesheetWeek,
  todayIso,
  updateTimeEntry,
  WORK_PERMISSIONS,
} from '../../services/workApi';
import { DAY_NAMES, formatHm, formatJalaliDay, formatMinutes, parseDuration, TaskSearchPicker, useRunningTimer } from './workShared';
import type { ApprovalStatus, TimeEntry, TimesheetWeek, Workload } from './types';

const STATUS_BADGE: Record<ApprovalStatus, { tone: 'slate' | 'amber' | 'green' | 'red'; label: string }> = {
  NotSubmitted: { tone: 'slate', label: 'ثبت نهایی نشده' },
  PendingApproval: { tone: 'amber', label: 'در انتظار تأیید' },
  Approved: { tone: 'green', label: 'ثبت نهایی شده' },
  Rejected: { tone: 'red', label: 'رد شده' },
};

type Tab = 'week' | 'workload';

/**
 * «ساعت کار» (CAT-159, CAT-77): the week's time on tasks, logged by hand or with the timer, sent once
 * the week is done. Time managers also see anyone's week and the team's workload.
 */
export const TimesheetsView: React.FC = () => {
  const me = getSessionUser();
  const canLog = can(me, WORK_PERMISSIONS.logTime);
  const canViewAll = can(me, WORK_PERMISSIONS.viewAllTime);
  const tabs: TabItem<Tab>[] = [
    ...(canLog || canViewAll ? [{ id: 'week' as const, label: 'هفتهٔ کاری', icon: Clock3 }] : []),
    ...(canViewAll ? [{ id: 'workload' as const, label: 'بار کاری تیم', icon: Users }] : []),
  ];
  const [tab, setTab] = useState<Tab>('week');
  return (
    <div className="w-full space-y-4" dir="rtl">
      <AdminCard className="p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-white"><Timer className="w-6 h-6 text-indigo-600" /> ساعت کار</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">زمانی که روی هر فعالیت گذاشته‌اید را ثبت کنید؛ دستی یا با زمان‌سنج. آخر هفته، هفته را ثبت نهایی کنید.</p>
        </div>
        {tabs.length > 1 && <PillTabs tabs={tabs} active={tab} onChange={setTab} />}
      </AdminCard>
      {tab === 'week' && <WeekPanel me={me} canLog={canLog} canViewAll={canViewAll} />}
      {tab === 'workload' && canViewAll && <WorkloadPanel />}
    </div>
  );
};

const WeekPanel: React.FC<{ me: User | null; canLog: boolean; canViewAll: boolean }> = ({ me, canLog, canViewAll }) => {
  const [day, setDay] = useState(todayIso());
  const [userId, setUserId] = useState<string>('');
  const [people, setPeople] = useState<User[]>([]);
  const [week, setWeek] = useState<TimesheetWeek | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<TimeEntry | 'new' | null>(null);
  const viewingOther = !!userId && userId !== me?.id;
  const { timer, elapsed, reload: reloadTimer } = useRunningTimer(canLog);

  const load = useCallback(() => {
    getTimesheetWeek(day, viewingOther ? userId : undefined)
      .then((w) => { setWeek(w); setError(''); })
      .catch((err) => setError(userErrorMessage(err, 'هفتهٔ کاری خوانده نشد.')));
  }, [day, userId, viewingOther]);
  useEffect(load, [load]);
  useEffect(() => { if (canViewAll) fetchAllUsersPB().then(setPeople).catch(() => setPeople([])); }, [canViewAll]);

  const days = useMemo(() => (week ? Array.from({ length: 7 }, (_, i) => addDays(week.weekStart, i)) : []), [week]);
  const editable = !viewingOther && canLog && week?.status !== 'PendingApproval';
  const today = todayIso();

  const stop = async () => {
    try {
      const entry = await stopTimer();
      showToast(`${formatMinutes(entry.minutes)} روی «${entry.taskTitle || 'فعالیت'}» ثبت شد.`, 'ok');
      reloadTimer();
      load();
    } catch (err) {
      showToast(userErrorMessage(err, 'زمان‌سنج متوقف نشد.'), 'error');
      reloadTimer();
    }
  };

  const submit = async () => {
    if (!week) return;
    if (!(await appConfirm(`هفتهٔ ${formatJalaliDay(week.weekStart)} با ${formatMinutes(week.totalMinutes)} ثبت نهایی شود؟ بعد از آن زمان‌های این هفته قابل تغییر نیستند.`, { confirmLabel: 'ثبت نهایی' }))) return;
    try {
      setWeek(await submitTimesheetWeek(week.weekStart));
      showToast('هفته ثبت نهایی شد.', 'ok');
    } catch (err) {
      showToast(userErrorMessage(err, 'هفته ثبت نهایی نشد.'), 'error');
    }
  };

  const remove = async (entry: TimeEntry) => {
    if (!(await appConfirm(`${formatMinutes(entry.minutes)} ثبت‌شده روی «${entry.taskTitle || 'فعالیت'}» حذف شود؟`, { confirmLabel: 'حذف', danger: true }))) return;
    try {
      await deleteTimeEntry(entry.id);
      load();
    } catch (err) {
      showToast(userErrorMessage(err, 'حذف انجام نشد.'), 'error');
    }
  };

  const badge = week ? STATUS_BADGE[week.status] : null;

  return (
    <div className="space-y-4">
      {canLog && !viewingOther && (
        <AdminCard className={`p-4 flex flex-wrap items-center gap-3 ${timer ? 'border-emerald-300 dark:border-emerald-800' : ''}`}>
          {timer ? (
            <>
              <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" /></span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex-1 min-w-0 truncate">زمان‌سنج روی «{timer.taskTitle || 'فعالیت'}» — {formatMinutes(elapsed)}</span>
              <PrimaryButton type="button" onClick={stop} className="bg-rose-700 hover:bg-rose-800"><Square className="w-4 h-4" /> توقف و ثبت</PrimaryButton>
            </>
          ) : (
            <TimerStarter onStarted={reloadTimer} />
          )}
        </AdminCard>
      )}

      <AdminCard className="p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton type="button" onClick={() => setDay(addDays(week?.weekStart || day, -7))} aria-label="هفتهٔ قبل" className="px-3"><ChevronRight className="w-4 h-4" /></SecondaryButton>
          <SecondaryButton type="button" onClick={() => setDay(todayIso())}>این هفته</SecondaryButton>
          <SecondaryButton type="button" onClick={() => setDay(addDays(week?.weekStart || day, 7))} aria-label="هفتهٔ بعد" className="px-3"><ChevronLeft className="w-4 h-4" /></SecondaryButton>
          {week && <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mx-2">{formatJalaliDay(week.weekStart)} تا {formatJalaliDay(addDays(week.weekStart, 6))}</span>}
          {badge && <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
          <span className="flex-1" />
          {canViewAll && people.length > 0 && (
            <select id="timesheet-person" aria-label="کارمند" className={`${inputClass} !w-auto max-w-60`} value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">هفتهٔ خودم</option>
              {people.filter((p) => p.id !== me?.id).map((p) => <option key={p.id} value={p.id}>{p.name || p.username}</option>)}
            </select>
          )}
          {editable && <PrimaryButton type="button" onClick={() => setEditing('new')}><Plus className="w-4 h-4" /> ثبت زمان</PrimaryButton>}
          {!viewingOther && week?.canSubmit && <SecondaryButton type="button" onClick={submit}><Send className="w-4 h-4" /> ثبت نهایی هفته</SecondaryButton>}
        </div>
        {error && <Notice type="error">{error}</Notice>}
        {week?.decisionComment && <Notice type="info">نظر تأییدکننده: {week.decisionComment}</Notice>}

        {week && (
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {days.map((d) => {
              const minutes = week.minutesPerDay[d] || 0;
              const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
              return (
                <div key={d} className={`rounded-xl border p-2 ${d === today ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700'}`}>
                  <div className={`text-[11px] font-bold ${dow === 5 ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>{DAY_NAMES[dow]}</div>
                  <div className="text-[10px] text-slate-400">{formatJalaliDay(d).split('/').slice(1).join('/')}</div>
                  <div className={`mt-1 text-sm font-extrabold tabular-nums ${minutes ? 'text-slate-800 dark:text-slate-100' : 'text-slate-300 dark:text-slate-600'}`}>{formatHm(minutes)}</div>
                </div>
              );
            })}
          </div>
        )}
        {week && <p className="text-sm font-bold text-slate-700 dark:text-slate-200">جمع هفته: {formatMinutes(week.totalMinutes)}</p>}

        {week && week.entries.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
            {viewingOther ? 'این شخص در این هفته زمانی ثبت نکرده است.' : 'در این هفته زمانی ثبت نشده است. با «ثبت زمان» یا زمان‌سنج شروع کنید.'}
          </p>
        )}
        {week && week.entries.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700">
                <tr className="text-right text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-2.5">روز</th><th className="px-3 py-2.5">فعالیت</th><th className="px-3 py-2.5">مدت</th><th className="px-3 py-2.5">توضیح</th><th className="px-3 py-2.5">نوع ثبت</th><th className="px-3 py-2.5 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {[...week.entries].sort((a, b) => a.date.localeCompare(b.date)).map((e) => (
                  <tr key={e.id}>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600 dark:text-slate-300">{DAY_NAMES[new Date(`${e.date}T12:00:00Z`).getUTCDay()]} {formatJalaliDay(e.date)}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-100">{e.taskTitle || '—'}</td>
                    <td className="px-3 py-2.5 tabular-nums font-bold">{formatHm(e.minutes)}</td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{e.note || '—'}</td>
                    <td className="px-3 py-2.5">{e.source === 'Timer' ? <StatusBadge tone="indigo">زمان‌سنج</StatusBadge> : <StatusBadge tone="slate">دستی</StatusBadge>}</td>
                    <td className="px-3 py-2.5">
                      {editable && e.status === 'NotSubmitted' && (
                        <span className="flex gap-1">
                          <IconAction icon={Pencil} label="ویرایش" onClick={() => setEditing(e)} />
                          <IconAction icon={Trash2} label="حذف" tone="rose" onClick={() => remove(e)} />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
      {editing && <EntryDialog entry={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
};

const TimerStarter: React.FC<{ onStarted: () => void }> = ({ onStarted }) => {
  const [task, setTask] = useState<{ id: string; title: string } | null>(null);
  const start = async () => {
    if (!task) return;
    try {
      await startTimer(task.id);
      showToast(`زمان‌سنج روی «${task.title}» شروع شد.`, 'ok');
      setTask(null);
      onStarted();
    } catch (err) {
      showToast(userErrorMessage(err, 'زمان‌سنج شروع نشد.'), 'error');
    }
  };
  return (
    <div className="flex flex-wrap items-start gap-3 w-full">
      <Timer className="w-5 h-5 text-slate-400 mt-2.5" />
      <div className="flex-1 min-w-[220px]"><TaskSearchPicker id="timer-task" value={task} onChange={setTask} /></div>
      <PrimaryButton type="button" disabled={!task} onClick={start}><Play className="w-4 h-4" /> شروع زمان‌سنج</PrimaryButton>
    </div>
  );
};

const EntryDialog: React.FC<{ entry: TimeEntry | null; onClose: () => void; onSaved: () => void }> = ({ entry, onClose, onSaved }) => {
  const [task, setTask] = useState<{ id: string; title: string } | null>(entry ? { id: entry.taskId, title: entry.taskTitle || 'فعالیت' } : null);
  const [date, setDate] = useState<string | undefined>(entry?.date || todayIso());
  const [duration, setDuration] = useState(entry ? `${Math.floor(entry.minutes / 60)}:${String(entry.minutes % 60).padStart(2, '0')}` : '');
  const [note, setNote] = useState(entry?.note || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const minutes = parseDuration(duration);
    if (!task) { setError('فعالیت را انتخاب کنید.'); return; }
    if (!date) { setError('روز را انتخاب کنید.'); return; }
    if (date > todayIso()) { setError('برای روزهای آینده نمی‌توان زمان ثبت کرد.'); return; }
    if (!minutes || minutes < 1 || minutes > 1440) { setError('مدت را مثل ۱:۳۰ (ساعت:دقیقه) یا ۹۰ (دقیقه) بنویسید؛ حداکثر ۲۴ ساعت.'); return; }
    setSaving(true);
    try {
      if (entry) await updateTimeEntry(entry.id, { date, minutes, note }); else await logTime({ taskId: task.id, date, minutes, note });
      showToast('زمان ثبت شد.', 'ok');
      onSaved();
    } catch (err) {
      setError(userErrorMessage(err, 'زمان ثبت نشد.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AdminDialog title={entry ? 'ویرایش زمان' : 'ثبت زمان'} onClose={onClose} footer={<><SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving} onClick={save}>ذخیره</PrimaryButton></>}>
      {error && <Notice type="error">{error}</Notice>}
      <Field label="فعالیت" required>
        {entry ? <div className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm font-bold">{task?.title}</div> : <TaskSearchPicker id="entry-task" value={task} onChange={setTask} />}
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="روز" required><JalaliDatePicker value={date} onChange={setDate} ariaLabel="روز" /></Field>
        <Field label="مدت" required hint="ساعت:دقیقه مثل ۱:۳۰، یا فقط دقیقه مثل ۹۰">
          <input id="entry-duration" className={inputClass} dir="ltr" value={duration} onChange={(e) => setDuration(toLatinDigits(e.target.value))} placeholder="1:30" />
        </Field>
      </div>
      <Field label="توضیح"><input id="entry-note" className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="مثلاً «جلسه با واحد مالی»" /></Field>
    </AdminDialog>
  );
};

const WorkloadPanel: React.FC = () => {
  const [from, setFrom] = useState<string | undefined>(addDays(todayIso(), -6));
  const [to, setTo] = useState<string | undefined>(todayIso());
  const [capacityHours, setCapacityHours] = useState('');
  const [data, setData] = useState<Workload | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    if (!from || !to) return;
    const capacity = capacityHours.trim() ? Math.round(Number(capacityHours) * 60) : undefined;
    getWorkload(from, to, capacity && capacity > 0 ? capacity : undefined)
      .then((w) => { setData(w); setError(''); })
      .catch((err) => setError(userErrorMessage(err, 'بار کاری خوانده نشد.')));
  }, [from, to, capacityHours]);
  useEffect(load, [load]);

  return (
    <AdminCard className="p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="از"><JalaliDatePicker value={from} onChange={setFrom} ariaLabel="از" /></Field>
        <Field label="تا"><JalaliDatePicker value={to} onChange={setTo} ariaLabel="تا" /></Field>
        <Field label="ظرفیت هفتگی هر نفر (ساعت)" hint={data ? `خالی: پیش‌فرض سامانه. ظرفیت هر نفر در این بازه: ${formatMinutes(data.capacityPerPersonMinutes)}` : undefined}>
          <input id="workload-capacity" className={inputClass} inputMode="numeric" dir="ltr" value={capacityHours} onChange={(e) => setCapacityHours(toLatinDigits(e.target.value))} />
        </Field>
      </div>
      {error && <Notice type="error">{error}</Notice>}
      {data && data.people.length === 0 && <p className="p-6 text-center text-sm text-slate-400">در این بازه کسی زمان یا فعالیت باز ندارد.</p>}
      {data && data.people.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700">
              <tr className="text-right text-[11px] font-bold text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2.5">نام</th><th className="px-3 py-2.5">زمان ثبت‌شده</th><th className="px-3 py-2.5">فعالیت باز</th><th className="px-3 py-2.5">برآورد باقی‌مانده</th><th className="px-3 py-2.5 w-56" title="زمان ثبت‌شده به‌علاوهٔ برآورد باقی‌مانده، نسبت به ظرفیت">اشغال ظرفیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...data.people].sort((a, b) => b.utilization - a.utilization).map((r) => {
                const pct = Math.round(r.utilization * 100);
                const tone = pct > 100 ? 'bg-rose-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500';
                return (
                  <tr key={r.user.id}>
                    <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-100">{r.user.displayName}</td>
                    <td className="px-3 py-2.5 tabular-nums">{formatHm(r.loggedMinutes)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{toPersianDigits(r.openTasks)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{formatHm(r.remainingEstimatedMinutes)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className={`h-full ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
                        <span className="tabular-nums font-bold w-12 text-left">{toPersianDigits(pct)}٪</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminCard>
  );
};
