/**
 * Approvals (Nexus.Workflow): the Approval Center, approval chains per kind, approver delegation.
 * Backend: /api/workflow/* (Nexus.Workflow/Endpoints/WorkflowEndpoints.cs); the subjects' titles come from the
 * modules that submit them (task review, timesheets). Use apiRequest; see docs/WORKFLOW-PROGRESS.md.
 */
import { apiRequest, getSessionTenantId, reloadTasksSoon } from './nexusApi';
import type {
  ApprovalKind,
  Delegation,
  SaveStep,
  TaskReviewItem,
  TimesheetReviewItem,
  WorkflowDefinition,
  WorkflowInstance,
} from '../components/approvals/types';

export const APPROVAL_PERMISSIONS = {
  view: 'Workflow.View',
  configure: 'Workflow.Configure',
  approve: 'Workflow.Approve',
  reject: 'Workflow.Reject',
} as const;

export const APPROVAL_KIND_LABELS: Record<ApprovalKind, string> = {
  TaskReview: 'بازبینی فعالیت',
  Timesheet: 'ساعت کار هفتگی',
};

// ------------------------------------------------------------------ Approval Center

/** Approvals waiting for the caller (their own, and those delegated to them). */
export const listPendingApprovals = () => apiRequest<WorkflowInstance[]>('GET', '/api/workflow/approval-center', { cache: 'no-store' });
export const getApproval = (id: string) => apiRequest<WorkflowInstance>('GET', `/api/workflow/approval-center/${id}`, { cache: 'no-store' });
/** The approvals (any state) of the given subjects, e.g. a task's review history. */
export const listApprovalsFor = (subjectType: ApprovalKind, subjectIds: string[]) =>
  apiRequest<WorkflowInstance[]>('POST', '/api/workflow/approval-center/for-subjects', { body: { subjectType, subjectIds } });

export async function approve(id: string, comment: string | null) {
  const result = await apiRequest<WorkflowInstance>('POST', `/api/workflow/approval-center/${id}/approve`, { body: { comment: comment?.trim() || null } });
  reloadTasksSoon();
  return result;
}
export async function reject(id: string, comment: string | null) {
  const result = await apiRequest<WorkflowInstance>('POST', `/api/workflow/approval-center/${id}/reject`, { body: { comment: comment?.trim() || null } });
  reloadTasksSoon();
  return result;
}

/** Titles of the tasks waiting for review among the ids. */
export const taskReviewItems = (ids: string[]) =>
  ids.length ? apiRequest<TaskReviewItem[]>('POST', '/api/task-management/tasks/in-review', { body: { ids } }) : Promise.resolve([]);
/** Who and which week, for the timesheet approvals among the ids. */
export const timesheetReviewItems = (ids: string[]) =>
  ids.length ? apiRequest<TimesheetReviewItem[]>('POST', '/api/task-management/timesheets/in-review', { body: { ids } }) : Promise.resolve([]);

// ------------------------------------------------------------------ task review (submitting)

/** The person doing the task asks for it to be checked; with no chain the task is completed at once. */
export async function submitTaskReview(taskId: string, comment: string | null) {
  const result = await apiRequest<{ status: string; reviewStatus: string }>('POST', `/api/task-management/tasks/${taskId}/submit-review`, { body: { comment: comment?.trim() || null } });
  reloadTasksSoon();
  return result;
}

// ------------------------------------------------------------------ approval chains

export const listDefinitions = (subjectType?: ApprovalKind) =>
  apiRequest<WorkflowDefinition[]>('GET', '/api/workflow/definitions', { query: { subjectType }, cache: 'no-store' });
/** The organization-wide chain for a kind: its steps become exactly these (empty: no approval needed). */
export const saveChain = (subjectType: ApprovalKind, name: string, steps: SaveStep[]) =>
  apiRequest<WorkflowDefinition>('PUT', '/api/workflow/definitions/by-scope', {
    body: { tenantId: getSessionTenantId(), subjectType, scopeType: null, scopeId: null, name, steps },
  });

// ------------------------------------------------------------------ delegations

export const listDelegations = () => apiRequest<Delegation[]>('GET', '/api/workflow/delegations', { cache: 'no-store' });
export const createDelegation = (input: { delegateUserId: string; startDate: string; endDate: string; subjectType?: ApprovalKind | null; reason?: string | null }) =>
  apiRequest<Delegation>('POST', '/api/workflow/delegations', { body: { ...input, subjectType: input.subjectType || null, reason: input.reason?.trim() || null } });
export const revokeDelegation = (id: string) => apiRequest<unknown>('POST', `/api/workflow/delegations/${id}/revoke`);
