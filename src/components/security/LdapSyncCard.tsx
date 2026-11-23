import React, { useState } from 'react';
import { RefreshCcw, Search } from 'lucide-react';
import { AdminCard, Notice, PrimaryButton, SecondaryButton, StatusBadge, Toggle } from '../admin/AdminUi';
import { appConfirm } from '../../utils/appDialog';
import { showToast } from '../../utils/toast';
import { userErrorMessage } from '../../utils/errorMessages';
import { toPersianDigits } from '../../utils/helpers';
import { previewLdapSync, runLdapSync } from '../../services/adminApi';
import type { LdapSyncAction, LdapSyncReport } from './types';

const ACTION: Record<LdapSyncAction, { tone: 'green' | 'indigo' | 'red' | 'amber' | 'slate'; label: string }> = {
  Create: { tone: 'green', label: 'ساخته می‌شود' },
  Update: { tone: 'indigo', label: 'به‌روز می‌شود' },
  Deactivate: { tone: 'red', label: 'غیرفعال می‌شود' },
  Reactivate: { tone: 'amber', label: 'دوباره فعال می‌شود' },
  Unchanged: { tone: 'slate', label: 'بدون تغییر' },
  Skipped: { tone: 'amber', label: 'رد شد' },
};

/**
 * «همگام‌سازی کاربران» under the LDAP settings (CAT-9): the directory's users become (or update) accounts
 * here; accounts that came from the directory and are gone or disabled there can be switched off. First a
 * preview that changes nothing, then the sync.
 */
export const LdapSyncCard: React.FC = () => {
  const [deactivateMissing, setDeactivateMissing] = useState(true);
  const [report, setReport] = useState<LdapSyncReport | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const preview = async () => {
    setBusy(true);
    try { setReport(await previewLdapSync(deactivateMissing)); setError(''); } catch (err) { setError(userErrorMessage(err, 'پیش‌نمایش همگام‌سازی انجام نشد. تنظیمات و اتصال LDAP را بررسی کنید.')); setReport(null); } finally { setBusy(false); }
  };
  const run = async () => {
    if (!(await appConfirm('همگام‌سازی کاربران با دایرکتوری انجام شود؟', { confirmLabel: 'همگام‌سازی' }))) return;
    setBusy(true);
    try {
      const done = await runLdapSync(deactivateMissing);
      setReport(done);
      showToast(`همگام‌سازی انجام شد: ${toPersianDigits(done.created)} ساخته، ${toPersianDigits(done.updated)} به‌روز، ${toPersianDigits(done.deactivated)} غیرفعال.`, 'ok', 8000);
    } catch (err) {
      setError(userErrorMessage(err, 'همگام‌سازی انجام نشد.'));
    } finally {
      setBusy(false);
    }
  };

  const changed = report ? report.rows.filter((r) => r.action !== 'Unchanged') : [];
  return (
    <AdminCard className="p-5 sm:p-6 space-y-4">
      <div>
        <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white"><RefreshCcw className="w-5 h-5 text-indigo-600" /> همگام‌سازی کاربران از دایرکتوری</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">کاربران Active Directory / LDAP به‌صورت حساب کاربری سامانه ساخته یا به‌روز می‌شوند و با رمز دایرکتوری وارد می‌شوند. اول پیش‌نمایش ببینید؛ پیش‌نمایش چیزی را تغییر نمی‌دهد.</p>
      </div>
      {error && <Notice type="error">{error}</Notice>}
      <Toggle checked={deactivateMissing} onChange={setDeactivateMissing} label="غیرفعال کردن حساب‌های حذف‌شده از دایرکتوری" description="حساب‌هایی که از دایرکتوری آمده‌اند و دیگر آنجا نیستند یا غیرفعال شده‌اند، اینجا هم غیرفعال می‌شوند." />
      <div className="flex flex-wrap gap-2">
        <SecondaryButton type="button" disabled={busy} onClick={preview}><Search className="w-4 h-4" /> پیش‌نمایش</SecondaryButton>
        <PrimaryButton type="button" disabled={busy || !report || report.applied} onClick={run}><RefreshCcw className="w-4 h-4" /> همگام‌سازی</PrimaryButton>
      </div>
      {report && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {report.applied && <StatusBadge tone="green">انجام شد</StatusBadge>}
            <StatusBadge tone="green">{toPersianDigits(report.created)} جدید</StatusBadge>
            <StatusBadge tone="indigo">{toPersianDigits(report.updated)} به‌روز</StatusBadge>
            <StatusBadge tone="red">{toPersianDigits(report.deactivated)} غیرفعال</StatusBadge>
            <StatusBadge tone="amber">{toPersianDigits(report.reactivated)} فعال‌شدهٔ دوباره</StatusBadge>
            <StatusBadge tone="slate">{toPersianDigits(report.unchanged)} بدون تغییر</StatusBadge>
            {report.skipped > 0 && <StatusBadge tone="amber">{toPersianDigits(report.skipped)} رد شده</StatusBadge>}
          </div>
          {changed.length > 0 && (
            <div className="overflow-x-auto max-h-72 rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/70 sticky top-0"><tr className="text-right text-[11px] text-slate-500"><th className="px-3 py-2">نام کاربری</th><th className="px-3 py-2">نام</th><th className="px-3 py-2">نتیجه</th><th className="px-3 py-2">توضیح</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {changed.slice(0, 300).map((r, i) => (
                    <tr key={`${r.username}-${i}`}>
                      <td className="px-3 py-2" dir="ltr">{r.username || '—'}</td>
                      <td className="px-3 py-2">{r.displayName || '—'}</td>
                      <td className="px-3 py-2"><StatusBadge tone={ACTION[r.action].tone}>{ACTION[r.action].label}</StatusBadge></td>
                      <td className="px-3 py-2 text-slate-500" dir="auto">{r.reason || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </AdminCard>
  );
};
