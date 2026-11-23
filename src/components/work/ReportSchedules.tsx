import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react';
import { AdminDialog, Field, IconAction, inputClass, Notice, PrimaryButton, SecondaryButton, StatusBadge, Toggle } from '../admin/AdminUi';
import { appConfirm } from '../../utils/appDialog';
import { showToast } from '../../utils/toast';
import { userErrorMessage } from '../../utils/errorMessages';
import { toPersianDigits } from '../../utils/helpers';
import { createReportSubscription, deleteReportSubscription, listReportSubscriptions, updateReportSubscription } from '../../services/workApi';
import type { DayOfWeekName, ReportFrequency, ReportSubscription } from './types';

const FREQ: Record<ReportFrequency, string> = { Daily: 'روزانه', Weekly: 'هفتگی', Monthly: 'ماهانه' };
const DAYS: [DayOfWeekName, string][] = [['Saturday', 'شنبه'], ['Sunday', 'یکشنبه'], ['Monday', 'دوشنبه'], ['Tuesday', 'سه‌شنبه'], ['Wednesday', 'چهارشنبه'], ['Thursday', 'پنجشنبه'], ['Friday', 'جمعه']];
const dayName = (d: DayOfWeekName | null) => DAYS.find(([k]) => k === d)?.[1] || '';

function describe(s: ReportSubscription): string {
  const when = s.frequency === 'Daily' ? 'هر روز' : s.frequency === 'Weekly' ? `هر ${dayName(s.dayOfWeek)}` : `روز ${toPersianDigits(s.dayOfMonth || 1)} هر ماه میلادی`;
  const via = [s.bySms && 'پیامک', s.byEmail && 'ایمیل'].filter(Boolean).join(' و ');
  return `${when} ساعت ${toPersianDigits(s.hour)}، با ${via}`;
}

/**
 * «ارسال خودکار گزارش» (CAT-195) on the reports page: the signed-in person's own digest of their tasks
 * (overdue, due today, due soon, in progress, finished last week), sent by SMS and/or email on a schedule.
 */
export const ReportSchedulesButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SecondaryButton type="button" onClick={() => setOpen(true)} className="px-3 py-2 text-xs"><CalendarClock className="w-4 h-4" /> ارسال خودکار گزارش</SecondaryButton>
      {open && <SchedulesDialog onClose={() => setOpen(false)} />}
    </>
  );
};

const SchedulesDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [items, setItems] = useState<ReportSubscription[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ReportSubscription | 'new' | null>(null);
  const load = useCallback(() => {
    listReportSubscriptions().then((r) => { setItems(r); setError(''); }).catch((err) => setError(userErrorMessage(err, 'برنامه‌های ارسال خوانده نشد.')));
  }, []);
  useEffect(load, [load]);
  const remove = async (s: ReportSubscription) => {
    if (!(await appConfirm('این برنامهٔ ارسال حذف شود؟', { confirmLabel: 'حذف', danger: true }))) return;
    try { await deleteReportSubscription(s.id); load(); } catch (err) { showToast(userErrorMessage(err, 'حذف انجام نشد.'), 'error'); }
  };

  if (editing) return <EditDialog item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />;

  return (
    <AdminDialog title="ارسال خودکار گزارش" onClose={onClose} footer={<><SecondaryButton type="button" onClick={onClose}>بستن</SecondaryButton><PrimaryButton type="button" onClick={() => setEditing('new')}><Plus className="w-4 h-4" /> برنامهٔ جدید</PrimaryButton></>}>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">خلاصهٔ فعالیت‌های خودتان (دیرکرده، موعد امروز، نزدیک به موعد، در حال انجام و تمام‌شدهٔ هفتهٔ گذشته) در زمان مشخص برایتان پیامک یا ایمیل می‌شود.</p>
      {error && <Notice type="error">{error}</Notice>}
      {items && items.length === 0 && <p className="p-6 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">برنامه‌ای تعریف نکرده‌اید.</p>}
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {(items || []).map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <span className="flex-1 min-w-0 text-sm font-bold text-slate-800 dark:text-slate-100">{FREQ[s.frequency]} — {describe(s)}</span>
            {!s.isActive && <StatusBadge tone="amber">غیرفعال</StatusBadge>}
            <IconAction icon={Pencil} label="ویرایش" onClick={() => setEditing(s)} />
            <IconAction icon={Trash2} label="حذف" tone="rose" onClick={() => remove(s)} />
          </li>
        ))}
      </ul>
    </AdminDialog>
  );
};

