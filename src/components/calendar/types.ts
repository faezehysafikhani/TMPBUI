// Work calendar types (Nexus.Calendar/Application/Dtos/WorkCalendarDtos.cs).
export interface WorkCalendarException { id?: string; date: string; isWorkingDay: boolean; description: string | null }
export interface WorkCalendar {
  id: string;
  name: string;
  description: string | null;
  /** Bits of System.DayOfWeek (Sunday = 1 … Saturday = 64). */
  workingDays: number;
  isDefault: boolean;
  exceptions: WorkCalendarException[];
  workHoursPerDay: number;
  applyOfficialHolidays: boolean;
}
export interface SaveWorkCalendar {
  name: string;
  description?: string | null;
  workingDays: number;
  isDefault: boolean;
  workHoursPerDay?: number;
  applyOfficialHolidays?: boolean;
  exceptions?: { date: string; isWorkingDay: boolean; description: string | null }[];
}
export type DaySource = 'Weekly' | 'Exception' | 'OfficialHoliday';
export interface CalendarDay { date: string; isWorkingDay: boolean; source: DaySource; reason: string | null }
