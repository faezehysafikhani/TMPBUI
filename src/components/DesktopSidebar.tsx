import React from 'react';
import { Kanban, Calendar, AlertCircle, Settings, CheckSquare, LogOut, MessageSquare, FileText, PanelRightClose, Plus } from 'lucide-react';
import { toPersianDigits } from '../utils/helpers';
import { AppColorPalette, User as UserType } from '../types';
import { COLOR_PALETTES } from '../utils/theme';
import { ActiveTab } from './SandwichBar';

interface DesktopSidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenCreateModal?: () => void;
  onOpenSettings: () => void;
  onOpenPdfCatalog?: () => void;
  onLogout?: () => void;
  overdueCount: number;
  unreadChatCount?: number;
  appColorPalette?: AppColorPalette;
  totalTasks?: number;
  completedTasks?: number;
  currentUser?: UserType | null;
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenCreateModal,
  onOpenSettings,
  onOpenPdfCatalog,
  onLogout,
  overdueCount,
  unreadChatCount = 0,
  appColorPalette = 'indigo',
  totalTasks = 0,
  completedTasks = 0,
  currentUser,
  isOpen = true,
  onToggleOpen,
}) => {
  const palette = COLOR_PALETTES[appColorPalette] || COLOR_PALETTES.indigo;

  if (!isOpen) {
    return null;
  }

  return (
    <aside className="hidden lg:flex flex-col w-48 shrink-0 gap-3 p-2.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-sm h-fit sticky top-20 animate-in fade-in slide-in-from-right-4 duration-300">
      
      {onOpenCreateModal && (
        <button
          type="button"
          onClick={onOpenCreateModal}
          className={`w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-tr ${palette.gradientFromTo} text-white font-bold text-xs rounded-xl shadow-sm hover:opacity-90 active:scale-98 transition-all cursor-pointer`}
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>افزودن فعالیت</span>
        </button>
      )}

      {/* Navigation Section */}
      <div className="space-y-1">
        <div className="flex items-center justify-between px-2 py-0.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          <span>منوی دسترسی</span>
          {onToggleOpen && (
            <button
              type="button"
              onClick={onToggleOpen}
              title="مخفی‌سازی منوی سمت راست"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 1. Kanban View */}
        <button
          type="button"
          onClick={() => setActiveTab('kanban')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'kanban'
              ? `${palette.accentBg} text-white shadow-md shadow-indigo-950/20`
              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <Kanban className="w-4 h-4 shrink-0" />
            <span className="truncate">بورد کانبان</span>
          </div>
        </button>

        {/* 2. Jalali Calendar View */}
        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'calendar'
              ? `${palette.accentBg} text-white shadow-md shadow-indigo-950/20`
              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 shrink-0" />
            <span className="truncate">نمای تقویم</span>
          </div>
        </button>

        {/* 3. Team Chat */}
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'chat'
              ? `${palette.accentBg} text-white shadow-md shadow-indigo-950/20`
              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span className="truncate">گفتگوی تیمی</span>
          </div>
          {unreadChatCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white font-black text-[9px] animate-pulse">
              {toPersianDigits(unreadChatCount)}
            </span>
          )}
        </button>

        {/* 4. Personal Notes */}
        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'notes'
              ? `${palette.accentBg} text-white shadow-md shadow-indigo-950/20`
              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 shrink-0" />
            <span className="truncate">یادداشت شخصی</span>
          </div>
        </button>

        {/* 5. Overdue Tasks View */}
        <button
          type="button"
          onClick={() => setActiveTab('overdue')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'overdue'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-950/20'
              : 'text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">موعد گذشته</span>
          </div>
          {overdueCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                activeTab === 'overdue'
                  ? 'bg-white text-rose-700'
                  : 'bg-rose-500 text-white animate-pulse'
              }`}
            >
              {toPersianDigits(overdueCount)}
            </span>
          )}
        </button>
      </div>


      <div className="border-t border-slate-100 dark:border-slate-800/80 my-0.5" />

      {/* System & Settings Section */}
      <div className="space-y-1">
        <div className="px-2 py-0.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          تنظیمات برنامه
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'settings'
              ? `${palette.accentBg} text-white shadow-md shadow-indigo-950/20`
              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
          }`}
        >
          <Settings className={`w-4 h-4 shrink-0 ${activeTab === 'settings' ? 'text-white' : 'text-slate-400'}`} />
          <span className="truncate">تنظیمات و پروفایل</span>
        </button>

        {currentUser && onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="truncate">خروج از حساب</span>
          </button>
        )}
      </div>

      {/* Progress Summary Widget */}
      {totalTasks > 0 && (
        <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-xl flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <div>
              <div className="font-bold text-[11px] text-slate-800 dark:text-slate-200">
                وضعیت پیشرفت
              </div>
              <div className="mt-0.5 text-[9px]">
                {toPersianDigits(completedTasks)} از {toPersianDigits(totalTasks)} فعالیت
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
