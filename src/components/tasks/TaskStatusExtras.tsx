import React from 'react';
import { Ban } from 'lucide-react';
import type { Task } from '../../types';
import { safeColor, useCustomStatuses } from './taskLookups';

/**
 * The task's custom status label (CAT-253) and a «مانع» mark when something blocks it (CAT-73), for
 * cards and list rows. Nothing when the task has neither.
 */
export const TaskStatusExtras: React.FC<{ task: Task }> = ({ task }) => {
  const statuses = useCustomStatuses();
  const custom = task.server?.customStatusId ? statuses.find((s) => s.id === task.server?.customStatusId) : undefined;
  const blocked = task.server?.blockedReason;
  if (!custom && !blocked) return null;
  const color = safeColor(custom?.color);
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {custom && (
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 whitespace-nowrap"
          title="وضعیت سفارشی"
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: color || '#94a3b8' }} />
          {custom.name}
        </span>
      )}
      {blocked && (
        <span
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900 whitespace-nowrap"
          title={`مانع: ${blocked}`}
        >
          <Ban className="w-2.5 h-2.5" /> مانع
        </span>
      )}
    </span>
  );
};
