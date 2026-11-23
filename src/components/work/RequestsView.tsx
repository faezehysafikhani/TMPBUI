import React from 'react';
import { AdminCard, Notice } from '../admin/AdminUi';

/** The requests page (CAT-15/16/22): submit, queue, convert to task, reject. Placeholder from step 0; Track 2 fills it in (docs/UI-WORKSTREAMS.md). */
export const RequestsView: React.FC = () => (
  <AdminCard className="p-5 sm:p-6 space-y-3">
    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">درخواست‌ها</h2>
    <Notice type="info">این بخش در حال ساخت است.</Notice>
  </AdminCard>
);
