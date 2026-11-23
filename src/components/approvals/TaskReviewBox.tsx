import React, { useEffect, useState } from 'react';
import { ClipboardCheck, Send } from 'lucide-react';
import type { Task } from '../../types';
import { AdminDialog, Field, inputClass, Notice, PrimaryButton, SecondaryButton } from '../admin/AdminUi';
import { showToast } from '../../utils/toast';
import { userErrorMessage } from '../../utils/errorMessages';
import { submitTaskReview } from '../../services/approvalsApi';

/**
 * Review of a task (CAT-79, CAT-80, CAT-126): the person doing it sends it to be checked; the approval chain set
 * for task reviews decides (no chain: it is completed at once). Shows where the review stands and, after a
 * rejection, why - the task then goes back to be reworked.
 */
export const TaskReviewBox: React.FC<{ task: Task; canSubmit: boolean }> = ({ task, canSubmit }) => {
  const [status, setStatus] = useState(task.server?.reviewStatus || 'NotSubmitted');
  const [open, setOpen] = useState(false);
  useEffect(() => { setStatus(task.server?.reviewStatus || 'NotSubmitted'); }, [task.server?.reviewStatus]);
  const comment = task.server?.reviewComment;
  const finished = task.status === 'completed';

  const badge =
    status === 'PendingApproval' ? { cls: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200', text: 'در انتظار بازبینی؛ تا تأیید نهایی، وضعیت فعالیت تغییر نمی‌کند.' }
      : status === 'Rejected' ? { cls: 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200', text: `بازبینی رد شد و فعالیت برای اصلاح برگشت${comment ? `: «${comment}»` : '.'}` }
        : status === 'Approved' ? { cls: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-200', text: `بازبینی تأیید شد${comment ? `: «${comment}»` : '.'}` }
          : null;
  const showButton = canSubmit && !finished && status !== 'PendingApproval';
  if (!badge && !showButton) return null;

  return (
    <div className="space-y-2">
      {badge && (
        <div className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs ${badge.cls}`}>
          <ClipboardCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{badge.text}</span>
        </div>
      )}
      {showButton && (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold cursor-pointer">
          <Send className="w-3.5 h-3.5" /> {status === 'Rejected' ? 'ارسال دوباره برای بازبینی' : 'ارسال برای بازبینی'}
        </button>
      )}
      {open && <SubmitDialog task={task} onClose={() => setOpen(false)} onDone={(s) => { setStatus(s); setOpen(false); }} />}
    </div>
  );
};

const SubmitDialog: React.FC<{ task: Task; onClose: () => void; onDone: (status: string) => void }> = ({ task, onClose, onDone }) => {
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const result = await submitTaskReview(task.id, comment);
      showToast(result.reviewStatus === 'PendingApproval' ? 'برای بازبینی فرستاده شد.' : 'مسیر بازبینی تعریف نشده است؛ فعالیت مستقیم خاتمه یافت.', 'ok');
      onDone(result.reviewStatus || 'NotSubmitted');
    } catch (err) {
      setError(userErrorMessage(err, 'برای بازبینی فرستاده نشد.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AdminDialog title="ارسال برای بازبینی" onClose={onClose} footer={<><SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving} onClick={save}>ارسال</PrimaryButton></>}>
      {error && <Notice type="error">{error}</Notice>}
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">«{task.title}» برای تأیید به مسیر بازبینی فرستاده می‌شود. با تأیید نهایی خاتمه می‌یابد؛ اگر رد شود با دلیل به شما برمی‌گردد.</p>
      <Field label="توضیح برای بازبین (اختیاری)">
        <textarea id="review-comment" className={`${inputClass} min-h-24`} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="مثلاً «گزارش پیوست شد؛ لطفاً بخش مالی را بررسی کنید»" autoFocus />
      </Field>
    </AdminDialog>
  );
};
