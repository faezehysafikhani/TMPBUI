import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Inbox, Plus, Send, XCircle } from 'lucide-react';
import type { Priority, User } from '../../types';
import { PRIORITIES } from '../../types';
import {
  AdminCard,
  AdminDialog,
  Field,
  inputClass,
  Notice,
  PillTabs,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  TabItem,
} from '../admin/AdminUi';
import { JalaliDatePicker } from '../JalaliDatePicker';
import { showToast } from '../../utils/toast';
import { userErrorMessage } from '../../utils/errorMessages';
import { formatJalaliDay } from './workShared';
import { can } from '../../utils/permissions';
import { getSessionUser } from '../../services/nexusApi';
import { fetchAllUsersPB } from '../../services/dataService';
import { convertRequest, listRequestCategories, listRequests, rejectRequest, submitRequest, WORK_PERMISSIONS } from '../../services/workApi';
import type { RequestCategory, RequestStatus, ServerPriority, TaskRequest } from './types';

const PRIORITY_FROM: Record<ServerPriority, Priority> = { Low: 'low', Medium: 'medium', High: 'high' };
const PRIORITY_TO: Record<Priority, ServerPriority> = { low: 'Low', medium: 'Medium', high: 'High' };
const STATUS: Record<RequestStatus, { tone: 'indigo' | 'green' | 'red'; label: string }> = {
  New: { tone: 'indigo', label: 'در انتظار رسیدگی' },
  Converted: { tone: 'green', label: 'تبدیل به فعالیت شد' },
  Rejected: { tone: 'red', label: 'رد شد' },
};

type Tab = 'mine' | 'queue';

/**
 * «درخواست‌ها» (CAT-15, CAT-16, CAT-22): anyone with Requests.Submit asks for work; the request is routed by
 * its category and urgency, and a handler turns it into a task (the task keeps the request as its source) or
 * turns it down with a reason.
 */
export const RequestsView: React.FC = () => {
  const me = getSessionUser();
  const canSubmit = can(me, WORK_PERMISSIONS.submitRequests);
  const canHandle = can(me, WORK_PERMISSIONS.handleRequests);
  const tabs: TabItem<Tab>[] = [
    ...(canSubmit ? [{ id: 'mine' as const, label: 'درخواست‌های من', icon: Send }] : []),
    ...(canHandle ? [{ id: 'queue' as const, label: 'صف رسیدگی', icon: Inbox }] : []),
  ];
  const [tab, setTab] = useState<Tab>(canHandle && !canSubmit ? 'queue' : 'mine');
  const [submitting, setSubmitting] = useState(false);
  const [version, setVersion] = useState(0);

  return (
    <div className="w-full space-y-4" dir="rtl">
      <AdminCard className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-white"><Inbox className="w-6 h-6 text-indigo-600" /> درخواست‌ها</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">کاری از واحد دیگر لازم دارید؟ درخواست ثبت کنید؛ بر اساس دسته به مسئول رسیدگی می‌رسد و در صورت پذیرش به فعالیت تبدیل می‌شود.</p>
          </div>
          {canSubmit && <PrimaryButton type="button" onClick={() => setSubmitting(true)} className="shrink-0"><Plus className="w-4 h-4" /> درخواست جدید</PrimaryButton>}
        </div>
        {tabs.length > 1 && <PillTabs tabs={tabs} active={tab} onChange={setTab} />}
      </AdminCard>
      <RequestList key={`${tab}:${version}`} mine={tab === 'mine'} canHandle={canHandle && tab === 'queue'} />
      {submitting && <SubmitDialog onClose={() => setSubmitting(false)} onSaved={() => { setSubmitting(false); setTab('mine'); setVersion((v) => v + 1); }} />}
    </div>
  );
};

