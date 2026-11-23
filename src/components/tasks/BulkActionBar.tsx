import React, { useState } from 'react';
import { Archive, Loader2, X } from 'lucide-react';
import type { Priority, TaskStatus } from '../../types';
import { PRIORITIES, STATUSES } from '../../types';
import { appConfirm } from '../../utils/appDialog';
import { showToast } from '../../utils/toast';
import { userErrorMessage, persianApiMessage } from '../../utils/errorMessages';
import { toPersianDigits } from '../../utils/helpers';
import { bulkTaskAction, PRIORITY_TO_SERVER, STATUS_TO_SERVER } from '../../services/taskFeaturesApi';
import { useCustomStatuses } from './taskLookups';
import type { BulkRequest, BulkResult } from './types';

/** What to tell after a bulk action: how many were done, and why the others were refused. */
function report(result: BulkResult, verb: string) {
  const done = result.succeeded.length;
  const failed = result.failed.length;
  if (failed === 0) {
    showToast(`${toPersianDigits(done)} فعالیت ${verb}.`, 'ok');
    return;
  }
  const reasons = Array.from(new Set(result.failed.map((f) => persianApiMessage(409, f.code, f.message)))).slice(0, 2).join(' ');
  showToast(`${toPersianDigits(done)} فعالیت ${verb}؛ ${toPersianDigits(failed)} فعالیت انجام نشد: ${reasons}`, done > 0 ? 'info' : 'error', 10000);
}

/**
 * Bulk actions over the selected tasks (CAT-74), up to 100 at a time: status, custom status,
 * priority, archive. Each task is checked on its own; the bar says how many went through.
 */
export const BulkActionBar: React.FC<{ selectedIds: string[]; onDone: () => void; onClear: () => void }> = ({ selectedIds, onDone, onClear }) => {
  const customStatuses = useCustomStatuses().filter((s) => s.isActive);
  const [busy, setBusy] = useState(false);
  const count = selectedIds.length;

  const run = async (request: Omit<BulkRequest, 'ids'>, verb: string) => {
    if (count > 100) {
      showToast('در هر بار حداکثر ۱۰۰ فعالیت را می‌توان با هم تغییر داد.', 'error');
      return;
    }
    setBusy(true);
    try {
      report(await bulkTaskAction({ ids: selectedIds, ...request }), verb);
      onDone();
    } catch (err) {
      showToast(userErrorMessage(err, 'تغییر گروهی انجام نشد.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const select = 'px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50';

  return (
    <div role="toolbar" aria-label="عملیات گروهی" className="sticky top-2 z-10 flex flex-wrap items-center gap-2 p-2.5 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/60 shadow-sm">
      <span className="text-xs font-extrabold text-indigo-800 dark:text-indigo-200 px-1">{toPersianDigits(count)} فعالیت انتخاب شده</span>
      <select
        id="bulk-status"
        aria-label="تغییر وضعیت"
        className={select}
        disabled={busy}
        value=""
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          if (v.startsWith('custom:')) run({ action: 'CustomStatus', customStatusId: v.slice(7) }, 'به‌روز شد');
          else run({ action: 'Status', status: STATUS_TO_SERVER[v as TaskStatus] }, 'به‌روز شد');
        }}
      >
        <option value="">تغییر وضعیت...</option>
        {(Object.keys(STATUSES) as TaskStatus[]).map((s) => <option key={s} value={s}>{STATUSES[s].title}</option>)}
        {customStatuses.length > 0 && (
          <optgroup label="وضعیت‌های سفارشی">
            {customStatuses.map((s) => <option key={s.id} value={`custom:${s.id}`}>{s.name}</option>)}
          </optgroup>
        )}
      </select>
      <select
        id="bulk-priority"
        aria-label="تغییر اولویت"
        className={select}
        disabled={busy}
        value=""
        onChange={(e) => e.target.value && run({ action: 'Priority', priority: PRIORITY_TO_SERVER[e.target.value as Priority] }, 'به‌روز شد')}
      >
        <option value="">تغییر اولویت...</option>
        {(Object.keys(PRIORITIES) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITIES[p].title}</option>)}
      </select>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (await appConfirm(`${toPersianDigits(count)} فعالیت به بایگانی برود؟ از صفحهٔ «بایگانی» قابل بازگرداندن است.`, { confirmLabel: 'بایگانی' })) {
            run({ action: 'Archive' }, 'بایگانی شد');
          }
        }}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer disabled:opacity-50"
      >
        <Archive className="w-3.5 h-3.5" /> بایگانی
      </button>
      {busy && <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />}
      <button type="button" onClick={onClear} className="mr-auto inline-flex items-center gap-1 text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer">
        <X className="w-3.5 h-3.5" /> لغو انتخاب
      </button>
    </div>
  );
};
