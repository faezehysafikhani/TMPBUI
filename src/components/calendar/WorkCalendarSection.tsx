import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Star, Trash2, X } from 'lucide-react';
import { AdminCard, Field, inputClass, Notice, PrimaryButton, SecondaryButton, StatusBadge, toLatinDigits, Toggle } from '../admin/AdminUi';
import { JalaliDatePicker } from '../JalaliDatePicker';
import { appConfirm } from '../../utils/appDialog';
import { showToast } from '../../utils/toast';
import { userErrorMessage } from '../../utils/errorMessages';
import { toPersianDigits } from '../../utils/helpers';
import { getJalaliMonthDays, gregorianToJalali, jalaliToGregorian } from '../../utils/jalali';
import {
  createWorkCalendar,
  DAY_BITS,
  deleteWorkCalendar,
  getCalendarDays,
  listWorkCalendars,
  updateWorkCalendar,
  WORK_CALENDAR_PERMISSIONS,
} from '../../services/workCalendarApi';
import type { CalendarDay, WorkCalendar, WorkCalendarException } from './types';

/** The week as people here read it: Saturday first. */
const WEEK: { key: keyof typeof DAY_BITS; label: string }[] = [
  { key: 'Saturday', label: 'شنبه' }, { key: 'Sunday', label: 'یکشنبه' }, { key: 'Monday', label: 'دوشنبه' },
  { key: 'Tuesday', label: 'سه‌شنبه' }, { key: 'Wednesday', label: 'چهارشنبه' }, { key: 'Thursday', label: 'پنجشنبه' }, { key: 'Friday', label: 'جمعه' },
];
const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const IRAN_WEEK = DAY_BITS.Saturday | DAY_BITS.Sunday | DAY_BITS.Monday | DAY_BITS.Tuesday | DAY_BITS.Wednesday;

const pad = (n: number) => String(n).padStart(2, '0');
const gIso = (jy: number, jm: number, jd: number) => { const g = jalaliToGregorian(jy, jm, jd); return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`; };
const jLabel = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); const j = gregorianToJalali(y, m, d); return toPersianDigits(`${j.jy}/${pad(j.jm)}/${pad(j.jd)}`); };

/**
 * «تقویم کاری» (CAT-85): the organization's working week, hours per day, whether Iran's official holidays
 * apply, and dates that differ (an extra holiday, a working Thursday). The default calendar is the one the
 * system counts working days by.
 */
export const WorkCalendarSection: React.FC<{ can: (permission: string) => boolean }> = ({ can }) => {
  const [calendars, setCalendars] = useState<WorkCalendar[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | 'new' | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async (select?: string) => {
    try {
      const list = await listWorkCalendars();
      setCalendars(list);
      setError('');
      setSelectedId((cur) => select ?? (cur && cur !== 'new' && list.some((c) => c.id === cur) ? cur : list.find((c) => c.isDefault)?.id ?? list[0]?.id ?? null));
    } catch (err) {
      setError(userErrorMessage(err, 'تقویم‌های کاری خوانده نشد.'));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const selected = calendars?.find((c) => c.id === selectedId) || null;
  const canCreate = can(WORK_CALENDAR_PERMISSIONS.create);

  return (
    <div className="space-y-4">
      <AdminCard className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white"><CalendarDays className="w-5 h-5 text-indigo-600" /> تقویم کاری</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-2xl">روزهای کاری هفته، ساعت کار روزانه، تعطیلات رسمی و روزهایی که با بقیه فرق دارند (تعطیلی اضافه یا پنجشنبهٔ کاری). مهلت پاسخ (SLA) در حالت «فقط روزهای کاری» با تقویم پیش‌فرض حساب می‌شود.</p>
          </div>
          {canCreate && <PrimaryButton type="button" onClick={() => setSelectedId('new')} className="shrink-0"><Plus className="w-4 h-4" /> تقویم جدید</PrimaryButton>}
        </div>
        {error && <Notice type="error">{error}</Notice>}
        {calendars && calendars.length === 0 && selectedId !== 'new' && (
          <p className="p-6 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">هنوز تقویم کاری تعریف نشده است؛ تا تعریف نشود، جمعه‌ها و تعطیلات رسمی ایران غیرکاری حساب می‌شوند.</p>
        )}
        {calendars && calendars.length > 0 && (
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="تقویم‌ها">
            {calendars.map((c) => (
              <button key={c.id} type="button" role="tab" aria-selected={c.id === selectedId} onClick={() => setSelectedId(c.id)} className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer ${c.id === selectedId ? 'bg-indigo-700 border-indigo-700 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'}`}>
                {c.isDefault && <Star className="w-3.5 h-3.5" />}{c.name}
              </button>
            ))}
          </div>
        )}
      </AdminCard>
      {(selected || selectedId === 'new') && (
        <CalendarEditor
          key={selectedId || 'none'}
          calendar={selectedId === 'new' ? null : selected}
          isFirst={(calendars?.length ?? 0) === 0}
          canEdit={selectedId === 'new' ? canCreate : can(WORK_CALENDAR_PERMISSIONS.update)}
          canDelete={can(WORK_CALENDAR_PERMISSIONS.delete)}
          onSaved={(id) => void load(id)}
          onDeleted={() => { setSelectedId(null); void load(); }}
          onCancel={() => setSelectedId(calendars?.[0]?.id ?? null)}
        />
      )}
    </div>
  );
};

