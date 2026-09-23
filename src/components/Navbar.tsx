import React from 'react';
import { Plus, RefreshCw, Filter, LogIn, Bell, LayoutDashboard, PanelRightClose, PanelRightOpen, CircleHelp } from 'lucide-react';
import { toPersianDigits } from '../utils/helpers';
import { User as UserType, AppTheme, AppColorPalette } from '../types';
import { COLOR_PALETTES } from '../utils/theme';

interface NavbarProps {
  /** Omitted when the user may not create tasks: the add button is not shown. */
  onOpenCreateModal?: () => void;
  totalTasks: number;
  completedTasks: number;
  /** Only on the Kanban page, the one the filters apply to: the filter button is not shown elsewhere. */
  onToggleFilterBar?: () => void;
  isFilterBarOpen: boolean;
  onRefreshData: () => void;
  isSyncing?: boolean;
  currentUser: UserType | null;
  currentTheme: AppTheme;
  appColorPalette?: AppColorPalette;
  onOpenAuthModal: () => void;
  unreadNotificationsCount?: number;
  onOpenNotificationModal?: () => void;
  onOpenWelcomeModal?: () => void;
  /** Opens the slide user guide (header "?" button). */
  onOpenUserGuide?: () => void;
  isDesktopSidebarOpen?: boolean;
  onToggleDesktopSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCreateModal,
  totalTasks,
  completedTasks,
  onToggleFilterBar,
  isFilterBarOpen,
  onRefreshData,
  isSyncing = false,
  currentUser,
  currentTheme,
  appColorPalette = 'indigo',
  onOpenAuthModal,
  unreadNotificationsCount = 0,
  onOpenNotificationModal,
  onOpenWelcomeModal,
  onOpenUserGuide,
  isDesktopSidebarOpen = true,
  onToggleDesktopSidebar,
}) => {
  const palette = COLOR_PALETTES[appColorPalette] || COLOR_PALETTES.indigo;

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-md text-white transition-colors duration-300">
      <div className="w-full max-w-[1920px] mx-auto px-2 sm:px-3 lg:px-3 py-3 sm:py-3.5">
        <div className="flex items-center justify-between gap-3">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3.5">
            <img 
              src="/icon.svg" 
              alt="لوگوی مدیریت وظایف (TM)" 
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl shadow-md shrink-0 object-cover border border-white/20 cursor-pointer hover:opacity-90 transition-opacity" 
              onClick={onOpenWelcomeModal}
            />
            <div>
              <h1 className="text-base sm:text-lg lg:text-xl font-bold text-white tracking-tight flex items-center gap-2 whitespace-nowrap">
                مدیریت وظایف (TM)
              </h1>
              {currentUser ? (
                <button 
                  type="button" 
                  onClick={onOpenWelcomeModal}
                  className="flex items-center gap-1.5 mt-0.5 hover:text-indigo-300 transition-colors cursor-pointer text-right"
                  title="نمایش خلاصه وضعیت کاربری"
                >
                  {currentUser.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name || 'آواتار کاربر'}
                      className="w-4.5 h-4.5 rounded-full object-cover border border-white/30 shrink-0"
                    />
                  ) : null}
                  <p className="text-xs text-indigo-200/90 font-medium truncate">
                    کاربر: {currentUser.name}
                  </p>
                </button>
              ) : (
                <p className="text-xs text-slate-300/80 hidden sm:block mt-0.5">
                  سامانه مدیریت فعالیت‌ها و کانبان بورد
                </p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Dashboard Executive Summary Button */}
            {currentUser && onOpenWelcomeModal && (
              <button
                type="button"
                onClick={onOpenWelcomeModal}
                title="داشبورد خلاصه وضعیت"
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-800 text-indigo-300 hover:text-white rounded-xl text-xs font-semibold border border-indigo-500/30 transition-all shrink-0 cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4 text-indigo-400" />
                <span className="hidden md:inline">خلاصه وضعیت</span>
              </button>
            )}


            {/* Notification Bell Button */}
            {onOpenNotificationModal && (
              <button
                type="button"
                onClick={onOpenNotificationModal}
                title="اطلاعیه‌ها و هشدارها"
                className="relative p-2.5 text-slate-200 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl border border-slate-700/80 transition-all shrink-0 cursor-pointer flex items-center justify-center my-auto"
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
                className="p-2.5 text-slate-200 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl border border-slate-700/80 transition-all shrink-0 cursor-pointer flex items-center justify-center my-auto"
              >
                <CircleHelp className="w-4 h-4" />
              </button>
            )}

            {/* Desktop Sidebar Toggle Button (Hides/Shows Right Sidebar) */}
            {onToggleDesktopSidebar && (
              <button
                type="button"
                onClick={onToggleDesktopSidebar}
                title={isDesktopSidebarOpen ? 'مخفی کردن منوی راست' : 'نمایش منوی راست'}
                className={`hidden lg:flex p-2.5 rounded-xl border transition-all shrink-0 cursor-pointer items-center justify-center my-auto ${
                  !isDesktopSidebarOpen
                    ? `${palette.accentBg} text-white ${palette.accentBorder} shadow-xs ring-2 ring-indigo-400/50`
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border-slate-700/80'
                }`}
              >
                {isDesktopSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
              </button>
            )}

            {/* Filter Toggle Button (Icon Only) - Kanban only */}
            {onToggleFilterBar && (
              <button
                type="button"
                onClick={onToggleFilterBar}
                title={isFilterBarOpen ? 'بستن فیلترها' : 'نمایش فیلترها'}
                className={`p-2.5 rounded-xl border transition-all shrink-0 cursor-pointer flex items-center justify-center my-auto ${
                  isFilterBarOpen
                    ? `${palette.accentBg} text-white ${palette.accentBorder} shadow-xs`
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border-slate-700/80'
                }`}
              >
                <Filter className="w-4 h-4" />
              </button>
            )}

            {/* Refresh Data Button (Icon Only - Centered and Color Palette Styled) */}
            <button
              type="button"
              onClick={onRefreshData}
              title="به‌روزرسانی داده‌ها"
              className="p-2.5 text-slate-200 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl border border-slate-700/80 transition-all shrink-0 cursor-pointer flex items-center justify-center my-auto"
            >
              <RefreshCw
                className={`w-4 h-4 ${palette.accentText} ${
                  isSyncing ? 'animate-spin' : 'hover:scale-110 transition-transform'
                }`}
              />
            </button>

            {/* If not logged in, show simple login button */}
            {!currentUser && (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className={`flex items-center gap-1.5 px-3 py-2 ${palette.accentBg} ${palette.accentHover} text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer my-auto`}
              >
                <LogIn className="w-4 h-4" />
                <span>ورود</span>
              </button>
            )}

            {/* Add Task Button (Icon Only on Desktop Header) */}
            {onOpenCreateModal && (
            <button
              type="button"
              onClick={onOpenCreateModal}
              title="افزودن فعالیت جدید"
              className={`hidden sm:flex items-center justify-center p-2.5 bg-gradient-to-tr ${palette.gradientFromTo} text-white rounded-xl shadow-sm transition-all shrink-0 cursor-pointer hover:opacity-90 active:scale-98 my-auto`}
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

