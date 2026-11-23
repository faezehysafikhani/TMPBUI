/**
 * Track 1 (هستهٔ فعالیت): the task-level features - archive, bulk actions, quick add, dependencies,
 * acceptance criteria, templates, custom statuses, work types and custom fields, WIP limits, hand-off.
 *
 * Backend: Nexus.TaskManagement (TaskManagementEndpoints.cs), under /api/task-management.
 * Use apiRequest (auth, active post, timeout and Persian errors come with it); do not add these
 * calls to nexusApi.ts. See docs/UI-WORKSTREAMS.md.
 */
import { apiRequest, reloadTasksSoon } from './nexusApi';
import type { Priority, TaskStatus } from '../types';
import type {
  BulkRequest,
  BulkResult,
  CustomField,
  CustomStatus,
  Paged,
  SaveCustomField,
  SaveCustomStatus,
  SaveWorkType,
  ServerPriority,
  ServerTaskStatus,
  TaskExtras,
  TaskListRow,
  TaskPlanning,
  TaskTemplate,
  TemplateBody,
  WorkType,
} from '../components/tasks/types';

export const TASK_MANAGEMENT_BASE = '/api/task-management';
const TASKS = `${TASK_MANAGEMENT_BASE}/tasks`;

// ------------------------------------------------------------------ value mapping

export const STATUS_TO_SERVER: Record<TaskStatus, ServerTaskStatus> = {
  todo: 'Todo',
  in_progress: 'InProgress',
  paused: 'Paused',
  completed: 'Completed',
};
export const STATUS_FROM_SERVER: Record<ServerTaskStatus, TaskStatus> = {
  Todo: 'todo',
  InProgress: 'in_progress',
  Paused: 'paused',
  Completed: 'completed',
};
export const PRIORITY_TO_SERVER: Record<Priority, ServerPriority> = { low: 'Low', medium: 'Medium', high: 'High' };
export const PRIORITY_FROM_SERVER: Record<ServerPriority, Priority> = { Low: 'low', Medium: 'medium', High: 'high' };

// ------------------------------------------------------------------ permissions (Nexus.TaskManagement/Permissions)

export const TASK_FEATURE_PERMISSIONS = {
  create: 'Tasks.Create',
  edit: 'Tasks.Edit',
  manageStatuses: 'Tasks.ManageStatuses',
  manageTemplates: 'Tasks.ManageTemplates',
} as const;

// ------------------------------------------------------------------ archive, quick add, bulk

/** The archive: archived tasks the caller may see, newest change first. */
export const listArchivedTasks = (pageNumber: number, pageSize: number, search?: string) =>
  apiRequest<Paged<TaskListRow>>('GET', TASKS, {
    query: { archived: true, pageNumber, pageSize, search: search?.trim() || undefined, sortBy: 'ModifiedAtUtc', sortDescending: true },
    cache: 'no-store',
  });

export const archiveTask = (taskId: string) => apiRequest<unknown>('POST', `${TASKS}/${taskId}/archive`);
export const restoreTask = (taskId: string) => apiRequest<unknown>('POST', `${TASKS}/${taskId}/restore`);

/** Quick add: a title is enough; due today unless a day is given, given to the caller. */
export const quickAddTask = (title: string, priority: Priority, dueDate?: string) =>
  apiRequest<{ id: string }>('POST', `${TASKS}/quick`, {
    body: { title: title.trim(), priority: PRIORITY_TO_SERVER[priority], dueDate: dueDate || null },
  });

/** One action over up to 100 tasks; each task succeeds or fails on its own. */
export const bulkTaskAction = (request: BulkRequest) => apiRequest<BulkResult>('POST', `${TASKS}/bulk`, { body: request });

// ------------------------------------------------------------------ planning: dependencies, blocker, criteria, bulk subtasks

export const getTaskPlanning = (taskId: string) => apiRequest<TaskPlanning>('GET', `${TASKS}/${taskId}/planning`, { cache: 'no-store' });
export const addTaskDependency = (taskId: string, blockedByTaskId: string) =>
  apiRequest<TaskPlanning>('POST', `${TASKS}/${taskId}/dependencies`, { body: { blockedByTaskId } });
export const removeTaskDependency = (taskId: string, blockedByTaskId: string) =>
  apiRequest<TaskPlanning>('DELETE', `${TASKS}/${taskId}/dependencies/${blockedByTaskId}`);
export const setTaskBlocker = (taskId: string, reason: string | null) =>
  apiRequest<TaskPlanning>('PUT', `${TASKS}/${taskId}/blocker`, { body: { reason: reason?.trim() || null } });
export const addCriterion = (taskId: string, text: string) =>
  apiRequest<TaskPlanning>('POST', `${TASKS}/${taskId}/criteria`, { body: { text: text.trim() } });
export const updateCriterion = (taskId: string, criterionId: string, text: string) =>
  apiRequest<TaskPlanning>('PUT', `${TASKS}/${taskId}/criteria/${criterionId}`, { body: { text: text.trim() } });
export const setCriterionMet = (taskId: string, criterionId: string, met: boolean) =>
  apiRequest<TaskPlanning>('PUT', `${TASKS}/${taskId}/criteria/${criterionId}/met`, { body: { met } });
export const deleteCriterion = (taskId: string, criterionId: string) =>
  apiRequest<TaskPlanning>('DELETE', `${TASKS}/${taskId}/criteria/${criterionId}`);

/** Many subtasks at once (one title per line in the dialog). */
export const addSubTasksInBulk = (taskId: string, titles: string[]) =>
  apiRequest<unknown>('POST', `${TASKS}/${taskId}/subtasks/bulk`, { body: { titles } });

