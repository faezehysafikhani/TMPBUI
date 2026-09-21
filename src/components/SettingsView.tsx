import React, { useState, useEffect, useRef } from 'react';
import {
  Sun, Moon, Grid, Palette, Check, LogOut, LogIn, User as UserIcon,
  Upload, Camera, Loader2, ShieldCheck, Users, Bell, MessageSquare, Send,
  Smartphone, HelpCircle, FileText, Printer, ChevronDown, ChevronUp
} from 'lucide-react';
import { AppTheme, AppColorPalette, User as UserType, WorkTeam } from '../types';
import { COLOR_PALETTES } from '../utils/theme';
import { PRESET_AVATARS, compressImageFile } from '../utils/avatars';
import { readFileAsDataUrl } from '../utils/storage';
import { AdminUserManagement } from './AdminUserManagement';
import { WorkTeamManagement } from './WorkTeamManagement';

export type ThemeMode = 'light' | 'dark';

export interface SettingsViewProps {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  appColorTheme: AppTheme;
  setAppColorTheme: (theme: AppTheme) => void;
  appColorPalette: AppColorPalette;
  setAppColorPalette: (palette: AppColorPalette) => void;
  totalTasksCount: number;
  currentUser: UserType | null;
  onLogout: () => void;
  onOpenAuthModal: () => void;
  onSaveProfile?: (data: {
    name?: string;
    username?: string;
    avatar?: string;
    phoneNumber?: string;
    telegramChatId?: string;
    notifySms?: boolean;
    notifyTelegram?: boolean;
  }) => Promise<void>;
  onTeamsUpdated?: (updatedTeams: WorkTeam[]) => void;
  onOpenPdfCatalog?: () => void;
  onBackToKanban?: () => void;
}

