import React, { useCallback, useEffect, useState } from 'react';
import { Bot, Copy, FileSpreadsheet, Gauge, KeyRound, Plus, ShieldCheck, Timer, Trash2, Upload } from 'lucide-react';
import {
  AdminCard,
  AdminDialog,
  Field,
  IconAction,
  inputClass,
  Notice,
  PillTabs,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  TabItem,
  toLatinDigits,
  Toggle,
} from '../admin/AdminUi';
import { JalaliDatePicker } from '../JalaliDatePicker';
import { appConfirm } from '../../utils/appDialog';
import { showToast } from '../../utils/toast';
import { userErrorMessage } from '../../utils/errorMessages';
import { toPersianDigits } from '../../utils/helpers';
import { gregorianToJalali, isoToIranDateTimeParts, isSchedulingOffDay } from '../../utils/jalali';
import {
  addApiKey,
  ADMIN_PERMISSIONS,
  clearMembership,
  createServiceAccount,
  getMembership,
  getPasswordPolicy,
  getRetention,
  listServiceAccounts,
  previewTaskImport,
  revokeApiKey,
  runTaskImport,
  saveMembership,
  savePasswordPolicy,
  saveRetention,
} from '../../services/adminApi';
import type { ImportPreview, ImportResult, Membership, MembershipStatus, ServiceAccount } from './types';

/**
 * Settings tab «امنیت و حساب‌ها» (service accounts, password policy, plan and usage, data retention, CSV
 * import). Track 3 owns this file: who sees the tab (canSeeSecuritySettings) and what is in it.
 * SystemAdministration only asks these two exports (docs/UI-WORKSTREAMS.md).
 */
export function canSeeSecuritySettings(can: (permission: string) => boolean): boolean {
  return can(ADMIN_PERMISSIONS.usersUpdate) || can(ADMIN_PERMISSIONS.settingsUpdate) || can(ADMIN_PERMISSIONS.membershipView);
}

type Section = 'service' | 'password' | 'plan' | 'retention' | 'import';

export const SecuritySettingsTab: React.FC<{ can: (permission: string) => boolean }> = ({ can }) => {
  const tabs: TabItem<Section>[] = [
    ...(can(ADMIN_PERMISSIONS.usersView) ? [{ id: 'service' as const, label: 'حساب‌های سرویس', icon: Bot }] : []),
    ...(can(ADMIN_PERMISSIONS.settingsUpdate) ? [{ id: 'password' as const, label: 'سیاست رمز عبور', icon: ShieldCheck }] : []),
    ...(can(ADMIN_PERMISSIONS.membershipView) ? [{ id: 'plan' as const, label: 'پلن و مصرف', icon: Gauge }, { id: 'retention' as const, label: 'نگهداری داده', icon: Timer }] : []),
    ...(can(ADMIN_PERMISSIONS.tasksCreate) ? [{ id: 'import' as const, label: 'ورود فعالیت از فایل', icon: FileSpreadsheet }] : []),
  ];
  const [active, setActive] = useState<Section>(tabs[0]?.id ?? 'import');
  const current = tabs.some((t) => t.id === active) ? active : tabs[0]?.id;
  return (
    <div className="space-y-4">
      {tabs.length > 1 && <PillTabs tabs={tabs} active={current ?? 'import'} onChange={setActive} />}
      {current === 'service' && <ServiceAccountsSection canCreate={can(ADMIN_PERMISSIONS.usersCreate)} canUpdate={can(ADMIN_PERMISSIONS.usersUpdate)} />}
      {current === 'password' && <PasswordPolicySection />}
      {current === 'plan' && <PlanSection canManage={can(ADMIN_PERMISSIONS.membershipManage)} />}
      {current === 'retention' && <RetentionSection canManage={can(ADMIN_PERMISSIONS.membershipManage)} />}
      {current === 'import' && <ImportSection />}
    </div>
  );
};

// ------------------------------------------------------------------ shared bits

