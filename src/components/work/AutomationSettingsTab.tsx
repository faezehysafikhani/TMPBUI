import React from 'react';
import { AdminCard, Notice } from '../admin/AdminUi';

/**
 * Settings tab «اتوماسیون و گزارش» (automation rules and their log, request categories, scheduled report digests). Track 2 owns this file: who sees the tab (canSeeAutomationSettings) and what is in it.
 * SystemAdministration only asks these two exports (docs/UI-WORKSTREAMS.md).
 */
export function canSeeAutomationSettings(can: (permission: string) => boolean): boolean {
  return can('Automation.Manage') || can('Requests.Manage');
}

export const AutomationSettingsTab: React.FC<{ can: (permission: string) => boolean }> = () => (
  <AdminCard className="p-5 sm:p-6 space-y-3">
    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">اتوماسیون و گزارش</h2>
    <Notice type="info">این بخش در حال ساخت است.</Notice>
  </AdminCard>
);