/** Tasks to wait for: a title search over the tasks the caller may see (not archived). */
export const searchTasks = (search: string) =>
  apiRequest<Paged<TaskListRow>>('GET', TASKS, { query: { search: search.trim() || undefined, pageNumber: 1, pageSize: 10 } });

// ------------------------------------------------------------------ WIP limit

export const getWipLimit = () => apiRequest<{ limitPerUser: number | null }>('GET', `${TASK_MANAGEMENT_BASE}/wip`, { cache: 'no-store' });
export const setWipLimit = (limitPerUser: number | null) =>
  apiRequest<{ limitPerUser: number | null }>('PUT', `${TASK_MANAGEMENT_BASE}/wip`, { body: { limitPerUser } });

// ------------------------------------------------------------------ templates

export const listTemplates = () => apiRequest<TaskTemplate[]>('GET', `${TASK_MANAGEMENT_BASE}/templates`, { cache: 'no-store' });
export const createTemplate = (name: string, body: TemplateBody) =>
  apiRequest<TaskTemplate>('POST', `${TASK_MANAGEMENT_BASE}/templates`, { body: { name: name.trim(), body } });
export const updateTemplate = (id: string, name: string, body: TemplateBody) =>
  apiRequest<TaskTemplate>('PUT', `${TASK_MANAGEMENT_BASE}/templates/${id}`, { body: { name: name.trim(), body } });
export const deleteTemplate = (id: string) => apiRequest<void>('DELETE', `${TASK_MANAGEMENT_BASE}/templates/${id}`);
export const saveTaskAsTemplate = (taskId: string, name: string) =>
  apiRequest<TaskTemplate>('POST', `${TASKS}/${taskId}/save-as-template`, { body: { name: name.trim() } });

/** A task or project from the template. The server does not announce it, so the board is reloaded here. */
export async function instantiateTemplate(id: string, options: { title?: string; dueDate?: string; assignedUserId?: string }) {
  const created = await apiRequest<{ id: string }>('POST', `${TASK_MANAGEMENT_BASE}/templates/${id}/instantiate`, {
    body: { title: options.title?.trim() || null, dueDate: options.dueDate || null, assignedUserId: options.assignedUserId || null },
  });
  reloadTasksSoon();
  return created;
}

// ------------------------------------------------------------------ custom statuses

export const listCustomStatuses = () => apiRequest<CustomStatus[]>('GET', `${TASK_MANAGEMENT_BASE}/statuses`, { cache: 'no-store' });
export const createCustomStatus = (input: SaveCustomStatus) =>
  apiRequest<CustomStatus>('POST', `${TASK_MANAGEMENT_BASE}/statuses`, { body: input });
export const updateCustomStatus = (id: string, input: SaveCustomStatus) =>
  apiRequest<CustomStatus>('PUT', `${TASK_MANAGEMENT_BASE}/statuses/${id}`, { body: { isActive: true, ...input } });
export const deleteCustomStatus = (id: string) => apiRequest<void>('DELETE', `${TASK_MANAGEMENT_BASE}/statuses/${id}`);

// ------------------------------------------------------------------ work types, custom fields, a task's values

export const listWorkTypes = () => apiRequest<WorkType[]>('GET', `${TASK_MANAGEMENT_BASE}/work-types`, { cache: 'no-store' });
export const createWorkType = (input: SaveWorkType) => apiRequest<WorkType>('POST', `${TASK_MANAGEMENT_BASE}/work-types`, { body: input });
export const updateWorkType = (id: string, input: SaveWorkType) =>
  apiRequest<WorkType>('PUT', `${TASK_MANAGEMENT_BASE}/work-types/${id}`, { body: { isActive: true, ...input } });
export const deleteWorkType = (id: string) => apiRequest<void>('DELETE', `${TASK_MANAGEMENT_BASE}/work-types/${id}`);

export const listCustomFields = () => apiRequest<CustomField[]>('GET', `${TASK_MANAGEMENT_BASE}/custom-fields`, { cache: 'no-store' });
export const createCustomField = (input: SaveCustomField) =>
  apiRequest<CustomField>('POST', `${TASK_MANAGEMENT_BASE}/custom-fields`, { body: input });
export const updateCustomField = (id: string, input: SaveCustomField) =>
  apiRequest<CustomField>('PUT', `${TASK_MANAGEMENT_BASE}/custom-fields/${id}`, { body: { isActive: true, ...input } });
export const deleteCustomField = (id: string) => apiRequest<void>('DELETE', `${TASK_MANAGEMENT_BASE}/custom-fields/${id}`);

export const getTaskExtras = (taskId: string) => apiRequest<TaskExtras>('GET', `${TASKS}/${taskId}/extras`, { cache: 'no-store' });
export async function saveTaskExtras(taskId: string, workTypeId: string | null, values: Record<string, string | null>) {
  const saved = await apiRequest<TaskExtras>('PUT', `${TASKS}/${taskId}/extras`, { body: { workTypeId, values } });
  reloadTasksSoon();
  return saved;
}

// ------------------------------------------------------------------ hand-off

/** Hand the task to another person and/or team, with a note. The server does not announce it, so the board is reloaded here. */
export async function handOffTask(taskId: string, input: { toUserId?: string | null; toGroupId?: string | null; note: string }) {
  const result = await apiRequest<unknown>('POST', `${TASKS}/${taskId}/handoff`, {
    body: { toUserId: input.toUserId || null, toGroupId: input.toGroupId || null, note: input.note.trim() },
  });
  reloadTasksSoon();
  return result;
}
