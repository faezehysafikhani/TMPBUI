import React, { useEffect, useState } from 'react';
import { DoorOpen, Repeat2, ShieldOff, UserRoundCog } from 'lucide-react';
import type { User } from '../../types';
import { AdminDialog, Field, inputClass, Notice, PrimaryButton, SecondaryButton, StatusBadge, Toggle } from '../admin/AdminUi';
import { JalaliDatePicker } from '../JalaliDatePicker';
import { appConfirm } from '../../utils/appDialog';
import { showToast } from '../../utils/toast';
import { userErrorMessage } from '../../utils/errorMessages';
import { iranDateTimeToISO } from '../../utils/jalali';
import { fetchAllUsersPB } from '../../services/dataService';
import type { AdminUser } from '../../services/nexusApi';
import { offboardUser, resetUserMfa, setUserAccessExpiry, setUserKind, transferUserPosts } from '../../services/adminApi';

/**
 * «امنیت و خروج» for one user in user management:
 * - the SMS code switched off for someone who lost their phone (CAT-228),
 * - guest (an outside person, not counted in the plan's users) and when the account's access ends (CAT-6),
 * - leaving the organization: posts handed to a successor or freed (CAT-5), or moved to someone else (CAT-11).
 * Each part shows only with its permission; the server checks again.
 */
