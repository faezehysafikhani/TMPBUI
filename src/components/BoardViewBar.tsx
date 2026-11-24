import React, { useEffect, useRef } from 'react';
import { Check, Columns3, UserCheck, Users, AlertTriangle, CalendarDays, Tag, ListOrdered, Grid3x3 } from 'lucide-react';
import { BoardGroupBy, BoardViewSettings } from '../utils/boardView';

interface BoardViewBarProps {
  settings: BoardViewSettings;
  onChange: (next: BoardViewSettings) => void;
  onClose: () => void;
}

/** Short names and one line each, so the list reads at a glance. */
const OPTIONS: { id: BoardGroupBy; icon: React.ElementType; label: string; hint: string }[] = [
  { id: 'status', icon: Columns3, label: 'وضعیت', hint: 'کانبان: شروع نشده تا خاتمه یافته' },
  { id: 'responsible', icon: Users, label: 'مسئول', hint: 'یک ستون برای هر مسئول' },
  { id: 'owner', icon: UserCheck, label: 'مالک', hint: 'یک ستون برای هر ایجادکننده' },
  { id: 'priority', icon: AlertTriangle, label: 'اولویت', hint: 'زیاد، متوسط و کم' },
  { id: 'dueDate', icon: CalendarDays, label: 'موعد انجام', hint: 'عقب‌افتاده، امروز، هفت روز آینده و بعد' },
  { id: 'tag', icon: Tag, label: 'برچسب', hint: 'یک ستون برای هر برچسب' },
  { id: 'matrix', icon: Grid3x3, label: 'ماتریس اهمیت و فوریت', hint: 'نه خانه: اهمیت (اولویت) و فوریت (موعد)' },
  { id: 'none', icon: ListOrdered, label: 'فهرست ساده', hint: 'همه در یک جدول، بدون گروه' },
];

const Switch: React.FC<{ label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }> = ({ label, hint, checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-right hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
  >
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span>
      <span className="block text-xs text-slate-400">{hint}</span>
    </span>
    <span className={`relative inline-flex w-9 h-5 shrink-0 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'right-0.5' : 'right-[18px]'}`} />
    </span>
  </button>
);

/**
 * «گروه‌بندی و نما»: a menu under its toolbar button - how the board groups its cards (one choice) and what
 * the cards show. Closes on a click outside or Escape.
 */
export const BoardViewBar: React.FC<BoardViewBarProps> = ({ settings, onChange, onClose }) => {
  const set = (patch: Partial<BoardViewSettings>) => onChange({ ...settings, ...patch });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = ref.current;
      if (el && !el.contains(e.target as Node) && !(el.parentElement?.contains(e.target as Node))) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="گروه‌بندی و نما"
      dir="rtl"
      className="absolute z-30 top-full mt-2 right-0 w-[min(20rem,calc(100vw-2rem))] p-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl animate-in fade-in zoom-in-95 duration-150"
    >
      <p className="px-3 pt-1.5 pb-1 text-xs font-bold text-slate-400">گروه‌بندی بر اساس</p>
      <div role="radiogroup" aria-label="گروه‌بندی کارت‌ها">
        {OPTIONS.map(({ id, icon: Icon, label, hint }) => {
          const active = settings.groupBy === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={label}
              onClick={() => set({ groupBy: id })}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-right cursor-pointer transition-colors ${
                active ? 'bg-indigo-50 dark:bg-indigo-950/60' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
              <span className="flex-1 min-w-0">
                <span className={`block text-sm font-semibold ${active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-100'}`}>{label}</span>
                <span className="block text-xs text-slate-400 truncate">{hint}</span>
              </span>
              {active && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />}
            </button>
          );
        })}
      </div>
      <div className="my-2 border-t border-slate-100 dark:border-slate-800" />
      <p className="px-3 pt-1 pb-1 text-xs font-bold text-slate-400">نمایش</p>
      <Switch label="جزئیات کارت" hint="مالک، مسئول و برچسب‌ها روی کارت" checked={settings.showDetails} onChange={(showDetails) => set({ showDetails })} />
      <Switch label="فقط فعالیت‌های جاری" hint="خاتمه‌یافته‌ها پنهان شوند" checked={settings.currentOnly} onChange={(currentOnly) => set({ currentOnly })} />
    </div>
  );
};