const SectionCard: React.FC<{ title: string; description: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, description, action, children }) => (
  <AdminCard className="p-5 sm:p-6 space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-2xl">{description}</p>
      </div>
      {action}
    </div>
    {children}
  </AdminCard>
);

function jalaliDay(value: string | null | undefined): string {
  if (!value) return '—';
  const day = value.includes('T') ? isoToIranDateTimeParts(value)?.date ?? value : value;
  const m = day.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return value;
  const { jy, jm, jd } = gregorianToJalali(Number(m[1]), Number(m[2]), Number(m[3]));
  return toPersianDigits(`${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`);
}

/** The secret, once: shown with a copy button and a warning that it will not be shown again. */
const SecretBox: React.FC<{ secret: string; onDone: () => void }> = ({ secret, onDone }) => {
  const copy = async () => {
    try { await navigator.clipboard.writeText(secret); showToast('کلید کپی شد.', 'ok', 2500); } catch { showToast('کپی انجام نشد؛ کلید را دستی انتخاب و کپی کنید.', 'error'); }
  };
  return (
    <AdminDialog title="کلید API ساخته شد" onClose={onDone} footer={<PrimaryButton type="button" onClick={onDone}>کلید را ذخیره کردم</PrimaryButton>}>
      <Notice type="info">این کلید فقط همین یک بار نمایش داده می‌شود. آن را در جای امنی (مثلاً تنظیمات سامانهٔ متصل‌شونده) ذخیره کنید.</Notice>
      <div className="flex gap-2">
        <input id="api-key-secret" readOnly value={secret} dir="ltr" className={`${inputClass} font-mono text-xs`} onFocus={(e) => e.target.select()} />
        <SecondaryButton type="button" onClick={copy}><Copy className="w-4 h-4" /> کپی</SecondaryButton>
      </div>
      <p className="text-[11px] text-slate-500 leading-relaxed">سامانهٔ متصل‌شونده کلید را به <code dir="ltr">POST /api/identity/auth/api-key/token</code> می‌فرستد و توکن دسترسی می‌گیرد.</p>
    </AdminDialog>
  );
};

// ------------------------------------------------------------------ service accounts (CAT-230)

