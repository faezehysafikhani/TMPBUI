import React from 'react';
import { AdminCard, Notice } from '../admin/AdminUi';

/**
 * Settings tab «تنظیمات فعالیت» (statuses, work types, custom fields, WIP limits, templates). Track 1 owns this file: who sees the tab (canSeeTaskSettings) and what is in it.
 * SystemAdministration only asks these two exports (docs/UI-WORKSTREAMS.md).
 */
export function canSeeTaskSettings(can: (permission: string) => boolean): boolean {
  return can('Tasks.ManageStatuses') || can('Tasks.ManageTemplates');
}

export const TaskSettingsTab: React.FC<{ can: (permission: string) => boolean }> = () => (
  <AdminCard className="p-5 sm:p-6 space-y-3">
    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">تنظیمات فعالیت</h2>
    <Notice type="info">این بخش در حال ساخت است.</Notice>
  </AdminCard>
);
