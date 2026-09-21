import React, { useState, useEffect } from 'react';
import { KeyRound, Lock, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff, ShieldCheck, X } from 'lucide-react';
import { confirmPasswordResetPB } from '../services/pocketbase';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialToken?: string | null;
  onSuccessLogin?: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  isOpen,
  onClose,
  initialToken,
  onSuccessLogin,
}) => {
  const [token, setToken] = useState(initialToken || '');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (initialToken) {
      setToken(initialToken);
    }
  }, [initialToken]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!token.trim()) {
      setErrorMsg('لطفاً توکن بازیابی یا کد ارسال شده به ایمیل را وارد نمایید.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('رمز عبور جدید باید حداقل ۸ کاراکتر باشد.');
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMsg('رمز عبور جدید و تکرار آن یکسان نیستند.');
      return;
    }

    setIsLoading(true);
    try {
      await confirmPasswordResetPB(token.trim(), password, passwordConfirm);
      setIsSuccess(true);

      // Clean token from URL hash/query without page reload
      if (typeof window !== 'undefined' && window.history) {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'تغییر رمز عبور با خطا مواجه شد. ممکن است توکن منقضی شده باشد.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden">
        {/* Header decoration */}
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />

        <div className="flex items-center justify-between mb-5 pt-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                تعیین رمز عبور جدید
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                بازیابی و فعال‌سازی حساب کاربری
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{errorMsg}</span>
          </div>
        )}

        {isSuccess ? (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 rounded-full flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>

            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                رمز عبور با موفقیت تغییر یافت!
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                اکنون می‌توانید با رمز عبور جدید خود وارد سیستم شوید.
              </p>
            </div>

            <button
              onClick={() => {
                onClose();
                if (onSuccessLogin) onSuccessLogin();
              }}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>ورود به حساب کاربری</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!initialToken && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  توکن بازیابی رمز عبور
                </label>
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="توکن دریافت شده از لینک ایمیل"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono dir-ltr"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                رمز عبور جدید (حداقل ۸ کاراکتر)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dir-ltr text-right"
                  required
                  minLength={8}
                />
                <Lock className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                تکرار رمز عبور جدید
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dir-ltr text-right"
                  required
                  minLength={8}
                />
                <Lock className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>در حال ذخیره‌سازی رمز عبور...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>ثبت رمز عبور جدید</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
