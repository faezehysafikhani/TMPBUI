import React, { useEffect, useRef, useState } from 'react';
import { LogIn, Bell, CircleHelp, BookOpen, User as UserIcon, CalendarDays, LogOut, Search, Moon, Sun, ChevronDown, PanelRightOpen } from 'lucide-react';
import { toPersianDigits } from '../utils/helpers';
import { User as UserType, AppTheme, AppColorPalette } from '../types';
import { useBranding } from '../utils/branding';
import { OPEN_PROFILE_EVENT } from '../utils/profileEvents';
import { ActivePostSwitcher } from './ActivePostSwitcher';
import { openCommandPalette, PALETTE_SHORTCUT_LABEL } from './palette/CommandPalette';

interface NavbarProps {
  totalTasks: number;
  completedTasks: number;
  currentUser: UserType | null;
  currentTheme: AppTheme;
  appColorPalette?: AppColorPalette;
  onOpenAuthModal: () => void;
  unreadNotificationsCount?: number;
  onOpenNotificationModal?: () => void;
  onOpenWelcomeModal?: () => void;
  /** Opens the slide user guide (header "?" button). */
  onOpenUserGuide?: () => void;
  /** Opens the training videos («تنظیمات و پروفایل» › «آموزش سامانه»). */
  onOpenTutorials?: () => void;
  /** «پروفایل» in the avatar menu: the signed-in user's own profile. */
  onOpenSettings?: () => void;
  /** «خروج» in the avatar menu. */
  onLogout?: () => void;
  /** Light or dark; with onToggleThemeMode the header shows the switch. */
  themeMode?: 'light' | 'dark';
  onToggleThemeMode?: () => void;
  /** The desktop sidebar is open: the header starts after it. */
  sidebarOpen?: boolean;
  /** The desktop sidebar is closed: a button here opens it again. */
  onOpenSidebar?: () => void;
  hidden?: unknown;
}

const iconButton = 'relative inline-flex items-center justify-center w-10 h-10 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-indigo-600';

/**
 * The bar on top of every page, beside the sidebar: search (opens the Ctrl+K palette), the post the user works
 * as, today's date and time, light/dark, help, notifications and the user menu. The brand shows here only when
 * the sidebar does not (small screens, or the sidebar closed).
 */
