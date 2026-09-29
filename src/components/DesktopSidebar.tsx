import React from 'react';
import { Kanban, Calendar, AlertCircle, CheckSquare, MessageSquare, FileText, PanelRightClose, PanelRightOpen, Plus } from 'lucide-react';
import { toPersianDigits } from '../utils/helpers';
import { AppColorPalette } from '../types';
import { COLOR_PALETTES } from '../utils/theme';
import { ActiveTab } from './SandwichBar';

interface DesktopSidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenCreateModal?: () => void;
  overdueCount: number;
  unreadChatCount?: number;
  appColorPalette?: AppColorPalette;
  totalTasks?: number;
  completedTasks?: number;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  /** Whether a section is available to the user (permissions); all are when omitted. */
  canOpenTab?: (tab: ActiveTab) => boolean;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenCreateModal,
  overdueCount,
  unreadChatCount = 0,
  appColorPalette = 'indigo',
  totalTasks = 0,
  completedTasks = 0,
  isOpen = true,
  onToggleOpen,
  canOpenTab = (_tab: ActiveTab) => true,
}) => {
  const palette = COLOR_PALETTES[appColorPalette] || COLOR_PALETTES.indigo;

  if (!isOpen) {
    return (
      <aside className="tm-sidebar hidden lg:flex w-16 shrink-0 flex-col items-center rounded-[14px] border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-[#15172D] lg:min-h-[calc(100vh-7rem)] sticky top-24">
        <button
          type="button"
          onClick={onToggleOpen}
          title="نمایش منوی اصلی"
          aria-label="نمایش منوی اصلی"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-[10px] text-indigo-600 transition-colors hover:bg-indigo-50 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300 dark:hover:bg-indigo-950/60"
        >
          <PanelRightOpen className="h-5 w-5" />
        </button>
        {onOpenCreateModal && (
          <button
            type="button"
            onClick={onOpenCreateModal}
            title="افزودن فعالیت"
            aria-label="افزودن فعالیت"
            className="mt-2 flex min-h-11 min-w-11 items-center justify-center rounded-[10px] bg-indigo-600 text-white transition-colors hover:bg-indigo-700"
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
      </aside>
    );
  }

  return (
    <aside className="tm-sidebar hidden lg:flex flex-col w-60 shrink-0 gap-4 p-3 bg-white dark:bg-[#15172D] border border-slate-200 dark:border-slate-800 rounded-[14px] lg:min-h-[calc(100vh-7rem)] sticky top-24 animate-in fade-in slide-in-from-right-4 duration-200">
      
      {onOpenCreateModal && (
        <button
          type="button"
          onClick={onOpenCreateModal}
          className="w-full min-h-11 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm rounded-[10px] shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 shrink-0" />
          <span>افزودن فعالیت</span>
        </button>
      )}

      {/* Navigation Section */}
      <div className="space-y-1">
        <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>منوی دسترسی</span>
          {onToggleOpen && (
            <button
              type="button"
              onClick={onToggleOpen}
              title="مخفی‌سازی منوی سمت راست"
              aria-label="مخفی‌سازی منوی اصلی"
              className="min-h-10 min-w-10 rounded-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-center"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 1. Kanban View */}
        {canOpenTab('kanban') && (
        <button
          type="button"
          onClick={() => setActiveTab('kanban')}
          aria-current={activeTab === 'kanban' ? 'page' : undefined}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[10px] text-xs font-bold transition-all cursor-pointer ${
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
        )}

        {/* 2. Jalali Calendar View */}
        {canOpenTab('calendar') && (
        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          aria-current={activeTab === 'calendar' ? 'page' : undefined}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[10px] text-xs font-bold transition-all cursor-pointer ${
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
        )}

        {/* 3. Team Chat */}
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          aria-current={activeTab === 'chat' ? 'page' : undefined}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[10px] text-xs font-bold transition-all cursor-pointer ${
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
        {canOpenTab('notes') && (
        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          aria-current={activeTab === 'notes' ? 'page' : undefined}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[10px] text-xs font-bold transition-all cursor-pointer ${
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
        )}

        {/* 5. Overdue Tasks View */}
        {canOpenTab('overdue') && (
        <button
          type="button"
          onClick={() => setActiveTab('overdue')}
          aria-current={activeTab === 'overdue' ? 'page' : undefined}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[10px] text-xs font-bold transition-all cursor-pointer ${
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
        )}
      </div>

      {/* Progress Summary Widget */}
      {totalTasks > 0 && (
        <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-[10px] flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
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
