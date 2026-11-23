import React from 'react';
import { AdminCard, Notice } from '../admin/AdminUi';

/** The timesheet page (CAT-159/77): week view, entries, timer, workload. Placeholder from step 0; Track 2 fills it in (docs/UI-WORKSTREAMS.md). */
export const TimesheetsView: React.FC = () => (
  <AdminCard className="p-5 sm:p-6 space-y-3">
    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">ساعت کار</h2>
    <Notice type="info">این بخش در حال ساخت است.</Notice>
  </AdminCard>
);
