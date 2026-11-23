import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Plus, UserRoundCheck, XCircle } from 'lucide-react';
import type { User } from '../../types';
import { AdminCard, AdminDialog, Field, inputClass, Notice, PillTabs, PrimaryButton, SecondaryButton, StatusBadge, TabItem } from '../admin/AdminUi';
import { JalaliDatePicker } from '../JalaliDatePicker';
import { appConfirm } from '../../utils/appDialog';
import { showToast } from '../../utils/toast';
import { userErrorMessage } from '../../utils/errorMessages';
import { toPersianDigits, formatToJalali } from '../../utils/helpers';
import { gregorianToJalali, isoToIranDateTimeParts } from '../../utils/jalali';
import { can } from '../../utils/permissions';
import { getSessionUser } from '../../services/nexusApi';
import { fetchAllUsersPB } from '../../services/dataService';
import {
  APPROVAL_KIND_LABELS,
  APPROVAL_PERMISSIONS,
  approve,
  createDelegation,
  listDelegations,
  listPendingApprovals,
  reject,
  revokeDelegation,
  taskReviewItems,
  timesheetReviewItems,
} from '../../services/approvalsApi';
import type { ApprovalKind, Delegation, TaskReviewItem, TimesheetReviewItem, WorkflowInstance } from './types';

function day(value: string | null | undefined): string {
  if (!value) return '—';
  const d = value.includes('T') ? isoToIranDateTimeParts(value)?.date ?? value : value;
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return value;
  const { jy, jm, jd } = gregorianToJalali(Number(m[1]), Number(m[2]), Number(m[3]));
  return toPersianDigits(`${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`);
}
const hm = (minutes: number) => toPersianDigits(`${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`);

type Tab = 'pending' | 'delegations';

/**
 * «کارتابل تأیید» (CAT-79/80/81/126, CAT-160, CAT-118/CAT-4): what waits for the signed-in person's decision -
 * task reviews and weekly timesheets - and their approver delegations (someone decides for them for a period).
 */
export const ApprovalsView: React.FC = () => {
  const me = getSessionUser();
  const tabs: TabItem<Tab>[] = [
    { id: 'pending', label: 'در انتظار تصمیم من', icon: ClipboardCheck },
    ...(can(me, APPROVAL_PERMISSIONS.approve) ? [{ id: 'delegations' as const, label: 'جانشینی تأیید', icon: UserRoundCheck }] : []),
  ];
  const [tab, setTab] = useState<Tab>('pending');
  return (
    <div className="w-full space-y-4" dir="rtl">
      <AdminCard className="p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900 dark:text-white"><ClipboardCheck className="w-6 h-6 text-indigo-600" /> کارتابل تأیید</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">فعالیت‌هایی که برای بازبینی فرستاده شده‌اند و ساعت‌های کار هفتگی که تأیید شما را لازم دارند. مسیر تأیید هر نوع کار در تنظیمات «اتوماسیون و گزارش» تعیین می‌شود.</p>
        </div>
        {tabs.length > 1 && <PillTabs tabs={tabs} active={tab} onChange={setTab} />}
      </AdminCard>
      {tab === 'pending' && <PendingList />}
      {tab === 'delegations' && <Delegations />}
    </div>
  );
};

