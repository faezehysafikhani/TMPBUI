/**
 * Track 3 (امنیت، حساب‌ها و مدیریت سیستم): MFA, SSO sign-in, service accounts and API keys, guest
 * users, password policy, plan and usage, data retention, offboarding and role transfer, LDAP sync,
 * SMS gateways, CSV task import, a unit's validity dates.
 *
 * Backend: /api/identity (SecurityEndpoints.cs, IdentityEndpoints.cs), /api/platform,
 * /api/task-management/membership, /api/task-management/tasks/import, /api/org-structure.
 * Use apiRequest; do not add these calls to nexusApi.ts. See docs/UI-WORKSTREAMS.md.
 */
import { apiRequest } from './nexusApi';

/** Kept so the import is used until the first real call lands here. */
export const adminRequest = apiRequest;
