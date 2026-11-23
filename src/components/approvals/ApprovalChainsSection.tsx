import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import type { User } from '../../types';
import { AdminCard, Field, inputClass, Notice, PrimaryButton } from '../admin/AdminUi';
import { showToast } from '../../utils/toast';
import { userErrorMessage } from '../../utils/errorMessages';
import { toPersianDigits } from '../../utils/helpers';
import { fetchAllUsersPB } from '../../services/dataService';
import { APPROVAL_KIND_LABELS, listDefinitions, saveChain } from '../../services/approvalsApi';
import type { ApprovalKind, SaveStep } from './types';

/** Who approves a step: a role in the organization chart (filled when the approval starts) or one person. */
const ROLES: Record<string, string> = {
  Manager: 'مدیر مستقیم (از چارت سازمانی)',
  Approver2: 'مدیرِ مدیر (یک سطح بالاتر)',
  Owner: 'مالک فعالیت / خود شخص',
};

interface DraftStep { name: string; who: string; isOptional: boolean }
const toDraft = (s: { name: string; approverUserId: string | null; approverKey: string | null; isOptional: boolean }): DraftStep =>
  ({ name: s.name, who: s.approverUserId ? `user:${s.approverUserId}` : s.approverKey ? `key:${s.approverKey}` : 'key:Manager', isOptional: s.isOptional });

/**
 * «مسیرهای تأیید» (CAT-123, CAT-108): for each kind of approval, the steps in order and who decides each one.
 * No step means no approval: a task submitted for review is completed at once, a week is accepted at once.
 */
export const ApprovalChainsSection: React.FC = () => {
  const [kind, setKind] = useState<ApprovalKind>('TaskReview');
  const [steps, setSteps] = useState<DraftStep[] | null>(null);
  const [people, setPeople] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setSteps(null);
    listDefinitions(kind)
      .then((defs) => {
        const general = defs.find((d) => d.subjectType === kind && d.scopeType === 'General' && d.isActive) || defs.find((d) => d.subjectType === kind);
        setSteps(general ? [...general.steps].sort((a, b) => a.order - b.order).map(toDraft) : []);
        setError('');
      })
      .catch((err) => setError(userErrorMessage(err, 'مسیر تأیید خوانده نشد.')));
  }, [kind]);
  useEffect(load, [load]);
  useEffect(() => { fetchAllUsersPB().then(setPeople).catch(() => setPeople([])); }, []);

  const set = (i: number, patch: Partial<DraftStep>) => setSteps((list) => (list || []).map((s, n) => (n === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: number) => setSteps((list) => {
    const next = [...(list || [])];
    const j = i + d;
    if (j < 0 || j >= next.length) return next;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const save = async () => {
    if (!steps) return;
    if (steps.some((s) => !s.name.trim())) { setError('نام هر مرحله را بنویسید.'); return; }
    setSaving(true);
    try {
      const payload: SaveStep[] = steps.map((s) => ({
        name: s.name.trim(),
        approverUserId: s.who.startsWith('user:') ? s.who.slice(5) : null,
        approverKey: s.who.startsWith('key:') ? s.who.slice(4) : null,
        isOptional: s.isOptional,
      }));
      await saveChain(kind, APPROVAL_KIND_LABELS[kind], payload);
      showToast(steps.length ? 'مسیر تأیید ذخیره شد.' : 'مسیر تأیید برداشته شد؛ این نوع کار دیگر تأیید لازم ندارد.', 'ok');
      setError('');
      load();
    } catch (err) {
      setError(userErrorMessage(err, 'مسیر تأیید ذخیره نشد.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminCard className="p-5 sm:p-6 space-y-4">
      <div>
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">مسیرهای تأیید</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-2xl">برای هر نوع کار، مراحل تأیید به ترتیب و تأییدکنندهٔ هر مرحله. «مدیر مستقیم» هنگام ارسال از چارت سازمانی پیدا می‌شود؛ مرحلهٔ اختیاری وقتی آن نقش کسی را ندارد رد می‌شود. بدون هیچ مرحله، تأیید لازم نیست.</p>
      </div>
      {error && <Notice type="error">{error}</Notice>}
      <Field label="نوع کار">
        <select id="chain-kind" className={`${inputClass} max-w-xs`} value={kind} onChange={(e) => setKind(e.target.value as ApprovalKind)}>
          {(Object.keys(APPROVAL_KIND_LABELS) as ApprovalKind[]).map((k) => <option key={k} value={k}>{APPROVAL_KIND_LABELS[k]}</option>)}
        </select>
      </Field>
      {steps && steps.length === 0 && <p className="p-4 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">این نوع کار مسیر تأیید ندارد و بدون تأیید نهایی می‌شود.</p>}
      <ol className="space-y-2">
        {(steps || []).map((s, i) => (
          <li key={i} className="grid grid-cols-1 sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.3fr)_auto_auto] gap-2 items-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <span className="text-sm font-extrabold text-slate-500 text-center">{toPersianDigits(i + 1)}</span>
            <input id={`step-name-${i}`} aria-label="نام مرحله" className={inputClass} value={s.name} onChange={(e) => set(i, { name: e.target.value })} maxLength={100} placeholder="مثلاً «تأیید مدیر واحد»" />
            <select id={`step-who-${i}`} aria-label="تأییدکننده" className={inputClass} value={s.who} onChange={(e) => set(i, { who: e.target.value })}>
              <optgroup label="بر اساس چارت سازمانی">
                {Object.entries(ROLES).map(([k, label]) => <option key={k} value={`key:${k}`}>{label}</option>)}
              </optgroup>
              <optgroup label="شخص مشخص">
                {people.map((p) => <option key={p.id} value={`user:${p.id}`}>{p.name || p.username}</option>)}
              </optgroup>
            </select>
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap"><input type="checkbox" checked={s.isOptional} onChange={(e) => set(i, { isOptional: e.target.checked })} /> اختیاری</label>
            <span className="flex gap-0.5">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30 cursor-pointer" aria-label="بالاتر"><ArrowUp className="w-4 h-4" /></button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === steps!.length - 1} className="p-1.5 text-slate-400 hover:text-indigo-600 disabled:opacity-30 cursor-pointer" aria-label="پایین‌تر"><ArrowDown className="w-4 h-4" /></button>
              <button type="button" onClick={() => setSteps((list) => (list || []).filter((_, n) => n !== i))} className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer" aria-label="حذف مرحله"><X className="w-4 h-4" /></button>
            </span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!steps} onClick={() => setSteps((list) => [...(list || []), { name: (list || []).length ? 'تأیید مرحلهٔ بعد' : 'تأیید مدیر مستقیم', who: 'key:Manager', isOptional: false }])} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"><Plus className="w-3.5 h-3.5" /> افزودن مرحله</button>
        <span className="flex-1" />
        <PrimaryButton type="button" disabled={saving || !steps} onClick={save}>ذخیرهٔ مسیر</PrimaryButton>
      </div>
    </AdminCard>
  );
};