const PendingList: React.FC = () => {
  const me = getSessionUser();
  const canApprove = can(me, APPROVAL_PERMISSIONS.approve);
  const canReject = can(me, APPROVAL_PERMISSIONS.reject);
  const [items, setItems] = useState<WorkflowInstance[] | null>(null);
  const [tasks, setTasks] = useState<Record<string, TaskReviewItem>>({});
  const [weeks, setWeeks] = useState<Record<string, TimesheetReviewItem>>({});
  const [people, setPeople] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [deciding, setDeciding] = useState<{ item: WorkflowInstance; approve: boolean } | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await listPendingApprovals();
      setItems(list);
      setError('');
      const ids = (kind: string) => list.filter((i) => i.subjectType === kind).map((i) => i.subjectId);
      const [t, w] = await Promise.all([taskReviewItems(ids('TaskReview')).catch(() => []), timesheetReviewItems(ids('Timesheet')).catch(() => [])]);
      setTasks(Object.fromEntries(t.map((x) => [x.id, x])));
      setWeeks(Object.fromEntries(w.map((x) => [x.id, x])));
    } catch (err) {
      setError(userErrorMessage(err, 'کارتابل تأیید خوانده نشد.'));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { fetchAllUsersPB().then(setPeople).catch(() => setPeople([])); }, []);
  const nameOf = (id: string | null | undefined) => (id ? people.find((p) => p.id === id)?.name || 'یک نفر' : '');

  return (
    <AdminCard className="p-5 space-y-3">
      {error && <Notice type="error">{error}</Notice>}
      {items && items.length === 0 && <p className="p-8 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">چیزی در انتظار تصمیم شما نیست.</p>}
      <ul className="space-y-2.5">
        {(items || []).map((i) => {
          const kind = i.subjectType as ApprovalKind;
          const task = kind === 'TaskReview' ? tasks[i.subjectId] : undefined;
          const week = kind === 'Timesheet' ? weeks[i.subjectId] : undefined;
          const stepName = i.steps?.find((s) => s.order === i.currentStepOrder)?.name;
          return (
            <li key={i.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={kind === 'Timesheet' ? 'indigo' : 'slate'}>{APPROVAL_KIND_LABELS[kind] || i.subjectType}</StatusBadge>
                <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex-1 min-w-0">
                  {task ? task.title : week ? `ساعت کار ${week.user?.displayName || ''} — هفتهٔ ${day(week.weekStart)}` : 'مورد تأیید'}
                </span>
                {i.totalSteps > 1 && <span className="text-[11px] text-slate-500">مرحلهٔ {toPersianDigits(i.currentStepOrder)} از {toPersianDigits(i.totalSteps)}{stepName ? `: ${stepName}` : ''}</span>}
                {i.delegatedFromUserId && <StatusBadge tone="amber">به جانشینی از {nameOf(i.delegatedFromUserId)}</StatusBadge>}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                {task?.submittedBy && <span>فرستنده: <b>{task.submittedBy.displayName}</b></span>}
                {task?.submittedAtUtc && <span>ارسال: {formatToJalali(task.submittedAtUtc)}</span>}
                {task && <span>موعد: {day(task.dueDate)}</span>}
                {week && <span>جمع هفته: <b>{hm(week.totalMinutes)}</b></span>}
                {week && <span>ارسال: {formatToJalali(week.submittedAtUtc)}</span>}
              </div>
              {task?.comment && <p className="text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">توضیح فرستنده: {task.comment}</p>}
              {i.decisions.length > 0 && (
                <ul className="text-[11px] text-slate-500 space-y-0.5">
                  {i.decisions.map((d) => <li key={d.id}>مرحلهٔ {toPersianDigits(d.stepOrder)}: {d.approved ? 'تأیید' : 'رد'} توسط {nameOf(d.decidedByUserId)}{d.comment ? ` — «${d.comment}»` : ''}</li>)}
                </ul>
              )}
              <div className="flex gap-2 pt-1">
                {canApprove && <button type="button" onClick={() => setDeciding({ item: i, approve: true })} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"><CheckCircle2 className="w-3.5 h-3.5" /> تأیید</button>}
                {canReject && <button type="button" onClick={() => setDeciding({ item: i, approve: false })} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300 text-xs font-bold cursor-pointer"><XCircle className="w-3.5 h-3.5" /> رد و برگشت</button>}
              </div>
            </li>
          );
        })}
      </ul>
      {deciding && <DecisionDialog item={deciding.item} approving={deciding.approve} onClose={() => setDeciding(null)} onDone={() => { setDeciding(null); void load(); }} />}
    </AdminCard>
  );
};

const DecisionDialog: React.FC<{ item: WorkflowInstance; approving: boolean; onClose: () => void; onDone: () => void }> = ({ item, approving, onClose, onDone }) => {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isTask = item.subjectType === 'TaskReview';
  const save = async () => {
    if (!approving && !comment.trim()) { setError('دلیل رد را بنویسید تا فرستنده بداند چه چیزی باید اصلاح شود.'); return; }
    setSaving(true);
    try {
      const done = approving ? await approve(item.id, comment) : await reject(item.id, comment);
      showToast(
        approving
          ? done.status === 'Approved' ? (isTask ? 'تأیید شد و فعالیت خاتمه یافت.' : 'تأیید شد.') : 'تأیید شد و به مرحلهٔ بعد رفت.'
          : isTask ? 'رد شد؛ فعالیت برای اصلاح به مسئول برگشت.' : 'رد شد؛ هفته برای اصلاح برگشت.',
        'ok',
      );
      onDone();
    } catch (err) {
      setError(userErrorMessage(err, 'تصمیم ثبت نشد.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AdminDialog
      title={approving ? 'تأیید' : 'رد و برگشت'}
      onClose={onClose}
      footer={<><SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving} onClick={save} className={approving ? '' : 'bg-rose-700 hover:bg-rose-800'}>{approving ? 'تأیید' : 'رد'}</PrimaryButton></>}
    >
      {error && <Notice type="error">{error}</Notice>}
      <Field label={approving ? 'توضیح (اختیاری)' : 'دلیل رد'} required={!approving} hint="فرستنده این توضیح را می‌بیند.">
        <textarea id="decision-comment" className={`${inputClass} min-h-24`} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} autoFocus />
      </Field>
    </AdminDialog>
  );
};

// ------------------------------------------------------------------ delegations (CAT-118, CAT-4)

const Delegations: React.FC = () => {
  const me = getSessionUser();
  const [items, setItems] = useState<Delegation[] | null>(null);
  const [people, setPeople] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const load = useCallback(() => {
    listDelegations().then((d) => { setItems(d); setError(''); }).catch((err) => setError(userErrorMessage(err, 'جانشینی‌ها خوانده نشد.')));
  }, []);
  useEffect(load, [load]);
  useEffect(() => { fetchAllUsersPB().then(setPeople).catch(() => setPeople([])); }, []);
  const nameOf = (id: string) => people.find((p) => p.id === id)?.name || 'یک نفر';
  const sorted = useMemo(() => [...(items || [])].sort((a, b) => b.startDate.localeCompare(a.startDate)), [items]);

  const revoke = async (d: Delegation) => {
    if (!(await appConfirm('این جانشینی همین حالا پایان یابد؟', { confirmLabel: 'پایان دادن' }))) return;
    try { await revokeDelegation(d.id); load(); showToast('جانشینی پایان یافت.', 'ok'); } catch (err) { showToast(userErrorMessage(err, 'انجام نشد.'), 'error'); }
  };

  return (
    <AdminCard className="p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">برای مرخصی یا مأموریت: در این بازه، تأییدهای شما در کارتابل جانشین هم دیده می‌شود و تصمیم او به‌جای شما ثبت می‌شود. جانشینی پاک نمی‌شود و سابقه‌اش می‌ماند؛ برای پایان زودتر آن را پایان دهید.</p>
        <PrimaryButton type="button" onClick={() => setAdding(true)} className="shrink-0"><Plus className="w-4 h-4" /> جانشین جدید</PrimaryButton>
      </div>
      {error && <Notice type="error">{error}</Notice>}
      {items && sorted.length === 0 && <p className="p-6 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">جانشینی تعریف نشده است.</p>}
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {sorted.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
            <span className="font-bold text-slate-800 dark:text-slate-100 flex-1 min-w-[200px]">
              {d.delegatorUserId === me?.id ? <>جانشین من: {nameOf(d.delegateUserId)}</> : <>من جانشین {nameOf(d.delegatorUserId)}</>}
            </span>
            <span className="text-xs text-slate-500">{day(d.startDate)} تا {day(d.endDate)}</span>
            <span className="text-xs text-slate-500">{d.subjectType ? APPROVAL_KIND_LABELS[d.subjectType as ApprovalKind] || d.subjectType : 'همهٔ تأییدها'}</span>
            {d.isRevoked ? <StatusBadge tone="slate">پایان‌یافته</StatusBadge> : d.isActiveNow ? <StatusBadge tone="green">فعال</StatusBadge> : <StatusBadge tone="amber">در انتظار شروع</StatusBadge>}
            {!d.isRevoked && d.delegatorUserId === me?.id && <SecondaryButton type="button" className="px-3 py-1.5 text-xs" onClick={() => revoke(d)}>پایان دادن</SecondaryButton>}
            {d.reason && <span className="w-full text-[11px] text-slate-500">دلیل: {d.reason}</span>}
          </li>
        ))}
      </ul>
      {adding && <DelegationDialog people={people.filter((p) => p.id !== me?.id)} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load(); }} />}
    </AdminCard>
  );
};

