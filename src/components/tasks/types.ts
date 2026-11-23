// Track 1 (هستهٔ فعالیت) types: the server's shapes for the task-level features
// (Nexus.TaskManagement/Application/Dtos/TaskManagementDtos.cs, TaskExtrasService.cs). Enums travel as strings.

export type ServerTaskStatus = 'Todo' | 'InProgress' | 'Paused' | 'Completed';
export type ServerPriority = 'Low' | 'Medium' | 'High';

/** A custom status: a label (and colour) over one of the four built-in statuses. */
export interface CustomStatus {
  id: string;
  name: string;
  category: ServerTaskStatus;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
}
export interface SaveCustomStatus {
  name: string;
  category: ServerTaskStatus;
  color?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export interface WorkType {
  id: string;
  name: string;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
}
export interface SaveWorkType {
  name: string;
  color?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

export type CustomFieldKind = 'Text' | 'Number' | 'Date' | 'Choice' | 'Boolean';
export interface CustomField {
  id: string;
  name: string;
  kind: CustomFieldKind;
  options: string[];
  isRequired: boolean;
  sortOrder: number;
  isActive: boolean;
}
export interface SaveCustomField {
  name: string;
  kind: CustomFieldKind;
  options?: string[] | null;
  isRequired?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

/** A task's work type and its value for each active field. */
export interface TaskFieldValue {
  fieldId: string;
  name: string;
  kind: CustomFieldKind;
  options: string[];
  isRequired: boolean;
  value: string | null;
}
export interface TaskExtras {
  workTypeId: string | null;
  workTypeName: string | null;
  fields: TaskFieldValue[];
}

export interface TaskBrief {
  id: string;
  title: string;
  status: ServerTaskStatus;
  isDone: boolean;
}
export interface Criterion {
  id: string;
  text: string;
  isMet: boolean;
  sortOrder: number;
}
/** What stands between a task and done: the tasks it waits for, those waiting for it, its blocker and its criteria. */
export interface TaskPlanning {
  blockedReason: string | null;
  blockedBy: TaskBrief[];
  blocking: TaskBrief[];
  criteria: Criterion[];
  canComplete: boolean;
}

export interface TemplateBody {
  title: string;
  description: string | null;
  priority: ServerPriority;
  isProject: boolean;
  /** The due date is this many days after the day the template is used. */
  dueInDays: number;
  subTasks: string[];
  criteria: string[];
  tags: string[];
}
export interface TaskTemplate {
  id: string;
  name: string;
  isProject: boolean;
  body: TemplateBody;
}

export type BulkAction = 'Status' | 'CustomStatus' | 'Priority' | 'Archive' | 'Restore';
export interface BulkRequest {
  ids: string[];
  action: BulkAction;
  status?: ServerTaskStatus;
  customStatusId?: string;
  priority?: ServerPriority;
}
export interface BulkResult {
  succeeded: string[];
  failed: { id: string; code: string; message: string }[];
}

/** One row of the task list endpoint (the archive page). */
export interface TaskListRow {
  id: string;
  title: string;
  isProject: boolean;
  isRecurring: boolean;
  status: ServerTaskStatus;
  priority: ServerPriority;
  dueDate: string;
  assignedUser: { id: string; displayName: string } | null;
  archivedAtUtc: string | null;
  modifiedAtUtc: string | null;
  createdAtUtc: string;
}
export interface Paged<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}
