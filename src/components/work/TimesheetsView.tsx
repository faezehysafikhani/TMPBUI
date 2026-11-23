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
import { PageHeader, btnPrimary, btnSecondary, surface } from '../layout/PageHeader';
import { schedulingOffDayInfo } from '../../utils/jalali';
import { useSchedulingCalendarVersion } from '../../utils/useSchedulingCalendar';
import { DAY_NAMES, formatHm, formatJalaliDay, formatMinutes, parseDuration, TaskSearchPicker, useRunningTimer } from './workShared';
import type { ApprovalStatus, TimeEntry, TimesheetWeek, Workload } from './types';

const STATUS_BADGE: Record<ApprovalStatus, { tone: 'slate' | 'amber' | 'green' | 'red'; label: string }> = {
  NotSubmitted: { tone: 'slate', label: 'ثبت نهایی نشده' },
  PendingApproval: { tone: 'amber', label: 'در انتظار تأیید' },
  Approved: { tone: 'green', label: 'ثبت نهایی شده' },
  Rejected: { tone: 'red', label: 'رد شده؛ اصلاح و دوباره ارسال کنید' },
};

type Tab = 'week' | 'workload';

/** Hours a working day counts for the weekly target (the work calendar's hours per day are not public yet). */
const HOURS_PER_WORKING_DAY = 8;

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
  const [newEntry, setNewEntry] = useState(0);
  return (
    <div className="w-full" dir="rtl">
      <PageHeader
        title="ساعت کار"
        subtitle="زمانی که روی هر فعالیت گذاشته‌اید را ثبت کنید؛ دستی یا با زمان‌سنج. آخر هفته، هفته را برای تأیید بفرستید."
        actions={tab === 'week' && canLog && (
          <button type="button" className={btnPrimary} onClick={() => setNewEntry((n) => n + 1)}><Plus className="w-4 h-4" /> ثبت زمان</button>
        )}
      >
        {tabs.length > 1 && (
          <div className="inline-flex self-start p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80" role="tablist">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button key={t.id} type="button" role="tab" aria-selected={active} onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors ${active ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}>
                  {Icon && <Icon className="w-4 h-4" />} {t.label}
                </button>
              );
            })}
          </div>
        )}
      </PageHeader>
      {tab === 'week' && <WeekPanel me={me} canLog={canLog} canViewAll={canViewAll} newEntryRequest={newEntry} />}
      {tab === 'workload' && canViewAll && <WorkloadPanel />}
    </div>
  );
};