const DelegationDialog: React.FC<{ people: User[]; onClose: () => void; onSaved: () => void }> = ({ people, onClose, onSaved }) => {
  const [delegate, setDelegate] = useState('');
  const [start, setStart] = useState<string | undefined>();
  const [end, setEnd] = useState<string | undefined>();
  const [kind, setKind] = useState<ApprovalKind | ''>('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!delegate) { setError('جانشین را انتخاب کنید.'); return; }
    if (!start || !end) { setError('بازهٔ جانشینی را مشخص کنید.'); return; }
    if (end < start) { setError('پایان باید بعد از شروع باشد.'); return; }
    setSaving(true);
    try {
      await createDelegation({ delegateUserId: delegate, startDate: start, endDate: end, subjectType: kind || null, reason });
      showToast('جانشین تأیید ثبت شد.', 'ok');
      onSaved();
    } catch (err) {
      setError(userErrorMessage(err, 'جانشینی ثبت نشد.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AdminDialog title="جانشین تأیید" onClose={onClose} footer={<><SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving} onClick={save}>ثبت</PrimaryButton></>}>
      {error && <Notice type="error">{error}</Notice>}
      <Field label="جانشین" required>
        <select id="delegate-user" className={inputClass} value={delegate} onChange={(e) => setDelegate(e.target.value)}>
          <option value="">انتخاب فرد</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name || p.username}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="از" required><JalaliDatePicker value={start} onChange={setStart} ariaLabel="شروع جانشینی" /></Field>
        <Field label="تا (شامل همین روز)" required><JalaliDatePicker value={end} onChange={setEnd} ariaLabel="پایان جانشینی" /></Field>
      </div>
      <Field label="برای">
        <select id="delegate-kind" className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as ApprovalKind | '')}>
          <option value="">همهٔ تأییدها</option>
          {(Object.keys(APPROVAL_KIND_LABELS) as ApprovalKind[]).map((k) => <option key={k} value={k}>{APPROVAL_KIND_LABELS[k]}</option>)}
        </select>
      </Field>
      <Field label="دلیل"><input id="delegate-reason" className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="مثلاً «مرخصی سالانه»" /></Field>
    </AdminDialog>
  );
};
