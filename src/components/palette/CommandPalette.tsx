import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive, BarChart3, Calendar, CalendarDays, ClipboardCheck, CornerDownLeft, FileText, Inbox, Kanban, Keyboard, ListChecks, LockKeyhole,
  MessageSquare, Plus, Search, Settings, Timer, User as UserIcon, Workflow, AlertCircle,
} from 'lucide-react';
import type { Task } from '../../types';
import type { ActiveTab } from '../SandwichBar';
import { requestSettingsSection, requestSettingsTab } from '../../utils/profileEvents';
import { toPersianDigits } from '../../utils/helpers';

interface Command {
  id: string;
  label: string;
  /** Other words that find it (Persian and English). */
  keywords: string;
  group: 'کارها' | 'رفتن به' | 'تنظیمات' | 'فعالیت‌ها';
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
  run: () => void;
}

/** Opens the palette from a button (the header's search box). */
export const OPEN_COMMAND_PALETTE_EVENT = 'nexuscore:open-command-palette';
export const openCommandPalette = () => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT));

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
export const PALETTE_SHORTCUT_LABEL = isMac ? '⌘K' : 'Ctrl+K';

/** Persian/Arabic letters and digits folded so «ي/ی», «ك/ک» and ۱/1 match each other. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ي]/g, 'ی').replace(/[ك]/g, 'ک').replace(/[‌]/g, ' ')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The command palette (CAT-107): Ctrl+K / ⌘K from anywhere opens one search box to go to any page the user may
 * open, make a task, find a task by title or jump to a settings section, without the mouse. Arrow keys move,
 * Enter runs, Esc closes. Shows only what the user is allowed to open.
 */
