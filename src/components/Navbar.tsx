import React, { useEffect, useRef, useState } from 'react';
import { Plus, LogIn, Bell, LayoutDashboard, CircleHelp, Settings, LogOut, ChevronDown } from 'lucide-react';
import { toPersianDigits } from '../utils/helpers';
import { User as UserType, AppColorPalette } from '../types';
import { COLOR_PALETTES } from '../utils/theme';

interface NavbarProps {
  /** Omitted when the user may not create tasks: the add button is not shown. */
  onOpenCreateModal?: () => void;
  currentUser: UserType | null;
  appColorPalette?: AppColorPalette;
  onOpenAuthModal: () => void;
  unreadNotificationsCount?: number;
  onOpenNotificationModal?: () => void;
  onOpenWelcomeModal?: () => void;
  /** Opens the slide user guide (header "?" button). */
  onOpenUserGuide?: () => void;
  /** Account menu: settings/profile and logout live here (design system section 8.1/20). */
  onOpenSettings?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCreateModal,
  currentUser,
  appColorPalette = 'indigo',
  onOpenAuthModal,
  unreadNotificationsCount = 0,
  onOpenNotificationModal,
  onOpenWelcomeModal,
  onOpenUserGuide,
  onOpenSettings,
  onLogout,
}) => {
  const palette = COLOR_PALETTES[appColorPalette] || COLOR_PALETTES.indigo;

  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAccountMenuOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [isAccountMenuOpen]);

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-md border-b border-indigo-950/60 shadow-md text-white transition-colors duration-300"
      style={{ background: 'linear-gradient(135deg, #252468 0%, #0F132C 100%)' }}
    >
      <div className="w-full max-w-[1760px] mx-auto px-3 sm:px-5 lg:px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3.5">
            <img 
              src="/icon.svg" 
              alt="لوگوی مدیریت وظایف (TM)" 
              className="w-11 h-11 rounded-[10px] shrink-0 object-cover border border-white/20 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={onOpenWelcomeModal}
            />
            <div>
              <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 whitespace-nowrap">
                مدیریت وظایف (TM)
              </h1>
              {currentUser ? (
                <div className="relative" ref={accountMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsAccountMenuOpen((open) => !open)}
                    className="flex items-center gap-1.5 mt-0.5 hover:text-indigo-300 transition-colors cursor-pointer text-right"
                    title="حساب کاربری"
                    aria-haspopup="menu"
                    aria-expanded={isAccountMenuOpen}
                  >
                    {currentUser.avatar ? (
                      <img
                        src={currentUser.avatar}
                        alt={currentUser.name || 'آواتار کاربر'}
                        className="w-4.5 h-4.5 rounded-full object-cover border border-white/30 shrink-0"
                      />
                    ) : null}
                    <p className="text-sm text-indigo-100 font-medium truncate">
                      {currentUser.name}
                    </p>
                    <ChevronDown className={`w-3 h-3 text-indigo-300/80 transition-transform ${isAccountMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isAccountMenuOpen && (
                    <div
                      role="menu"
                      className="absolute top-full right-0 mt-2 w-56 rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_20px_48px_rgba(11,12,30,0.22)] py-1.5 text-right animate-in fade-in slide-in-from-top-2 duration-150 z-40"
                    >
                      {onOpenWelcomeModal && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            onOpenWelcomeModal();
                          }}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <LayoutDashboard className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>خلاصه وضعیت</span>
                        </button>
                      )}
                      {onOpenSettings && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setIsAccountMenuOpen(false);
                            onOpenSettings();
                          }}
                          className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Settings className="w-4 h-4 text-slate-400 shrink-0" />
                          <span>تنظیمات و پروفایل</span>
                        </button>
                      )}
                      {onLogout && (
                        <>
                          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setIsAccountMenuOpen(false);
                              onLogout();
                            }}
                            className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          >
                            <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
                            <span>خروج از حساب</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-300/80 hidden sm:block mt-0.5">
                  سامانه مدیریت فعالیت‌ها و کانبان بورد
                </p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5">

            {/* Notification Bell Button */}
            {onOpenNotificationModal && (
              <button
                type="button"
                onClick={onOpenNotificationModal}
                title="اطلاعیه‌ها و هشدارها"
                aria-label="اطلاعیه‌ها و هشدارها"
                className="relative min-w-11 min-h-11 p-2.5 text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 rounded-[10px] border border-white/10 transition-all shrink-0 cursor-pointer flex items-center justify-center my-auto"
              >
                <Bell className={`w-4 h-4 ${unreadNotificationsCount > 0 ? palette.accentText : ''}`} />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-xs animate-pulse">
                    {toPersianDigits(unreadNotificationsCount)}
                  </span>
                )}
              </button>
            )}

            {/* User Guide Button (Icon Only) */}
            {onOpenUserGuide && (
              <button
                type="button"
                onClick={onOpenUserGuide}
                title="راهنمای کاربری"
                aria-label="راهنمای کاربری"
                className="min-w-11 min-h-11 p-2.5 text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 rounded-[10px] border border-white/10 transition-all shrink-0 cursor-pointer flex items-center justify-center my-auto"
              >
                <CircleHelp className="w-4 h-4" />
              </button>
            )}

            {/* If not logged in, show simple login button */}
            {!currentUser && (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className={`flex items-center gap-1.5 px-3 py-2 ${palette.accentBg} ${palette.accentHover} text-white rounded-[10px] text-xs font-semibold shadow-sm transition-colors cursor-pointer my-auto`}
              >
                <LogIn className="w-4 h-4" />
                <span>ورود</span>
              </button>
            )}

            {/* On desktop the page and sidebar already expose the primary action. */}
            {onOpenCreateModal && (
            <button
              type="button"
              onClick={onOpenCreateModal}
              title="افزودن فعالیت جدید"
              aria-label="افزودن فعالیت جدید"
              className="hidden sm:flex lg:hidden min-w-11 min-h-11 items-center justify-center p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[10px] shadow-sm transition-colors shrink-0 cursor-pointer my-auto"
            >
              <Plus className="w-4 h-4" />
            </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};

