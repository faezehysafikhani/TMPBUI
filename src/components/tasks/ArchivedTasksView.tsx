import React from 'react';
import { AdminCard, Notice } from '../admin/AdminUi';

/** The archived tasks page (CAT-210): list, restore. Placeholder from step 0; Track 1 fills it in (docs/UI-WORKSTREAMS.md). */
export const ArchivedTasksView: React.FC = () => (
  <AdminCard className="p-5 sm:p-6 space-y-3">
    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">بایگانی فعالیت‌ها</h2>
    <Notice type="info">این بخش در حال ساخت است.</Notice>
  </AdminCard>
);