const RequestList: React.FC<{ mine: boolean; canHandle: boolean }> = ({ mine, canHandle }) => {
  const [filter, setFilter] = useState<RequestStatus | ''>(mine ? '' : 'New');
  const [items, setItems] = useState<TaskRequest[] | null>(null);
  const [error, setError] = useState('');
  const [converting, setConverting] = useState<TaskRequest | null>(null);
  const [rejecting, setRejecting] = useState<TaskRequest | null>(null);

  const load = useCallback(() => {
    listRequests(mine, filter || undefined)
      .then((list) => { setItems(list); setError(''); })
      .catch((err) => setError(userErrorMessage(err, 'درخواست‌ها خوانده نشد.')));
  }, [mine, filter]);
  useEffect(load, [load]);

  const sorted = [...(items || [])].sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc));

  return (
    <AdminCard className="p-5 space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="وضعیت">
        {([['', 'همه'], ['New', 'در انتظار'], ['Converted', 'تبدیل‌شده'], ['Rejected', 'ردشده']] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFilter(id)} aria-pressed={filter === id} className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${filter === id ? 'bg-indigo-700 text-white border-indigo-700' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>{label}</button>
        ))}
      </div>
      {error && <Notice type="error">{error}</Notice>}
      {items && sorted.length === 0 && (
        <p className="p-8 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
          {mine ? 'درخواستی ثبت نکرده‌اید.' : 'درخواستی در این وضعیت نیست.'}
        </p>
      )}
      <ul className="space-y-2.5">
        {sorted.map((r) => {
          const priority = PRIORITIES[PRIORITY_FROM[r.priority]];
          return (
            <li key={r.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex-1 min-w-0">{r.title}</span>
                {r.categoryName && <StatusBadge tone="slate">{r.categoryName}</StatusBadge>}
                {priority && <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${priority.bgColor} ${priority.textColor} ${priority.borderColor}`}>{priority.title}</span>}
                <StatusBadge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</StatusBadge>
              </div>
              {r.description && <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{r.description}</p>}
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                {!mine && r.requester && <span>درخواست‌دهنده: <b>{r.requester.displayName}</b></span>}
                <span>ثبت: {formatJalaliDay(r.createdAtUtc)}</span>
                {r.neededBy && <span>نیاز تا: {formatJalaliDay(r.neededBy)}</span>}
                {r.routedTo && <span>ارجاع به: <b>{r.routedTo.displayName}</b></span>}
              </div>
              {r.decisionNote && <p className="text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">توضیح رسیدگی: {r.decisionNote}</p>}
              {canHandle && r.status === 'New' && (
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setConverting(r)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"><CheckCircle2 className="w-3.5 h-3.5" /> تبدیل به فعالیت</button>
                  <button type="button" onClick={() => setRejecting(r)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300 text-xs font-bold cursor-pointer"><XCircle className="w-3.5 h-3.5" /> رد</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {converting && <ConvertDialog request={converting} onClose={() => setConverting(null)} onDone={() => { setConverting(null); load(); }} />}
      {rejecting && <RejectDialog request={rejecting} onClose={() => setRejecting(null)} onDone={() => { setRejecting(null); load(); }} />}
    </AdminCard>
  );
};

const SubmitDialog: React.FC<{ onClose: () => void; onSaved: () => void }> = ({ onClose, onSaved }) => {
  const [categories, setCategories] = useState<RequestCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [neededBy, setNeededBy] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { listRequestCategories().then((list) => setCategories(list.filter((c) => c.isActive))).catch(() => setCategories([])); }, []);
  const save = async () => {
    if (!title.trim()) { setError('عنوان درخواست را بنویسید.'); return; }
    setSaving(true);
    try {
      const saved = await submitRequest({ title: title.trim(), description: description.trim() || null, categoryId: categoryId || null, priority: priority ? PRIORITY_TO[priority] : null, neededBy: neededBy || null });
      showToast(saved.routedTo ? `درخواست ثبت شد و به ${saved.routedTo.displayName} ارجاع شد.` : 'درخواست ثبت شد.', 'ok');
      onSaved();
    } catch (err) {
      setError(userErrorMessage(err, 'درخواست ثبت نشد.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AdminDialog title="درخواست جدید" onClose={onClose} footer={<><SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving} onClick={save}>ثبت درخواست</PrimaryButton></>}>
      {error && <Notice type="error">{error}</Notice>}
      {categories.length > 0 && (
        <Field label="دسته" hint="دسته تعیین می‌کند درخواست به چه کسی برسد.">
          <select id="request-category" className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">بدون دسته</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="عنوان" required><input id="request-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="مثلاً «تهیه گزارش فروش فصل پاییز»" /></Field>
      <Field label="شرح"><textarea id="request-description" className={`${inputClass} min-h-24`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="فوریت" hint="خالی: پیش‌فرض دسته">
          <select id="request-priority" className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value as Priority | '')}>
            <option value="">پیش‌فرض</option>
            {(Object.keys(PRIORITIES) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITIES[p].title}</option>)}
          </select>
        </Field>
        <Field label="نیاز تا تاریخ"><JalaliDatePicker value={neededBy} onChange={setNeededBy} ariaLabel="نیاز تا تاریخ" /></Field>
      </div>
    </AdminDialog>
  );
};

const ConvertDialog: React.FC<{ request: TaskRequest; onClose: () => void; onDone: () => void }> = ({ request, onClose, onDone }) => {
  const [people, setPeople] = useState<User[]>([]);
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState<string | undefined>(request.neededBy || undefined);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { fetchAllUsersPB().then(setPeople).catch(() => setPeople([])); }, []);
  const save = async () => {
    setSaving(true);
    try {
      await convertRequest(request.id, { dueDate, assignedUserId: assignee || null });
      showToast(`«${request.title}» به فعالیت تبدیل شد.`, 'ok');
      onDone();
    } catch (err) {
      setError(userErrorMessage(err, 'درخواست به فعالیت تبدیل نشد.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AdminDialog title="تبدیل به فعالیت" onClose={onClose} footer={<><SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving} onClick={save}>ساخت فعالیت</PrimaryButton></>}>
      {error && <Notice type="error">{error}</Notice>}
      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{request.title}</p>
      <Field label="مسئول انجام" hint="خالی: خودتان">
        <select id="convert-assignee" className={inputClass} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">خودم</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name || p.username}</option>)}
        </select>
      </Field>
      <Field label="موعد انجام" hint={request.neededBy ? `درخواست‌دهنده تا ${formatJalaliDay(request.neededBy)} لازم دارد.` : 'خالی: پیش‌فرض سامانه'}>
        <JalaliDatePicker value={dueDate} onChange={setDueDate} ariaLabel="موعد انجام" />
      </Field>
    </AdminDialog>
  );
};

const RejectDialog: React.FC<{ request: TaskRequest; onClose: () => void; onDone: () => void }> = ({ request, onClose, onDone }) => {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await rejectRequest(request.id, note);
      showToast('درخواست رد شد.', 'ok');
      onDone();
    } catch (err) {
      setError(userErrorMessage(err, 'درخواست رد نشد.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AdminDialog title={`رد «${request.title}»`} onClose={onClose} footer={<><SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving} onClick={save} className="bg-rose-700 hover:bg-rose-800">رد درخواست</PrimaryButton></>}>
      {error && <Notice type="error">{error}</Notice>}
      <Field label="دلیل" hint={`درخواست‌دهنده${request.requester ? ` (${request.requester.displayName})` : ''} این توضیح را می‌بیند.`}>
        <textarea id="reject-note" className={`${inputClass} min-h-24`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </Field>
    </AdminDialog>
  );
};

