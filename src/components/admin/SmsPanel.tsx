import React, { useEffect, useState } from 'react';
import { Loader2, Save, Send, MessageSquareText, RotateCcw, Plus, Pencil, Trash2, X, AlarmClock } from 'lucide-react';
import {
  SmsPanelSettings, SmsProviderConfiguration, SmsProviderOption, SmsTemplate, SmsQuietHours, TaskReminderSettings,
  getSmsPanelSettings, getSmsProviders, getSmsTemplates, saveSmsPanelSettings, saveSmsTemplates, sendTestSms,
  getSmsQuietHours, saveSmsQuietHours, getTaskReminderSettings, saveTaskReminderSettings,
} from '../../services/nexusApi';
import { AdminCard, Field, inputClass, Toggle, Notice, PrimaryButton, SecondaryButton, toLatinDigits } from './AdminUi';
import { userErrorMessage } from '../../utils/errorMessages';
import { productSmsTemplates, validateSmsTemplate, SMS_TEMPLATE_MAX_LENGTH } from '../../utils/smsTemplates';

/** The SMS panel (پنل پیامکی): provider settings, the system's SMS texts and a test message. */
export const SmsPanel: React.FC<{ canUpdate: boolean; canTest: boolean }> = ({ canUpdate, canTest }) => {
  const [providers, setProviders] = useState<SmsProviderOption[]>([]);
  const [settings, setSettings] = useState<SmsPanelSettings | null>(null);
  const [editor, setEditor] = useState<SmsProviderConfiguration | null>(null);
  const [isNewProvider, setIsNewProvider] = useState(false);
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [busy, setBusy] = useState<'save' | 'test' | 'provider' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Null when the server has neither (an older version): the section is not shown.
  const [quietHours, setQuietHours] = useState<SmsQuietHours | null>(null);
  const [reminders, setReminders] = useState<TaskReminderSettings | null>(null);

  useEffect(() => {
    Promise.all([getSmsProviders(), getSmsPanelSettings(), getSmsTemplates()])
      .then(([p, s, t]) => { setProviders(p); setSettings(s); setTemplates(productSmsTemplates(t)); })
      .catch((err) => setLoadError(userErrorMessage(err, 'دریافت تنظیمات پنل پیامکی ممکن نشد.')));
    // Optional: a failure here never hides the rest of the panel.
    getSmsQuietHours().then(setQuietHours).catch(() => setQuietHours(null));
    getTaskReminderSettings().then(setReminders).catch(() => setReminders(null));
  }, []);

  if (!settings) {
    return (
      <AdminCard className="p-10 text-center text-slate-400">
        {loadError ? <Notice type="error">{loadError}</Notice> : <Loader2 className="w-5 h-5 animate-spin inline" />}
      </AdminCard>
    );
  }

  const selectedProvider = providers.find((item) => item.key === editor?.provider);
  const updateEditor = (updates: Partial<SmsProviderConfiguration>) => setEditor((current) => current ? { ...current, ...updates } : current);
  const addProvider = () => {
    const id = crypto.randomUUID();
    setEditor({ id, name: '', provider: providers[0]?.key ?? 'kavenegar', enabled: false, apiUrl: '', apiKey: '', lineNumber: '', username: '', password: '', apiKeyConfigured: false, usernameConfigured: false, passwordConfigured: false });
    setIsNewProvider(true);
    setMessage(null);
  };
  const persistProviders = async (items: SmsProviderConfiguration[]) => {
    const active = items.find((item) => item.enabled);
    const saved = await saveSmsPanelSettings({
      ...settings,
      providers: items,
      enabled: !!active,
      provider: active?.provider ?? settings.provider,
      apiUrl: active?.apiUrl ?? '',
      apiKey: active?.apiKey ?? '',
      username: active?.username ?? '',
      password: active?.password ?? '',
      lineNumber: active?.lineNumber ?? '',
    });
    setSettings(saved);
  };
  const saveProvider = async () => {
    if (!editor) return;
    if (!editor.name.trim()) {
      setMessage({ type: 'error', text: 'نام سرویس‌دهنده را وارد کنید.' });
      return;
    }
    if (editor.enabled && !editor.apiKey.trim() && !editor.apiKeyConfigured) {
      setMessage({ type: 'error', text: 'برای فعال‌کردن این سرویس‌دهنده، کلید API را وارد کنید.' });
      return;
    }
    setBusy('provider');
    setMessage(null);
    try {
      const item = { ...editor, name: editor.name.trim() };
      const items = isNewProvider
        ? [...settings.providers, item]
        : settings.providers.map((current) => current.id === item.id ? item : current);
      await persistProviders(item.enabled ? items.map((current) => ({ ...current, enabled: current.id === item.id })) : items);
      setEditor(null);
      setMessage({ type: 'success', text: isNewProvider ? 'سرویس‌دهنده اضافه شد.' : 'تغییرات سرویس‌دهنده ذخیره شد.' });
    } catch (err) {
      setMessage({ type: 'error', text: userErrorMessage(err, 'ذخیره سرویس‌دهنده انجام نشد.') });
    } finally {
      setBusy(null);
    }
  };
  const deleteProvider = async (item: SmsProviderConfiguration) => {
    if (!window.confirm(`سرویس‌دهنده «${item.name}» حذف شود؟`)) return;
    setBusy('provider');
    setMessage(null);
    try {
      await persistProviders(settings.providers.filter((current) => current.id !== item.id));
      if (editor?.id === item.id) setEditor(null);
      setMessage({ type: 'success', text: 'سرویس‌دهنده حذف شد.' });
    } catch (err) {
      setMessage({ type: 'error', text: userErrorMessage(err, 'حذف سرویس‌دهنده انجام نشد.') });
    } finally {
      setBusy(null);
    }
  };
  const setProviderActive = async (item: SmsProviderConfiguration, enabled: boolean) => {
    if (enabled && !item.apiKeyConfigured && !item.apiKey.trim()) {
      setMessage({ type: 'error', text: 'برای فعال‌کردن سرویس‌دهنده، ابتدا کلید API آن را در بخش ویرایش ثبت کنید.' });
      return;
    }
    setBusy('provider');
    setMessage(null);
    try {
      await persistProviders(settings.providers.map((current) => ({ ...current, enabled: enabled && current.id === item.id })));
      setMessage({ type: 'success', text: enabled ? 'سرویس‌دهنده فعال شد.' : 'سرویس‌دهنده غیرفعال شد.' });
    } catch (err) {
      setMessage({ type: 'error', text: userErrorMessage(err, 'تغییر وضعیت سرویس‌دهنده انجام نشد.') });
    } finally {
      setBusy(null);
    }
  };

  /** Saves settings and texts; the server validates both and keeps the stored key when none is typed. */
  const saveAll = async (): Promise<boolean> => {
    const active = settings.providers.find((item) => item.enabled);
    const hasApiKey = active?.apiKeyConfigured || active?.apiKey.trim();
    const hasUsername = active?.usernameConfigured || active?.username.trim();
    const hasPassword = active?.passwordConfigured || active?.password;
    if (active && !hasApiKey && !(hasUsername && hasPassword)) {
      setMessage({ type: 'error', text: 'برای فعال کردن پنل پیامکی، کلید API یا نام کاربری و رمز عبور را وارد کنید.' });
      return false;
    }
    const invalid = templates.map(validateSmsTemplate).find((error) => error !== null);
    if (invalid) {
      setMessage({ type: 'error', text: invalid });
      return false;
    }
    const timingError = validateTiming(quietHours, reminders);
    if (timingError) {
      setMessage({ type: 'error', text: timingError });
      return false;
    }
    const saved = await saveSmsPanelSettings(settings);
    setSettings(saved);
    // Only this product's texts are sent; the answer is filtered the same way.
    setTemplates(productSmsTemplates(await saveSmsTemplates(templates.map((t) => ({ key: t.key, text: t.text, enabled: t.enabled })))));
    if (quietHours) setQuietHours(await saveSmsQuietHours(quietHours));
    if (reminders) setReminders(await saveTaskReminderSettings(reminders));
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
          <button type="button" onClick={addProvider} disabled={disabled || busy !== null} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-sm hover:bg-indigo-500 disabled:opacity-50">
            <Plus className="w-4 h-4" /> افزودن سرویس
          </button>
        </div>

        <div className="space-y-2">
          {settings.providers.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-center text-sm text-slate-500">هنوز سرویس‌دهنده‌ای ثبت نشده است.</p>}
          {settings.providers.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 p-3.5">
              <div className="min-w-0">
                <p className="font-bold text-sm text-slate-900 dark:text-white">{item.name || 'سرویس‌دهنده پیامک'}</p>
                <p className={`text-xs mt-1 ${item.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>{item.enabled ? 'فعال و در حال استفاده' : 'غیرفعال'}</p>
              </div>
              <div className="flex items-center gap-2">
                {canUpdate && <>
                  <button type="button" onClick={() => setProviderActive(item, !item.enabled)} disabled={busy !== null} className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-50 ${item.enabled ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}>{item.enabled ? 'غیرفعال‌کردن' : 'فعال‌کردن'}</button>
                  <button type="button" onClick={() => { setEditor({ ...item }); setIsNewProvider(false); setMessage(null); }} disabled={busy !== null} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 disabled:opacity-50"><Pencil className="w-3.5 h-3.5" /> ویرایش</button>
                  <button type="button" onClick={() => deleteProvider(item)} disabled={busy !== null} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /> حذف</button>
                </>}
              </div>
            </div>
          ))}
        </div>

        {editor && <div className="space-y-4 rounded-2xl border border-indigo-100 dark:border-indigo-800 bg-slate-50 dark:bg-slate-800 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-bold text-slate-900 dark:text-white">{isNewProvider ? 'افزودن سرویس‌دهنده' : `ویرایش ${editor.name}`}</h4>
            <button type="button" onClick={() => setEditor(null)} disabled={busy !== null} aria-label="بستن فرم سرویس‌دهنده" className="p-1.5 rounded-lg text-slate-500 hover:bg-white dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
          </div>
          <Toggle checked={editor.enabled} onChange={(enabled) => updateEditor({ enabled })} disabled={disabled || busy !== null} label="فعال بودن این سرویس‌دهنده" description="فقط یک سرویس‌دهنده می‌تواند هم‌زمان برای ارسال پیامک فعال باشد." />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="سرویس‌دهنده (Service Provider)" required hint="نامی که برای تشخیص این پنل در سامانه نمایش داده می‌شود">
            <input className={inputClass} value={editor.name} onChange={(e) => updateEditor({ name: e.target.value })} disabled={disabled || busy !== null} placeholder="مثلاً پنل پیامکی شرکت ..." />
          </Field>
          <Field label="آدرس سرویس (Base URL)" hint={selectedProvider ? `خالی = آدرس رسمی: ${selectedProvider.defaultBaseUrl}` : undefined}>
            <input className={`${inputClass} dir-ltr text-right`} value={editor.apiUrl} onChange={(e) => updateEditor({ apiUrl: e.target.value })} disabled={disabled || busy !== null} placeholder={selectedProvider?.defaultBaseUrl} />
          </Field>
          <Field label="کلید API (API Key)" hint={editor.apiKeyConfigured ? 'کلید فعلی نمایش داده نمی‌شود؛ برای تغییر، کلید جدید را وارد کنید.' : 'برای کاوه‌نگار الزامی است.'}>
            <input className={`${inputClass} dir-ltr text-right`} type="password" value={editor.apiKey} onChange={(e) => updateEditor({ apiKey: e.target.value })} disabled={disabled || busy !== null} autoComplete="new-password" placeholder={editor.apiKeyConfigured ? '••••••••••••' : ''} />
          </Field>
          <Field label="نام کاربری پنل (اختیاری)" hint={editor.usernameConfigured ? 'نام کاربری فعلی نمایش داده نمی‌شود؛ برای تغییر، مقدار جدید را وارد کنید.' : 'کاوه‌نگار به این مورد نیاز ندارد.'}>
            <input className={`${inputClass} dir-ltr text-right`} value={editor.username} onChange={(e) => updateEditor({ username: e.target.value })} disabled={disabled || busy !== null} autoComplete="username" placeholder={editor.usernameConfigured ? '••••••••' : ''} />
          </Field>
          <Field label="رمز عبور پنل (اختیاری)" hint={editor.passwordConfigured ? 'رمز فعلی نمایش داده نمی‌شود؛ برای تغییر، رمز جدید را وارد کنید.' : 'کاوه‌نگار به این مورد نیاز ندارد.'}>
            <input className={`${inputClass} dir-ltr text-right`} type="password" value={editor.password} onChange={(e) => updateEditor({ password: e.target.value })} disabled={disabled || busy !== null} autoComplete="new-password" placeholder={editor.passwordConfigured ? '••••••••••••' : ''} />
          </Field>
          <Field label="شماره فرستنده (اختیاری)" hint="خالی = خط پیش‌فرض حساب">
            <input className={`${inputClass} dir-ltr text-right font-mono`} value={editor.lineNumber} onChange={(e) => updateEditor({ lineNumber: toLatinDigits(e.target.value).replace(/\D/g, '') })} disabled={disabled || busy !== null} inputMode="numeric" />
          </Field>
        </div>
          <div className="flex justify-end gap-2 border-t border-indigo-100 dark:border-indigo-900 pt-4">
            <SecondaryButton type="button" onClick={() => setEditor(null)} disabled={busy !== null}>انصراف</SecondaryButton>
            <PrimaryButton type="button" onClick={saveProvider} disabled={busy !== null}>
              {busy === 'provider' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isNewProvider ? 'ثبت سرویس‌دهنده' : 'ذخیره تغییرات'}</span>
            </PrimaryButton>
          </div>
        </div>}
      </AdminCard>

      <AdminCard className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquareText className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">متن پیامک‌ها</h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">عبارت‌های داخل آکولاد هنگام ارسال با مقدار واقعی جایگزین می‌شوند. عبارت‌های ستاره‌دار باید در متن بمانند.</p>
        {templates.length === 0 && <p className="text-xs text-slate-400">متنی برای ویرایش وجود ندارد.</p>}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {templates.map((template, index) => {
            const error = validateSmsTemplate(template);
            const required = new Set((template.requiredPlaceholders ?? []).map((p) => p.toLowerCase()));
            const update = (text: string) => setTemplates((list) => list.map((t, i) => (i === index ? { ...t, text } : t)));
            return (
              <div key={template.key} data-sms-template={template.key} className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{template.title}</p>
                    <p className="text-[11px] font-mono text-slate-400 dir-ltr text-right">{template.key}</p>
                  </div>
                  {template.defaultText && template.text !== template.defaultText && !disabled && (
                    <button
                      type="button"
                      onClick={() => update(template.defaultText!)}
                      className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-400 hover:underline"
                    >
                      <RotateCcw className="w-3 h-3" /> متن پیش‌فرض
                    </button>
                  )}
                </div>
                {template.description && <p className="text-xs text-slate-500 dark:text-slate-400">{template.description}</p>}
                {template.enabled !== undefined && template.canDisable !== false && (
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-indigo-600"
                      checked={template.enabled}
                      disabled={disabled}
                      aria-label={`ارسال پیامک «${template.title}»`}
                      onChange={(e) => setTemplates((list) => list.map((t, i) => (i === index ? { ...t, enabled: e.target.checked } : t)))}
                    />
                    <span>{template.enabled ? 'این پیامک ارسال می‌شود' : 'این پیامک ارسال نمی‌شود'}</span>
                  </label>
                )}
                <textarea
                  className={`${inputClass} min-h-24 resize-y leading-relaxed`}
                  value={template.text}
                  maxLength={SMS_TEMPLATE_MAX_LENGTH}
                  disabled={disabled}
                  aria-label={template.title}
                  aria-invalid={error ? true : undefined}
                  onChange={(e) => update(e.target.value)}
                />
                <span className="flex flex-wrap gap-1">
                  {template.placeholders.map((ph) => (
                    <button
                      key={ph}
                      type="button"
                      disabled={disabled}
                      title={required.has(ph.toLowerCase()) ? 'الزامی' : undefined}
                      onClick={() => update(`${template.text}{${ph}}`)}
                      className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300 hover:bg-indigo-50 cursor-pointer disabled:cursor-default"
                    >
                      {`{${ph}}`}{required.has(ph.toLowerCase()) && <span className="text-rose-500">*</span>}
                    </button>
                  ))}
                </span>
                {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
              </div>
            );
          })}
        </div>
      </AdminCard>

      {(quietHours || reminders) && (
        <AdminCard className="p-5 sm:p-6 space-y-5">
          <div className="flex items-center gap-2">
            <AlarmClock className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">زمان‌بندی یادآوری‌ها و ساعات سکوت</h3>
          </div>

          {quietHours && (
            <div className="space-y-3">
              <Toggle
                checked={quietHours.enabled}
                onChange={(enabled) => setQuietHours({ ...quietHours, enabled })}
                disabled={disabled}
                label="ساعات سکوت پیامک"
                description="پیامک‌های اطلاع‌رسانی در این بازه ارسال نمی‌شوند و پس از پایان آن ارسال خواهند شد. اعلان داخل سامانه همان لحظه نمایش داده می‌شود؛ کد بازیابی رمز عبور همیشه فوراً ارسال می‌شود."
              />
              <div className="grid grid-cols-2 gap-4 max-w-md">
                <Field label="از ساعت">
                  <input type="time" className={`${inputClass} dir-ltr text-right`} value={quietHours.start} disabled={disabled || !quietHours.enabled} onChange={(e) => setQuietHours({ ...quietHours, start: e.target.value })} />
                </Field>
                <Field label="تا ساعت">
                  <input type="time" className={`${inputClass} dir-ltr text-right`} value={quietHours.end} disabled={disabled || !quietHours.enabled} onChange={(e) => setQuietHours({ ...quietHours, end: e.target.value })} />
                </Field>
              </div>
            </div>
          )}

          {reminders && (
            <div className="space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">یادآوری‌ها هم به‌صورت اعلان در سامانه و هم با پیامک (به مسئولین انجام) ارسال می‌شوند. هر پیامک را می‌توانید در بخش «متن پیامک‌ها» خاموش کنید.</p>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3.5">
                  <Toggle checked={reminders.dueSoonEnabled} onChange={(dueSoonEnabled) => setReminders({ ...reminders, dueSoonEnabled })} disabled={disabled} label="یادآوری نزدیک شدن موعد" />
                  <Field label="چند ساعت پیش از ساعت موعد" hint="برای فعالیت‌هایی که ساعت موعد دارند">
                    <input type="number" min={1} max={168} className={`${inputClass} dir-ltr text-right`} value={reminders.dueSoonHoursBefore} disabled={disabled || !reminders.dueSoonEnabled} onChange={(e) => setReminders({ ...reminders, dueSoonHoursBefore: Number(toLatinDigits(e.target.value)) })} />
                  </Field>
                  <Field label="ساعت یادآوری فعالیت‌های بدون ساعت" hint="روز قبل از موعد (و برای موعد گذشته، روز بعد) در این ساعت">
                    <input type="number" min={0} max={23} className={`${inputClass} dir-ltr text-right`} value={reminders.morningHour} disabled={disabled} onChange={(e) => setReminders({ ...reminders, morningHour: Number(toLatinDigits(e.target.value)) })} />
                  </Field>
                </div>
                <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3.5">
                  <Toggle checked={reminders.overdueEnabled} onChange={(overdueEnabled) => setReminders({ ...reminders, overdueEnabled })} disabled={disabled} label="اطلاع گذشتن موعد" description="یک بار، وقتی موعد گذشت و فعالیت هنوز انجام نشده است؛ به مسئولین و ایجادکننده." />
                </div>
                <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3.5">
                  <Toggle checked={reminders.recurringSoonEnabled} onChange={(recurringSoonEnabled) => setReminders({ ...reminders, recurringSoonEnabled })} disabled={disabled} label="یادآوری پیش از هر نوبت تکرارشونده" description="برای هر نوبت، حتی اگر نوبت قبلی انجام یا متوقف شده باشد." />
                  <Field label="چند دقیقه پیش از هر نوبت">
                    <input type="number" min={5} max={1440} className={`${inputClass} dir-ltr text-right`} value={reminders.recurringSoonMinutesBefore} disabled={disabled || !reminders.recurringSoonEnabled} onChange={(e) => setReminders({ ...reminders, recurringSoonMinutesBefore: Number(toLatinDigits(e.target.value)) })} />
                  </Field>
                </div>
              </div>
            </div>
          )}
        </AdminCard>
      )}

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

/** The same ranges the server accepts, in Persian; null when they are fine. */
function validateTiming(quietHours: SmsQuietHours | null, reminders: TaskReminderSettings | null): string | null {
  if (quietHours?.enabled) {
    if (!/^\d{1,2}:\d{2}$/.test(quietHours.start) || !/^\d{1,2}:\d{2}$/.test(quietHours.end)) return 'ساعت شروع و پایان سکوت پیامک را وارد کنید.';
    if (quietHours.start === quietHours.end) return 'ساعت شروع و پایان سکوت پیامک نباید یکسان باشد.';
  }
  if (reminders) {
    const whole = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;
    if (!whole(reminders.dueSoonHoursBefore, 1, 168)) return 'یادآوری موعد باید بین ۱ تا ۱۶۸ ساعت پیش از موعد باشد.';
    if (!whole(reminders.morningHour, 0, 23)) return 'ساعت یادآوری باید بین ۰ تا ۲۳ باشد.';
    if (!whole(reminders.recurringSoonMinutesBefore, 5, 1440)) return 'یادآوری تکرارشونده باید بین ۵ تا ۱۴۴۰ دقیقه پیش از نوبت باشد.';
  }
  return null;
}
