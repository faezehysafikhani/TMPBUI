import React from 'react';

const fa = (n: number) => String(n).padStart(2, '0').replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

/**
 * A time of day as «HH:mm», 24-hour with Persian digits. The browser's own time field follows the
 * operating system (AM/PM, Latin digits), so it is not used. Minutes go in steps of five; a value
 * between them (from an older entry) is kept as it is.
 */
export const PersianTimeInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}> = ({ value, onChange, disabled, className = '', ariaLabel }) => {
  const [h, m] = (value || '').split(':').map((x) => Number.parseInt(x, 10));
  const hour = Number.isFinite(h) ? h : 0;
  const minute = Number.isFinite(m) ? m : 0;
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
  if (!minutes.includes(minute)) minutes.push(minute);
  minutes.sort((a, b) => a - b);
  const set = (nh: number, nm: number) => onChange(`${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`);
  const select = 'appearance-none bg-transparent text-center font-bold cursor-pointer focus:outline-hidden disabled:cursor-not-allowed';
  return (
    <div dir="ltr" role="group" aria-label={ariaLabel} className={`flex items-center justify-center gap-1 ${className}`}>
      <select aria-label="ساعت" className={select} value={hour} disabled={disabled} onChange={(e) => set(Number(e.target.value), minute)}>
        {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{fa(i)}</option>)}
      </select>
      <span className="font-bold">:</span>
      <select aria-label="دقیقه" className={select} value={minute} disabled={disabled} onChange={(e) => set(hour, Number(e.target.value))}>
        {minutes.map((i) => <option key={i} value={i}>{fa(i)}</option>)}
      </select>
    </div>
  );
};
