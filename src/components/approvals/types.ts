// Approvals (Nexus.Workflow) types: the server's shapes (Nexus.Workflow/Application/Dtos/WorkflowDtos.cs).

/** The kinds of approval the TMPB modules submit. */
export type ApprovalKind = 'TaskReview' | 'Timesheet';

export interface WorkflowStep {
  id: string;
  order: number;
  name: string;
  approverUserId: string | null;
  approverRoleId: string | null;
  /** A role in the organization chart, filled when the approval starts: Owner, Manager, Approver1, Approver2. */
  approverKey: string | null;
  isOptional: boolean;
}
export interface WorkflowDefinition {
  id: string;
  name: string;
  subjectType: string;
  scopeType: string;
  scopeId: string | null;
  isActive: boolean;
  steps: WorkflowStep[];
}
export interface SaveStep {
  name: string;
  approverUserId?: string | null;
  approverRoleId?: string | null;
  approverKey?: string | null;
  isOptional?: boolean;
}

export interface WorkflowDecision {
  id: string;
  stepOrder: number;
  decidedByUserId: string;
  approved: boolean;
  comment: string | null;
  decidedAtUtc: string;
  onBehalfOfUserId?: string | null;
}
export interface WorkflowInstance {
  id: string;
  workflowDefinitionId: string;
  subjectType: string;
  subjectId: string;
  totalSteps: number;
  currentStepOrder: number;
  status: 'InProgress' | 'Approved' | 'Rejected';
  decisions: WorkflowDecision[];
  currentApproverUserId: string | null;
  /** Set when the caller sees this item because someone delegated their approvals to them. */
  delegatedFromUserId: string | null;
  steps: { order: number; name: string; approverUserId: string | null }[] | null;
}

export interface Delegation {
  id: string;
  delegatorUserId: string;
  delegateUserId: string;
  startDate: string;
  endDate: string;
  subjectType: string | null;
  reason: string | null;
  isRevoked: boolean;
  isActiveNow: boolean;
}

/** What a pending item is about, from the module that submitted it. */
export interface TaskReviewItem { id: string; title: string; dueDate: string; submittedBy: { id: string; displayName: string } | null; submittedAtUtc: string | null; comment: string | null }
export interface TimesheetReviewItem { id: string; user: { id: string; displayName: string } | null; weekStart: string; totalMinutes: number; submittedAtUtc: string }
