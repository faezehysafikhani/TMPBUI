/**
 * Track 2 (زمان، درخواست و اتوماسیون): timesheets and timer, estimate vs actual, requests (intake),
 * message to task, meeting minutes to tasks, automation rules and SLA, scheduled report digests.
 *
 * Backend: /api/task-management (timesheets, requests, automation, report-subscriptions, tasks/{id}/time)
 * and /api/calendar/meetings/{id}/actions (Nexus.Integrations.CalendarTasks).
 * Use apiRequest; do not add these calls to nexusApi.ts. See docs/UI-WORKSTREAMS.md.
 */
import { apiRequest, reloadTasksSoon } from './nexusApi';
import type { Meeting } from './meetingApi';
import type {
  AutomationLogEntry,
  AutomationRule,
  ConvertMeetingActionsResult,
  ReportSubscription,
  RequestCategory,
  RequestStatus,
  RunningTimer,
  SaveAutomationRule,
  SaveReportSubscription,
  SaveRequestCategory,
  SubmitRequest,
  TaskRequest,
  TaskTime,
  TimeEntry,
  TimesheetWeek,
  Workload,
} from '../components/work/types';

export const TASK_MANAGEMENT_BASE = '/api/task-management';
export const MEETINGS_BASE = '/api/calendar/meetings';
const TM = TASK_MANAGEMENT_BASE;

/** Permissions (Nexus.TaskManagement/Permissions/TaskManagementPermissions.cs). */
export const WORK_PERMISSIONS = {
  tasksView: 'Tasks.View',
  tasksCreate: 'Tasks.Create',
  tasksEdit: 'Tasks.Edit',
  logTime: 'Timesheets.Log',
  viewAllTime: 'Timesheets.ViewAll',
  manageAutomation: 'Automation.Manage',
  submitRequests: 'Requests.Submit',
  handleRequests: 'Requests.Handle',
  manageRequests: 'Requests.Manage',
  meetingsEdit: 'Meetings.Edit',
} as const;

