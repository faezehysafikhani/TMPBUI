import React, { useState } from 'react';
import { LogIn, UserPlus, KeyRound, AtSign, AlertCircle, X, Loader2, Eye, EyeOff, CheckCircle2, ArrowRight, Mail, Smartphone, Send } from 'lucide-react';
import { AppTheme } from '../types';
import { loginPB, registerPB, requestPasswordResetPB } from '../services/pocketbase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentTheme: AppTheme;
  onThemeSelect: (theme: AppTheme) => void;
  canClose?: boolean;
  onOpenResetWithToken?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentTheme,
  onThemeSelect,
  canClose = true,
  onOpenResetWithToken,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  
  // Login fields
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password fields
  const [forgotInput, setForgotInput] = useState('');
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState<string | null>(null);

  // Register fields
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regTelegram, setRegTelegram] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [regNotifySms, setRegNotifySms] = useState(true);
  const [regNotifyTelegram, setRegNotifyTelegram] = useState(true);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegPasswordConfirm, setShowRegPasswordConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCloseModal = () => {
    if (canClose) {
      onClose();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!identity.trim() || !password.trim()) {
      setErrorMsg('لطفاً نام کاربری/ایمیل و رمز عبور را وارد فرمایید.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await loginPB(identity.trim(), password);
      if (user.theme) {
        onThemeSelect(user.theme);
      }
      onSuccess();
      if (canClose) onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'ورود ناموفق بود. نام کاربری یا رمز عبور اشتباه است.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setForgotSuccessMsg(null);

    if (!forgotInput.trim()) {
      setErrorMsg('لطفاً ایمیل یا نام کاربری خود را وارد نمایید.');
      return;
    }

    setIsLoading(true);
    try {
      const sentEmail = await requestPasswordResetPB(forgotInput);
      setForgotSuccessMsg(
        `لینک بازنشانی رمز عبور با موفقیت به ایمیل (${sentEmail}) ارسال گردید. لطفاً صندوق ورودی و پوشه اسپم (Spam) ایمیل خود را بررسی نمایید.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'خطا در ارسال درخواست بازنشانی رمز عبور.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!regName.trim()) {
      setErrorMsg('لطفاً نام و نام خانوادگی خود را وارد نمایید.');
      return;
    }
    if (!regPhone.trim()) {
      setErrorMsg('لطفاً شماره موبایل خود را وارد نمایید.');
      return;
    }
    if (!regUsername.trim()) {
      setErrorMsg('لطفاً نام کاربری را وارد نمایید.');
      return;
    }
    if (!regEmail.trim() || !regEmail.includes('@')) {
      setErrorMsg('لطفاً یک ایمیل معتبر وارد نمایید.');
      return;
    }
    if (regPassword.length < 8) {
      setErrorMsg('رمز عبور باید حداقل ۸ کاراکتر باشد.');
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setErrorMsg('رمز عبور و تکرار آن یکسان نیستند.');
      return;
    }

    setIsLoading(true);
    try {
      const fullName = regName.trim();
      const usernameInput = regUsername.trim() || undefined;

      await registerPB({
        username: usernameInput,
        email: regEmail.trim().toLowerCase(),
        name: fullName,
        phoneNumber: regPhone.trim(),
        telegramChatId: regTelegram.trim(),
        notifySms: regNotifySms,
        notifyTelegram: regNotifyTelegram,
        password: regPassword,
        passwordConfirm: regPasswordConfirm,
        theme: currentTheme || 'default',
      });
      onSuccess();
      if (canClose) onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'ثبت‌نام ناموفق بود.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget && canClose) {
          handleCloseModal();
        }
      }}
    >
      {/* Irregular Floating Small White Balls in Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[12%] left-[10%] w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)] animate-float-1" />
        <div className="absolute top-[22%] right-[15%] w-5 h-5 rounded-full bg-white/90 shadow-[0_0_14px_rgba(255,255,255,0.9)] animate-float-2" />
        <div className="absolute bottom-[18%] left-[14%] w-4 h-4 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.95)] animate-float-3" />
        <div className="absolute bottom-[28%] right-[18%] w-3 h-3 rounded-full bg-white/95 shadow-[0_0_8px_rgba(255,255,255,0.9)] animate-float-4" />
        <div className="absolute top-[52%] left-[6%] w-4.5 h-4.5 rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.95)] animate-float-5" />
        <div className="absolute top-[8%] right-[32%] w-3 h-3 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)] animate-float-3" />
        <div className="absolute bottom-[10%] right-[38%] w-5 h-5 rounded-full bg-white/85 shadow-[0_0_14px_rgba(255,255,255,0.85)] animate-float-1" />
        <div className="absolute top-[42%] right-[8%] w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)] animate-float-4" />
        <div className="absolute bottom-[45%] left-[22%] w-3.5 h-3.5 rounded-full bg-white/95 shadow-[0_0_10px_rgba(255,255,255,0.9)] animate-float-2" />
        <div className="absolute top-[30%] left-[38%] w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] animate-float-5" />
        <div className="absolute bottom-[15%] left-[45%] w-4 h-4 rounded-full bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.95)] animate-float-1" />
        <div className="absolute top-[75%] right-[25%] w-3 h-3 rounded-full bg-white shadow-[0_0_9px_rgba(255,255,255,0.9)] animate-float-3" />
      </div>

      <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-right max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-br from-indigo-900 to-slate-900 text-white shrink-0">
          {canClose && (
            <button
              type="button"
              onClick={handleCloseModal}
              className="absolute left-4 top-4 p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-3">
            <img 
              src="/icon.svg" 
              alt="لوگو" 
              className="w-12 h-12 rounded-2xl border border-indigo-400/30 shadow-lg object-cover shrink-0" 
            />
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">مدیریت وظایف (TM)</h1>
              <h2 className="text-xs font-semibold text-indigo-200/90 mt-0.5">حساب کاربری</h2>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex bg-slate-950/50 p-1 rounded-2xl mt-5 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg(null);
                setForgotSuccessMsg(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>ورود به حساب</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
                setForgotSuccessMsg(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>ثبت نام جدید</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {mode === 'login' ? (
            /* Login Form */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  نام کاربری، شماره موبایل یا ایمیل
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    placeholder="نام کاربری، ۰۹۱۲۳۴۵۶۷۸۹ یا info@example.com"
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dir-ltr text-right"
                    required
                  />
                  <AtSign className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    رمز عبور
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMsg(null);
                      setForgotSuccessMsg(null);
                      if (identity.trim()) {
                        setForgotInput(identity.trim());
                      }
                    }}
                    className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 hover:underline cursor-pointer transition-colors"
                  >
                    فراموشی رمز عبور؟
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dir-ltr text-right"
                    required
                  />
                  <KeyRound className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-2.5 p-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors"
                    title={showPassword ? 'پنهان کردن رمز' : 'مشاهده رمز'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>در حال بررسی...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>ورود به سیستم</span>
                  </>
                )}
              </button>
            </form>
          ) : mode === 'forgot' ? (
            /* Forgot Password Form */
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <KeyRound className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  بازیابی رمز عبور
                </h3>
              </div>

              {forgotSuccessMsg ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-800 dark:text-emerald-200 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed font-medium">{forgotSuccessMsg}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMsg(null);
                      setForgotSuccessMsg(null);
                    }}
                    className="w-full mt-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    <span>بازگشت به صفحه ورود</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    ایمیل یا نام کاربری ثبت‌شده در سیستم را وارد نمایید. لینک بازنشانی رمز عبور به ایمیل شما ارسال خواهد شد.
                  </p>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      ایمیل یا نام کاربری
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={forgotInput}
                        onChange={(e) => setForgotInput(e.target.value)}
                        placeholder="مثلاً: info@example.com یا user123"
                        className="w-full pl-3 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dir-ltr text-right"
                        required
                      />
                      <Mail className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>در حال ارسال لینک...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>ارسال لینک بازنشانی رمز عبور</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMsg(null);
                    }}
                    className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>انصراف و بازگشت به ورود</span>
                  </button>

                  {onOpenResetWithToken && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setErrorMsg(null);
                          onOpenResetWithToken();
                        }}
                        className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        توکن یا کد بازیابی دریافت کرده‌اید؟ تعیین رمز عبور جدید
                      </button>
                    </div>
                  )}
                </form>
              )}
            </div>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  نام و نام خانوادگی *
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="مثلاً: علی محمدی"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    شماره موبایل *
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                      className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dir-ltr text-right"
                      required
                    />
                    <Smartphone className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    آیدی تلگرام (اختیاری)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={regTelegram}
                      onChange={(e) => setRegTelegram(e.target.value)}
                      placeholder="@username یا چت آیدی"
                      className="w-full pl-3 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dir-ltr text-right"
                    />
                    <Send className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    نام کاربری *
                  </label>
                  <input
                    type="text"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="username"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dir-ltr text-right"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ایمیل *
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dir-ltr text-right"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    رمز عبور (حداقل ۸ حرف) *
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dir-ltr text-right"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute left-2 top-2 p-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors"
                      title={showRegPassword ? 'پنهان کردن رمز' : 'مشاهده رمز'}
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    تکرار رمز عبور *
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPasswordConfirm ? 'text' : 'password'}
                      value={regPasswordConfirm}
                      onChange={(e) => setRegPasswordConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all dir-ltr text-right"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPasswordConfirm(!showRegPasswordConfirm)}
                      className="absolute left-2 top-2 p-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer transition-colors"
                      title={showRegPasswordConfirm ? 'پنهان کردن رمز' : 'مشاهده رمز'}
                    >
                      {showRegPasswordConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Default Notification Preferences */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <label className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">اطلاع‌رسانی با پیامک</span>
                  <input
                    type="checkbox"
                    checked={regNotifySms}
                    onChange={(e) => setRegNotifySms(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">اطلاع‌رسانی با تلگرام</span>
                  <input
                    type="checkbox"
                    checked={regNotifyTelegram}
                    onChange={(e) => setRegNotifyTelegram(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>در حال ایجاد حساب...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>ایجاد حساب کاربری</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Company Footer Info */}
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-center space-y-1">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              تهیه شده توسط شرکت مدیریت پروژه پارس
            </p>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-center gap-2 dir-ltr">
              <span>پشتیبانی: ۸۸۷۳۱۶۰۱</span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span>info@parspmi.ir</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
