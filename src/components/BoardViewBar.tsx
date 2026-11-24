import React from 'react';
import { X, Columns3, UserCheck, Users, AlertTriangle, CalendarDays, Tag, ListOrdered, Grid3x3 } from 'lucide-react';
import { BoardGroupBy, BoardViewSettings, BOARD_GROUP_LABELS } from '../utils/boardView';

interface BoardViewBarProps {
  settings: BoardViewSettings;
  onChange: (next: BoardViewSettings) => void;
  onClose: () => void;
}

const OPTIONS: { id: BoardGroupBy; icon: React.ElementType; wide?: boolean }[] = [
  { id: 'status', icon: Columns3 },
  { id: 'owner', icon: UserCheck },
  { id: 'responsible', icon: Users },
  { id: 'priority', icon: AlertTriangle },
  { id: 'dueDate', icon: CalendarDays },
  { id: 'tag', icon: Tag },
  { id: 'matrix', icon: Grid3x3 },
  { id: 'none', icon: ListOrdered, wide: true },
];

const Switch: React.FC<{ label: string; title: string; checked: boolean; onChange: (value: boolean) => void }> = ({ label, title, checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    title={title}
    onClick={() => onChange(!checked)}
    className="inline-flex items-center gap-2 h-9 px-3 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-colors"
  >
    <span className={`relative inline-flex w-8 h-[18px] shrink-0 rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
      <span className={`absolute top-[3px] w-3 h-3 rounded-full bg-white shadow transition-all ${checked ? 'right-[3px]' : 'right-[17px]'}`} />
    </span>
    {label}
  </button>
);

/** «گروه‌بندی و نما»: how the board groups its cards and what they show - one compact row under the toolbar. */
export const BoardViewBar: React.FC<BoardViewBarProps> = ({ settings, onChange, onClose }) => {
  const set = (patch: Partial<BoardViewSettings>) => onChange({ ...settings, ...patch });

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800" dir="rtl">
      <span className="px-2 text-xs font-bold text-slate-400 dark:text-slate-500">گروه‌بندی</span>
      <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0" role="radiogroup" aria-label="گروه‌بندی کارت‌ها">
        {OPTIONS.map(({ id, icon: Icon }) => {
          const active = settings.groupBy === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => set({ groupBy: id })}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
              {BOARD_GROUP_LABELS[id]}
            </button>
          );
        })}
      </div>
      <span className="hidden md:block w-px h-6 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
      <Switch label="جزئیات کارت" title="تگ‌های مالک، مسئول و برچسب روی کارت‌ها" checked={settings.showDetails} onChange={(showDetails) => set({ showDetails })} />
      <Switch label="فقط جاری" title="فقط فعالیت‌های خاتمه‌نیافته" checked={settings.currentOnly} onChange={(currentOnly) => set({ currentOnly })} />
      <button type="button" onClick={onClose} title="بستن" aria-label="بستن گروه‌بندی و نما" className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-white dark:hover:bg-slate-800 cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