/** Today in Iran as yyyy-MM-dd (the server's days are Iranian days). */
export function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
}
/** The day `days` after the given yyyy-MM-dd. */
export function addDays(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------------ timesheets

/** The week holding `day` (default: this week) for the caller, or for `userId` (time managers). */
export const getTimesheetWeek = (day?: string, userId?: string) =>
  apiRequest<TimesheetWeek>('GET', `${TM}/timesheets/week`, { query: { day, userId }, cache: 'no-store' });
export const logTime = (input: { taskId: string; date: string; minutes: number; note?: string | null }) =>
  apiRequest<TimeEntry>('POST', `${TM}/timesheets/entries`, { body: { ...input, note: input.note?.trim() || null } });
export const updateTimeEntry = (id: string, input: { date: string; minutes: number; note?: string | null }) =>
  apiRequest<TimeEntry>('PUT', `${TM}/timesheets/entries/${id}`, { body: { ...input, note: input.note?.trim() || null } });
export const deleteTimeEntry = (id: string) => apiRequest<void>('DELETE', `${TM}/timesheets/entries/${id}`);
/** The week is sent for approval; with no approval chain installed it is accepted at once. */
export const submitTimesheetWeek = (weekStart: string) => apiRequest<TimesheetWeek>('POST', `${TM}/timesheets/submit`, { body: { weekStart } });

/** The caller's running timer, or null. */
export async function getRunningTimer(): Promise<RunningTimer | null> {
  try {
    return await apiRequest<RunningTimer | null>('GET', `${TM}/timesheets/timer`, { cache: 'no-store' });
  } catch {
    return null;
  }
}
export const startTimer = (taskId: string) => apiRequest<RunningTimer>('POST', `${TM}/timesheets/timer/start`, { body: { taskId } });
/** Stops the timer; the time becomes an entry for today. */
export const stopTimer = () => apiRequest<TimeEntry>('POST', `${TM}/timesheets/timer/stop`);

export const getWorkload = (from: string, to: string, capacityMinutes?: number) =>
  apiRequest<Workload>('GET', `${TM}/timesheets/workload`, { query: { from, to, capacityMinutes }, cache: 'no-store' });

export const getTaskTime = (taskId: string) => apiRequest<TaskTime>('GET', `${TM}/tasks/${taskId}/time`, { cache: 'no-store' });
export const setTaskEstimate = (taskId: string, minutes: number | null) =>
  apiRequest<TaskTime>('PUT', `${TM}/tasks/${taskId}/estimate`, { body: { minutes } });

/** Tasks to log time on: a title search over the tasks the caller may see. */
export const searchTasks = (search: string) =>
  apiRequest<{ items: { id: string; title: string }[] }>('GET', `${TM}/tasks`, { query: { search: search.trim() || undefined, pageNumber: 1, pageSize: 10 } });

// ------------------------------------------------------------------ requests

export const listRequestCategories = () => apiRequest<RequestCategory[]>('GET', `${TM}/requests/categories`, { cache: 'no-store' });
export const createRequestCategory = (input: SaveRequestCategory) => apiRequest<RequestCategory>('POST', `${TM}/requests/categories`, { body: input });
export const updateRequestCategory = (id: string, input: SaveRequestCategory) =>
  apiRequest<RequestCategory>('PUT', `${TM}/requests/categories/${id}`, { body: input });
/** mine=true: the caller's requests; false: every request (handlers). */
export const listRequests = (mine: boolean, status?: RequestStatus) =>
  apiRequest<TaskRequest[]>('GET', `${TM}/requests`, { query: { mine, status }, cache: 'no-store' });
export const submitRequest = (input: SubmitRequest) => apiRequest<TaskRequest>('POST', `${TM}/requests`, { body: input });
/** The request becomes a task (kept as its source). */
export async function convertRequest(id: string, input: { dueDate?: string | null; assignedUserId?: string | null }) {
  const result = await apiRequest<TaskRequest>('POST', `${TM}/requests/${id}/convert`, {
    body: { dueDate: input.dueDate || null, assignedUserId: input.assignedUserId || null },
  });
  reloadTasksSoon();
  return result;
}
export const rejectRequest = (id: string, note: string | null) =>
  apiRequest<TaskRequest>('POST', `${TM}/requests/${id}/reject`, { body: { note: note?.trim() || null } });

// ------------------------------------------------------------------ message to task

/** One click: a chat message becomes a task; the message is kept as the task's source. */
export const taskFromMessage = (messageId: string, text: string, title?: string) =>
  apiRequest<{ id: string; title: string }>('POST', `${TM}/tasks/from-message`, { body: { messageId, text, title: title?.trim() || null } });

// ------------------------------------------------------------------ meeting actions

export async function convertMeetingAction(meetingId: string, index: number) {
  const result = await apiRequest<ConvertMeetingActionsResult<Meeting>>('POST', `${MEETINGS_BASE}/${meetingId}/actions/${index}/convert-to-task`);
  reloadTasksSoon();
  return result;
}
export async function convertAllMeetingActions(meetingId: string) {
  const result = await apiRequest<ConvertMeetingActionsResult<Meeting>>('POST', `${MEETINGS_BASE}/${meetingId}/actions/convert-all`);
  reloadTasksSoon();
  return result;
}

// ------------------------------------------------------------------ automation

export const listAutomationRules = () => apiRequest<AutomationRule[]>('GET', `${TM}/automation/rules`, { cache: 'no-store' });
export const createAutomationRule = (input: SaveAutomationRule) => apiRequest<AutomationRule>('POST', `${TM}/automation/rules`, { body: input });
export const updateAutomationRule = (id: string, input: SaveAutomationRule) =>
  apiRequest<AutomationRule>('PUT', `${TM}/automation/rules/${id}`, { body: input });
export const deleteAutomationRule = (id: string) => apiRequest<void>('DELETE', `${TM}/automation/rules/${id}`);
export const listAutomationLog = (taskId?: string) =>
  apiRequest<AutomationLogEntry[]>('GET', `${TM}/automation/log`, { query: { taskId }, cache: 'no-store' });

// ------------------------------------------------------------------ report digests (the caller's own)

export const listReportSubscriptions = () => apiRequest<ReportSubscription[]>('GET', `${TM}/report-subscriptions`, { cache: 'no-store' });
export const createReportSubscription = (input: SaveReportSubscription) =>
  apiRequest<ReportSubscription>('POST', `${TM}/report-subscriptions`, { body: input });
export const updateReportSubscription = (id: string, input: SaveReportSubscription) =>
  apiRequest<ReportSubscription>('PUT', `${TM}/report-subscriptions/${id}`, { body: input });
export const deleteReportSubscription = (id: string) => apiRequest<void>('DELETE', `${TM}/report-subscriptions/${id}`);

// ------------------------------------------------------------------ lookups for the rule editor

/** The organization's work types (for «بر اساس نوع فعالیت» conditions). */
export const listWorkTypes = () =>
  apiRequest<{ id: string; name: string; isActive: boolean }[]>('GET', `${TM}/work-types`, { cache: 'no-store' }).catch(() => []);
