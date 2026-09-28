import React, { useState } from 'react';
import { Kanban, Calendar, Plus, AlertCircle, Settings, MessageSquare, FileText, MoreHorizontal, X } from 'lucide-react';
import { toPersianDigits } from '../utils/helpers';
import { AppColorPalette } from '../types';
import { COLOR_PALETTES } from '../utils/theme';

export type ActiveTab = 'kanban' | 'calendar' | 'overdue' | 'chat' | 'notes' | 'settings';

interface SandwichBarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  /** Omitted when the user may not create tasks: the add button is not shown. */
  onOpenCreateModal?: () => void;
  onOpenSettings?: () => void;
  /** Whether a section is available to the user (permissions); all are when omitted. */
  canOpenTab?: (tab: ActiveTab) => boolean;
  overdueCount: number;
  unreadChatCount?: number;
  appColorPalette?: AppColorPalette;
}

/**
 * Mobile's bottom navigation. Team Chat is a direct tab (it's a daily-use module, per the UX
 * review it must never be effectively hidden on mobile) - Settings is not, since the header's
 * account menu already reaches it on every viewport, so it would be a second, harder-to-find
 * path to the same place. Notes and Settings sit behind a plainly-labeled "بیشتر" (not an
 * unexplained icon) so they stay one tap away without crowding the five primary destinations.
 */
export const SandwichBar: React.FC<SandwichBarProps> = ({
  activeTab,
  setActiveTab,
  onOpenCreateModal,
  overdueCount,
  unreadChatCount = 0,
  appColorPalette = 'indigo',
  canOpenTab = (_tab: ActiveTab) => true,
}) => {
  const palette = COLOR_PALETTES[appColorPalette] || COLOR_PALETTES.indigo;
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const isInMoreMenu = activeTab === 'notes' || activeTab === 'settings';

  return (
    <>
      {/* Backdrop when the "بیشتر" menu is open */}
      {isMoreMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/25 backdrop-blur-[2px] transition-opacity"
          onClick={() => setIsMoreMenuOpen(false)}
        />
      )}

      {/* Main Bottom Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/90 shadow-2xl py-2 px-3 sm:px-6">
        <div className="w-full max-w-xl mx-auto flex items-center justify-around sm:justify-center gap-1 sm:gap-4">

          {/* 1. Kanban / Card View Button */}
          {canOpenTab('kanban') && (
          <button
            type="button"
            onClick={() => setActiveTab('kanban')}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-full transition-all cursor-pointer ${
              activeTab === 'kanban'
                ? `${palette.accentBg} text-white font-bold shadow-md shadow-slate-950 ring-2 ring-white/20`
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
            }`}
            title="بورد کانبان (نمای کارت)"
          >
            <Kanban className="w-6.5 h-6.5 shrink-0" />
            <span className="text-xs hidden sm:inline">کانبان</span>
          </button>
          )}

          {/* 2. Calendar View Button */}
          {canOpenTab('calendar') && (
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-full transition-all cursor-pointer ${
              activeTab === 'calendar'
                ? `${palette.accentBg} text-white font-bold shadow-md shadow-slate-950 ring-2 ring-white/20`
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
            }`}
            title="نمای تقویم"
          >
            <Calendar className="w-6.5 h-6.5 shrink-0" />
            <span className="text-xs hidden sm:inline">تقویم</span>
          </button>
          )}

          {/* 3. Central Add Task Plus Button */}
          {onOpenCreateModal && (
          <button
            type="button"
            onClick={onOpenCreateModal}
            className={`w-12 h-12 sm:w-14 sm:h-14 ${palette.accentBg} ${palette.accentHover} active:scale-95 text-white rounded-full flex items-center justify-center shadow-xl shadow-slate-950 transition-all cursor-pointer mx-1 shrink-0 ring-4 ring-slate-900`}
            title="افزودن فعالیت جدید"
            aria-label="افزودن فعالیت"
          >
            <Plus className="w-7.5 h-7.5 sm:w-8.5 sm:h-8.5 stroke-[2.5]" />
          </button>
          )}

          {/* 4. Overdue Tasks Button */}
          {canOpenTab('overdue') && (
          <button
            type="button"
            onClick={() => setActiveTab('overdue')}
            className={`relative flex items-center gap-1.5 px-2.5 py-2 rounded-full transition-all cursor-pointer ${
              activeTab === 'overdue'
                ? 'bg-rose-600 text-white font-bold shadow-md shadow-rose-950 ring-2 ring-white/20'
                : 'text-slate-400 hover:text-rose-400 hover:bg-rose-950/40'
            }`}
            title="فعالیت‌های از موعد گذشته"
          >
            <AlertCircle className="w-6.5 h-6.5 shrink-0" />
            <span className="text-xs hidden sm:inline">موعد گذشته</span>
            {overdueCount > 0 && (
              <span
                className={`absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold border ${
                  activeTab === 'overdue'
                    ? 'bg-white text-rose-700 border-rose-200'
                    : 'bg-rose-600 text-white border-slate-900 animate-pulse'
                }`}
              >
                {toPersianDigits(overdueCount)}
              </span>
            )}
          </button>
          )}

          {/* 5. Team Chat: a real daily-use module, so it gets a direct tab like the others -
              not tucked behind another menu. */}
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`relative flex items-center gap-1.5 px-2.5 py-2 rounded-full transition-all cursor-pointer ${
              activeTab === 'chat'
                ? `${palette.accentBg} text-white font-bold shadow-md shadow-slate-950 ring-2 ring-white/20`
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
            }`}
            title="گفتگوی تیمی"
          >
            <MessageSquare className="w-6.5 h-6.5 shrink-0" />
            <span className="text-xs hidden sm:inline">گفتگو</span>
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-600 text-white font-black text-[10px] animate-pulse border border-slate-900">
                {toPersianDigits(unreadChatCount)}
              </span>
            )}
          </button>

          {/* 6. "بیشتر": Notes and Settings, plainly labeled instead of an unexplained icon */}
          <div className="relative flex flex-col items-center">
            {isMoreMenuOpen && (
              <div className="absolute bottom-full left-0 mb-3 flex flex-col items-stretch gap-1 z-50 w-40 bg-slate-800 rounded-[14px] shadow-2xl border border-slate-700/80 p-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
                {canOpenTab('notes') && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      setActiveTab('notes');
                    }}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-xs font-bold transition-colors cursor-pointer ${
                      activeTab === 'notes' ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <FileText className="w-4.5 h-4.5 shrink-0" />
                    <span>یادداشت شخصی</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    setActiveTab('settings');
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-xs font-bold transition-colors cursor-pointer ${
                    activeTab === 'settings' ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  <Settings className="w-4.5 h-4.5 shrink-0" />
                  <span>تنظیمات و پروفایل</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-full transition-all cursor-pointer ${
                isMoreMenuOpen || isInMoreMenu
                  ? `${palette.accentBg} text-white font-bold shadow-md shadow-slate-950 ring-2 ring-white/20`
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
              }`}
              title="بیشتر: یادداشت شخصی و تنظیمات"
              aria-expanded={isMoreMenuOpen}
            >
              {isMoreMenuOpen ? <X className="w-6.5 h-6.5 shrink-0" /> : <MoreHorizontal className="w-6.5 h-6.5 shrink-0" />}
              <span className="text-xs hidden sm:inline">بیشتر</span>
            </button>
          </div>

        </div>
      </div>
    </>
  );
};
