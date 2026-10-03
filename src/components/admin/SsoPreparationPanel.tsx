import React, { useState } from 'react';
import { KeyRound, LockKeyhole, Save } from 'lucide-react';
import { AdminCard, Field, inputClass, Notice, PrimaryButton } from './AdminUi';

type SsoDraft = { protocol: 'oidc' | 'saml' | ''; issuer: string; clientId: string; redirectUri: string };
const STORAGE_KEY = 'parstask_sso_preparation_v1';
const empty: SsoDraft = { protocol: '', issuer: '', clientId: '', redirectUri: '' };

function readDraft(): SsoDraft {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Partial<SsoDraft>;
    return {
      protocol: value.protocol === 'oidc' || value.protocol === 'saml' ? value.protocol : '',
      issuer: typeof value.issuer === 'string' ? value.issuer : '',
      clientId: typeof value.clientId === 'string' ? value.clientId : '',
      redirectUri: typeof value.redirectUri === 'string' ? value.redirectUri : '',
    };
  } catch { return empty; }
}

/** Non-secret, device-local preparation only. No authentication route is enabled here. */
export const SsoPreparationPanel: React.FC = () => {
  const [draft, setDraft] = useState<SsoDraft>(readDraft);
  const [saved, setSaved] = useState(false);
  const set = (key: keyof SsoDraft) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSaved(false);
    setDraft((current) => ({ ...current, [key]: event.target.value }));
  };
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    setSaved(true);
  };

  return <AdminCard>
    <div className="space-y-4 p-5 sm:p-6">
      <h3 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-white"><KeyRound className="w-5 h-5 text-indigo-600" /> آماده‌سازی ورود با SSO</h3>
      <form onSubmit={save} className="space-y-3">
        <div className="rounded-2xl border border-indigo-100 dark:border-indigo-900 bg-slate-50 dark:bg-slate-800 p-5">
          <div className="flex items-center gap-2 mb-4 text-sm font-bold text-indigo-950 dark:text-indigo-100"><LockKeyhole className="w-4 h-4" /> اطلاعات اولیهٔ سرویس هویت</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="پروتکل"><select className={inputClass} value={draft.protocol} onChange={set('protocol')}><option value="">هنوز مشخص نیست</option><option value="oidc">OpenID Connect (OIDC)</option><option value="saml">SAML 2.0</option></select></Field>
            <Field label="شناسه برنامه (Client ID)" hint="فقط شناسهٔ عمومی؛ رمز یا کلید محرمانه را اینجا وارد نکنید."><input className={inputClass} value={draft.clientId} onChange={set('clientId')} autoComplete="off" dir="ltr" /></Field>
            <Field label="نشانی صادرکننده / Metadata"><input className={inputClass} value={draft.issuer} onChange={set('issuer')} placeholder="https://idp.internal.example" autoComplete="off" dir="ltr" /></Field>
            <Field label="نشانی بازگشت (Redirect URI)"><input className={inputClass} value={draft.redirectUri} onChange={set('redirectUri')} autoComplete="off" dir="ltr" /></Field>
          </div>
        </div>
        <div className="flex justify-end pt-1">
          <PrimaryButton type="submit" className="bg-gradient-to-b from-violet-500 via-indigo-600 to-indigo-800 hover:from-violet-400 hover:via-indigo-500 hover:to-indigo-700 border border-indigo-500/70 shadow-[0_8px_0_-3px_rgba(49,46,129,0.85),0_16px_24px_-14px_rgba(49,46,129,0.75)] hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_3px_0_-2px_rgba(49,46,129,0.85)] transition-all"><Save className="w-4 h-4" /> ذخیره پیش‌نویس</PrimaryButton>
        </div>
        {saved && <Notice type="success">پیش‌نویس روی همین مرورگر ذخیره شد؛ ورود SSO همچنان غیرفعال است.</Notice>}
      </form>
    </div>
  </AdminCard>;
};
