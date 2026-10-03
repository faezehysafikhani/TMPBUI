import React, { useEffect, useState } from 'react';
import { MessageSquare, Users, History, Network, KeyRound, Loader2, Save, User as UserIcon, Palette, FileText, UploadCloud } from 'lucide-react';
import { getMyPermissions, changeMyPassword, fetchUploadPolicy, updateMaxUploadSizeKb } from '../../services/nexusApi';
import { AdminCard, SegmentedTabs, PillTabs, TabItem, Field, inputClass, Notice, PrimaryButton } from './AdminUi';
import { UsersPanel } from './UsersPanel';
import { LoginHistoryPanel } from './LoginHistoryPanel';
import { LdapPanel } from './LdapPanel';
import { SsoPreparationPanel } from './SsoPreparationPanel';
import { SmsPanel } from './SmsPanel';
import { userErrorMessage } from '../../utils/errorMessages';

type MainTab = 'profile' | 'team' | 'appearance' | 'help' | 'sms' | 'users';
type UsersTab = 'list' | 'history' | 'ldap' | 'sso';

/** Permission names the signed-in user holds. The server re-checks every call. */
export function useMyPermissions(userId: string | undefined): Set<string> | null {
  const [permissions, setPermissions] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!userId) { setPermissions(new Set()); return; }
    let alive = true;
    getMyPermissions()
      .then((names) => alive && setPermissions(new Set(names)))
      .catch(() => alive && setPermissions(new Set()));
    return () => { alive = false; };
  }, [userId]);
  return permissions;
}

/** «مدیریت کاربران» with its sub-tabs: users, sign-in history and LDAP. */
const UserManagementSection: React.FC<{ currentUserId: string; can: (p: string) => boolean }> = ({ currentUserId, can }) => {
  const tabs: TabItem<UsersTab>[] = [
    ...(can('users.view') ? [{ id: 'list' as const, label: 'مدیریت کاربران', icon: Users }] : []),
    ...(can('audit_logs.view') ? [{ id: 'history' as const, label: 'تاریخچه ورود', icon: History }] : []),
    ...(can('ldap_settings.view') ? [{ id: 'ldap' as const, label: 'LDAP', icon: Network }] : []),
    ...(can('users.view') ? [{ id: 'sso' as const, label: 'ورود با SSO', icon: KeyRound }] : []),
  ];
  const [active, setActive] = useState<UsersTab>(tabs[0]?.id ?? 'list');
  const current = tabs.some((t) => t.id === active) ? active : tabs[0]?.id;

  return (
    <div className="space-y-4">
      <PillTabs tabs={tabs} active={current ?? 'list'} onChange={setActive} />
      {current === 'list' && (
        <UsersPanel
          currentUserId={currentUserId}
          rights={{
            create: can('users.create'),
            update: can('users.update'),
            changeStatus: can('users.change_status'),
            assignRoles: can('users.assign_roles'),
            assignPermissions: can('users.assign_permissions'),
          }}
        />
      )}
      {current === 'history' && <LoginHistoryPanel />}
      {current === 'ldap' && <LdapPanel canUpdate={can('ldap_settings.update')} canTest={can('ldap_settings.test')} />}
      {current === 'sso' && <SsoPreparationPanel />}
    </div>
  );
};

