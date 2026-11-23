import React, { useEffect, useState } from 'react';
import { KeyRound, Loader2, LogIn, MessageSquareLock } from 'lucide-react';
import { NEXUS_API_BASE_URL } from '../../services/nexusApi';
import { listSsoProviders } from '../../services/adminApi';
import { toPersianDigits } from '../../utils/helpers';
import type { MfaChallenge, SsoProvider } from './types';

/**
 * The SMS code step of a sign-in (CAT-228): the password was right and this account signs in with a code
 * too; the code went to the masked mobile number. Same look as the sign-in form it replaces.
 */
export const MfaCodeStep: React.FC<{
  challenge: MfaChallenge;
  busy: boolean;
  onSubmit: (code: string) => void;
  onCancel: () => void;
}> = ({ challenge, busy, onSubmit, onCancel }) => {
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(challenge.expiresInSeconds);
  useEffect(() => {
    setLeft(challenge.expiresInSeconds);
    const id = window.setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [challenge.challengeId, challenge.expiresInSeconds]);
  const clean = code.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\D/g, '');
  return (
    <form
      className="app-form space-y-4"
      onSubmit={(e) => { e.preventDefault(); if (clean) onSubmit(clean); }}
      aria-label="کد تأیید ورود"
    >
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200">
        <MessageSquareLock className="w-4 h-4 shrink-0 mt-0.5" />
        <p className="leading-relaxed">ورود دومرحله‌ای برای حساب شما فعال است. کد پیامک‌شده به شمارهٔ <b dir="ltr">{toPersianDigits(challenge.maskedPhone)}</b> را وارد کنید.</p>
      </div>
      <div>
        <label htmlFor="mfa-code" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">کد تأیید</label>
        <input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          autoFocus
          maxLength={8}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-lg tracking-[0.5em] font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40"
        />
        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          {left > 0 ? `اعتبار کد: ${toPersianDigits(Math.floor(left / 60))}:${toPersianDigits(String(left % 60).padStart(2, '0'))}` : 'کد منقضی شده است؛ دوباره وارد شوید تا کد جدید ارسال شود.'}
        </p>
      </div>
      <button type="submit" disabled={busy || !clean || left === 0} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} تأیید و ورود
      </button>
      <button type="button" onClick={onCancel} className="w-full text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer">بازگشت به صفحهٔ ورود</button>
    </form>
  );
};

/**
 * «ورود با …» buttons for the configured identity providers (CAT-226: OIDC / SAML). Nothing when none is
 * configured. The browser goes to the provider and comes back to this page with ?sso=ok (or ?sso_error=…).
 */
export const SsoButtons: React.FC = () => {
  const [providers, setProviders] = useState<SsoProvider[]>([]);
  useEffect(() => { listSsoProviders().then(setProviders); }, []);
  if (providers.length === 0) return null;
  const returnUrl = `${window.location.origin}${window.location.pathname}`;
  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-2 text-[11px] text-slate-400"><span className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />یا<span className="flex-1 h-px bg-slate-200 dark:bg-slate-700" /></div>
      {providers.map((p) => (
        <a
          key={p.key}
          href={`${NEXUS_API_BASE_URL}/api/identity/auth/sso/${encodeURIComponent(p.key)}/start?returnUrl=${encodeURIComponent(returnUrl)}`}
          className="w-full py-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <LogIn className="w-4 h-4" /> ورود با {p.displayName}
        </a>
      ))}
    </div>
  );
};

/** What the SSO round trip left in the address (?sso=ok / ?sso_error=…), read once and removed. */
export function takeSsoResult(): { ok: boolean; error: string | null } | null {
  const params = new URLSearchParams(window.location.search);
  const ok = params.get('sso') === 'ok';
  const error = params.get('sso_error');
  if (!ok && error === null) return null;
  params.delete('sso');
  params.delete('sso_error');
  const rest = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
  return { ok, error };
}