export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onOpenAuthModal,
  unreadNotificationsCount = 0,
  onOpenNotificationModal,
  onOpenWelcomeModal,
  onOpenUserGuide,
  onOpenTutorials,
  onOpenSettings,
  onLogout,
  themeMode = 'light',
  onToggleThemeMode,
  sidebarOpen = true,
  onOpenSidebar,
  hidden,
}) => {
  const brand = useBranding();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);
  const openProfile = () => {
    setMenuOpen(false);
    onOpenSettings?.();
    window.setTimeout(() => window.dispatchEvent(new CustomEvent(OPEN_PROFILE_EVENT, { detail: { tab: 'avatar' } })), 0);
  };

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const date = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
  const time = new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const initial = currentUser?.name ? currentUser.name.trim().charAt(0) : '';

  return (
    <header className={`app-header sticky top-0 z-20 h-16 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 transition-[margin] ${sidebarOpen ? 'lg:mr-64' : ''}`}>
      <div className="h-full flex items-center gap-2 sm:gap-3 px-3 sm:px-5">
        {/* Brand where the sidebar does not show it */}
        <div className={`flex items-center gap-2.5 shrink-0 ${sidebarOpen ? 'lg:hidden' : ''}`}>
          {!sidebarOpen && onOpenSidebar && (
            <button type="button" onClick={onOpenSidebar} className={`${iconButton} hidden lg:inline-flex`} title="باز کردن منو" aria-label="باز کردن منو">
              <PanelRightOpen className="w-5 h-5" />
            </button>
          )}
          <button type="button" onClick={onOpenWelcomeModal} className="flex items-center gap-2.5 cursor-pointer" title="خلاصهٔ وضعیت">
            <img src={brand.logo} style={{ visibility: brand.ready ? 'visible' : 'hidden' }} alt="" className="w-9 h-9 rounded-xl object-cover" />
            <span className="hidden sm:block text-base font-extrabold text-slate-900 dark:text-white whitespace-nowrap">{brand.name}</span>
          </button>
        </div>

        {/* Search: opens the command palette */}
        {currentUser && (
          <>
            <button
              type="button"
              onClick={openCommandPalette}
              className="hidden md:flex items-center gap-2.5 h-10 w-full max-w-md px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-white dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-400 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-600"
              aria-label="جستجو و فرمان‌ها"
            >
              <Search className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-right text-sm">جستجو در فعالیت‌ها، صفحه‌ها و تنظیمات…</span>
              <kbd dir="ltr" className="font-sans text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-0.5">{PALETTE_SHORTCUT_LABEL}</kbd>
            </button>
            <button type="button" onClick={openCommandPalette} className={`${iconButton} md:hidden`} aria-label="جستجو">
              <Search className="w-5 h-5" />
            </button>
            <ActivePostSwitcher variant="light" hidden={hidden as never} className="hidden sm:block" />
          </>
        )}

        <span className="flex-1" />

        {/* Today */}
        <div className="hidden xl:flex items-center gap-2 h-10 px-3 rounded-xl text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap" title="تاریخ و ساعت دستگاه شما">
          <CalendarDays className="w-4 h-4" />
          <span className="font-semibold text-slate-700 dark:text-slate-200">{date}</span>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200">{time}</span>
        </div>

        {onToggleThemeMode && (
          <button type="button" onClick={onToggleThemeMode} className={iconButton} title={themeMode === 'dark' ? 'حالت روشن' : 'حالت تیره'} aria-label={themeMode === 'dark' ? 'حالت روشن' : 'حالت تیره'}>
            {themeMode === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        )}
        {onOpenTutorials && (
          <button type="button" onClick={onOpenTutorials} className={`${iconButton} hidden sm:inline-flex`} title="آموزش ویدیویی" aria-label="آموزش ویدیویی">
            <BookOpen className="w-5 h-5" />
          </button>
        )}
        {onOpenUserGuide && (
          <button type="button" onClick={onOpenUserGuide} className={`${iconButton} hidden sm:inline-flex`} title="راهنمای کاربری" aria-label="راهنمای کاربری">
            <CircleHelp className="w-5 h-5" />
          </button>
        )}
        {onOpenNotificationModal && (
          <button type="button" onClick={onOpenNotificationModal} className={iconButton} title="اطلاعیه‌ها و هشدارها" aria-label={`اطلاعیه‌ها${unreadNotificationsCount ? ` (${toPersianDigits(unreadNotificationsCount)} خوانده‌نشده)` : ''}`}>
            <Bell className="w-5 h-5" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 left-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-950">
                {toPersianDigits(unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount)}
              </span>
            )}
          </button>
        )}

        {!currentUser && (
          <button type="button" onClick={onOpenAuthModal} className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold cursor-pointer">
            <LogIn className="w-4 h-4" />
            ورود
          </button>
        )}

        {currentUser && onOpenSettings && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="حساب کاربری"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2.5 h-10 pr-1 pl-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-600"
            >
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 flex items-center justify-center text-sm font-bold">
                  {initial || <UserIcon className="w-4 h-4" />}
                </span>
              )}
              <span className="hidden lg:block text-right leading-tight max-w-[10rem]">
                <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{currentUser.name}</span>
                {currentUser.username && <span className="block text-[11px] text-slate-400 truncate" dir="ltr">@{currentUser.username}</span>}
              </span>
              <ChevronDown className={`hidden lg:block w-4 h-4 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <div role="menu" dir="rtl" className="absolute left-0 top-full mt-2 w-52 z-50 rounded-2xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 lg:hidden">
                  <p className="text-sm font-bold truncate">{currentUser.name}</p>
                  {currentUser.username && <p className="text-[11px] text-slate-400 truncate" dir="ltr">@{currentUser.username}</p>}
                </div>
                <button type="button" role="menuitem" onClick={openProfile} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-right">
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  پروفایل
                </button>
                {onLogout && (
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onLogout(); }} className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-t border-slate-100 dark:border-slate-800 cursor-pointer text-right">
                    <LogOut className="w-4 h-4" />
                    خروج
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