const PATTERN_SCHEMES: { id: AppTheme; name: string; description: string; previewClass: string }[] = [
  { id: 'default', name: 'ساده و مدرن', description: 'زمینه خنثی', previewClass: 'bg-pattern-default' },
  { id: 'checkerboard', name: 'طرح شطرنجی', description: 'مربع‌های ریز', previewClass: 'bg-pattern-checkerboard' },
  { id: 'diagonal', name: 'خطوط مورب', description: 'خطوط اریب', previewClass: 'bg-pattern-diagonal' },
  { id: 'grid', name: 'طرح شبکه‌ای', description: 'جدول هندسی', previewClass: 'bg-pattern-grid' },
  { id: 'dots', name: 'طرح نقطه‌ای', description: 'نقطه‌چین ظریف', previewClass: 'bg-pattern-dots' },
  { id: 'cross', name: 'چهارخانه', description: 'متقاطع ریز', previewClass: 'bg-pattern-cross' },
  { id: 'waves', name: 'طرح موجی', description: 'قوس‌های دایره‌ای', previewClass: 'bg-pattern-waves' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  themeMode,
  setThemeMode,
  appColorTheme,
  setAppColorTheme,
  appColorPalette,
  setAppColorPalette,
  currentUser,
  onLogout,
  onOpenAuthModal,
  onSaveProfile,
  onTeamsUpdated,
  onOpenPdfCatalog,
  onBackToKanban,
}) => {
  // Profile Form States
  const [profileName, setProfileName] = useState<string>('');
  const [profileUsername, setProfileUsername] = useState<string>('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');
  const [profilePhoneNumber, setProfilePhoneNumber] = useState<string>('');
  const [profileTelegramChatId, setProfileTelegramChatId] = useState<string>('');
  const [notifySms, setNotifySms] = useState<boolean>(true);
  const [notifyTelegram, setNotifyTelegram] = useState<boolean>(true);

  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    profile: false,
    adminUsers: false,
    team: false,
    themeMode: false,
    colorPalette: false,
    patternBg: false,
    catalog: false,
    account: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name || '');
      setProfileUsername(currentUser.username || '');
      setSelectedAvatar(currentUser.avatar || '');
      setProfilePhoneNumber(currentUser.phoneNumber || '');
      setProfileTelegramChatId(currentUser.telegramChatId || '');
      setNotifySms(currentUser.notifySms !== undefined ? !!currentUser.notifySms : true);
      setNotifyTelegram(currentUser.notifyTelegram !== undefined ? !!currentUser.notifyTelegram : true);
    }
  }, [currentUser]);

  const handleCustomAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileMsg({ type: 'error', text: 'لطفاً یک فایل تصویری (PNG, JPG, WEBP) انتخاب نمایید.' });
      return;
    }

    const MAX_ALLOWED_BYTES = 200 * 1024; // 200 KB
    const originalKb = (file.size / 1024).toFixed(0);

    try {
      let finalDataUrl = '';
      if (file.size > MAX_ALLOWED_BYTES) {
        finalDataUrl = await compressImageFile(file, 220, 220, 0.8);
        const approxBytes = Math.round(finalDataUrl.length * 0.75);
        if (approxBytes > MAX_ALLOWED_BYTES) {
          finalDataUrl = await compressImageFile(file, 160, 160, 0.65);
        }
        const finalKb = (Math.round(finalDataUrl.length * 0.75) / 1024).toFixed(0);
        setSelectedAvatar(finalDataUrl);
        setProfileMsg({
          type: 'success',
          text: `تصویر اصلی (${originalKb} KB) فشرده‌سازی گردید (${finalKb} KB). جهت ثبت، کلید «ذخیره آواتار و مشخصات» را بزنید.`,
        });
      } else {
        finalDataUrl = await readFileAsDataUrl(file);
        setSelectedAvatar(finalDataUrl);
        setProfileMsg({
          type: 'success',
          text: `تصویر آواتار انتخاب شد (${originalKb} KB). جهت ثبت، کلید «ذخیره آواتار و مشخصات» را بزنید.`,
        });
      }
    } catch (err: any) {
      console.error('Failed to process custom avatar:', err);
      setProfileMsg({ type: 'error', text: err.message || 'بارگذاری یا فشرده‌سازی تصویر با خطا مواجه شد.' });
    }
  };

  const handleSaveProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !onSaveProfile) return;
    setIsSavingProfile(true);
    setProfileMsg(null);
    try {
      await onSaveProfile({
        name: profileName.trim(),
        username: profileUsername.trim(),
        avatar: selectedAvatar,
        phoneNumber: profilePhoneNumber.trim(),
        telegramChatId: profileTelegramChatId.trim(),
        notifySms: notifySms,
        notifyTelegram: notifyTelegram,
      });
      setProfileMsg({ type: 'success', text: 'تغییرات پروفایل، شماره همراه و تنظیمات اطلاع‌رسانی با موفقیت ذخیره شد 🎉' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'خطا در ذخیره‌سازی پروفایل در دیتابیس.' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      {/* Section 1: Admin User Management Card (Admin Only - Top Item) */}
      {currentUser && (currentUser.role === 'admin' || currentUser.username.toLowerCase() === 'admin') && (
        <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <button
            type="button"
            onClick={() => toggleSection('adminUsers')}
            className={`w-full flex items-center justify-between text-slate-900 dark:text-white font-bold text-sm select-none cursor-pointer group ${
              openSections.adminUsers ? 'pb-3 border-b border-amber-200/60 dark:border-amber-800/60' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
              <span>مدیریت کاربران سامانه</span>
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2.5 py-1 rounded-xl border border-amber-300 dark:border-amber-800 shrink-0">
                پنل مدیر (Admin)
              </span>
            </div>
            {openSections.adminUsers ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>

          {openSections.adminUsers && (
            <div className="animate-in fade-in duration-200">
              <AdminUserManagement currentUser={currentUser} />
            </div>
          )}
        </div>
      )}

      {/* Section 2: User Profile & Avatar Form */}
      {currentUser && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <button
            type="button"
            onClick={() => toggleSection('profile')}
            className={`w-full flex items-center justify-between text-slate-900 dark:text-white font-bold text-sm select-none cursor-pointer group ${
              openSections.profile ? 'pb-3 border-b border-slate-100 dark:border-slate-800' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
              <span>پروفایل و آواتار کاربری</span>
            </div>
            {openSections.profile ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>

          {openSections.profile && (
            <div className="space-y-5 animate-in fade-in duration-200">
              {profileMsg && (
                <div className={`p-3.5 rounded-2xl text-xs font-semibold ${
                  profileMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                }`}>
                  {profileMsg.text}
                </div>
              )}

              <form onSubmit={handleSaveProfileSubmit} className="space-y-5">
                {/* Current Avatar & File Upload */}
                <div className="flex flex-col sm:flex-row items-center gap-5 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                  <div className="relative shrink-0">
                    {selectedAvatar ? (
                      <img
                        src={selectedAvatar}
                        alt="آواتار انتخابی"
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-500 shadow-md"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-2xl border-2 border-indigo-400 shadow-md">
                        {profileName ? profileName.charAt(0).toUpperCase() : <UserIcon className="w-10 h-10" />}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-1 -right-1 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors shadow-xs cursor-pointer"
                      title="بارگذاری تصویر شخصی"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 text-center sm:text-right space-y-2">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">تصویر آواتار کاربر</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
                        می‌توانید از آلبوم ۲۴ آواتار متنوع پیش‌فرض انتخاب کنید یا تصویر دلخواه خود را بارگذاری نمایید.
                      </p>
                    </div>

                    {/* Acceptable file size & format notice before upload */}
                    <div className="p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-right space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                        <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0" />
                        <span>حجم قابل قبول: <strong>حداکثر ۲۰۰ کیلوبایت (200 KB)</strong></span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed pr-3.5">
                        فرمت‌های مجاز: <strong>JPG, PNG, WEBP, GIF</strong> (تصاویر بزرگتر نیز به صورت خودکار و هوشمند فشرده‌سازی و بهینه‌سازی می‌شوند).
                      </p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleCustomAvatarUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      title="حجم مجاز: حداکثر ۲۰۰ کیلوبایت (فرمت‌های JPG, PNG, WEBP)"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer shadow-xs"
                    >
                      <Upload className="w-4 h-4" />
                      <span>بارگذاری تصویر شخصی (حداکثر ۲۰۰ KB)</span>
                    </button>
                  </div>
                </div>

                {/* Default Avatar Preset Gallery */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    انتخاب از آلبوم آواتارهای پیش‌فرض:
                  </label>
                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2.5 p-1">
                    {PRESET_AVATARS.map((avatar) => {
                      const isSelected = selectedAvatar === avatar.url;
                      return (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => {
                            setSelectedAvatar(avatar.url);
                            setProfileMsg(null);
                          }}
                          className={`relative p-1 rounded-2xl border-2 transition-all cursor-pointer aspect-square flex items-center justify-center bg-white dark:bg-slate-800 hover:scale-105 ${
                            isSelected
                              ? 'border-indigo-600 ring-2 ring-indigo-400/40 shadow-md scale-105'
                              : 'border-slate-200 dark:border-slate-700 opacity-80 hover:opacity-100'
                          }`}
                          title={avatar.name}
                        >
                          <img src={avatar.url} alt={avatar.name} className="w-full h-full rounded-xl object-cover" />
                          {isSelected && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Name & Username Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      نام و نام خانوادگی *
                    </label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      placeholder="مثلاً: علی محمدی"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      نام کاربری (ورود به سیستم)
                    </label>
                    <input
                      type="text"
                      value={profileUsername}
                      onChange={(e) => setProfileUsername(e.target.value)}
                      placeholder="username"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dir-ltr text-right font-mono"
                    />
                  </div>
                </div>

                {/* Notification Inputs (SMS & Telegram) */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>اطلاع‌رسانی پیامکی و تلگرامی</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Smartphone className="w-4 h-4 text-indigo-500" />
                        <span>شماره تلفن همراه (پیامک):</span>
                      </label>
                      <input
                        type="tel"
                        value={profilePhoneNumber}
                        onChange={(e) => setProfilePhoneNumber(e.target.value)}
                        placeholder="09121234567"
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dir-ltr text-right font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Send className="w-4 h-4 text-sky-500" />
                        <span>شناسه چت تلگرام (Telegram Chat ID):</span>
                      </label>
                      <input
                        type="text"
                        value={profileTelegramChatId}
                        onChange={(e) => setProfileTelegramChatId(e.target.value)}
                        placeholder="مثلاً: 123456789"
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dir-ltr text-right font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <label className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                      notifySms
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-xs font-semibold">اطلاع‌رسانی با پیامک (SMS)</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifySms}
                        onChange={(e) => setNotifySms(e.target.checked)}
                        className="w-4.5 h-4.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </label>

                    <label className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                      notifyTelegram
                        ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-700 text-sky-900 dark:text-sky-200'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Send className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        <span className="text-xs font-semibold">اطلاع‌رسانی با تلگرام</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifyTelegram}
                        onChange={(e) => setNotifyTelegram(e.target.checked)}
                        className="w-4.5 h-4.5 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                      />
                    </label>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 shrink-0 text-slate-400" />
                    <span>
                      جهت دریافت شناسه تلگرام می‌توانید به ربات <code className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono dir-ltr inline-block text-indigo-600 dark:text-indigo-400">@userinfobot</code> پیام دهید.
                    </span>
                  </p>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-50 active:scale-98"
                  >
                    {isSavingProfile ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>در حال ذخیره در دیتابیس...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>ذخیره آواتار و مشخصات در دیتابیس</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Section 3: Work Team Management Card */}
      {currentUser && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <button
            type="button"
            onClick={() => toggleSection('team')}
            className={`w-full flex items-center justify-between text-slate-900 dark:text-white font-bold text-sm select-none cursor-pointer group ${
              openSections.team ? 'pb-3 border-b border-slate-100 dark:border-slate-800' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
              <span>مدیریت تیم کاری من</span>
            </div>
            {openSections.team ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>

          {openSections.team && (
            <div className="animate-in fade-in duration-200">
              <WorkTeamManagement currentUser={currentUser} onTeamsUpdated={onTeamsUpdated} />
            </div>
          )}
        </div>
      )}

      {/* Section 4: Light / Dark Mode Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <button
          type="button"
          onClick={() => toggleSection('themeMode')}
          className={`w-full flex items-center justify-between text-slate-900 dark:text-white font-bold text-sm select-none cursor-pointer group ${
            openSections.themeMode ? 'pb-3 border-b border-slate-100 dark:border-slate-800' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
            <span>حالت روز / شب (طرح روشن و تیره)</span>
          </div>
          {openSections.themeMode ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>

        {openSections.themeMode && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-200">
            <button
              type="button"
              onClick={() => setThemeMode('light')}
              className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer font-bold text-xs ${
                themeMode === 'light'
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-400 dark:text-indigo-300 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sun className="w-5 h-5 text-amber-500" />
                <span>طرح روشن (روز)</span>
              </div>
              {themeMode === 'light' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
            </button>

            <button
              type="button"
              onClick={() => setThemeMode('dark')}
              className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer font-bold text-xs ${
                themeMode === 'dark'
                  ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-400 dark:text-indigo-300 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Moon className="w-5 h-5 text-indigo-400" />
                <span>طرح تیره (شب)</span>
              </div>
              {themeMode === 'dark' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
            </button>
          </div>
        )}
      </div>

      {/* Section 5: Color Palette Selector Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <button
          type="button"
          onClick={() => toggleSection('colorPalette')}
          className={`w-full flex items-center justify-between text-slate-900 dark:text-white font-bold text-sm select-none cursor-pointer group ${
            openSections.colorPalette ? 'pb-3 border-b border-slate-100 dark:border-slate-800' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition-transform" />
            <span>پالت رنگی اصلی اپلیکیشن</span>
          </div>
          {openSections.colorPalette ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>

        {openSections.colorPalette && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تغییر همزمان رنگ پالت عناصر، دکمه‌ها و حاشیه‌ها (ذخیره مستقیم در دیتابیس)
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {(Object.keys(COLOR_PALETTES) as AppColorPalette[]).map((key) => {
                const palette = COLOR_PALETTES[key];
                const isSelected = appColorPalette === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAppColorPalette(key)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col items-start gap-2 overflow-hidden ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/50 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/80'
                    }`}
                  >
                    <div className={`w-full h-10 rounded-xl ${palette.previewBg} flex items-center justify-end p-2 shadow-xs`}>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-xs">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {palette.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Section 6: Background Pattern Theme Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <button
          type="button"
          onClick={() => toggleSection('patternBg')}
          className={`w-full flex items-center justify-between text-slate-900 dark:text-white font-bold text-sm select-none cursor-pointer group ${
            openSections.patternBg ? 'pb-3 border-b border-slate-100 dark:border-slate-800' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <Grid className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition-transform" />
            <span>طرح بافت زمینه (پترن گرافیکی)</span>
          </div>
          {openSections.patternBg ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>

        {openSections.patternBg && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تغییر الگوی زمینه صفحه و کارت‌های کاربری (ذخیره مستقیم در دیتابیس)
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {PATTERN_SCHEMES.map((scheme) => {
                const isSelected = appColorTheme === scheme.id;
                return (
                  <button
                    key={scheme.id}
                    type="button"
                    onClick={() => setAppColorTheme(scheme.id)}
                    className={`relative p-3 rounded-2xl border transition-all cursor-pointer flex flex-col items-start gap-2 overflow-hidden ${
                      isSelected
                        ? 'border-indigo-600 ring-2 ring-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/50 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/80'
                    }`}
                  >
                    <div className={`w-full h-12 rounded-xl border border-slate-200 dark:border-slate-700 ${scheme.previewClass} palette-${appColorPalette} flex items-center justify-end p-2 shadow-inner`}>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                        {scheme.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-normal mt-0.5">
                        {scheme.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Section 7: Feature Catalog & PDF Handbook (Collapsible, closed by default) */}
      {onOpenPdfCatalog && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
          <button
            type="button"
            onClick={() => toggleSection('catalog')}
            className={`w-full flex items-center justify-between text-slate-900 dark:text-white font-bold text-sm select-none cursor-pointer group ${
              openSections.catalog ? 'pb-3 border-b border-emerald-200/60 dark:border-emerald-800/60' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>دفترچه راهنما و کاتالوگ امکانات سامانه</span>
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-xl border border-emerald-300 dark:border-emerald-800 shrink-0">
                نسخه PDF
              </span>
            </div>
            {openSections.catalog ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>

          {openSections.catalog && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-right">
                  <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-xs shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      شناسنامه و کاتالوگ جامع تمام قابلیت‌های سامانه
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      مشاهده مستندات تفصیلی، راهنمای کاربری و دریافت نسخه استاندارد قابل چاپ و ذخیره PDF
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenPdfCatalog}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer shrink-0 active:scale-95"
                >
                  <Printer className="w-4 h-4" />
                  <span>مشاهده و چاپ کاتالوگ (PDF)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section 8: User Account Status & Logout Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <button
          type="button"
          onClick={() => toggleSection('account')}
          className={`w-full flex items-center justify-between text-slate-900 dark:text-white font-bold text-sm select-none cursor-pointer group ${
            openSections.account ? 'pb-3 border-b border-slate-100 dark:border-slate-800' : ''
          }`}
        >
          <div className="flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition-transform" />
            <span>مدیریت حساب کاربری و خروج</span>
          </div>
          {openSections.account ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>

        {openSections.account && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1 animate-in fade-in duration-200">
            {currentUser ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-xs">
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : <UserIcon className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{currentUser.name}</p>
                    <p className="text-xs text-slate-400 dir-ltr text-right font-mono">@{currentUser.username}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-300 rounded-xl text-xs font-bold transition-all cursor-pointer border border-rose-200 dark:border-rose-800 shrink-0 active:scale-95"
                >
                  <LogOut className="w-4 h-4" />
                  <span>خروج از حساب کاربری</span>
                </button>
              </>
            ) : (
              <>
                <span className="text-xs text-slate-600 dark:text-slate-300 font-bold">وارد حساب کاربری نشده‌اید</span>
                <button
                  type="button"
                  onClick={onOpenAuthModal}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <LogIn className="w-4 h-4" />
                  <span>ورود به حساب کاربری</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