const ServiceAccountsSection: React.FC<{ canCreate: boolean; canUpdate: boolean }> = ({ canCreate, canUpdate }) => {
  const [accounts, setAccounts] = useState<ServiceAccount[] | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState<'account' | { accountId: string } | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const load = useCallback(() => {
    listServiceAccounts().then((a) => { setAccounts(a); setError(''); }).catch((err) => setError(userErrorMessage(err, 'حساب‌های سرویس خوانده نشد.')));
  }, []);
  useEffect(load, [load]);

  const revoke = async (accountId: string, keyId: string, name: string) => {
    if (!(await appConfirm(`کلید «${name}» باطل شود؟ سامانه‌ای که با آن وصل است دیگر دسترسی ندارد.`, { confirmLabel: 'ابطال', danger: true }))) return;
    try { await revokeApiKey(accountId, keyId); load(); showToast('کلید باطل شد.', 'ok'); } catch (err) { showToast(userErrorMessage(err, 'ابطال انجام نشد.'), 'error'); }
  };

  return (
    <SectionCard
      title="حساب‌های سرویس"
      description="حساب غیرانسانی برای اتصال سامانه‌های دیگر (اتوماسیون اداری، گزارش‌ساز…) به API. با کلید API وارد می‌شود، نه با رمز عبور، و دسترسی‌اش مثل هر کاربری از نقش‌ها و مجوزهایش می‌آید."
      action={canCreate ? <PrimaryButton type="button" onClick={() => setCreating('account')} className="shrink-0"><Plus className="w-4 h-4" /> حساب سرویس جدید</PrimaryButton> : undefined}
    >
      {error && <Notice type="error">{error}</Notice>}
      {accounts && accounts.length === 0 && <p className="p-6 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">هنوز حساب سرویسی ساخته نشده است.</p>}
      <ul className="space-y-3">
        {(accounts || []).map((a) => (
          <li key={a.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Bot className="w-4 h-4 text-slate-400" />
              <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex-1">{a.name}</span>
              {!a.isActive && <StatusBadge tone="red">غیرفعال</StatusBadge>}
              {canUpdate && <SecondaryButton type="button" className="px-3 py-1.5 text-xs" onClick={() => setCreating({ accountId: a.id })}><KeyRound className="w-3.5 h-3.5" /> کلید جدید</SecondaryButton>}
            </div>
            <table className="w-full text-xs">
              <thead><tr className="text-right text-[11px] text-slate-500"><th className="py-1">کلید</th><th>ساخت</th><th>انقضا</th><th>آخرین استفاده</th><th /></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {a.keys.map((k) => (
                  <tr key={k.id} className={k.revoked ? 'opacity-50' : ''}>
                    <td className="py-1.5 font-bold">{k.name}{k.revoked && <span className="mr-1 text-rose-600">(باطل)</span>}</td>
                    <td>{jalaliDay(k.createdAtUtc)}</td>
                    <td>{k.expiresAtUtc ? jalaliDay(k.expiresAtUtc) : 'بدون انقضا'}</td>
                    <td>{k.lastUsedAtUtc ? jalaliDay(k.lastUsedAtUtc) : 'هرگز'}</td>
                    <td className="text-left">{canUpdate && !k.revoked && <IconAction icon={Trash2} label="ابطال کلید" tone="rose" onClick={() => revoke(a.id, k.id, k.name)} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </li>
        ))}
      </ul>
      {creating && <CreateKeyDialog target={creating} onClose={() => setCreating(null)} onCreated={(s) => { setCreating(null); setSecret(s); load(); }} />}
      {secret && <SecretBox secret={secret} onDone={() => setSecret(null)} />}
    </SectionCard>
  );
};

const CreateKeyDialog: React.FC<{ target: 'account' | { accountId: string }; onClose: () => void; onCreated: (secret: string) => void }> = ({ target, onClose, onCreated }) => {
  const isAccount = target === 'account';
  const [name, setName] = useState('');
  const [days, setDays] = useState('365');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) { setError(isAccount ? 'نام حساب را بنویسید.' : 'نام کلید را بنویسید.'); return; }
    const expires = days.trim() ? Number(days) : null;
    if (expires !== null && (!Number.isInteger(expires) || expires < 1 || expires > 3650)) { setError('مدت اعتبار باید بین ۱ تا ۳۶۵۰ روز باشد، یا خالی برای بدون انقضا.'); return; }
    setSaving(true);
    try {
      const secret = isAccount ? (await createServiceAccount(name, expires)).secret : (await addApiKey(target.accountId, name, expires)).secret;
      onCreated(secret);
    } catch (err) {
      setError(userErrorMessage(err, 'ساخته نشد.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AdminDialog title={isAccount ? 'حساب سرویس جدید' : 'کلید API جدید'} onClose={onClose} footer={<><SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving} onClick={save}>ساخت</PrimaryButton></>}>
      {error && <Notice type="error">{error}</Notice>}
      <Field label={isAccount ? 'نام حساب' : 'نام کلید'} required hint={isAccount ? 'مثلاً «اتوماسیون اداری». بعد از ساخت، از «مدیریت کاربران» نقش و دسترسی بدهید.' : 'مثلاً «سرور گزارش‌گیری ۱۴۰۵».'}>
        <input id="key-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
      </Field>
      <Field label="مدت اعتبار کلید (روز)" hint="خالی: بدون انقضا (پیشنهاد نمی‌شود)">
        <input id="key-days" className={inputClass} inputMode="numeric" dir="ltr" value={days} onChange={(e) => setDays(toLatinDigits(e.target.value))} />
      </Field>
    </AdminDialog>
  );
};

// ------------------------------------------------------------------ password policy (CAT-257)

const CLASS_LABELS: Record<number, string> = { 2: 'دو نوع از حروف کوچک، بزرگ، رقم و نماد', 3: 'سه نوع از حروف کوچک، بزرگ، رقم و نماد', 4: 'هر چهار نوع: حروف کوچک، بزرگ، رقم و نماد' };

const PasswordPolicySection: React.FC = () => {
  const [minLength, setMinLength] = useState('');
  const [classes, setClasses] = useState(3);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => {
    getPasswordPolicy().then((p) => { setMinLength(String(p.minLength)); setClasses(p.requiredClasses); setMessage(p.message); }).catch((err) => setError(userErrorMessage(err, 'سیاست رمز خوانده نشد.')));
  }, []);
  useEffect(load, [load]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(minLength);
    if (!Number.isInteger(n) || n < 8 || n > 64) { setError('حداقل طول باید بین ۸ تا ۶۴ نویسه باشد.'); return; }
    setSaving(true);
    try {
      await savePasswordPolicy(n, classes);
      setError('');
      showToast('سیاست رمز عبور ذخیره شد. از رمزهای تازه به بعد اعمال می‌شود.', 'ok');
      load();
    } catch (err) {
      setError(userErrorMessage(err, 'سیاست رمز ذخیره نشد.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <SectionCard title="سیاست رمز عبور" description="قواعدی که هر رمز عبور تازه (ساخت کاربر، تغییر رمز، بازیابی) باید رعایت کند. رمزهای فعلی کاربران تغییری نمی‌کنند.">
      {error && <Notice type="error">{error}</Notice>}
      <form onSubmit={save} className="space-y-4 max-w-lg">
        <Field label="حداقل طول (نویسه)" hint="بین ۸ تا ۶۴">
          <input id="pw-min" className={inputClass} inputMode="numeric" dir="ltr" value={minLength} onChange={(e) => setMinLength(toLatinDigits(e.target.value))} />
        </Field>
        <Field label="ترکیب لازم">
          <select id="pw-classes" className={inputClass} value={classes} onChange={(e) => setClasses(Number(e.target.value))}>
            {[2, 3, 4].map((c) => <option key={c} value={c}>{CLASS_LABELS[c]}</option>)}
          </select>
        </Field>
        {message && <p className="text-xs text-slate-500 dark:text-slate-400">آنچه کاربران می‌بینند: «{message}»</p>}
        <PrimaryButton loading={saving} type="submit" disabled={saving}>ذخیره</PrimaryButton>
      </form>
    </SectionCard>
  );
};

// ------------------------------------------------------------------ plan and usage (CAT-2, CAT-199)

const STATUS: Record<MembershipStatus, { tone: 'slate' | 'green' | 'amber' | 'red'; label: string }> = {
  NoPlan: { tone: 'slate', label: 'بدون پلن (بدون محدودیت)' },
  Active: { tone: 'green', label: 'فعال' },
  ExpiringSoon: { tone: 'amber', label: 'نزدیک به پایان' },
  Expired: { tone: 'red', label: 'منقضی شده' },
  NotStarted: { tone: 'amber', label: 'هنوز شروع نشده' },
};

const Meter: React.FC<{ label: string; value: string; percent: number | null }> = ({ label, value, percent }) => (
  <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
    <div className="flex items-baseline justify-between gap-2"><span className="text-xs font-bold text-slate-500">{label}</span><span className="text-sm font-extrabold text-slate-800 dark:text-slate-100 tabular-nums">{value}</span></div>
    {percent !== null && (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className={`h-full ${percent >= 100 ? 'bg-rose-500' : percent >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, percent)}%` }} /></div>
        <span className="text-[11px] font-bold tabular-nums">{toPersianDigits(percent)}٪</span>
      </div>
    )}
  </div>
);

const PlanSection: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const [data, setData] = useState<Membership | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const load = useCallback(() => {
    getMembership().then((m) => { setData(m); setError(''); }).catch((err) => setError(userErrorMessage(err, 'اطلاعات پلن خوانده نشد.')));
  }, []);
  useEffect(load, [load]);
  const mb = (bytes: number) => `${toPersianDigits((bytes / 1048576).toFixed(1))} مگابایت`;

  return (
    <SectionCard
      title="پلن و مصرف"
      description="سقف کاربر فعال و فضای فایل، و بازهٔ اعتبار اشتراک سازمان. کاربران مهمان و حساب‌های سرویس در سقف کاربران شمرده نمی‌شوند. وقتی سقف پر است، کاربر یا فایل تازه پذیرفته نمی‌شود."
      action={canManage ? <PrimaryButton type="button" onClick={() => setEditing(true)} className="shrink-0">{data?.status === 'NoPlan' ? 'تعریف پلن' : 'ویرایش پلن'}</PrimaryButton> : undefined}
    >
      {error && <Notice type="error">{error}</Notice>}
      {data && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {data.planName && <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{data.planName}</span>}
            <StatusBadge tone={STATUS[data.status].tone}>{STATUS[data.status].label}</StatusBadge>
            {data.validUntil && <span className="text-xs text-slate-500">اعتبار تا {jalaliDay(data.validUntil)}{data.daysLeft !== null && data.daysLeft >= 0 ? ` (${toPersianDigits(data.daysLeft)} روز مانده)` : ''}</span>}
          </div>
          {data.warnings.map((w) => <Notice key={w} type="info">{w}</Notice>)}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Meter label="کاربر فعال" value={`${toPersianDigits(data.usage.activeUsers)}${data.maxUsers ? ` از ${toPersianDigits(data.maxUsers)}` : ''}`} percent={data.usage.usersPercent} />
            <Meter label="فضای فایل" value={`${mb(data.usage.storageBytes)}${data.maxStorageMb ? ` از ${toPersianDigits(data.maxStorageMb)}` : ''}`} percent={data.usage.storagePercent} />
            <Meter label="فعالیت ثبت‌شده" value={toPersianDigits(data.usage.taskCount)} percent={null} />
          </div>
          {data.notes && <p className="text-xs text-slate-500">یادداشت: {data.notes}</p>}
        </>
      )}
      {editing && data && <PlanDialog data={data} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />}
    </SectionCard>
  );
};

const PlanDialog: React.FC<{ data: Membership; onClose: () => void; onSaved: () => void }> = ({ data, onClose, onSaved }) => {
  const [planName, setPlanName] = useState(data.planName || '');
  const [maxUsers, setMaxUsers] = useState(data.maxUsers ? String(data.maxUsers) : '');
  const [maxStorage, setMaxStorage] = useState(data.maxStorageMb ? String(data.maxStorageMb) : '');
  const [validFrom, setValidFrom] = useState<string | undefined>(data.validFrom || undefined);
  const [validUntil, setValidUntil] = useState<string | undefined>(data.validUntil || undefined);
  const [notes, setNotes] = useState(data.notes || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const num = (v: string) => (v.trim() ? Number(v) : null);
  const save = async () => {
    if (!planName.trim()) { setError('نام پلن را بنویسید.'); return; }
    const users = num(maxUsers);
    const storage = num(maxStorage);
    if ((users !== null && (!Number.isInteger(users) || users < 1)) || (storage !== null && (!Number.isInteger(storage) || storage < 1))) { setError('سقف‌ها باید عدد مثبت باشند، یا خالی برای بدون سقف.'); return; }
    if (validFrom && validUntil && validUntil <= validFrom) { setError('پایان اعتبار باید بعد از شروع آن باشد.'); return; }
    setSaving(true);
    try {
      await saveMembership({ planName: planName.trim(), maxUsers: users, maxStorageMb: storage, validFrom: validFrom || null, validUntil: validUntil || null, notes: notes.trim() || null });
      showToast('پلن ذخیره شد.', 'ok');
      onSaved();
    } catch (err) {
      setError(userErrorMessage(err, 'پلن ذخیره نشد.'));
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!(await appConfirm('پلن برداشته شود؟ بعد از آن هیچ سقفی اعمال نمی‌شود.', { confirmLabel: 'برداشتن', danger: true }))) return;
    try { await clearMembership(); showToast('پلن برداشته شد.', 'ok'); onSaved(); } catch (err) { setError(userErrorMessage(err, 'انجام نشد.')); }
  };
  return (
    <AdminDialog
      title="پلن سازمان"
      onClose={onClose}
      footer={<>{data.status !== 'NoPlan' && <SecondaryButton type="button" onClick={remove} className="text-rose-700 ml-auto">برداشتن پلن</SecondaryButton>}<SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving} onClick={save}>ذخیره</PrimaryButton></>}
    >
      {error && <Notice type="error">{error}</Notice>}
      <Field label="نام پلن" required><input id="plan-name" className={inputClass} value={planName} onChange={(e) => setPlanName(e.target.value)} maxLength={100} placeholder="مثلاً «سازمانی ۱۰۰ نفره»" /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="سقف کاربر فعال" hint="خالی: بدون سقف"><input id="plan-users" className={inputClass} inputMode="numeric" dir="ltr" value={maxUsers} onChange={(e) => setMaxUsers(toLatinDigits(e.target.value))} /></Field>
        <Field label="سقف فضای فایل (مگابایت)" hint="خالی: بدون سقف"><input id="plan-storage" className={inputClass} inputMode="numeric" dir="ltr" value={maxStorage} onChange={(e) => setMaxStorage(toLatinDigits(e.target.value))} /></Field>
        <Field label="شروع اعتبار"><JalaliDatePicker value={validFrom} onChange={setValidFrom} ariaLabel="شروع اعتبار" /></Field>
        <Field label="پایان اعتبار"><JalaliDatePicker value={validUntil} onChange={setValidUntil} ariaLabel="پایان اعتبار" /></Field>
      </div>
      <Field label="یادداشت"><textarea id="plan-notes" className={`${inputClass} min-h-20`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} /></Field>
    </AdminDialog>
  );
};

// ------------------------------------------------------------------ data retention (CAT-232)

const RetentionSection: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const [automation, setAutomation] = useState('');
  const [webhook, setWebhook] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    getRetention().then((r) => { setAutomation(r.automationLogDays ? String(r.automationLogDays) : ''); setWebhook(r.webhookDeliveryDays ? String(r.webhookDeliveryDays) : ''); }).catch((err) => setError(userErrorMessage(err, 'تنظیم نگهداری خوانده نشد.')));
  }, []);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const parse = (v: string) => (v.trim() ? Number(v) : null);
    const a = parse(automation);
    const w = parse(webhook);
    if ((a !== null && (!Number.isInteger(a) || a < 1)) || (w !== null && (!Number.isInteger(w) || w < 1))) { setError('تعداد روز باید عدد مثبت باشد، یا خالی برای «همیشه».'); return; }
    setSaving(true);
    try {
      await saveRetention({ automationLogDays: a, webhookDeliveryDays: w });
      setError('');
      showToast('مدت نگهداری ذخیره شد.', 'ok');
    } catch (err) {
      setError(userErrorMessage(err, 'ذخیره نشد.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <SectionCard title="نگهداری داده" description="گزارش‌های فنی بعد از این مدت خودکار پاک می‌شوند تا پایگاه داده بی‌جهت بزرگ نشود. فعالیت‌ها، نظرها و تاریخچهٔ فعالیت پاک نمی‌شوند.">
      {error && <Notice type="error">{error}</Notice>}
      <form onSubmit={save} className="space-y-4 max-w-lg">
        <Field label="گزارش اجرای قواعد خودکار (روز)" hint="خالی: همیشه نگه داشته می‌شود">
          <input id="ret-automation" className={inputClass} inputMode="numeric" dir="ltr" value={automation} disabled={!canManage} onChange={(e) => setAutomation(toLatinDigits(e.target.value))} />
        </Field>
        <Field label="سابقهٔ ارسال وب‌هوک (روز)" hint="خالی: همیشه نگه داشته می‌شود">
          <input id="ret-webhook" className={inputClass} inputMode="numeric" dir="ltr" value={webhook} disabled={!canManage} onChange={(e) => setWebhook(toLatinDigits(e.target.value))} />
        </Field>
        {canManage && <PrimaryButton loading={saving} type="submit" disabled={saving}>ذخیره</PrimaryButton>}
      </form>
    </SectionCard>
  );
};

// ------------------------------------------------------------------ CSV import (CAT-265)

/** A sample file with a due date a month from today (dates in the file are Gregorian). */
function sampleCsv(): string {
  // A working day: tasks cannot be due on a Friday or an official holiday.
  let due = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  for (let i = 0; i < 10 && isSchedulingOffDay(due); i++) due = new Date(Date.parse(`${due}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return `title,dueDate,priority,assignee,description,tags\nتهیه گزارش ماهانه,${due},زیاد,,گزارش ماه,گزارش;مالی\n`;
}

/** The server's per-row checks, in Persian (other messages are already Persian). */
function importError(message: string): string {
  const rules: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^title is empty$/, () => 'عنوان خالی است'],
    [/^title is longer than (\d+) characters$/, (m) => `عنوان بیش از ${toPersianDigits(m[1])} نویسه است`],
    [/^dueDate is empty$/, () => 'سررسید خالی است'],
    [/^dueDate '(.*)' is not yyyy-MM-dd$/, (m) => `سررسید «${m[1]}» به شکل میلادی yyyy-MM-dd نیست`],
    [/^priority '(.*)' is not Low, Medium or High$/, (m) => `اولویت «${m[1]}» باید کم، متوسط یا زیاد باشد`],
    [/^assignee '(.*)' is not a user of this organization$/, (m) => `مسئول «${m[1]}» کاربر این سازمان نیست`],
  ];
  for (const [re, render] of rules) { const m = message.match(re); if (m) return render(m); }
  return message;
}

const ImportSection: React.FC = () => {
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2_000_000) { setError('حجم فایل حداکثر ۲ مگابایت است.'); return; }
    const reader = new FileReader();
    reader.onload = () => { setCsv(String(reader.result || '')); setFileName(file.name); setPreview(null); setError(''); };
    reader.onerror = () => setError('فایل خوانده نشد.');
    reader.readAsText(file, 'utf-8');
  };
  const check = async () => {
    setBusy(true);
    try { setPreview(await previewTaskImport(csv)); setResult(null); setError(''); } catch (err) { setError(userErrorMessage(err, 'فایل بررسی نشد.')); setPreview(null); } finally { setBusy(false); }
  };
  const run = async () => {
    if (!preview) return;
    if (!(await appConfirm(`${toPersianDigits(skipInvalid ? preview.valid : preview.total)} فعالیت ساخته شود؟`, { confirmLabel: 'ورود فعالیت‌ها' }))) return;
    setBusy(true);
    try {
      const done = await runTaskImport(csv, skipInvalid);
      showToast(`${toPersianDigits(done.created)} فعالیت ساخته شد${done.skipped ? `؛ ${toPersianDigits(done.skipped)} ردیف رد شد` : ''}.`, done.created ? 'ok' : 'info', 8000);
      setResult(done);
      setPreview(null);
      if (done.failed.length === 0) { setCsv(''); setFileName(''); }
    } catch (err) {
      setError(userErrorMessage(err, 'ورود فعالیت‌ها انجام نشد.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="ورود فعالیت از فایل CSV"
      description="فهرست فعالیت‌ها را از اکسل (ذخیره به‌صورت CSV با UTF-8) وارد کنید. ستون‌ها: title یا عنوان (اجباری)، dueDate یا سررسید (میلادی yyyy-MM-dd)، priority یا اولویت (کم/متوسط/زیاد)، assignee یا مسئول (نام کاربری)، description یا توضیحات، tags یا برچسب (با ; جدا). حداکثر ۵۰۰ ردیف؛ اول پیش‌نمایش، بعد ورود."
    >
      {error && <Notice type="error">{error}</Notice>}
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
          <Upload className="w-4 h-4" /> انتخاب فایل CSV
          <input id="import-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {fileName && <span className="text-xs text-slate-500">{fileName}</span>}
        <button type="button" onClick={() => { setCsv(sampleCsv()); setFileName('نمونه'); setPreview(null); }} className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer">نمونهٔ ساختار را نشان بده</button>
      </div>
      <Field label="محتوای فایل" hint="می‌توانید متن CSV را مستقیم هم اینجا بچسبانید.">
        <textarea id="import-csv" dir="ltr" className={`${inputClass} min-h-32 font-mono text-xs`} value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }} />
      </Field>
      <SecondaryButton type="button" disabled={busy || !csv.trim()} onClick={check}>پیش‌نمایش و بررسی</SecondaryButton>

      {result && result.failed.length > 0 && (
        <div className="space-y-2">
          <Notice type="error">این ردیف‌ها ساخته نشدند؛ آن‌ها را در فایل اصلاح و دوباره وارد کنید:</Notice>
          <ul className="text-xs space-y-1">
            {result.failed.map((r) => (
              <li key={r.line} className="px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/30"><b>خط {toPersianDigits(r.line)}{r.title ? ` — ${r.title}` : ''}:</b> {r.errors.map(importError).join(' | ')}</li>
            ))}
          </ul>
        </div>
      )}

      {preview && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="slate">{toPersianDigits(preview.total)} ردیف</StatusBadge>
            <StatusBadge tone="green">{toPersianDigits(preview.valid)} درست</StatusBadge>
            {preview.invalid > 0 && <StatusBadge tone="red">{toPersianDigits(preview.invalid)} دارای خطا</StatusBadge>}
          </div>
          <div className="overflow-x-auto max-h-80 rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[620px] text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/70 sticky top-0"><tr className="text-right text-[11px] font-bold text-slate-500"><th className="px-3 py-2">خط</th><th className="px-3 py-2">عنوان</th><th className="px-3 py-2">سررسید</th><th className="px-3 py-2">اولویت</th><th className="px-3 py-2">مسئول</th><th className="px-3 py-2">وضعیت</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {preview.rows.map((r) => (
                  <tr key={r.line} className={r.valid ? '' : 'bg-rose-50/60 dark:bg-rose-950/20'}>
                    <td className="px-3 py-2 tabular-nums">{toPersianDigits(r.line)}</td>
                    <td className="px-3 py-2 font-bold">{r.title || '—'}</td>
                    <td className="px-3 py-2">{jalaliDay(r.dueDate)}</td>
                    <td className="px-3 py-2">{r.priority ? ({ Low: 'کم', Medium: 'متوسط', High: 'زیاد' } as const)[r.priority] : '—'}</td>
                    <td className="px-3 py-2" dir="ltr">{r.assignee || '—'}</td>
                    <td className="px-3 py-2">{r.valid && r.dueDate && isSchedulingOffDay(r.dueDate) ? <StatusBadge tone="amber">سررسید روز تعطیل است؛ ساخته نمی‌شود</StatusBadge> : r.valid ? <StatusBadge tone="green">درست</StatusBadge> : <span className="text-rose-700 dark:text-rose-300" dir="auto">{r.errors.map(importError).join(' | ')}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.invalid > 0 && <Toggle checked={skipInvalid} onChange={setSkipInvalid} label="ردیف‌های دارای خطا را رد کن" description="خاموش: اگر ردیفی خطا داشته باشد هیچ فعالیتی ساخته نمی‌شود." />}
          <PrimaryButton type="button" disabled={busy || preview.valid === 0 || (!skipInvalid && preview.invalid > 0)} onClick={run}>ورود {toPersianDigits(skipInvalid ? preview.valid : preview.total)} فعالیت</PrimaryButton>
        </div>
      )}
    </SectionCard>
  );
};
