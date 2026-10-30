// A node's history (phase 7.2): the merge form with its impact preview, the change log with «بازگردانی»,
// and the dates between which the node exists («نمایش به تاریخ» in the chart uses them).
import React, { useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { AdminDialog, Field, Notice, PrimaryButton, SecondaryButton } from '../../AdminUi';
import { JalaliDatePicker } from '../../../JalaliDatePicker';
import { userErrorMessage } from '../../../../utils/errorMessages';
import { formatToJalali, toPersianDigits } from '../../../../utils/helpers';
import { gregorianToJalali } from '../../../../utils/jalali';

/** A Gregorian day (yyyy-MM-dd) as a Jalali date. */
export const jalaliDay = (iso: string): string => {
  const [gy, gm, gd] = iso.split('-').map(Number);
  if (!gy || !gm || !gd) return iso;
  const { jy, jm, jd } = gregorianToJalali(gy, gm, gd);
  return toPersianDigits(`${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`);
};
import { appConfirm } from '../../../../utils/appDialog';
import { type ChartCompany, type ChartUnit, type NodeChange, isConflict, listNodeChanges, mergeNode, setNodeValidity, undoNodeChange } from '../../../../services/orgStructureApi';
import { useLoad } from '../orgShared';
import { ImpactPreviewDialog } from './ImpactPreviewDialog';
import { MergeNodesForm, type MergeNodesInput } from './MergeNodesForm';

/** «ادغام در گره‌ی دیگر»: choose the target and the date, see what it changes for people, then merge. */
export const MergeNodeDialog: React.FC<{
  company: ChartCompany;
  unit: ChartUnit;
  rowVersion: string | null;
  onMerged: () => Promise<void> | void;
  onReload: () => Promise<void> | void;
  onClose: () => void;
}> = ({ company, unit, rowVersion, onMerged, onReload, onClose }) => {
  const [input, setInput] = useState<MergeNodesInput | null>(null);
  const target = input ? company.units.concat(company.units.flatMap(function walk(u: ChartUnit): ChartUnit[] { return (u.children || []).flatMap((c) => [c, ...walk(c)]); })).find((u) => u.unitId === input.targetNodeId) : undefined;

  if (input && target) {
    return (
      <ImpactPreviewDialog
        title={`ادغام «${unit.name}»`}
        summary={<>«{unit.name}» با زیرمجموعه، پست‌ها (با دارندگان) و افرادش در «{target.name}» ادغام می‌شود و {input.effectiveDate ? `از ${jalaliDay(input.effectiveDate)}` : 'همین حالا'} غیرفعال می‌شود.</>}
        changes={[{ kind: 'merge', nodeId: unit.unitId, toNodeId: input.targetNodeId }]}
        confirmLabel="ادغام کن"
        onConfirm={async () => {
          await mergeNode(unit.unitId, { targetNodeId: input.targetNodeId, effectiveDate: input.effectiveDate ?? null, rowVersion });
          await onMerged();
          onClose();
        }}
        onReload={onReload}
        onClose={onClose}
      />
    );
  }
  return (
    <AdminDialog title={`ادغام «${unit.name}» در گره‌ی دیگر`} wide onClose={onClose} footer={<SecondaryButton type="button" onClick={onClose}>بستن</SecondaryButton>}>
      <MergeNodesForm company={company} initialSourceId={unit.unitId} onSubmit={setInput} onCancel={onClose} />
    </AdminDialog>
  );
};

const ACTION_TITLES: Record<string, string> = {
  create: 'ساخته شد', update: 'ویرایش نام یا نوع', manager: 'تغییر مدیر', move: 'جابه‌جایی', reorder: 'تغییر ترتیب', deactivate: 'غیرفعال شد', activate: 'فعال شد',
  details: 'ویرایش اطلاعات', validity: 'تغییر تاریخ وجود', merge: 'ادغام', undo: 'بازگردانی', link: 'افزودن رابطه', unlink: 'برداشتن رابطه',
};
const actionTitle = (action: string) => ACTION_TITLES[action] || ACTION_TITLES[action.split('.').pop() || ''] || action;

/** The change log of a node, newest first; the last change can be undone. */
export const NodeHistoryDialog: React.FC<{
  unit: ChartUnit;
  rowVersion: string | null;
  canUndo: boolean;
  onUndone: () => Promise<void> | void;
  onClose: () => void;
}> = ({ unit, rowVersion, canUndo, onUndone, onClose }) => {
  const log = useLoad(() => listNodeChanges(unit.unitId, 50), 'دریافت تاریخچه ممکن نشد.');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; conflict?: boolean } | null>(null);
  const changes: NodeChange[] = log.data || [];
  const last = changes[0];

  const undo = async () => {
    if (!(await appConfirm('آخرین تغییر این گره برگردانده شود؟ بازگردانی هم مثل هر تغییر دیگر بررسی و در تاریخچه ثبت می‌شود.', { confirmLabel: 'بازگردان' }))) return;
    setBusy(true);
    setMessage(null);
    try {
      await undoNodeChange(unit.unitId, rowVersion);
      await onUndone();
      await log.reload();
      setMessage({ type: 'success', text: 'آخرین تغییر برگردانده شد.' });
    } catch (err) {
      setMessage({ type: 'error', text: userErrorMessage(err, 'بازگردانی انجام نشد.'), conflict: isConflict(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminDialog title={`تاریخچه‌ی «${unit.name}»`} wide onClose={onClose} footer={<>
      <SecondaryButton type="button" onClick={onClose}>بستن</SecondaryButton>
      {canUndo && <PrimaryButton type="button" onClick={undo} disabled={busy || !last?.canUndo}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} بازگرداندن آخرین تغییر</PrimaryButton>}
    </>}>
      {message && <Notice type={message.type}>{message.text}{message.conflict && ' صفحه را بارگذاری دوباره کنید.'}</Notice>}
      {log.loading ? <p className="text-sm text-slate-500">در حال دریافت…</p> : log.error ? <Notice type="error">{log.error}</Notice>
        : changes.length === 0 ? <p className="text-sm text-slate-500">هنوز تغییری ثبت نشده است.</p> : (
          <ol className="space-y-1.5" data-testid="node-log">
            {changes.map((c, i) => (
              <li key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{actionTitle(c.action)}</span>
                  <span className="text-[11px] text-slate-500 tabular-nums">{formatToJalali(c.atUtc)}</span>
                </div>
                {c.details && <details className="mt-1"><summary className="text-[11px] text-slate-500 cursor-pointer">جزئیات</summary><pre dir="ltr" className="mt-1 whitespace-pre-wrap break-words text-[11px] text-slate-600 dark:text-slate-300">{c.details}</pre></details>}
                {i === 0 && !c.canUndo && <p className="mt-1 text-[11px] text-slate-400">این نوع تغییر برگردانده نمی‌شود.</p>}
              </li>
            ))}
          </ol>
        )}
    </AdminDialog>
  );
};

/** The dates between which a node exists. They only matter for the chart on a day. */
export const NodeValidityDialog: React.FC<{
  unit: ChartUnit;
  rowVersion: string | null;
  onSaved: () => Promise<void> | void;
  onClose: () => void;
}> = ({ unit, rowVersion, onSaved, onClose }) => {
  const [from, setFrom] = useState<string | undefined>(undefined);
  const [to, setTo] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bad = !!from && !!to && from > to;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await setNodeValidity(unit.unitId, { validFrom: from ?? null, validTo: to ?? null, rowVersion });
      await onSaved();
      onClose();
    } catch (err) {
      setError(userErrorMessage(err, 'ذخیره‌ی تاریخ‌ها انجام نشد.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminDialog title={`تاریخ وجود «${unit.name}»`} onClose={() => !busy && onClose()} footer={<>
      <SecondaryButton type="button" onClick={onClose} disabled={busy}>انصراف</SecondaryButton>
      <PrimaryButton type="button" onClick={save} disabled={busy || bad}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} ذخیره</PrimaryButton>
    </>}>
      {error && <Notice type="error" onClose={() => setError(null)}>{error}</Notice>}
      <Notice type="info">هر دو تاریخ با مقدار این فرم جایگزین می‌شود (خالی: بدون محدودیت). تغییر تاریخ، گره را غیرفعال یا جابه‌جا نمی‌کند؛ فقط «نمایش به تاریخ» در چارت از آن استفاده می‌کند.</Notice>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="وجود دارد از"><JalaliDatePicker value={from} onChange={setFrom} ariaLabel="گره از این تاریخ وجود دارد" placeholder="بدون محدودیت" /></Field>
        <Field label="وجود دارد تا"><JalaliDatePicker value={to} onChange={setTo} ariaLabel="گره تا این تاریخ وجود دارد" placeholder="بدون محدودیت" /></Field>
      </div>
      {bad && <Notice type="error">تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد.</Notice>}
    </AdminDialog>
  );
};