const EditDialog: React.FC<{ item: ReportSubscription | null; onClose: () => void; onSaved: () => void }> = ({ item, onClose, onSaved }) => {
  const [frequency, setFrequency] = useState<ReportFrequency>(item?.frequency || 'Weekly');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeekName>(item?.dayOfWeek || 'Saturday');
  const [dayOfMonth, setDayOfMonth] = useState(item?.dayOfMonth || 1);
  const [hour, setHour] = useState(item?.hour ?? 8);
  const [bySms, setBySms] = useState(item?.bySms ?? true);
  const [byEmail, setByEmail] = useState(item?.byEmail ?? false);
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!bySms && !byEmail) { setError('پیامک، ایمیل یا هر دو را انتخاب کنید.'); return; }
    setSaving(true);
    try {
      const input = {
        frequency,
        dayOfWeek: frequency === 'Weekly' ? dayOfWeek : null,
        dayOfMonth: frequency === 'Monthly' ? dayOfMonth : null,
        hour, bySms, byEmail, isActive,
      };
      if (item) await updateReportSubscription(item.id, input); else await createReportSubscription(input);
      showToast('برنامهٔ ارسال ذخیره شد.', 'ok');
      onSaved();
    } catch (err) {
      setError(userErrorMessage(err, 'برنامهٔ ارسال ذخیره نشد.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AdminDialog title={item ? 'ویرایش برنامهٔ ارسال' : 'برنامهٔ ارسال جدید'} onClose={onClose} footer={<><SecondaryButton type="button" onClick={onClose}>بازگشت</SecondaryButton><PrimaryButton type="button" disabled={saving} onClick={save}>ذخیره</PrimaryButton></>}>
      {error && <Notice type="error">{error}</Notice>}
      <Field label="تکرار">
        <select id="schedule-frequency" className={inputClass} value={frequency} onChange={(e) => setFrequency(e.target.value as ReportFrequency)}>
          {(Object.keys(FREQ) as ReportFrequency[]).map((f) => <option key={f} value={f}>{FREQ[f]}</option>)}
        </select>
      </Field>
      {frequency === 'Weekly' && (
        <Field label="روز هفته">
          <select id="schedule-dow" className={inputClass} value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value as DayOfWeekName)}>
            {DAYS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </Field>
      )}
      {frequency === 'Monthly' && (
        <Field label="روز ماه میلادی" hint="روز ماه در تقویم میلادی؛ ۱ تا ۲۸ تا هر ماه وجود داشته باشد.">
          <select id="schedule-dom" className={inputClass} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{toPersianDigits(d)}</option>)}
          </select>
        </Field>
      )}
      <Field label="ساعت (به وقت ایران)">
        <select id="schedule-hour" className={inputClass} value={hour} onChange={(e) => setHour(Number(e.target.value))}>
          {Array.from({ length: 24 }, (_, h) => h).map((h) => <option key={h} value={h}>{toPersianDigits(String(h).padStart(2, '0'))}:۰۰</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Toggle checked={bySms} onChange={setBySms} label="پیامک" description="به شمارهٔ موبایل حساب" />
        <Toggle checked={byEmail} onChange={setByEmail} label="ایمیل" description="به ایمیل حساب" />
      </div>
      {item && <Toggle checked={isActive} onChange={setIsActive} label="فعال" />}
    </AdminDialog>
  );
};
