import React, { useEffect, useState } from 'react';
import { Loader2, Save, Send, MessageSquareText, KeyRound } from 'lucide-react';
import {
  SmsPanelSettings, SmsProviderOption, SmsTemplate,
  getSmsPanelSettings, getSmsProviders, getSmsTemplates, saveSmsPanelSettings, saveSmsTemplates, sendTestSms,
} from '../../services/nexusApi';
import { AdminCard, Field, inputClass, Toggle, Notice, PrimaryButton, SecondaryButton, StatusBadge, toLatinDigits } from './AdminUi';
import { userErrorMessage } from '../../utils/errorMessages';

/** The SMS panel (پنل پیامکی): provider settings, the system's SMS texts and a test message. */
export const SmsPanel: React.FC<{ canUpdate: boolean; canTest: boolean }> = ({ canUpdate, canTest }) => {
  const [providers, setProviders] = useState<SmsProviderOption[]>([]);
  const [settings, setSettings] = useState<SmsPanelSettings | null>(null);
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getSmsProviders(), getSmsPanelSettings(), getSmsTemplates()])
      .then(([p, s, t]) => { setProviders(p); setSettings(s); setTemplates(t); })
      .catch((err) => setLoadError(userErrorMessage(err, 'دریافت تنظیمات پنل پیامکی ممکن نشد.')));
  }, []);

  if (!settings) {
    return (
      <AdminCard className="p-10 text-center text-slate-400">
        {loadError ? <Notice type="error">{loadError}</Notice> : <Loader2 className="w-5 h-5 animate-spin inline" />}
      </AdminCard>
    );
  }

  const provider = providers.find((p) => p.key === settings.provider);
  const set = <K extends keyof SmsPanelSettings>(key: K, value: SmsPanelSettings[K]) => setSettings((s) => (s ? { ...s, [key]: value } : s));

  /** Saves settings and texts; the server validates both and keeps the stored key when none is typed. */
  const saveAll = async (): Promise<boolean> => {
    if (settings.enabled && !settings.apiKeyConfigured && !settings.apiKey.trim()) {
      setMessage({ type: 'error', text: 'برای فعال کردن پنل پیامکی، کلید API را وارد کنید.' });
      return false;
    }
    if (templates.some((t) => !t.text.trim())) {
      setMessage({ type: 'error', text: 'متن هیچ‌کدام از پیامک‌ها نمی‌تواند خالی باشد.' });
      return false;
    }
    const saved = await saveSmsPanelSettings(settings);
    setSettings(saved);
    setTemplates(await saveSmsTemplates(templates.map((t) => ({ key: t.key, text: t.text }))));
    return true;
  };

  const handleSave = async () => {
    setBusy('save');
    setMessage(null);
    try {
      if (await saveAll()) setMessage({ type: 'success', text: 'تنظیمات و متن پیامک‌ها ذخیره شد.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: userErrorMessage(err, 'ذخیره تنظیمات انجام نشد.') });
    } finally {
      setBusy(null);
    }
  };

  const handleSaveAndTest = async () => {
    if (!testPhone.trim()) {
      setMessage({ type: 'error', text: 'شماره موبایل آزمایشی را وارد کنید.' });
      return;
    }
    setBusy('test');
    setMessage(null);
    try {
      if (canUpdate && !(await saveAll())) return;
      const result = await sendTestSms(testPhone.trim(), testMessage.trim() || undefined);
      setMessage({ type: result.success ? 'success' : 'error', text: result.message });
    } catch (err: any) {
      setMessage({ type: 'error', text: userErrorMessage(err, 'ارسال پیامک آزمایشی انجام نشد.') });
    } finally {
      setBusy(null);
    }
  };

  const disabled = !canUpdate;
  return (
    <div className="space-y-5">
      {message && <Notice type={message.type} onClose={() => setMessage(null)}>{message.text}</Notice>}

      <AdminCard className="p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">سرویس‌دهنده پیامک</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">پیامک‌های سامانه از طریق این سرویس و توسط سرور ارسال می‌شوند.</p>
          </div>
          {settings.apiKeyConfigured
            ? <StatusBadge tone="green"><KeyRound className="w-3 h-3" /> کلید API ثبت شده</StatusBadge>
            : <StatusBadge tone="amber">کلید API ثبت نشده</StatusBadge>}
        </div>

        <Toggle checked={settings.enabled} onChange={(v) => set('enabled', v)} disabled={disabled} label="فعال بودن پنل پیامکی" description="با غیرفعال بودن، هیچ پیامکی ارسال نمی‌شود." />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="سرویس‌دهنده (Service Provider)" required>
            <select className={inputClass} value={settings.provider} onChange={(e) => set('provider', e.target.value)} disabled={disabled}>
              {providers.map((p) => <option key={p.key} value={p.key}>{p.displayName}</option>)}
            </select>
          </Field>
          <Field label="آدرس سرویس (Base URL)" hint={provider ? `خالی = آدرس رسمی: ${provider.defaultBaseUrl}` : undefined}>
            <input className={`${inputClass} dir-ltr text-right`} value={settings.apiUrl} onChange={(e) => set('apiUrl', e.target.value)} disabled={disabled} placeholder={provider?.defaultBaseUrl} />
          </Field>
          <Field label="کلید API (API Key)" hint={settings.apiKeyConfigured ? 'کلید فعلی نمایش داده نمی‌شود؛ برای تغییر، کلید جدید را وارد کنید.' : 'کلید را از پنل کاوه‌نگار دریافت کنید.'}>
            <input className={`${inputClass} dir-ltr text-right`} type="password" value={settings.apiKey} onChange={(e) => set('apiKey', e.target.value)} disabled={disabled} autoComplete="new-password" placeholder={settings.apiKeyConfigured ? '••••••••••••' : ''} />
          </Field>
          <Field label="شماره فرستنده (اختیاری)" hint="خالی = خط پیش‌فرض حساب کاوه‌نگار">
            <input className={`${inputClass} dir-ltr text-right font-mono`} value={settings.lineNumber} onChange={(e) => set('lineNumber', toLatinDigits(e.target.value).replace(/\D/g, ''))} disabled={disabled} inputMode="numeric" />
          </Field>
        </div>
      </AdminCard>

      <AdminCard className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquareText className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">متن پیامک‌ها</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">عبارت‌های داخل آکولاد هنگام ارسال با مقدار واقعی جایگزین می‌شوند.</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {templates.map((template, index) => (
            <Field key={template.key} label={template.title}>
              <textarea
                className={`${inputClass} min-h-24 resize-y leading-relaxed`}
                value={template.text}
                maxLength={1000}
                disabled={disabled}
                onChange={(e) => setTemplates((list) => list.map((t, i) => (i === index ? { ...t, text: e.target.value } : t)))}
              />
              <span className="flex flex-wrap gap-1 mt-1.5">
                {template.placeholders.map((ph) => (
                  <button
                    key={ph}
                    type="button"
                    disabled={disabled}
                    onClick={() => setTemplates((list) => list.map((t, i) => (i === index ? { ...t, text: `${t.text}{${ph}}` } : t)))}
                    className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300 hover:bg-indigo-50 cursor-pointer disabled:cursor-default"
                  >
                    {`{${ph}}`}
                  </button>
                ))}
              </span>
            </Field>
          ))}
        </div>
      </AdminCard>

      <AdminCard className="p-5 sm:p-6 space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">ارسال آزمایشی</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="شماره موبایل آزمایشی">
            <input className={`${inputClass} dir-ltr text-right font-mono`} value={testPhone} onChange={(e) => setTestPhone(toLatinDigits(e.target.value))} inputMode="tel" placeholder="09121234567" />
          </Field>
          <Field label="متن آزمایشی" className="md:col-span-2">
            <input className={inputClass} value={testMessage} onChange={(e) => setTestMessage(e.target.value)} maxLength={500} placeholder="پیامک آزمایشی سامانه" />
          </Field>
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {canUpdate && (
            <SecondaryButton type="button" onClick={handleSave} disabled={busy !== null}>
              {busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>ذخیره تنظیمات</span>
            </SecondaryButton>
          )}
          {canTest && (
            <PrimaryButton type="button" onClick={handleSaveAndTest} disabled={busy !== null}>
              {busy === 'test' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{canUpdate ? 'ذخیره و ارسال تست' : 'ارسال تست'}</span>
            </PrimaryButton>
          )}
        </div>
      </AdminCard>
    </div>
  );
};
