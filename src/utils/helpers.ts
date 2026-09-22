import { formatISOToJalaliDateTime, iranDayNumber, parseDateSafely } from './jalali';
import { TaskStatus } from '../types';

// Compute automatic task status based on subtasks completion
export function computeAutoTaskStatus(
  subtasks?: Array<{ completed?: boolean }> | null
): TaskStatus {
  if (!subtasks || subtasks.length === 0) return 'todo';
  const completedCount = subtasks.filter((st) => Boolean(st.completed)).length;
  if (completedCount === subtasks.length) return 'completed';
  if (completedCount > 0) return 'in_progress';
  return 'todo';
}

// Convert English numbers to Persian digits
export function toPersianDigits(num: number | string): string {
  if (num === null || num === undefined) return '';
  const str = num.toString();
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.replace(/\d/g, (x) => persianDigits[parseInt(x, 10)]);
}

// Format Date / string to 24-hour Persian formatted time string (HH:mm -> ۱۴:۳۰) in Iran local time (UTC+3:30)
export function formatTime24h(dateInput?: string | Date | number | null): string {
  if (!dateInput) return '';
  let d: Date | null = null;
  if (typeof dateInput === 'string') {
    d = parseDateSafely(dateInput);
  } else if (dateInput instanceof Date) {
    d = new Date(dateInput.getTime());
  } else if (typeof dateInput === 'number') {
    d = new Date(dateInput);
  }
  if (!d || isNaN(d.getTime())) return '';

  // Shift UTC to Iran local time (UTC+3:30 -> +3.5 hours)
  d.setTime(d.getTime() + (3.5 * 3600 * 1000));
  const pad = (n: number) => n.toString().padStart(2, '0');
  const timeStr = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return toPersianDigits(timeStr);
}

// Convert bytes to human readable format (KB, MB, GB)
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '۰ بایت';
  const k = 1024;
  const sizes = ['بایت', 'کیلوبایت', 'مگابایت', 'گیگابایت'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const formatted = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${toPersianDigits(formatted)} ${sizes[i]}`;
}

// Format ISO string to Shamsi / Jalali date and time string
export function formatToJalali(dateString: string): string {
  return formatISOToJalaliDateTime(dateString);
}

// Check if task is overdue
export function isOverdue(dueDateString: string, status: string): boolean {
  if (!dueDateString || status === 'completed' || status === 'paused') return false;
  const due = parseDateSafely(dueDateString);
  if (!due) return false;
  
  // If only a date (e.g. YYYY-MM-DD) without time was supplied, treat due time as end of day (23:59:59)
  if (dueDateString.length <= 10 || !dueDateString.includes('T')) {
    due.setUTCHours(23, 59, 59, 999);
  }

  return due.getTime() < Date.now();
}

// Check if actual completion date is greater (later) than planned due date
export function isCompletionDelayed(
  dueDateString?: string | null,
  completionDateString?: string | null
): boolean {
  if (!dueDateString || !completionDateString) return false;
  const due = parseDateSafely(dueDateString);
  const completed = parseDateSafely(completionDateString);
  if (!due || !completed) return false;

  // If only a date (e.g. YYYY-MM-DD) without time was supplied for planned date,
  // treat planned due time as end of day (23:59:59.999)
  if (dueDateString.length <= 10 || !dueDateString.includes('T')) {
    due.setUTCHours(23, 59, 59, 999);
  }

  return completed.getTime() > due.getTime();
}

// Calculate exact latest timestamp of any activity or modification on a task (fields, subtasks, comments, logs)
export function getTaskLastModifiedTime(task: {
  createdAt?: string;
  updatedAt?: string;
  dueDate?: string;
  comments?: Array<{ createdAt?: string }>;
  logs?: Array<{ createdAt?: string }>;
} | null | undefined): number {
  if (!task) return 0;
  let maxTime = 0;

  if (task.updatedAt) {
    const t = new Date(task.updatedAt).getTime();
    if (!isNaN(t) && t > maxTime) maxTime = t;
  }

  if (task.createdAt) {
    const t = new Date(task.createdAt).getTime();
    if (!isNaN(t) && t > maxTime) maxTime = t;
  }

  if (task.comments && Array.isArray(task.comments) && task.comments.length > 0) {
    for (const c of task.comments) {
      if (c && c.createdAt) {
        const t = new Date(c.createdAt).getTime();
        if (!isNaN(t) && t > maxTime) maxTime = t;
      }
    }
  }

  if (task.logs && Array.isArray(task.logs) && task.logs.length > 0) {
    for (const l of task.logs) {
      if (l && l.createdAt) {
        const t = new Date(l.createdAt).getTime();
        if (!isNaN(t) && t > maxTime) maxTime = t;
      }
    }
  }

  if (!maxTime && task.dueDate) {
    const t = new Date(task.dueDate).getTime();
    if (!isNaN(t)) maxTime = t;
  }

  return maxTime || 0;
}

export function getDaysDiff(dueDateString: string): { days: number; text: string; isPast: boolean } {
  if (!dueDateString) return { days: 0, text: '', isPast: false };
  const due = parseDateSafely(dueDateString);
  if (!due) return { days: 0, text: '', isPast: false };

  // Both sides as Iranian calendar days (UTC+3:30), the same calendar every date in the app is
  // shown in. Mixing the browser's local date for "today" with the UTC date of the due instant
  // put any task due before 03:30 Tehran time - including every midnight - on the previous day.
  const diffDays = iranDayNumber(due) - iranDayNumber(new Date());

  if (diffDays === 0) {
    return { days: 0, text: 'امروز', isPast: false };
  } else if (diffDays === 1) {
    return { days: 1, text: 'فردا', isPast: false };
  } else if (diffDays > 1) {
    return { days: diffDays, text: `${toPersianDigits(diffDays)} روز دیگر`, isPast: false };
  } else if (diffDays === -1) {
    return { days: -1, text: 'دیروز', isPast: true };
  } else {
    return { days: diffDays, text: `${toPersianDigits(Math.abs(diffDays))} روز گذشته`, isPast: true };
  }
}

