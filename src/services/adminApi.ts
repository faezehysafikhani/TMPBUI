/**
 * Track 3 (امنیت، حساب‌ها و مدیریت سیستم): MFA, SSO sign-in, service accounts and API keys, guest
 * users, password policy, plan and usage, data retention, offboarding and role transfer, LDAP sync,
 * SMS gateways, CSV task import, a unit's validity dates.
 *
 * Backend: /api/identity (SecurityEndpoints.cs, IdentityEndpoints.cs), /api/platform,
 * /api/task-management/membership, /api/task-management/tasks/import, /api/org-structure.
 * Use apiRequest; do not add these calls to nexusApi.ts. See docs/UI-WORKSTREAMS.md.
 */
import { apiRequest, getSessionTenantId, reloadTasksSoon } from './nexusApi';
import type {
  ApiKeyCreated,
  ImportPreview,
  ImportResult,
  LdapSyncReport,
  Membership,
  MfaChallenge,
  OffboardResult,
  PasswordPolicy,
  Retention,
  SaveMembership,
  ServiceAccount,
  ServiceAccountCreated,
  SsoProvider,
  TransferResult,
} from '../components/security/types';

/** Permission names (NexusCore IdentityPermissions, TaskManagementPermissions, OrgStructurePermissions). */
export const ADMIN_PERMISSIONS = {
  usersView: 'users.view',
  usersCreate: 'users.create',
  usersUpdate: 'users.update',
  settingsUpdate: 'settings.update',
  ldapUpdate: 'ldap_settings.update',
  membershipView: 'Membership.View',
  membershipManage: 'Membership.Manage',
  tasksCreate: 'Tasks.Create',
  orgManageAssignments: 'org_structure.manage_assignments',
} as const;

// ------------------------------------------------------------------ MFA (the signed-in person; admins reset)

/** Whether the signed-in person signs in with an SMS code. */
export async function getMyMfaEnabled(): Promise<boolean> {
  const me = await apiRequest<{ user: { mfaEnabled?: boolean } }>('GET', '/api/identity/auth/me', { cache: 'no-store' });
  return !!me.user?.mfaEnabled;
}
/** A code goes to the person's mobile; confirming it turns the SMS code on. */
export const requestMfaEnable = () => apiRequest<MfaChallenge>('POST', '/api/identity/auth/me/mfa/request-enable');
export const confirmMfaEnable = (challengeId: string, code: string) =>
  apiRequest<unknown>('POST', '/api/identity/auth/me/mfa/confirm-enable', { body: { challengeId, code: code.trim() } });
export const disableMfa = (password: string) => apiRequest<unknown>('POST', '/api/identity/auth/me/mfa/disable', { body: { password } });
/** For someone who lost their phone: their SMS code is switched off. */
export const resetUserMfa = (userId: string) => apiRequest<unknown>('POST', `/api/identity/users/${userId}/mfa/reset`);

// ------------------------------------------------------------------ SSO

/** The configured identity providers (none: no SSO buttons). Asked before sign-in. */
export async function listSsoProviders(): Promise<SsoProvider[]> {
  try {
    return await apiRequest<SsoProvider[]>('GET', '/api/identity/auth/sso/providers', { auth: false, retryOnUnauthorized: false });
  } catch {
    return [];
  }
}

// ------------------------------------------------------------------ guests and access end

export const setUserKind = (userId: string, kind: 'Normal' | 'Guest') =>
  apiRequest<unknown>('PUT', `/api/identity/users/${userId}/kind`, { body: { kind } });
/** null: the access does not end. */
export const setUserAccessExpiry = (userId: string, expiresAtUtc: string | null) =>
  apiRequest<unknown>('PUT', `/api/identity/users/${userId}/access-expiry`, { body: { expiresAtUtc } });

// ------------------------------------------------------------------ service accounts

export const listServiceAccounts = () => apiRequest<ServiceAccount[]>('GET', '/api/identity/service-accounts', { cache: 'no-store' });
export const createServiceAccount = (name: string, keyExpiresInDays: number | null) =>
  apiRequest<ServiceAccountCreated>('POST', '/api/identity/service-accounts', { body: { name: name.trim(), keyExpiresInDays } });
export const addApiKey = (accountId: string, name: string, expiresInDays: number | null) =>
  apiRequest<ApiKeyCreated>('POST', `/api/identity/service-accounts/${accountId}/api-keys`, { body: { name: name.trim(), expiresInDays } });
export const revokeApiKey = (accountId: string, keyId: string) =>
  apiRequest<unknown>('DELETE', `/api/identity/service-accounts/${accountId}/api-keys/${keyId}`);

// ------------------------------------------------------------------ password policy (organization settings)

export const getPasswordPolicy = () => apiRequest<PasswordPolicy>('GET', '/api/platform/password-policy', { cache: 'no-store' });
/**
 * Stored as this organization's settings Security.PasswordMinLength (8-64) / Security.PasswordRequiredClasses (2-4),
 * scope System, which is where the server's PasswordPolicyReader looks.
 */
export async function savePasswordPolicy(minLength: number, requiredClasses: number) {
  const tenantId = getSessionTenantId();
  for (const [key, value] of [['Security.PasswordMinLength', minLength], ['Security.PasswordRequiredClasses', requiredClasses]] as const) {
    await apiRequest<unknown>('PUT', '/api/platform/settings', { body: { tenantId, key, value: String(value), scope: 'System' } });
  }
}

// ------------------------------------------------------------------ plan, usage, retention

export const getMembership = () => apiRequest<Membership>('GET', '/api/task-management/membership', { cache: 'no-store' });
export const saveMembership = (input: SaveMembership) => apiRequest<Membership>('PUT', '/api/task-management/membership', { body: input });
export const clearMembership = () => apiRequest<unknown>('DELETE', '/api/task-management/membership');
export const getRetention = () => apiRequest<Retention>('GET', '/api/task-management/membership/retention', { cache: 'no-store' });
export const saveRetention = (input: Retention) => apiRequest<Retention>('PUT', '/api/task-management/membership/retention', { body: input });

// ------------------------------------------------------------------ LDAP / AD sync

export const previewLdapSync = (deactivateMissing: boolean) =>
  apiRequest<LdapSyncReport>('POST', '/api/platform/ldap/sync/preview', { body: { deactivateMissing } });
export const runLdapSync = (deactivateMissing: boolean) =>
  apiRequest<LdapSyncReport>('POST', '/api/platform/ldap/sync', { body: { deactivateMissing } });

// ------------------------------------------------------------------ CSV task import

export const previewTaskImport = (csv: string) => apiRequest<ImportPreview>('POST', '/api/task-management/tasks/import/preview', { body: { csv } });
export async function runTaskImport(csv: string, skipInvalid: boolean) {
  const result = await apiRequest<ImportResult>('POST', '/api/task-management/tasks/import', { body: { csv, skipInvalid } });
  reloadTasksSoon();
  return result;
}

// ------------------------------------------------------------------ offboarding and role transfer

/** The person leaves: their posts are handed to the successor (or freed), all in one save. */
export const offboardUser = (userId: string, successorUserId: string | null) =>
  apiRequest<OffboardResult>('POST', `/api/org-structure/users/${userId}/offboard`, { body: { successorUserId } });
/** The person's posts move to another person from the given day (default: now). */
export const transferUserPosts = (userId: string, toUserId: string, effectiveDate: string | null) =>
  apiRequest<TransferResult>('POST', `/api/org-structure/users/${userId}/transfer`, { body: { toUserId, effectiveDate } });
