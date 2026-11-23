import React from 'react';
import { AdminCard, Notice } from '../admin/AdminUi';

/**
 * Settings tab «امنیت و حساب‌ها» (service accounts, password policy, plan and usage, data retention, CSV import). Track 3 owns this file: who sees the tab (canSeeSecuritySettings) and what is in it.
 * SystemAdministration only asks these two exports (docs/UI-WORKSTREAMS.md).
 */
export function canSeeSecuritySettings(can: (permission: string) => boolean): boolean {
  return can('users.update') || can('settings.update') || can('Membership.View');
}

export const SecuritySettingsTab: React.FC<{ can: (permission: string) => boolean }> = () => (
  <AdminCard className="p-5 sm:p-6 space-y-3">
    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">امنیت و حساب‌ها</h2>
    <Notice type="info">این بخش در حال ساخت است.</Notice>
  </AdminCard>
);
