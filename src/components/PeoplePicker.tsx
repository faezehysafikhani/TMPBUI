// Search-and-pick list of people: nothing is chosen by default; the chosen ones show as chips and
// the dropdown opens on focus with a name/username search.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface PickablePerson {
  id: string;
  name?: string;
  username?: string;
}

interface PeoplePickerProps {
  people: PickablePerson[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  placeholder?: string;
}

const labelOf = (p: PickablePerson) => p.name || p.username || 'کاربر';

export default function PeoplePicker({ people, selectedIds, onToggle, placeholder = 'جستجوی نام یا نام کاربری...' }: PeoplePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const selected = useMemo(
    () => selectedIds.map((id) => people.find((p) => p.id === id)).filter((p): p is PickablePerson => !!p),
    [people, selectedIds],
  );
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => people.filter((p) => !q || labelOf(p).toLowerCase().includes(q) || (p.username || '').toLowerCase().includes(q)),
    [people, q],
  );

  return (
    <div ref={rootRef} className="space-y-1.5">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-1 pl-1 pr-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold">
              {labelOf(p)}
              <button type="button" aria-label={`حذف ${labelOf(p)}`} onClick={() => onToggle(p.id)} className="p-0.5 rounded hover:bg-emerald-700 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute right-2.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            className="w-full pl-8 pr-8 py-1.5 bg-slate-50 dark:bg-slate-800 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
          />
          <button type="button" aria-label="نمایش فهرست افراد" onClick={() => setOpen((v) => !v)} className="absolute left-2 p-0.5 text-slate-400 cursor-pointer">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {open && (
          <div className="absolute z-50 top-full mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-52 overflow-y-auto p-1 space-y-0.5">
            {filtered.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-400">کاربری یافت نشد.</div>
            ) : (
              filtered.map((p) => {
                const on = selectedIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => onToggle(p.id)}
                    className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs text-right cursor-pointer ${
                      on ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-100' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <span className="truncate font-semibold">{labelOf(p)}{p.username && p.name ? <span className="text-[10px] text-slate-400 font-normal"> @{p.username}</span> : null}</span>
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 dark:border-slate-600'}`}>
                      {on && <Check className="w-3 h-3 text-white" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