const CalendarEditor: React.FC<{
  calendar: WorkCalendar | null;
  isFirst: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onSaved: (id: string) => void;
  onDeleted: () => void;
  onCancel: () => void;
}> = ({ calendar, isFirst, canEdit, canDelete, onSaved, onDeleted, onCancel }) => {
  const [name, setName] = useState(calendar?.name || 'تقویم کاری سازمان');
  const [mask, setMask] = useState(calendar?.workingDays ?? IRAN_WEEK);
  const [hours, setHours] = useState(String(calendar?.workHoursPerDay ?? 8));
  const [officialHolidays, setOfficialHolidays] = useState(calendar?.applyOfficialHolidays ?? true);
  const [isDefault, setIsDefault] = useState(calendar?.isDefault ?? isFirst);
  const [exceptions, setExceptions] = useState<WorkCalendarException[]>(calendar?.exceptions ?? []);
  const [newDate, setNewDate] = useState<string | undefined>();
  const [newWorking, setNewWorking] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const h = Number(hours);
    if (!name.trim()) { setError('نام تقویم را بنویسید.'); return; }
    if (mask === 0) { setError('دست‌کم یک روز کاری انتخاب کنید.'); return; }
    if (!Number.isInteger(h) || h < 1 || h > 24) { setError('ساعت کار روزانه باید بین ۱ تا ۲۴ باشد.'); return; }
    setSaving(true);
    try {
      const input = {
        name: name.trim(), workingDays: mask, isDefault, workHoursPerDay: h, applyOfficialHolidays: officialHolidays,
        exceptions: exceptions.map((e) => ({ date: e.date, isWorkingDay: e.isWorkingDay, description: e.description || null })),
      };
      const saved = calendar ? await updateWorkCalendar(calendar.id, input) : await createWorkCalendar(input);
      showToast('تقویم کاری ذخیره شد.', 'ok');
      setError('');
      onSaved(saved.id);
    } catch (err) {
      setError(userErrorMessage(err, 'تقویم کاری ذخیره نشد.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!calendar || !(await appConfirm(`تقویم «${calendar.name}» حذف شود؟`, { confirmLabel: 'حذف', danger: true }))) return;
    try { await deleteWorkCalendar(calendar.id); showToast('تقویم حذف شد.', 'ok'); onDeleted(); } catch (err) { setError(userErrorMessage(err, 'حذف انجام نشد.')); }
  };

  const addException = () => {
    if (!newDate) return;
    setExceptions((list) => [...list.filter((e) => e.date !== newDate), { date: newDate, isWorkingDay: newWorking, description: newNote.trim() || null }].sort((a, b) => a.date.localeCompare(b.date)));
    setNewDate(undefined);
    setNewNote('');
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
      <AdminCard className="p-5 space-y-4">
        {error && <Notice type="error">{error}</Notice>}
        <fieldset disabled={!canEdit} className="space-y-4">
          <Field label="نام" required><input id="wc-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={160} /></Field>
          <div>
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">روزهای کاری هفته</span>
            <div className="flex flex-wrap gap-2">
              {WEEK.map((d) => {
                const on = (mask & DAY_BITS[d.key]) !== 0;
                return (
                  <button key={d.key} type="button" aria-pressed={on} onClick={() => setMask((m) => m ^ DAY_BITS[d.key])} className={`px-3 py-2 rounded-xl border text-xs font-bold cursor-pointer ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>{d.label}</button>
                );
              })}
            </div>
          </div>
          <Field label="ساعت کار روزانه" hint="برای تبدیل روز کاری به ساعت (برآورد و ظرفیت)."><input id="wc-hours" className={`${inputClass} max-w-32`} inputMode="numeric" dir="ltr" value={hours} onChange={(e) => setHours(toLatinDigits(e.target.value))} /></Field>
          <Toggle checked={officialHolidays} onChange={setOfficialHolidays} label="تعطیلات رسمی ایران" description="روزهای تعطیل رسمی (عید، تاسوعا و عاشورا، …) غیرکاری حساب شوند." />
          <Toggle checked={isDefault} onChange={setIsDefault} label="تقویم پیش‌فرض سازمان" description="سامانه روزهای کاری را با این تقویم حساب می‌کند." />
          <div className="space-y-2">
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">روزهای استثنا</span>
            {exceptions.length === 0 && <p className="text-xs text-slate-400">روز استثنایی ثبت نشده است.</p>}
            <ul className="space-y-1">
              {exceptions.map((e) => (
                <li key={e.date} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs">
                  <span className="font-bold tabular-nums">{jLabel(e.date)}</span>
                  <StatusBadge tone={e.isWorkingDay ? 'green' : 'red'}>{e.isWorkingDay ? 'کاری' : 'تعطیل'}</StatusBadge>
                  <span className="flex-1 text-slate-500 truncate">{e.description || ''}</span>
                  <button type="button" onClick={() => setExceptions((list) => list.filter((x) => x.date !== e.date))} className="p-0.5 text-slate-400 hover:text-rose-500 cursor-pointer" aria-label="حذف استثنا"><X className="w-3.5 h-3.5" /></button>
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-1 sm:grid-cols-[10rem_auto_minmax(0,1fr)_auto] gap-2 items-center">
              <JalaliDatePicker value={newDate} onChange={setNewDate} ariaLabel="روز استثنا" placeholder="روز" />
              <select id="wc-ex-kind" aria-label="نوع روز" className={inputClass} value={newWorking ? 'work' : 'off'} onChange={(e) => setNewWorking(e.target.value === 'work')}>
                <option value="off">تعطیل</option><option value="work">کاری</option>
              </select>
              <input id="wc-ex-note" aria-label="توضیح" className={inputClass} value={newNote} onChange={(e) => setNewNote(e.target.value)} maxLength={300} placeholder="مثلاً «تعطیلی استانی»" />
              <SecondaryButton type="button" disabled={!newDate} onClick={addException} className="px-3"><Plus className="w-4 h-4" /> افزودن</SecondaryButton>
            </div>
          </div>
        </fieldset>
        {canEdit && (
          <div className="flex flex-wrap gap-2 pt-1">
            <PrimaryButton type="button" disabled={saving} onClick={save}>ذخیره</PrimaryButton>
            {!calendar && <SecondaryButton type="button" onClick={onCancel}>انصراف</SecondaryButton>}
            {calendar && canDelete && <SecondaryButton type="button" onClick={remove} className="mr-auto text-rose-700"><Trash2 className="w-4 h-4" /> حذف تقویم</SecondaryButton>}
          </div>
        )}
      </AdminCard>
      {calendar && <MonthPreview calendarId={calendar.id} version={JSON.stringify(calendar)} />}
    </div>
  );
};

/** The saved calendar month by month: working days, days off and why. */
const MonthPreview: React.FC<{ calendarId: string; version: string }> = ({ calendarId, version }) => {
  const today = gregorianToJalali(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
  const [view, setView] = useState({ jy: today.jy, jm: today.jm });
  const [days, setDays] = useState<CalendarDay[]>([]);
  const length = getJalaliMonthDays(view.jy, view.jm);
  const from = gIso(view.jy, view.jm, 1);
  const to = gIso(view.jy, view.jm, length);
  useEffect(() => { getCalendarDays(calendarId, from, to).then(setDays).catch(() => setDays([])); }, [calendarId, from, to, version]);
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const firstDow = (new Date(`${from}T12:00:00Z`).getUTCDay() + 1) % 7; // Saturday = 0
  const shift = (d: number) => setView((v) => { let jm = v.jm + d, jy = v.jy; if (jm < 1) { jm = 12; jy--; } if (jm > 12) { jm = 1; jy++; } return { jy, jm }; });
  const offCount = days.filter((d) => !d.isWorkingDay).length;

  return (
    <AdminCard className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" aria-label="ماه قبل"><ChevronRight className="w-4 h-4" /></button>
        <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{MONTHS[view.jm - 1]} {toPersianDigits(view.jy)}</span>
        <button type="button" onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" aria-label="ماه بعد"><ChevronLeft className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
        {WEEK.map((d) => <div key={d.key} className="font-bold text-slate-500 py-1">{d.label.slice(0, 1)}</div>)}
        {Array.from({ length: firstDow }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length }, (_, i) => {
          const iso = gIso(view.jy, view.jm, i + 1);
          const info = byDate.get(iso);
          const off = info ? !info.isWorkingDay : false;
          const exception = info?.source === 'Exception';
          return (
            <div
              key={iso}
              title={info?.reason || (off ? 'غیرکاری' : 'کاری')}
              className={`py-2 rounded-lg font-bold tabular-nums ${off ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'} ${exception ? 'ring-2 ring-amber-400' : ''}`}
            >
              {toPersianDigits(i + 1)}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-slate-500">{toPersianDigits(length - offCount)} روز کاری و {toPersianDigits(offCount)} روز غیرکاری در این ماه. روزهای قاب زرد استثنا هستند؛ برای دیدن دلیل، نشانگر را روی روز نگه دارید.</p>
      <ul className="text-[11px] text-slate-500 space-y-0.5">
        {days.filter((d) => d.source !== 'Weekly' && d.reason).map((d) => <li key={d.date}>{jLabel(d.date)}: {d.reason}</li>)}
      </ul>
    </AdminCard>
  );
};
