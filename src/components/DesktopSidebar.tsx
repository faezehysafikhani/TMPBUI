import React from 'react';
import {
  Kanban, Calendar, AlertCircle, Settings, LogOut, MessageSquare, FileText, PanelRightClose, Plus, BarChart3, UserCog,
  UserX, Archive, Inbox, Timer, ClipboardCheck,
} from 'lucide-react';
import { toPersianDigits } from '../utils/helpers';
import { AppColorPalette, User as UserType } from '../types';
import { useBranding } from '../utils/branding';
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
  /** Whether a section is available to the user (permissions); all are when omitted. */
  canOpenTab?: (tab: ActiveTab) => boolean;
}

/** Width of the sidebar; the header and the page leave this much room on the right while it is open. */
export const SIDEBAR_WIDTH_CLASS = 'w-64';

interface NavItem {
  tab: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  /** Red badge (something is late) rather than the neutral one. */
  alert?: boolean;
}

/**
 * The main navigation, full height on the right (RTL): the brand, «افزودن فعالیت», the pages the user may open
 * (with counts), settings and sign-out, and the progress of the user's tasks at the bottom. Hidden on small
 * screens (the bottom bar and the menu drawer take over there) and when the user collapses it.
 */
export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenCreateModal,
  onLogout,
  overdueCount,
  unreadChatCount = 0,
  totalTasks = 0,
  completedTasks = 0,
  currentUser,
  isOpen = true,
  onToggleOpen,
  canOpenTab = (_tab: ActiveTab) => true,
}) => {
  const brand = useBranding();
  if (!isOpen) return null;

  const work: NavItem[] = [
    { tab: 'kanban', label: 'بورد فعالیت‌ها', icon: Kanban },
    { tab: 'calendar', label: 'تقویم', icon: Calendar },
    { tab: 'chat', label: 'گفتگوی تیمی', icon: MessageSquare, badge: unreadChatCount },
    { tab: 'notes', label: 'یادداشت شخصی', icon: FileText },
    { tab: 'overdue', label: 'موعد گذشته', icon: AlertCircle, badge: overdueCount, alert: true },
    { tab: 'reports', label: 'گزارشات', icon: BarChart3 },
    { tab: 'requests', label: 'درخواست‌ها', icon: Inbox },
    { tab: 'timesheets', label: 'ساعت کار', icon: Timer },
    { tab: 'approvals', label: 'کارتابل تأیید', icon: ClipboardCheck },
    { tab: 'archive', label: 'بایگانی', icon: Archive },
    { tab: 'substitution', label: 'کارتابل جانشینی', icon: UserCog },
    { tab: 'unplaced', label: 'افراد بدون پست', icon: UserX },
  ].filter((item) => canOpenTab(item.tab as ActiveTab)) as NavItem[];

  const progress = totalTasks > 0 ? Math.min(100, Math.round((completedTasks / totalTasks) * 100)) : 0;

  const item = ({ tab, label, icon: Icon, badge, alert }: NavItem) => {
    const active = activeTab === tab;
    return (
      <button
        key={tab}
        type="button"
        onClick={() => setActiveTab(tab)}
        aria-current={active ? 'page' : undefined}
        className={`w-full flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-600 ${
          active
            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
        }`}
      >
        <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
        <span className="flex-1 truncate text-right">{label}</span>
        {!!badge && badge > 0 && (
          <span className={`min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
            alert ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300' : 'bg-indigo-600 text-white'
          }`}>
            {toPersianDigits(badge > 99 ? '99+' : badge)}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Keeps the sidebar's width free in the page row; the sidebar itself is fixed to the screen. */}
      <div className={`hidden lg:block ${SIDEBAR_WIDTH_CLASS} shrink-0`} aria-hidden="true" />
      <aside
        aria-label="منوی اصلی"
        className={`hidden lg:flex flex-col ${SIDEBAR_WIDTH_CLASS} fixed top-0 right-0 bottom-0 z-30 bg-white dark:bg-slate-900 border-l border-slate-200/80 dark:border-slate-800`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 h-16 px-4 shrink-0">
          <img
            src={brand.logo}
            style={{ visibility: brand.ready ? 'visible' : 'hidden' }}
            alt=""
            className="w-10 h-10 rounded-xl object-cover shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold leading-5 text-slate-900 dark:text-white line-clamp-2" title={brand.name}>{brand.name}</p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">مدیریت یکپارچهٔ فعالیت‌ها</p>
          </div>
          {onToggleOpen && (
            <button
              type="button"
              onClick={onToggleOpen}
              title="بستن منو"
              aria-label="بستن منو"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="px-3 pt-2 pb-3 shrink-0">
          {onOpenCreateModal && (
            <button
              type="button"
              onClick={onOpenCreateModal}
              className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm shadow-indigo-600/25 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <Plus className="w-4 h-4" />
              افزودن فعالیت
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
          <p className="px-3 pt-1 pb-2 text-[11px] font-bold text-slate-400 dark:text-slate-500">فضای کاری</p>
          {work.map(item)}

          <p className="px-3 pt-4 pb-2 text-[11px] font-bold text-slate-400 dark:text-slate-500">حساب</p>
          {item({ tab: 'settings', label: 'تنظیمات و پروفایل', icon: Settings })}
          {currentUser && onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              <LogOut className="w-[18px] h-[18px] shrink-0" />
              <span className="flex-1 text-right">خروج از حساب</span>
            </button>
          )}
        </nav>

        {/* Progress of the user's tasks */}
        {totalTasks > 0 && (
          <div className="m-3 mt-0 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 shrink-0">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-200">پیشرفت فعالیت‌ها</span>
              <span className="font-extrabold text-indigo-600 dark:text-indigo-400 tabular-nums">{toPersianDigits(progress)}٪</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="پیشرفت فعالیت‌ها">
              <div className="h-full rounded-full bg-indigo-600 transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {toPersianDigits(completedTasks)} از {toPersianDigits(totalTasks)} فعالیت خاتمه یافته
            </p>
          </div>
        )}
      </aside>
    </>
  );
};
