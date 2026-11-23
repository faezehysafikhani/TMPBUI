/**
 * Track 1 (هستهٔ فعالیت): the task-level features - archive, bulk actions, quick add, dependencies,
 * acceptance criteria, templates, custom statuses, work types and custom fields, WIP limits, hand-off.
 *
 * Backend: Nexus.TaskManagement (TaskManagementEndpoints.cs), under /api/task-management.
 * Use apiRequest (auth, active post, timeout and Persian errors come with it); do not add these
 * calls to nexusApi.ts. See docs/UI-WORKSTREAMS.md.
 */
import { apiRequest } from './nexusApi';

export const TASK_MANAGEMENT_BASE = '/api/task-management';

/** Kept so the import is used until the first real call lands here. */
export const taskFeaturesRequest = apiRequest;
