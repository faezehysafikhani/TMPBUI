import React, { useEffect, useState } from 'react';
import { MessageSquareLock, ShieldCheck, ShieldOff } from 'lucide-react';
import { AdminCard, Field, inputClass, Notice, PrimaryButton, SecondaryButton, StatusBadge } from '../admin/AdminUi';
import { showToast } from '../../utils/toast';
import { userErrorMessage } from '../../utils/errorMessages';
import { toPersianDigits } from '../../utils/helpers';
import { confirmMfaEnable, disableMfa, getMyMfaEnabled, requestMfaEnable } from '../../services/adminApi';
import type { MfaChallenge } from './types';

/**
 * «ورود دومرحله‌ای» in the profile (CAT-228): with it on, signing in also needs a code sent by SMS to the
 * person's mobile. Turning it on sends a code first; turning it off asks for the password.
 */
export const MfaProfileCard: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { getMyMfaEnabled().then(setEnabled).catch((err) => setError(userErrorMessage(err, 'وضعیت ورود دومرحله‌ای خوانده نشد.'))); }, []);

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError('');
    try { await action(); } catch (err) { setError(userErrorMessage(err, fallback)); } finally { setBusy(false); }
  };

  return (
    <AdminCard className="p-5 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white"><MessageSquareLock className="w-5 h-5 text-indigo-600" /> ورود دومرحله‌ای (کد پیامکی)</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-xl">با روشن کردن آن، هنگام ورود علاوه بر رمز عبور، کدی که به موبایل شما پیامک می‌شود هم لازم است؛ حتی اگر کسی رمز شما را بداند، بدون گوشی شما وارد نمی‌شود.</p>
        </div>
        {enabled !== null && (enabled ? <StatusBadge tone="green"><ShieldCheck className="w-3.5 h-3.5" /> فعال</StatusBadge> : <StatusBadge tone="slate">غیرفعال</StatusBadge>)}
      </div>
      {error && <Notice type="error">{error}</Notice>}

      {enabled === false && !challenge && (
        <PrimaryButton type="button" disabled={busy} onClick={() => run(async () => setChallenge(await requestMfaEnable()), 'کد ارسال نشد.')}>
          <ShieldCheck className="w-4 h-4" /> روشن کردن (ارسال کد)
        </PrimaryButton>
      )}

      {enabled === false && challenge && (
        <form
          className="flex flex-col sm:flex-row sm:items-end gap-3 max-w-lg"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await confirmMfaEnable(challenge.challengeId, code.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))));
              setEnabled(true);
              setChallenge(null);
              setCode('');
              showToast('ورود دومرحله‌ای روشن شد.', 'ok');
            }, 'کد درست نیست یا منقضی شده است.');
          }}
        >
          <Field label={`کد پیامک‌شده به ${toPersianDigits(challenge.maskedPhone)}`} className="flex-1">
            <input id="mfa-enable-code" className={`${inputClass} text-center tracking-widest`} dir="ltr" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
          </Field>
          <PrimaryButton type="submit" disabled={busy || !code.trim()}>تأیید</PrimaryButton>
          <SecondaryButton type="button" onClick={() => { setChallenge(null); setCode(''); }}>انصراف</SecondaryButton>
        </form>
      )}

      {enabled && !disabling && (
        <SecondaryButton type="button" onClick={() => setDisabling(true)}><ShieldOff className="w-4 h-4" /> خاموش کردن</SecondaryButton>
      )}
      {enabled && disabling && (
        <form
          className="flex flex-col sm:flex-row sm:items-end gap-3 max-w-lg"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await disableMfa(password);
              setEnabled(false);
              setDisabling(false);
              setPassword('');
              showToast('ورود دومرحله‌ای خاموش شد.', 'ok');
            }, 'رمز عبور درست نیست.');
          }}
        >
          <Field label="رمز عبور فعلی" className="flex-1">
            <input id="mfa-disable-password" type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" autoFocus />
          </Field>
          <PrimaryButton type="submit" disabled={busy || !password} className="bg-rose-700 hover:bg-rose-800">خاموش کردن</PrimaryButton>
          <SecondaryButton type="button" onClick={() => { setDisabling(false); setPassword(''); }}>انصراف</SecondaryButton>
        </form>
      )}
    </AdminCard>
  );
};
