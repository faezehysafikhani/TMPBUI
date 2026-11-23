import React, { useState } from 'react';
import { CheckCircle2, ListTodo, Loader2, Plus, Trash2, Wand2 } from 'lucide-react';
import { inputClass } from '../admin/AdminUi';
import { JalaliDatePicker } from '../JalaliDatePicker';
import { showToast } from '../../utils/toast';
import { userErrorMessage } from '../../utils/errorMessages';
import { toPersianDigits } from '../../utils/helpers';
import { formatJalaliDay } from './workShared';
import { Meeting, MeetingAction, saveMeeting } from '../../services/meetingApi';
import { convertAllMeetingActions, convertMeetingAction } from '../../services/workApi';

/** The server also says which task an action became. */
type Action = MeetingAction & { taskId?: string | null };

/**
 * «اقدام‌های صورت‌جلسه» in the meeting's minutes tab (CAT-134): who does what by when, decided in the
 * meeting, and each one - or all at once - turned into a task (the task keeps the meeting as its source
 * and is added to the meeting's tasks). Only the one who made or runs the meeting may convert.
 */
export const MeetingActionsPanel: React.FC<{
  meeting: Meeting;
  people: { id: string; name: string }[];
  canEdit: boolean;
  canCreateTasks: boolean;
  onChanged: (meeting: Meeting) => void;
}> = ({ meeting, people, canEdit, canCreateTasks, onChanged }) => {
  const actions = (meeting.details.actions || []) as Action[];
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const saveActions = async (next: Action[], ok: string) => {
    setBusy(true);
    try {
      const saved = await saveMeeting({ ...meeting.details, actions: next, sendInvitationSms: false, version: meeting.version }, meeting.id);
      onChanged(saved);
      showToast(ok, 'ok', 3000);
      return true;
    } catch (err) {
      showToast(userErrorMessage(err, 'اقدام‌های جلسه ذخیره نشد.'), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const ok = await saveActions([...actions, { title: title.trim(), assigneeUserId: assignee || null, dueDate: dueDate || null, status: 'todo' }], 'اقدام اضافه شد.');
    if (ok) { setTitle(''); setAssignee(''); setDueDate(undefined); }
  };

  const convert = async (index: number | null) => {
    setBusy(true);
    try {
      const result = index === null ? await convertAllMeetingActions(meeting.id) : await convertMeetingAction(meeting.id, index);
      onChanged(result.meeting);
      const made = result.converted.length;
      showToast(
        result.skipped.length
          ? `${toPersianDigits(made)} فعالیت ساخته شد؛ ${toPersianDigits(result.skipped.length)} اقدام انجام نشد: ${result.skipped.slice(0, 2).join(' | ')}`
          : `${toPersianDigits(made)} فعالیت از صورت‌جلسه ساخته شد.`,
        result.skipped.length ? 'info' : 'ok',
        result.skipped.length ? 10000 : 5000,
      );
    } catch (err) {
      showToast(userErrorMessage(err, 'اقدام‌ها به فعالیت تبدیل نشد.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (id: string | null) => (id ? people.find((p) => p.id === id)?.name || 'فرد ثبت‌شده' : 'کسی که تبدیل می‌کند');
  const open = actions.filter((a) => !a.taskId).length;

  return (
    <section className="mt-3 space-y-2.5 rounded-xl border border-slate-200 dark:border-slate-700 p-3" aria-label="اقدام‌های صورت‌جلسه">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-800 dark:text-slate-100"><ListTodo className="w-4 h-4 text-indigo-500" /> اقدام‌های صورت‌جلسه</h4>
        {canEdit && canCreateTasks && open > 0 && (
          <button type="button" disabled={busy} onClick={() => convert(null)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} تبدیل همه به فعالیت ({toPersianDigits(open)})
          </button>
        )}
      </div>
      {actions.length === 0 && <p className="text-xs text-slate-400">هنوز اقدامی ثبت نشده است. هر تصمیم جلسه را با مسئول و موعدش اینجا بنویسید.</p>}
      <ul className="space-y-1.5">
        {actions.map((a, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <span className="flex-1 min-w-[160px] text-xs font-bold text-slate-800 dark:text-slate-100">{toPersianDigits(i + 1)}. {a.title}</span>
            <span className="text-[11px] text-slate-500">مسئول: {nameOf(a.assigneeUserId)}</span>
            <span className="text-[11px] text-slate-500">موعد: {a.dueDate ? formatJalaliDay(a.dueDate) : 'یک هفته بعد از جلسه'}</span>
            {a.taskId ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> فعالیت ساخته شد</span>
            ) : (
              <>
                {canEdit && canCreateTasks && (
                  <button type="button" disabled={busy} onClick={() => convert(i)} className="px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-900 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer disabled:opacity-50">تبدیل به فعالیت</button>
                )}
                {canEdit && (
                  <button type="button" disabled={busy} onClick={() => saveActions(actions.filter((_, n) => n !== i), 'اقدام حذف شد.')} className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer" aria-label="حذف اقدام"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form onSubmit={add} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_12rem_10rem_auto] gap-2 items-start">
          <input id="meeting-action-title" aria-label="شرح اقدام" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} placeholder="اقدام جدید، مثلاً «ارسال پیش‌نویس قرارداد به حقوقی»" />
          <select id="meeting-action-assignee" aria-label="مسئول اقدام" className={inputClass} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">مسئول: تبدیل‌کننده</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <JalaliDatePicker value={dueDate} onChange={setDueDate} ariaLabel="موعد اقدام" placeholder="موعد" />
          <button type="submit" disabled={busy || !title.trim()} className="inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"><Plus className="w-3.5 h-3.5" /> افزودن</button>
        </form>
      )}
    </section>
  );
};
