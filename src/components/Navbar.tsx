import React from 'react';
import { Plus, LogIn, Bell, LayoutDashboard, CircleHelp } from 'lucide-react';
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
  /** Opens the "خلاصه وضعیت" (status summary) view - also exposed here as its own header button. */
  onOpenWelcomeModal?: () => void;
  /** Opens the slide user guide (header "?" button). */
  onOpenUserGuide?: () => void;
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
}) => {
  const palette = COLOR_PALETTES[appColorPalette] || COLOR_PALETTES.indigo;

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
                <div className="flex items-center gap-1.5 mt-0.5" title="حساب کاربری">
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

            {/* Status Summary Button (Icon Only) - moved here from the account dropdown */}
            {currentUser && onOpenWelcomeModal && (
              <button
                type="button"
                onClick={onOpenWelcomeModal}
                title="خلاصه وضعیت"
                aria-label="خلاصه وضعیت"
                className="min-w-11 min-h-11 p-2.5 text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 rounded-[10px] border border-white/10 transition-all shrink-0 cursor-pointer flex items-center justify-center my-auto"
              >
                <LayoutDashboard className="w-4 h-4" />
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

