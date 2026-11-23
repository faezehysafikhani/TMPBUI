import React from 'react';
import { TimerReset } from 'lucide-react';
import type { Task } from '../../types';
import { toPersianDigits } from '../../utils/helpers';

/** «۳ ساعت»، «۲ روز» for a span of minutes. */
function span(minutes: number): string {
  const m = Math.abs(minutes);
  if (m < 60) return `${toPersianDigits(Math.max(1, Math.round(m)))} دقیقه`;
  if (m < 48 * 60) return `${toPersianDigits(Math.round(m / 60))} ساعت`;
  return `${toPersianDigits(Math.round(m / (24 * 60)))} روز`;
}

/**
 * The SLA badge on a task card (CAT-119), from task.server.slaDueAtUtc / slaBreachedAtUtc: how long is
 * left, or that the SLA is missed. Track 2 owns this file; TaskCard (Track 1) only renders it.
 * The SLA clock is started by an automation rule («شروع SLA»); a finished task shows nothing.
 */
export const TaskSlaBadge: React.FC<{ task: Task }> = ({ task }) => {
  const due = task.server?.slaDueAtUtc;
  if (!due || task.status === 'completed') return null;
  const breached = !!task.server?.slaBreachedAtUtc || new Date(due).getTime() < Date.now();
  const minutesLeft = (new Date(due).getTime() - Date.now()) / 60_000;
  const soon = !breached && minutesLeft < 4 * 60;
  const tone = breached
    ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
    : soon
      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
      : 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800';
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap ${tone}`}
      title={`مهلت پاسخ (SLA): ${new Date(due).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })}`}
    >
      <TimerReset className="w-3 h-3" />
      {breached ? 'SLA گذشته' : `SLA: ${span(minutesLeft)} مانده`}
    </span>
  );
};
