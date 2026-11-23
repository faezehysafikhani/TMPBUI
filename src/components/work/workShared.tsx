import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { inputClass } from '../admin/AdminUi';
import { formatToJalali, toPersianDigits } from '../../utils/helpers';
import { gregorianToJalali, isoToIranDateTimeParts } from '../../utils/jalali';
import { getRunningTimer, searchTasks } from '../../services/workApi';
import type { RunningTimer } from './types';

/** 95 → «۱ ساعت و ۳۵ دقیقه»; 0 → «۰». */
export function formatMinutes(minutes: number | null | undefined): string {
  const m = Math.max(0, Math.round(minutes || 0));
  if (m === 0) return 'کمتر از یک دقیقه';
  const h = Math.floor(m / 60);
  const r = m % 60;
  return [h ? `${toPersianDigits(h)} ساعت` : '', r ? `${toPersianDigits(r)} دقیقه` : ''].filter(Boolean).join(' و ');
}
/** 95 → «۱:۳۵» (compact, for tables). */
export function formatHm(minutes: number | null | undefined): string {
  const m = Math.max(0, Math.round(minutes || 0));
  return toPersianDigits(`${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`);
}
/** «1:30», «۱:۳۰», «90» or «1.5h» → minutes; null when it cannot be read. */
export function parseDuration(text: string): number | null {
  const t = text.trim().replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  if (!t) return null;
  const hm = t.match(/^(\d{1,2})[:٫.](\d{1,2})$/);
  if (hm && t.includes(':')) return Number(hm[1]) * 60 + Number(hm[2]);
  if (/^\d+$/.test(t)) return Number(t);
  const h = t.match(/^(\d+(?:[.٫]\d+)?)\s*(h|ساعت)$/i);
  if (h) return Math.round(Number(h[1].replace('٫', '.')) * 60);
  return null;
}

/** A day (yyyy-MM-dd, or the day part of an ISO date) as a Jalali date «۱۴۰۵/۰۹/۰۲», without a time. */
export function formatJalaliDay(value: string | null | undefined): string {
  // A moment (with a time) is first turned into its day in Iran; a plain day is taken as it is.
  const day = value && value.includes('T') ? isoToIranDateTimeParts(value)?.date ?? value : value;
  const m = (day || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return value ? formatToJalali(value) : '—';
  const { jy, jm, jd } = gregorianToJalali(Number(m[1]), Number(m[2]), Number(m[3]));
  return toPersianDigits(`${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`);
}

export const DAY_NAMES = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

/** The caller's running timer, read once and then ticking locally every 30 seconds. */
export function useRunningTimer(enabled: boolean): { timer: RunningTimer | null; elapsed: number; reload: () => void } {
  const [timer, setTimer] = useState<RunningTimer | null>(null);
  const [now, setNow] = useState(Date.now());
  const reload = () => { if (enabled) getRunningTimer().then(setTimer); };
  useEffect(reload, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!timer) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [timer]);
  const elapsed = timer ? Math.max(0, Math.floor((now - new Date(timer.startedAtUtc).getTime()) / 60_000)) : 0;
  return { timer, elapsed, reload };
}

/** Search the caller's tasks by title and pick one. */
export const TaskSearchPicker: React.FC<{ id: string; value: { id: string; title: string } | null; onChange: (task: { id: string; title: string } | null) => void }> = ({ id, value, onChange }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  useEffect(() => {
    if (!open) return undefined;
    const current = ++seq.current;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchTasks(query)
        .then((page) => { if (current === seq.current) setResults(page.items || []); })
        .catch(() => { if (current === seq.current) setResults([]); })
        .finally(() => { if (current === seq.current) setLoading(false); });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  if (value && !open) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        <span className="flex-1 text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{value.title}</span>
        <button type="button" onClick={() => { onChange(null); setOpen(true); }} className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer">تغییر</button>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
        <input id={id} className={`${inputClass} pr-9`} value={query} onFocus={() => setOpen(true)} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} placeholder="جستجوی عنوان فعالیت..." />
      </div>
      {open && (
        <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
          {loading && <p className="flex items-center gap-1 p-2.5 text-xs text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> در حال جستجو...</p>}
          {!loading && results.length === 0 && <p className="p-2.5 text-xs text-slate-400">فعالیتی پیدا نشد.</p>}
          {!loading && results.map((r) => (
            <button key={r.id} type="button" onClick={() => { onChange(r); setOpen(false); }} className="w-full text-right px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800 cursor-pointer truncate">
              {r.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
