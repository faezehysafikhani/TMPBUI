// Track 2 (زمان، درخواست و اتوماسیون) types: the server's shapes (Nexus.TaskManagement/Application/Dtos,
// Domain/Automation.cs, Nexus.Integrations.CalendarTasks). Enums travel as strings; days are yyyy-MM-dd.

export type ServerTaskStatus = 'Todo' | 'InProgress' | 'Paused' | 'Completed';
export type ServerPriority = 'Low' | 'Medium' | 'High';
export type ApprovalStatus = 'NotSubmitted' | 'PendingApproval' | 'Approved' | 'Rejected';
export interface UserSummary { id: string; displayName: string; email?: string | null }

// ------------------------------------------------------------------ timesheets

export interface TimeEntry {
  id: string;
  taskId: string;
  taskTitle: string | null;
  userId: string;
  userName: string | null;
  date: string;
  minutes: number;
  note: string | null;
  source: 'Manual' | 'Timer';
  status: ApprovalStatus;
}
export interface TimesheetWeek {
  weekStart: string;
  entries: TimeEntry[];
  /** yyyy-MM-dd → minutes */
  minutesPerDay: Record<string, number>;
  totalMinutes: number;
  status: ApprovalStatus;
  submissionId: string | null;
  decisionComment: string | null;
  canSubmit: boolean;
}
export interface RunningTimer { taskId: string; taskTitle: string | null; startedAtUtc: string; elapsedMinutes: number }
export interface TaskTime { estimatedMinutes: number | null; actualMinutes: number; entries: TimeEntry[] }
export interface WorkloadRow {
  user: UserSummary;
  loggedMinutes: number;
  openTasks: number;
  remainingEstimatedMinutes: number;
  capacityMinutes: number;
  utilization: number;
}
export interface Workload { from: string; to: string; capacityPerPersonMinutes: number; people: WorkloadRow[] }

// ------------------------------------------------------------------ requests (intake)

export type RequestStatus = 'New' | 'Converted' | 'Rejected';
export interface RequestCategory {
  id: string;
  name: string;
  routeToUserId: string | null;
  urgentRouteToUserId: string | null;
  defaultPriority: ServerPriority;
  isActive: boolean;
}
export interface SaveRequestCategory {
  name: string;
  routeToUserId?: string | null;
  urgentRouteToUserId?: string | null;
  defaultPriority?: ServerPriority;
  isActive?: boolean;
}
export interface TaskRequest {
  id: string;
  categoryId: string | null;
  categoryName: string | null;
  title: string;
  description: string | null;
  priority: ServerPriority;
  neededBy: string | null;
  requester: UserSummary | null;
  routedTo: UserSummary | null;
  status: RequestStatus;
  decisionNote: string | null;
  convertedTaskId: string | null;
  createdAtUtc: string;
  decidedAtUtc: string | null;
}
export interface SubmitRequest {
  title: string;
  description?: string | null;
  categoryId?: string | null;
  priority?: ServerPriority | null;
  neededBy?: string | null;
}

// ------------------------------------------------------------------ automation

export type AutomationTrigger = 'TaskCreated' | 'StatusChanged' | 'SlaBreached' | 'Overdue';
export type AutomationActionType =
  | 'SetPriority' | 'SetStatus' | 'AssignUser' | 'AssignManager' | 'AddTag' | 'StartSla' | 'Notify' | 'AssignGroup' | 'EscalateUp';
export interface AutomationConditions {
  priority?: ServerPriority | null;
  status?: ServerTaskStatus | null;
  isProject?: boolean | null;
  titleContains?: string | null;
  workTypeId?: string | null;
}
export interface AutomationAction {
  type: AutomationActionType;
  priority?: ServerPriority | null;
  status?: ServerTaskStatus | null;
  userId?: string | null;
  tag?: string | null;
  hours?: number | null;
  businessDaysOnly?: boolean;
  message?: string | null;
  groupId?: string | null;
  levels?: number | null;
}
export interface AutomationRule {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationConditions;
  actions: AutomationAction[];
  sortOrder: number;
  isActive: boolean;
}
export interface SaveAutomationRule {
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationConditions | null;
  actions: AutomationAction[];
  sortOrder?: number;
  isActive?: boolean;
}
export interface AutomationLogEntry {
  id: string;
  ruleId: string;
  ruleName: string;
  taskId: string;
  trigger: AutomationTrigger;
  outcome: string;
  detail: string | null;
  atUtc: string;
}

// ------------------------------------------------------------------ report digests

export type ReportFrequency = 'Daily' | 'Weekly' | 'Monthly';
export type DayOfWeekName = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
export interface ReportSubscription {
  id: string;
  frequency: ReportFrequency;
  dayOfWeek: DayOfWeekName | null;
  dayOfMonth: number | null;
  hour: number;
  bySms: boolean;
  byEmail: boolean;
  isActive: boolean;
  nextRunAtUtc: string;
  lastSentAtUtc: string | null;
}
export interface SaveReportSubscription {
  frequency: ReportFrequency;
  dayOfWeek?: DayOfWeekName | null;
  dayOfMonth?: number | null;
  hour: number;
  bySms: boolean;
  byEmail: boolean;
  isActive?: boolean;
}

// ------------------------------------------------------------------ meeting actions to tasks

export interface ConvertMeetingActionsResult<TMeeting> {
  meeting: TMeeting;
  converted: { index: number; taskId: string; title: string }[];
  skipped: string[];
}