export const CommandPalette: React.FC<{
  canOpen: (tab: ActiveTab) => boolean;
  goTo: (tab: ActiveTab) => void;
  onNewTask?: () => void;
  tasks: Task[];
  onOpenTask: (task: Task) => void;
}> = ({ canOpen, goTo, onNewTask, tasks, onOpenTask }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  // Ctrl+K / ⌘K toggles it anywhere (also inside text fields: it is not a character anyone types).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K' || e.key === 'ن' || e.code === 'KeyK')) {
        e.preventDefault();
        setOpen((v) => {
          if (!v) returnFocus.current = document.activeElement as HTMLElement | null;
          return !v;
        });
      }
    };
    const onOpen = () => {
      returnFocus.current = document.activeElement as HTMLElement | null;
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      window.setTimeout(() => input.current?.focus(), 0);
    } else {
      returnFocus.current?.focus?.();
    }
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const page = (tab: ActiveTab, label: string, keywords: string, icon: Command['icon']): Command[] =>
      canOpen(tab) ? [{ id: `go:${tab}`, label, keywords, group: 'رفتن به', icon, run: () => goTo(tab) }] : [];
    const setting = (tab: string, label: string, keywords: string, icon: Command['icon']): Command => ({
      id: `settings:${tab}`, label, keywords, group: 'تنظیمات', icon,
      run: () => { requestSettingsTab(tab); goTo('settings'); },
    });
    const section = (tab: string, id: string, label: string, keywords: string, icon: Command['icon']): Command => ({
      id: `settings:${tab}:${id}`, label, keywords, group: 'تنظیمات', icon,
      run: () => { requestSettingsSection(tab, id); goTo('settings'); },
    });
    return [
      ...(onNewTask ? [{ id: 'new-task', label: 'فعالیت جدید', keywords: 'ایجاد افزودن ثبت new task create', group: 'کارها' as const, icon: Plus, run: onNewTask }] : []),
      ...page('kanban', 'بورد کانبان', 'board kanban فعالیت‌ها کارها', Kanban),
      ...page('calendar', 'نمای تقویم', 'calendar جلسه تقویم', Calendar),
      ...page('chat', 'گفتگوی تیمی', 'chat پیام گفتگو', MessageSquare),
      ...page('notes', 'یادداشت شخصی', 'notes یادداشت', FileText),
      ...page('overdue', 'موعد گذشته', 'overdue دیرکرد تاخیر', AlertCircle),
      ...page('reports', 'گزارشات', 'reports گزارش', BarChart3),
      ...page('requests', 'درخواست‌ها', 'requests درخواست intake', Inbox),
      ...page('timesheets', 'ساعت کار', 'timesheet زمان ساعت تایمر', Timer),
      ...page('approvals', 'کارتابل تأیید', 'approvals تایید بازبینی کارتابل', ClipboardCheck),
      ...page('archive', 'بایگانی', 'archive بایگانی', Archive),
      ...page('substitution', 'کارتابل جانشینی', 'substitution جانشین', UserIcon),
      ...page('unplaced', 'کارتابل افراد بدون پست', 'unplaced بدون پست', UserIcon),
      setting('profile', 'پروفایل و رمز عبور', 'profile password رمز پروفایل آواتار', UserIcon),
      setting('task-settings', 'تنظیمات فعالیت', 'statuses templates وضعیت قالب فیلد wip', ListChecks),
      setting('automation', 'اتوماسیون و قواعد خودکار', 'automation rules sla قاعده اتوماسیون', Workflow),
      section('automation', 'work-calendar', 'تقویم کاری', 'work calendar holidays تعطیلات روز کاری ساعت کاری تقویم کاری', CalendarDays),
      section('automation', 'approvals', 'مسیرهای تأیید', 'approval chain workflow مسیر تایید تأیید', ClipboardCheck),
      setting('security', 'امنیت و حساب‌ها', 'security service account plan پلن حساب سرویس رمز', LockKeyhole),
      setting('users', 'مدیریت کاربران', 'users کاربران نقش ldap', UserIcon),
      setting('appearance', 'ظاهر سامانه', 'theme appearance تم رنگ ظاهر', Settings),
    ];
  }, [canOpen, goTo, onNewTask]);

  const q = fold(query);
  const results = useMemo<Command[]>(() => {
    const matching = q ? commands.filter((c) => fold(`${c.label} ${c.keywords}`).includes(q)) : commands;
    // Tasks by title (the ones the user can see), only while searching.
    const taskHits: Command[] = q.length >= 2
      ? tasks.filter((t) => fold(t.title).includes(q)).slice(0, 8).map((t) => ({
        id: `task:${t.id}`, label: t.title, keywords: '', group: 'فعالیت‌ها' as const, icon: Search,
        hint: t.isProject ? 'پروژه' : undefined,
        run: () => onOpenTask(t),
      }))
      : [];
    return [...matching, ...taskHits];
  }, [commands, tasks, q, onOpenTask]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const run = (c: Command | undefined) => {
    if (!c) return;
    setOpen(false);
    window.setTimeout(c.run, 0);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(results[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); }
  };

  let lastGroup = '';
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh] bg-slate-950/50 backdrop-blur-xs" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="جستجو و فرمان‌ها" dir="rtl" className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden" onKeyDown={onKeyDown}>
        <div className="flex items-center gap-2 px-4 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={input}
            id="command-palette-input"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
            className="flex-1 py-4 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden"
            placeholder="کجا بروید یا چه کنید؟ مثلاً «ساعت کار»، «فعالیت جدید» یا عنوان یک فعالیت"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="text-[10px] font-bold text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div ref={list} id="command-palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 && <p className="p-6 text-center text-sm text-slate-400">چیزی پیدا نشد.</p>}
          {results.map((c, i) => {
            const header = c.group !== lastGroup ? (lastGroup = c.group) : null;
            const Icon = c.icon;
            return (
              <React.Fragment key={c.id}>
                {header && <div className="px-3 pt-2 pb-1 text-[11px] font-bold text-slate-400">{header}</div>}
                <button
                  type="button"
                  id={`cmd-${c.id}`}
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(c)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right text-sm cursor-pointer ${i === active ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200' : 'text-slate-700 dark:text-slate-200'}`}
                >
                  <Icon className="w-4 h-4 shrink-0 opacity-70" />
                  <span className="flex-1 truncate font-semibold">{c.label}</span>
                  {c.hint && <span className="text-[11px] text-slate-400">{c.hint}</span>}
                  {i === active && <CornerDownLeft className="w-3.5 h-3.5 opacity-60" />}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1"><Keyboard className="w-3.5 h-3.5" /> ↑ ↓ برای حرکت، Enter برای اجرا</span>
          <span className="mr-auto">{toPersianDigits(results.length)} مورد · {PALETTE_SHORTCUT_LABEL}</span>
        </div>
      </div>
    </div>
  );
};
