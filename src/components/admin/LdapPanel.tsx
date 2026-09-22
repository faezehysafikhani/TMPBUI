import React, { useEffect, useState } from 'react';
import { Loader2, PlugZap, Save } from 'lucide-react';
import { LdapSettings, LdapTestResult, getLdapSettings, saveLdapSettings, testLdapConnection } from '../../services/nexusApi';
import { toPersianDigits } from '../../utils/helpers';
import { AdminCard, Field, inputClass, Toggle, Notice, PrimaryButton, SecondaryButton, toLatinDigits } from './AdminUi';

export const LdapPanel: React.FC<{ canUpdate: boolean; canTest: boolean }> = ({ canUpdate, canTest }) => {
  const [settings, setSettings] = useState<LdapSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testResult, setTestResult] = useState<LdapTestResult | null>(null);

  useEffect(() => {
    getLdapSettings().then(setSettings).catch((err) => setMessage({ type: 'error', text: err?.message || 'دریافت تنظیمات LDAP ممکن نشد.' }));
  }, []);

  if (!settings) {
    return (
      <AdminCard className="p-10 text-center text-slate-400">
        {message ? <Notice type="error">{message.text}</Notice> : <Loader2 className="w-5 h-5 animate-spin inline" />}
      </AdminCard>
    );
  }

  const set = <K extends keyof LdapSettings>(key: K, value: LdapSettings[K]) => setSettings((s) => (s ? { ...s, [key]: value } : s));
  const text = (key: keyof LdapSettings) => (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value as never);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      setSettings(await saveLdapSettings(settings));
      setMessage({ type: 'success', text: 'تنظیمات LDAP ذخیره شد.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'ذخیره تنظیمات LDAP انجام نشد.' });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    setMessage(null);
    try {
      setTestResult(await testLdapConnection(settings));
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'تست اتصال انجام نشد.' });
    } finally {
      setTesting(false);
    }
  };

  const disabled = !canUpdate;
  return (
    <AdminCard className="p-5 sm:p-6 space-y-5">
      <div>
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">اتصال به LDAP / Active Directory</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">تنظیمات اتصال سامانه به سرویس دایرکتوری سازمان. رمز عبور اتصال رمزنگاری‌شده ذخیره می‌شود و هرگز نمایش داده نمی‌شود.</p>
      </div>

      {message && <Notice type={message.type} onClose={() => setMessage(null)}>{message.text}</Notice>}

      <Toggle checked={settings.enabled} onChange={(v) => set('enabled', v)} disabled={disabled} label="فعال بودن اتصال LDAP" description="با غیرفعال بودن، تنظیمات نگه داشته می‌شوند ولی استفاده نمی‌شوند." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="سرور (Host)" required hint="نام یا IP سرور، بدون ldap://" className="md:col-span-2">
          <input className={`${inputClass} dir-ltr text-right`} value={settings.host} onChange={text('host')} disabled={disabled} placeholder="dc01.example.local" />
        </Field>
        <Field label="پورت" required hint="۳۸۹ برای LDAP، ۶۳۶ برای LDAPS">
          <input className={`${inputClass} dir-ltr text-right`} value={String(settings.port)} onChange={(e) => set('port', Number(toLatinDigits(e.target.value).replace(/\D/g, '')) || 0)} disabled={disabled} inputMode="numeric" />
        </Field>
        <Field label="دامنه (Domain)" hint="برای ساخت نام کاربری اتصال به شکل user@domain">
          <input className={`${inputClass} dir-ltr text-right`} value={settings.domain} onChange={text('domain')} disabled={disabled} placeholder="example.local" />
        </Field>
        <Field label="Base DN" className="md:col-span-2">
          <input className={`${inputClass} dir-ltr text-right`} value={settings.baseDn} onChange={text('baseDn')} disabled={disabled} placeholder="DC=example,DC=local" />
        </Field>
        <Field label="نام کاربری اتصال (Bind Username)" hint="DN، user@domain، DOMAIN\\user یا فقط نام حساب">
          <input className={`${inputClass} dir-ltr text-right`} value={settings.bindUsername} onChange={text('bindUsername')} disabled={disabled} autoComplete="off" />
        </Field>
        <Field label="رمز عبور اتصال (Bind Password)" hint={settings.bindPasswordConfigured ? 'رمزی ذخیره شده است؛ برای تغییر، رمز جدید را وارد کنید.' : 'رمزی ذخیره نشده است.'} className="md:col-span-2">
          <input className={`${inputClass} dir-ltr text-right`} type="password" value={settings.bindPassword} onChange={text('bindPassword')} disabled={disabled} autoComplete="new-password" placeholder={settings.bindPasswordConfigured ? '••••••••' : ''} />
        </Field>
        <Field label="مسیر جستجوی کاربران (User Search Base)" hint="خالی = همان Base DN" className="md:col-span-2">
          <input className={`${inputClass} dir-ltr text-right`} value={settings.userSearchBase} onChange={text('userSearchBase')} disabled={disabled} placeholder="OU=Users,DC=example,DC=local" />
        </Field>
        <Field label="مهلت اتصال (ثانیه)">
          <input className={`${inputClass} dir-ltr text-right`} value={String(settings.connectionTimeoutSeconds)} onChange={(e) => set('connectionTimeoutSeconds', Number(toLatinDigits(e.target.value).replace(/\D/g, '')) || 0)} disabled={disabled} inputMode="numeric" />
        </Field>
        <Field label="فیلتر کاربران (User Filter)" className="md:col-span-3">
          <input className={`${inputClass} dir-ltr text-right font-mono`} value={settings.userFilter} onChange={text('userFilter')} disabled={disabled} />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Toggle checked={settings.useSsl} onChange={(v) => { set('useSsl', v); if (v) set('useStartTls', false); }} disabled={disabled} label="SSL (LDAPS)" />
        <Toggle checked={settings.useStartTls} onChange={(v) => { set('useStartTls', v); if (v) set('useSsl', false); }} disabled={disabled} label="StartTLS" />
        <Toggle checked={settings.trustServerCertificate} onChange={(v) => set('trustServerCertificate', v)} disabled={disabled} label="اعتماد به گواهی سرور" description="فقط برای CA داخلی؛ امنیت را کاهش می‌دهد." />
      </div>

      {testResult && (
        <Notice type={testResult.success ? 'success' : 'error'}>
          {testResult.message}
          <span className="block text-xs opacity-75 mt-1">زمان: {toPersianDigits(testResult.elapsedMilliseconds)} میلی‌ثانیه</span>
        </Notice>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        {canTest && (
          <SecondaryButton type="button" onClick={test} disabled={testing}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlugZap className="w-4 h-4" />}
            <span>تست اتصال</span>
          </SecondaryButton>
        )}
        {canUpdate && (
          <PrimaryButton type="button" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>ذخیره تنظیمات</span>
          </PrimaryButton>
        )}
      </div>
    </AdminCard>
  );
};
