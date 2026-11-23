/**
 * Work calendars (CAT-85; Nexus.Calendar, /api/calendar/work-calendars): working days, hours per day, whether
 * Iran's official holidays apply, and date exceptions. Use apiRequest; see docs/WORKFLOW-PROGRESS.md.
 */
import { apiRequest, getSessionTenantId } from './nexusApi';
import { getIranTodayISO, setSchedulingCalendar } from '../utils/jalali';
import type { CalendarDay, SaveWorkCalendar, WorkCalendar } from '../components/calendar/types';

const BASE = '/api/calendar/work-calendars';

export const WORK_CALENDAR_PERMISSIONS = {
  view: 'work_calendars.view',
  create: 'work_calendars.create',
  update: 'work_calendars.update',
  delete: 'work_calendars.delete',
} as const;

/** Days of the week as bits (System.DayOfWeek: Sunday = 0 … Saturday = 6), the server's DayOfWeekMask. */
export const DAY_BITS = { Sunday: 1, Monday: 2, Tuesday: 4, Wednesday: 8, Thursday: 16, Friday: 32, Saturday: 64 } as const;
const NAMED: Record<string, number> = { ...DAY_BITS, None: 0, IranWorkWeek: 64 | 1 | 2 | 4 | 8, AllDays: 127 };

/** The server sends the mask as names ("Thursday, IranWorkWeek"), or a number. */
export function parseMask(value: string | number): number {
  if (typeof value === 'number') return value;
  return value.split(',').map((n) => n.trim()).reduce((mask, n) => mask | (NAMED[n] ?? (Number(n) || 0)), 0);
}

type Raw = Omit<WorkCalendar, 'workingDays'> & { workingDays: string | number };
const toCalendar = (r: Raw): WorkCalendar => ({ ...r, workingDays: parseMask(r.workingDays) });

export const listWorkCalendars = async () => (await apiRequest<Raw[]>('GET', BASE, { cache: 'no-store' })).map(toCalendar);
// After any change the scheduling days are read again: the default calendar decides which days take tasks.
export const createWorkCalendar = async (input: SaveWorkCalendar) => {
  const saved = toCalendar(await apiRequest<Raw>('POST', BASE, { body: { tenantId: getSessionTenantId(), ...input } }));
  void loadSchedulingDays();
  return saved;
};
/** Saves the whole calendar; its exceptions become exactly the given ones. */
export const updateWorkCalendar = async (id: string, input: SaveWorkCalendar) => {
  const saved = toCalendar(await apiRequest<Raw>('PUT', `${BASE}/${id}`, { body: input }));
  void loadSchedulingDays();
  return saved;
};
export const deleteWorkCalendar = async (id: string) => {
  await apiRequest<void>('DELETE', `${BASE}/${id}`);
  void loadSchedulingDays();
};
/** Each day in the range as the calendar sees it, and why. */
export const getCalendarDays = (id: string, from: string, to: string) =>
  apiRequest<CalendarDay[]>('GET', `${BASE}/${id}/days`, { query: { from, to }, cache: 'no-store' });

/**
 * Loads which days take no new tasks or meetings (the default work calendar's days off, for any signed-in user)
 * into utils/jalali, so the forms and date pickers refuse exactly what the server refuses. No work calendar, an
 * older server or an error: the built-in rule (Friday and official holidays).
 */
export async function loadSchedulingDays(): Promise<void> {
  const today = getIranTodayISO();
  const from = addDaysIso(today, -1);
  const to = addDaysIso(today, 900);
  try {
    const r = await apiRequest<{ usesWorkCalendar: boolean; offDays: { date: string; reason?: string | null }[] }>(
      'GET', '/api/calendar/scheduling-days', { query: { from, to }, cache: 'no-store' });
    setSchedulingCalendar(r.usesWorkCalendar ? { from, to, offDays: (r.offDays || []).map((d) => ({ date: d.date.slice(0, 10), reason: d.reason ?? null })) } : null);
  } catch {
    setSchedulingCalendar(null);
  }
}

function addDaysIso(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
