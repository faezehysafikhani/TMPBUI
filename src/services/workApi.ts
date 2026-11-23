/**
 * Track 2 (زمان، درخواست و اتوماسیون): timesheets and timer, estimate vs actual, requests (intake),
 * message to task, meeting minutes to tasks, automation rules and SLA, scheduled report digests.
 *
 * Backend: /api/task-management (timesheets, requests, automation, report-subscriptions, tasks/{id}/time)
 * and /api/calendar/meetings/{id}/actions (Nexus.Integrations.CalendarTasks).
 * Use apiRequest; do not add these calls to nexusApi.ts. See docs/UI-WORKSTREAMS.md.
 */
import { apiRequest } from './nexusApi';

export const TASK_MANAGEMENT_BASE = '/api/task-management';
export const MEETINGS_BASE = '/api/calendar/meetings';

/** Kept so the import is used until the first real call lands here. */
export const workRequest = apiRequest;
