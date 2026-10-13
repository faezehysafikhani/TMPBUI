import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toPersianDigits } from '../utils/helpers';
import {
  getCurrentJalali, getJalaliHoliday, getJalaliMonthDays, getJalaliMonthFirstDayOfWeek, gregorianToJalali, jalaliToGregorian,
} from '../utils/jalali';

const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

interface JalaliDay { jy: number; jm: number; jd: number }

function toJalali(isoDate: string): JalaliDay | null {
  const [gy, gm, gd] = isoDate.split('-').map(Number);
  return gy && gm && gd ? gregorianToJalali(gy, gm, gd) : null;
}

function toIso({ jy, jm, jd }: JalaliDay): string {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}

const same = (a: JalaliDay | null, b: JalaliDay) => !!a && a.jy === b.jy && a.jm === b.jm && a.jd === b.jd;

/**
 * An optional Jalali (Shamsi) day, picked from a month calendar. The value is the Gregorian day
 * (yyyy-MM-dd) or undefined; Fridays and official holidays are shown in red. Date only - unlike
 * JalaliDateTimePicker, which always holds a date and a time.
 */
export const JalaliDatePicker: React.FC<{
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  ariaLabel: string;
}> = ({ value, onChange, placeholder = 'انتخاب تاریخ', ariaLabel }) => {
  const today = getCurrentJalali();
  const selected = value ? toJalali(value) : null;
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<{ jy: number; jm: number }>(selected || today);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setView(selected || today);
    const close = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const shift = (months: number) => setView(({ jy, jm }) => {
    const index = jy * 12 + (jm - 1) + months;
    return { jy: Math.floor(index / 12), jm: (index % 12) + 1 };
  });
  const pick = (day: JalaliDay) => { onChange(toIso(day)); setOpen(false); };

  const lead = getJalaliMonthFirstDayOfWeek(view.jy, view.jm);
  const days = getJalaliMonthDays(view.jy, view.jm);
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <div className="relative" ref={root}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-right cursor-pointer hover:border-indigo-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40"
        >
          <span className={selected ? 'font-bold text-slate-800 dark:text-slate-100' : 'text-slate-400'}>
            {selected ? toPersianDigits(`${selected.jd} ${MONTHS[selected.jm - 1]} ${selected.jy}`) : placeholder}
          </span>
          <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
        </button>
        {selected && (
          <button type="button" onClick={() => onChange(undefined)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer shrink-0" aria-label={`حذف ${ariaLabel}`}>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div role="dialog" aria-label={ariaLabel} className="absolute z-40 top-full mt-1.5 right-0 w-72 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" aria-label="ماه قبل"><ChevronRight className="w-4 h-4" /></button>
            <span className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{MONTHS[view.jm - 1]} {toPersianDigits(view.jy)}</span>
            <button type="button" onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" aria-label="ماه بعد"><ChevronLeft className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w, i) => <span key={w} className={`text-[11px] font-bold py-1 ${i === 6 ? 'text-rose-500' : 'text-slate-400'}`}>{w}</span>)}
            {cells.map((d, i) => {
              if (d === null) return <span key={`e${i}`} />;
              const day = { jy: view.jy, jm: view.jm, jd: d };
              const off = i % 7 === 6 || getJalaliHoliday(view.jy, view.jm, d).isHoliday;
              const isSelected = same(selected, day);
              const isToday = same(today, day);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => pick(day)}
                  aria-label={toPersianDigits(`${d} ${MONTHS[view.jm - 1]} ${view.jy}`)}
                  aria-pressed={isSelected}
                  className={`h-8 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    isSelected ? 'bg-indigo-600 text-white'
                      : isToday ? 'ring-1 ring-indigo-400 text-indigo-700 dark:text-indigo-300'
                      : off ? 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {toPersianDigits(d)}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button type="button" onClick={() => pick(today)} className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer">امروز</button>
            {selected && <button type="button" onClick={() => { onChange(undefined); setOpen(false); }} className="text-xs font-bold text-slate-500 hover:text-rose-600 cursor-pointer">پاک کردن</button>}
          </div>
        </div>
      )}
    </div>
  );
};