const WeekPanel: React.FC<{ me: User | null; canLog: boolean; canViewAll: boolean; newEntryRequest: number }> = ({ me, canLog, canViewAll, newEntryRequest }) => {
  useSchedulingCalendarVersion();
  const [day, setDay] = useState(todayIso());
  const [selected, setSelected] = useState<string | 'week'>(todayIso());
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
  useEffect(() => { if (newEntryRequest > 0) setEditing('new'); }, [newEntryRequest]);

  const days = useMemo(() => (week ? Array.from({ length: 7 }, (_, i) => addDays(week.weekStart, i)) : []), [week]);
  // Keep the selected day inside the shown week (the whole week when today is not in it).
  useEffect(() => {
    if (days.length && selected !== 'week' && !days.includes(selected)) setSelected(days.includes(todayIso()) ? todayIso() : 'week');
  }, [days, selected]);
  const editable = !viewingOther && canLog && week?.status !== 'PendingApproval' && week?.status !== 'Approved';
  const today = todayIso();

  // The week's target: working days in the organization's work calendar (Friday and holidays without one).
  const workingDays = days.filter((d) => !schedulingOffDayInfo(d).off).length;
  const targetMinutes = workingDays * HOURS_PER_WORKING_DAY * 60;
  const total = week?.totalMinutes || 0;
  const ratio = targetMinutes > 0 ? Math.min(1, total / targetMinutes) : 0;

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
    if (!(await appConfirm(`هفتهٔ ${formatJalaliDay(week.weekStart)} با ${formatMinutes(week.totalMinutes)} ثبت نهایی شود؟ اگر مسیر تأیید ساعت کار تعریف شده باشد برای تأیید فرستاده می‌شود، وگرنه همین حالا نهایی می‌شود. بعد از آن زمان‌های این هفته قابل تغییر نیستند.`, { confirmLabel: 'ثبت نهایی' }))) return;
    try {
      const sent = await submitTimesheetWeek(week.weekStart);
      setWeek(sent);
      showToast(sent.status === 'PendingApproval' ? 'هفته برای تأیید فرستاده شد.' : 'هفته ثبت نهایی شد.', 'ok');
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
  const shown = week ? [...week.entries].filter((e) => selected === 'week' || e.date === selected).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const dayLabel = (d: string) => `${DAY_NAMES[new Date(`${d}T12:00:00Z`).getUTCDay()]} ${formatJalaliDay(d)}`;

  return (
    <div className="space-y-4">
      {/* Running timer, or start one */}
      {canLog && !viewingOther && (
        <div className={`${surface} p-3.5 flex flex-wrap items-center gap-3 ${timer ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20' : ''}`}>
          {timer ? (
            <>
              <span className="relative flex h-3 w-3 mr-1"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" /></span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex-1 min-w-0 truncate">زمان‌سنج روی «{timer.taskTitle || 'فعالیت'}»</span>
              <span className="text-lg font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">{formatHm(elapsed)}</span>
              <button type="button" onClick={stop} className={`${btnPrimary} !bg-rose-600 hover:!bg-rose-700 !shadow-none`}><Square className="w-4 h-4" /> توقف و ثبت</button>
            </>
          ) : (
            <TimerStarter onStarted={reloadTimer} />
          )}
        </div>
      )}

      {/* Week: navigation, status, person */}
      <div className={`${surface} p-3.5`}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
            {week ? `${formatJalaliDay(week.weekStart)} تا ${formatJalaliDay(addDays(week.weekStart, 6))}` : '…'}
          </span>
          {badge && <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>}
          <span className="flex-1" />
          {canViewAll && people.length > 0 && (
            <select id="timesheet-person" aria-label="کارمند" className={`${inputClass} !w-auto max-w-60 !h-9 !py-0`} value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">هفتهٔ خودم</option>
              {people.filter((p) => p.id !== me?.id).map((p) => <option key={p.id} value={p.id}>{p.name || p.username}</option>)}
            </select>
          )}
          <button type="button" className={`${btnSecondary} !h-9`} onClick={() => { setDay(todayIso()); setSelected(todayIso()); }}>این هفته</button>
        </div>
        <div className="flex items-stretch gap-2">
          <button type="button" onClick={() => setDay(addDays(week?.weekStart || day, -7))} aria-label="هفتهٔ قبل" className="shrink-0 w-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><ChevronRight className="w-5 h-5" /></button>
          <div className="flex-1 grid grid-cols-7 gap-2 min-w-0 overflow-x-auto">
            {days.map((d) => {
              const minutes = week?.minutesPerDay[d] || 0;
              const off = schedulingOffDayInfo(d);
              const isSelected = selected === d;
              const isToday = d === today;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelected(isSelected ? 'week' : d)}
                  aria-pressed={isSelected}
                  title={off.off ? off.title : undefined}
                  className={`min-w-[72px] rounded-xl border px-2 py-2.5 text-center transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/15 dark:bg-indigo-950/50 dark:border-indigo-500'
                      : off.off
                      ? 'border-rose-100 bg-rose-50/60 hover:bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className={`text-[11px] font-semibold ${off.off ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>{DAY_NAMES[new Date(`${d}T12:00:00Z`).getUTCDay()]}</div>
                  <div className={`text-lg font-extrabold leading-7 ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : off.off ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}`}>
                    {formatJalaliDay(d).split('/')[2]}
                    {isToday && <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500 align-middle mr-1" aria-label="امروز" />}
                  </div>
                  <div className={`text-[11px] tabular-nums font-semibold ${minutes ? 'text-slate-700 dark:text-slate-200' : off.off ? 'text-rose-400' : 'text-slate-300 dark:text-slate-600'}`}>
                    {minutes ? formatHm(minutes) : off.off ? 'تعطیل' : '—'}
                  </div>
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setDay(addDays(week?.weekStart || day, 7))} aria-label="هفتهٔ بعد" className="shrink-0 w-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><ChevronLeft className="w-5 h-5" /></button>
        </div>
      </div>

      {error && <Notice type="error">{error}</Notice>}
      {week?.decisionComment && <Notice type="info">نظر تأییدکننده: {week.decisionComment}</Notice>}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        {/* Entries of the selected day (or the week) */}
        <div className={`${surface} overflow-hidden`}>
          <div className="flex items-center gap-2 px-4 h-14 border-b border-slate-100 dark:border-slate-800">
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{selected === 'week' ? 'همهٔ هفته' : dayLabel(selected)}</h3>
              <p className="text-[11px] text-slate-400">{toPersianDigits(shown.length)} ورودی · {formatMinutes(shown.reduce((sum, e) => sum + e.minutes, 0)) || '۰ دقیقه'}</p>
            </div>
            <span className="flex-1" />
            {selected !== 'week' && <button type="button" onClick={() => setSelected('week')} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">نمایش همهٔ هفته</button>}
          </div>
          {shown.length === 0 ? (
            <div className="p-10 text-center">
              <Clock3 className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {viewingOther ? 'زمانی ثبت نشده است.' : selected === 'week' ? 'در این هفته زمانی ثبت نشده است.' : 'برای این روز زمانی ثبت نشده است.'}
              </p>
              {editable && <button type="button" onClick={() => setEditing('new')} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"><Plus className="w-4 h-4" /> ثبت زمان</button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="text-right text-xs font-semibold text-slate-400 bg-slate-50/70 dark:bg-slate-800/40">
                    {selected === 'week' && <th className="px-4 py-2.5 font-semibold">روز</th>}
                    <th className="px-4 py-2.5 font-semibold">فعالیت</th>
                    <th className="px-4 py-2.5 font-semibold">توضیح</th>
                    <th className="px-4 py-2.5 font-semibold">نوع ثبت</th>
                    <th className="px-4 py-2.5 font-semibold text-left">مدت</th>
                    <th className="px-2 py-2.5 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {shown.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      {selected === 'week' && <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400 text-xs">{dayLabel(e.date)}</td>}
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{e.taskTitle || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{e.note || '—'}</td>
                      <td className="px-4 py-3">{e.source === 'Timer' ? <StatusBadge tone="indigo">زمان‌سنج</StatusBadge> : <StatusBadge tone="slate">دستی</StatusBadge>}</td>
                      <td className="px-4 py-3 tabular-nums font-extrabold text-left text-slate-800 dark:text-slate-100">{formatHm(e.minutes)}</td>
                      <td className="px-2 py-3">
                        {editable && (e.status === 'NotSubmitted' || e.status === 'Rejected') && (
                          <span className="flex gap-1 justify-end">
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
        </div>

        {/* Week summary and submit */}
        <aside className={`${surface} p-5`} aria-label="خلاصهٔ هفته">
          <WeekRing ratio={ratio} total={total} target={targetMinutes} />
          <dl className="mt-5 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
            <div className="flex items-center justify-between py-2.5"><dt className="text-slate-500 dark:text-slate-400">ثبت‌شده این هفته</dt><dd className="font-extrabold tabular-nums">{formatHm(total)}</dd></div>
            <div className="flex items-center justify-between py-2.5"><dt className="text-slate-500 dark:text-slate-400">موظفی هفته</dt><dd className="font-bold tabular-nums">{formatHm(targetMinutes)} <span className="text-[11px] font-normal text-slate-400">({toPersianDigits(workingDays)} روز کاری)</span></dd></div>
            <div className="flex items-center justify-between py-2.5"><dt className="text-slate-500 dark:text-slate-400">{total >= targetMinutes ? 'بیش از موظفی' : 'باقی‌مانده'}</dt><dd className={`font-bold tabular-nums ${total >= targetMinutes ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{formatHm(Math.abs(targetMinutes - total))}</dd></div>
          </dl>
          {!viewingOther && week?.canSubmit && (
            <button type="button" onClick={submit} className={`${btnPrimary} w-full mt-4`}><Send className="w-4 h-4" /> ثبت نهایی و ارسال هفته</button>
          )}
          {week?.status === 'PendingApproval' && <p className="mt-4 text-xs text-amber-700 dark:text-amber-400 text-center">هفته در انتظار تأیید است؛ تا تصمیم تأییدکننده زمان‌ها قابل تغییر نیستند.</p>}
          {week?.status === 'Approved' && <p className="mt-4 text-xs text-emerald-700 dark:text-emerald-400 text-center">این هفته ثبت نهایی شده است.</p>}
          {week?.status === 'Rejected' && <p className="mt-4 text-xs text-rose-600 dark:text-rose-400 text-center">ورودی‌های ردشده را اصلاح کنید و دوباره بفرستید.</p>}
        </aside>
      </div>
      {editing && <EntryDialog entry={editing === 'new' ? null : editing} defaultDate={selected !== 'week' && selected <= today ? selected : undefined} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
};

/** The week's logged time against its target, as a ring. */
const WeekRing: React.FC<{ ratio: number; total: number; target: number }> = ({ ratio, total, target }) => {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-40 h-40 mx-auto" role="img" aria-label={`${formatMinutes(total)} از ${formatMinutes(target)}`}>
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" className="stroke-slate-100 dark:stroke-slate-800" />
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="10" strokeLinecap="round" className={`${ratio >= 1 ? 'stroke-emerald-500' : 'stroke-indigo-600'} transition-all duration-500`} strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">{formatHm(total)}</span>
        <span className="text-[11px] text-slate-400">از {formatHm(target)} ساعت</span>
      </div>
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

const EntryDialog: React.FC<{ entry: TimeEntry | null; defaultDate?: string; onClose: () => void; onSaved: () => void }> = ({ entry, defaultDate, onClose, onSaved }) => {
  const [task, setTask] = useState<{ id: string; title: string } | null>(entry ? { id: entry.taskId, title: entry.taskTitle || 'فعالیت' } : null);
  const [date, setDate] = useState<string | undefined>(entry?.date || defaultDate || todayIso());
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