/** The signed-in user's own password change (the system administrator included). */
export const ChangePasswordCard: React.FC = () => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (next.length < 8) { setMessage({ type: 'error', text: 'رمز عبور جدید باید حداقل ۸ کاراکتر باشد.' }); return; }
    if (next !== repeat) { setMessage({ type: 'error', text: 'تکرار رمز عبور جدید با آن یکسان نیست.' }); return; }
    setBusy(true);
    try {
      await changeMyPassword(current, next);
      setCurrent(''); setNext(''); setRepeat('');
      setMessage({ type: 'success', text: 'رمز عبور شما تغییر کرد.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: userErrorMessage(err, 'تغییر رمز عبور انجام نشد.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminCard className="p-5 sm:p-6">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">تغییر رمز عبور</h3>
        </div>
        {message && <Notice type={message.type} onClose={() => setMessage(null)}>{message.text}</Notice>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="رمز عبور فعلی" required>
            <input type="password" className={`${inputClass} dir-ltr text-right`} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </Field>
          <Field label="رمز عبور جدید" required hint="حداقل ۸ کاراکتر">
            <input type="password" className={`${inputClass} dir-ltr text-right`} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
          </Field>
          <Field label="تکرار رمز عبور جدید" required>
            <input type="password" className={`${inputClass} dir-ltr text-right`} value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" required />
          </Field>
        </div>
        <div className="flex justify-end">
          <PrimaryButton type="submit" disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>تغییر رمز عبور</span>
          </PrimaryButton>
        </div>
      </form>
    </AdminCard>
  );
};

/** Admin-only (settings.update): the system-wide max upload file size, in KB. */
const UploadSizeSettingsCard: React.FC = () => {
  const [valueKb, setValueKb] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetchUploadPolicy()
      .then((policy) => { if (alive) setValueKb(String(policy.maxFileSizeKb)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const kb = Number(valueKb);
    if (!Number.isFinite(kb) || kb <= 0) {
      setMessage({ type: 'error', text: 'مقدار وارد شده معتبر نیست.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateMaxUploadSizeKb(kb);
      setMessage({ type: 'success', text: 'حداکثر حجم فایل آپلودی ذخیره شد.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: userErrorMessage(err, 'ذخیره تنظیمات با خطا مواجه شد.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminCard className="p-5 sm:p-6">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-2">
          <UploadCloud className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">محدودیت حجم فایل آپلودی</h3>
        </div>
        {message && <Notice type={message.type} onClose={() => setMessage(null)}>{message.text}</Notice>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <Field label="حداکثر حجم مجاز (کیلوبایت)" hint="پیش‌فرض: ۲۰۰ کیلوبایت">
            <input
              type="number"
              min={1}
              className={inputClass}
              value={valueKb}
              onChange={(e) => setValueKb(e.target.value)}
              disabled={loading}
            />
          </Field>
          <PrimaryButton type="submit" disabled={saving || loading}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>ذخیره</span>
          </PrimaryButton>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          این مقدار برای بارگذاری فایل در فعالیت‌ها، گفتگو و یادداشت‌ها در کل سامانه اعمال می‌شود.
        </p>
      </form>
    </AdminCard>
  );
};

/**
 * «تنظیمات سامانه»: the header card with the main tabs. Profile / Team / Appearance / Help are
 * always-present personal-settings tabs; SMS panel and user management appear by permission.
 */
export const SystemAdministration: React.FC<{
  currentUserId?: string;
  profile: React.ReactNode;
  team: React.ReactNode;
  appearance: React.ReactNode;
  help: React.ReactNode;
}> = ({ currentUserId, profile, team, appearance, help }) => {
  const permissions = useMyPermissions(currentUserId);
  const can = (p: string) => !!permissions?.has(p);
  const [active, setActive] = useState<MainTab>('profile');

  const tabs: TabItem<MainTab>[] = [
    { id: 'profile', label: 'پروفایل', icon: UserIcon },
    { id: 'team', label: 'مدیریت تیم کاری', icon: Users },
    { id: 'appearance', label: 'ظاهر سامانه', icon: Palette },
    { id: 'help', label: 'راهنما', icon: FileText },
    ...(can('sms_settings.view') ? [{ id: 'sms' as const, label: 'پنل پیامکی', icon: MessageSquare }] : []),
    ...(can('users.view') || can('audit_logs.view') || can('ldap_settings.view')
      ? [{ id: 'users' as const, label: 'مدیریت کاربران', icon: Users }] : []),
  ];
  const current = tabs.some((t) => t.id === active) ? active : 'profile';

  return (
    <div className="w-full space-y-5" dir="rtl">
      <AdminCard className="p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">تنظیمات سامانه</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">تنظیمات شخصی، پنل پیامکی و مدیریت کاربران سامانه</p>
        </div>
        {tabs.length > 1 && <SegmentedTabs tabs={tabs} active={current} onChange={setActive} />}
      </AdminCard>

      {current === 'profile' && profile}
      {current === 'team' && team}
      {current === 'appearance' && (
        <div className="space-y-5">
          {can('settings.update') && <UploadSizeSettingsCard />}
          {appearance}
        </div>
      )}
      {current === 'help' && help}
      {current === 'sms' && <SmsPanel canUpdate={can('sms_settings.update')} canTest={can('sms_settings.test')} />}
      {current === 'users' && currentUserId && <UserManagementSection currentUserId={currentUserId} can={can} />}
    </div>
  );
};