export const UserSecurityDialog: React.FC<{
  user: AdminUser;
  canUpdate: boolean;
  canManageAssignments: boolean;
  onClose: () => void;
  onChanged: () => void;
}> = ({ user, canUpdate, canManageAssignments, onClose, onChanged }) => {
  const [people, setPeople] = useState<User[]>([]);
  const [guest, setGuest] = useState(user.kind === 'Guest');
  const [mfaOn, setMfaOn] = useState(user.mfaEnabled);
  const [expiry, setExpiry] = useState<string | undefined>();
  const [successor, setSuccessor] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferDay, setTransferDay] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const name = user.displayName || user.username;

  useEffect(() => { if (canManageAssignments) fetchAllUsersPB().then((list) => setPeople(list.filter((p) => p.id !== user.id))).catch(() => setPeople([])); }, [canManageAssignments, user.id]);

  const run = async (action: () => Promise<unknown>, ok: string, fallback: string, close = false) => {
    setBusy(true);
    setError('');
    try {
      await action();
      showToast(ok, 'ok');
      onChanged();
      if (close) onClose();
    } catch (err) {
      setError(userErrorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  const editableAccount = canUpdate && !user.isSystem && user.kind !== 'ServiceAccount';
  const section = 'p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3';

  return (
    <AdminDialog title={`امنیت و خروج — ${name}`} onClose={onClose} footer={<SecondaryButton type="button" onClick={onClose}>بستن</SecondaryButton>}>
      {error && <Notice type="error">{error}</Notice>}

      {canUpdate && (
        <section className={section}>
          <h4 className="flex items-center gap-2 text-sm font-extrabold text-slate-800 dark:text-slate-100"><ShieldOff className="w-4 h-4 text-indigo-500" /> ورود دومرحله‌ای</h4>
          {mfaOn ? (
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge tone="green">فعال</StatusBadge>
              <span className="text-xs text-slate-500 flex-1">اگر کاربر به گوشی خود دسترسی ندارد، کد پیامکی را برایش خاموش کنید؛ دوباره از پروفایلش روشن می‌شود.</span>
              <SecondaryButton
                type="button"
                disabled={busy}
                onClick={async () => { if (await appConfirm(`ورود دومرحله‌ای ${name} خاموش شود؟`, { confirmLabel: 'خاموش کن' })) run(async () => { await resetUserMfa(user.id); setMfaOn(false); }, 'ورود دومرحله‌ای کاربر خاموش شد.', 'انجام نشد.'); }}
              >
                خاموش کردن
              </SecondaryButton>
            </div>
          ) : (
            <p className="text-xs text-slate-500">این کاربر ورود دومرحله‌ای را روشن نکرده است. هر کاربر آن را از پروفایل خودش روشن می‌کند.</p>
          )}
        </section>
      )}

      {editableAccount && (
        <section className={section}>
          <h4 className="flex items-center gap-2 text-sm font-extrabold text-slate-800 dark:text-slate-100"><UserRoundCog className="w-4 h-4 text-indigo-500" /> مهمان و پایان دسترسی</h4>
          <Toggle
            checked={guest}
            disabled={busy}
            onChange={(next) => run(async () => { await setUserKind(user.id, next ? 'Guest' : 'Normal'); setGuest(next); }, next ? 'کاربر مهمان شد.' : 'کاربر عادی شد.', 'نوع کاربر تغییر نکرد.')}
            label="کاربر مهمان"
            description="فرد بیرونی (مشتری، مشاور) با دسترسی محدودی که خودتان می‌دهید؛ در سقف کاربران پلن شمرده نمی‌شود."
          />
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <Field label="پایان دسترسی" hint="از ابتدای این روز (به وقت ایران) دیگر نمی‌تواند وارد شود." className="flex-1">
              <JalaliDatePicker value={expiry} onChange={setExpiry} ariaLabel="پایان دسترسی" />
            </Field>
            <PrimaryButton type="button" disabled={busy || !expiry} onClick={() => run(() => setUserAccessExpiry(user.id, iranDateTimeToISO(expiry) ?? null), 'پایان دسترسی ثبت شد.', 'پایان دسترسی ثبت نشد.')}>ثبت</PrimaryButton>
            <SecondaryButton type="button" disabled={busy} onClick={() => run(() => setUserAccessExpiry(user.id, null), 'پایان دسترسی برداشته شد.', 'انجام نشد.')}>بدون پایان</SecondaryButton>
          </div>
        </section>
      )}

      {canManageAssignments && !user.isSystem && (
        <>
          <section className={section}>
            <h4 className="flex items-center gap-2 text-sm font-extrabold text-slate-800 dark:text-slate-100"><Repeat2 className="w-4 h-4 text-indigo-500" /> انتقال سمت‌ها به فرد دیگر</h4>
            <p className="text-xs text-slate-500 leading-relaxed">پست‌های سازمانی این کاربر از روز انتخاب‌شده به فرد دیگری می‌رسد و فعالیت‌های پست‌ها هم با آن‌ها می‌رود. حساب این کاربر فعال می‌ماند.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="به">
                <select id="transfer-to" className={inputClass} value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                  <option value="">انتخاب فرد</option>
                  {people.map((p) => <option key={p.id} value={p.id}>{p.name || p.username}</option>)}
                </select>
              </Field>
              <Field label="از تاریخ" hint="خالی: از همین حالا"><JalaliDatePicker value={transferDay} onChange={setTransferDay} ariaLabel="از تاریخ" /></Field>
            </div>
            <PrimaryButton
              type="button"
              disabled={busy || !transferTo}
              onClick={async () => {
                if (!(await appConfirm(`سمت‌های ${name} منتقل شود؟`, { confirmLabel: 'انتقال' }))) return;
                run(() => transferUserPosts(user.id, transferTo, transferDay ? iranDateTimeToISO(transferDay) ?? null : null), 'سمت‌ها منتقل شد.', 'انتقال انجام نشد.');
              }}
            >
              انتقال سمت‌ها
            </PrimaryButton>
          </section>

          <section className={`${section} border-rose-200 dark:border-rose-900`}>
            <h4 className="flex items-center gap-2 text-sm font-extrabold text-rose-700 dark:text-rose-300"><DoorOpen className="w-4 h-4" /> خروج از سازمان</h4>
            <p className="text-xs text-slate-500 leading-relaxed">همهٔ انتصاب‌های این کاربر پایان می‌یابد؛ اگر جانشین انتخاب کنید پست‌ها و فعالیت‌هایشان به او می‌رسد، وگرنه پست‌ها خالی می‌شوند و در کارتابل جانشینی دیده می‌شوند. حساب کاربر را جداگانه غیرفعال کنید.</p>
            <Field label="جانشین" hint="خالی: پست‌ها خالی می‌مانند">
              <select id="offboard-successor" className={inputClass} value={successor} onChange={(e) => setSuccessor(e.target.value)}>
                <option value="">بدون جانشین</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name || p.username}</option>)}
              </select>
            </Field>
            <PrimaryButton
              type="button"
              disabled={busy}
              className="bg-rose-700 hover:bg-rose-800"
              onClick={async () => {
                if (!(await appConfirm(`خروج ${name} از سازمان ثبت شود؟ این کار انتصاب‌های او را پایان می‌دهد.`, { confirmLabel: 'ثبت خروج', danger: true }))) return;
                run(() => offboardUser(user.id, successor || null), 'خروج از سازمان ثبت شد.', 'خروج ثبت نشد.', true);
              }}
            >
              ثبت خروج
            </PrimaryButton>
          </section>
        </>
      )}
    </AdminDialog>
  );
};
