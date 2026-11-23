// Track 3 (امنیت، حساب‌ها و مدیریت سیستم) types: the server's shapes (NexusCore.Application/Identity,
// Ldap, Nexus.TaskManagement membership/import, Nexus.OrgStructure offboarding). Enums travel as strings.

export interface ApiKey {
  id: string;
  name: string;
  createdAtUtc: string;
  expiresAtUtc: string | null;
  lastUsedAtUtc: string | null;
  revoked: boolean;
}
export interface ServiceAccount { id: string; name: string; isActive: boolean; keys: ApiKey[] }
/** The secret is shown once, right after it is made. */
export interface ServiceAccountCreated { account: ServiceAccount; secret: string }
export interface ApiKeyCreated { key: ApiKey; secret: string }

export interface SsoProvider { key: string; displayName: string; type: 'Oidc' | 'Saml' | string }
export interface MfaChallenge { challengeId: string; maskedPhone: string; expiresInSeconds: number }

export interface PasswordPolicy { minLength: number; requiredClasses: number; message: string | null }

export type MembershipStatus = 'NoPlan' | 'Active' | 'ExpiringSoon' | 'Expired' | 'NotStarted';
export interface Membership {
  planName: string | null;
  maxUsers: number | null;
  maxStorageMb: number | null;
  validFrom: string | null;
  validUntil: string | null;
  notes: string | null;
  status: MembershipStatus;
  daysLeft: number | null;
  usage: { activeUsers: number; storageBytes: number; taskCount: number; usersPercent: number | null; storagePercent: number | null };
  warnings: string[];
}
export interface SaveMembership {
  planName: string;
  maxUsers?: number | null;
  maxStorageMb?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  notes?: string | null;
}
export interface Retention { automationLogDays: number | null; webhookDeliveryDays: number | null }

export type LdapSyncAction = 'Create' | 'Update' | 'Deactivate' | 'Reactivate' | 'Unchanged' | 'Skipped';
export interface LdapSyncReport {
  applied: boolean;
  created: number;
  updated: number;
  deactivated: number;
  reactivated: number;
  unchanged: number;
  skipped: number;
  rows: { username: string | null; displayName: string | null; action: LdapSyncAction; reason: string | null }[];
}

export interface ImportRow {
  line: number;
  title: string | null;
  dueDate: string | null;
  priority: 'Low' | 'Medium' | 'High' | null;
  assignee: string | null;
  valid: boolean;
  errors: string[];
}
export interface ImportPreview { total: number; valid: number; invalid: number; rows: ImportRow[] }
export interface ImportResult { created: number; skipped: number; taskIds: string[]; failed: ImportRow[] }

export interface OffboardResult {
  userId: string;
  ended: unknown[];
  transferred: unknown[];
  cancelled: unknown[];
  headlessCompanyIds: string[];
}
export interface TransferResult { fromUserId: string; toUserId: string; effectiveDate: string; transferred: unknown[] }
