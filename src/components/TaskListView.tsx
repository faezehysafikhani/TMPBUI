import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Tag, FolderKanban, Repeat, AlertCircle } from 'lucide-react';
import { Task, User, STATUSES, PRIORITIES } from '../types';
import { formatToJalali, getTaskLastModifiedTime, isOverdue, toPersianDigits } from '../utils/helpers';
import { responsibleNamesOf } from '../utils/taskPeople';
import { can } from '../utils/permissions';
import { BulkActionBar } from './tasks/BulkActionBar';
import { TaskStatusExtras } from './tasks/TaskStatusExtras';
import { TASK_FEATURE_PERMISSIONS } from '../services/taskFeaturesApi';

interface TaskListViewProps {
  tasks: Task[];
  showDetails: boolean;
  onViewDetails?: (task: Task) => void;
  /** With Tasks.Edit, rows can be selected for bulk actions (CAT-74). */
  currentUser?: User | null;
}

const SYSTEM_TAGS = new Set(['تکرارشونده', 'تکرار', 'فعالیت تکرارشونده']);

const STATUS_DOT: Record<string, string> = { todo: 'bg-slate-400', in_progress: 'bg-blue-500', paused: 'bg-amber-500', completed: 'bg-emerald-500' };
const PRIORITY_DOT: Record<string, string> = { high: 'bg-rose-500', medium: 'bg-amber-400', low: 'bg-emerald-500' };

/** «بدون گروه‌بندی»: every task as one numbered row, newest change first. A row opens the task. */
export const TaskListView: React.FC<TaskListViewProps> = ({ tasks, showDetails, onViewDetails, currentUser }) => {
  const rows = useMemo(
    () => [...tasks].sort((a, b) => getTaskLastModifiedTime(b) - getTaskLastModifiedTime(a)),
    [tasks],
  );
  const selectable = !!currentUser && can(currentUser, TASK_FEATURE_PERMISSIONS.edit);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // A task that left the list (archived, filtered out) is no longer selected.
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(rows.map((r) => r.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allSelected = rows.length > 0 && selected.size === rows.length;

  if (rows.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
        <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">هیچ فعالیتی برای نمایش وجود ندارد</p>
      </div>
    );
  }

  const th = 'px-4 py-3 text-right text-xs font-semibold text-slate-400 dark:text-slate-500 whitespace-nowrap';
  const td = 'px-4 py-3 align-middle';

  return (
    <div className="space-y-2">
    {selectable && selected.size > 0 && (
      <BulkActionBar selectedIds={[...selected]} onDone={() => setSelected(new Set())} onClear={() => setSelected(new Set())} />
    )}
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
            <tr>
              {selectable && (
                <th className={`${th} w-10`}>
                  <input
                    type="checkbox"
                    aria-label="انتخاب همه"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = selected.size > 0 && !allSelected; }}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                    className="cursor-pointer"
                  />
                </th>
              )}
              <th className={`${th} w-12`}>ردیف</th>
              <th className={th}>عنوان فعالیت</th>
              <th className={th}>وضعیت</th>
              <th className={th}>اولویت</th>
              {showDetails && <th className={th}>مالک</th>}
              {showDetails && <th className={th}>مسئول</th>}
              <th className={th}>موعد انجام</th>
              <th className={`${th} w-14`}><span className="sr-only">جزئیات</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {rows.map((task, index) => {
              const status = STATUSES[task.status];
              const priority = PRIORITIES[task.priority] || PRIORITIES.medium;
              const overdue = isOverdue(task.dueDate, task.status);
              const tags = (task.tags || []).filter((t) => t.trim() && !SYSTEM_TAGS.has(t));
              return (
                <tr
                  key={task.id}
                  onClick={() => onViewDetails?.(task)}
                  className={`transition-colors ${onViewDetails ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}`}
                >
                  {selectable && (
                    <td className={td} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`انتخاب «${task.title}»`}
                        checked={selected.has(task.id)}
                        onChange={() => toggle(task.id)}
                        className="cursor-pointer"
                      />
                    </td>
                  )}
                  <td className={`${td} text-slate-400 font-bold tabular-nums`}>{toPersianDigits(index + 1)}</td>
                  <td className={`${td} min-w-[220px]`}>
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                      {task.isProject && <FolderKanban className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      {task.isRecurring && <Repeat className="w-3.5 h-3.5 text-violet-600 shrink-0" />}
                      <span className="line-clamp-1" title={task.title}>{task.title}</span>
                    </div>
                    {showDetails && tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tags.map((t) => (
                          <span key={t} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            <Tag className="w-2.5 h-2.5" />#{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className={td}>
                    <span className="inline-flex flex-wrap items-center gap-1">
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        <span className={`w-2 h-2 rounded-full ${STATUS_DOT[task.status]}`} aria-hidden="true" />
                        {status.title}
                      </span>
                      <TaskStatusExtras task={task} />
                    </span>
                  </td>
                  <td className={td}>
                    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[task.priority || 'medium']}`} aria-hidden="true" />
                      {priority.title}
                    </span>
                  </td>
                  {showDetails && <td className={`${td} text-slate-600 dark:text-slate-300 whitespace-nowrap`}>{task.ownerName || '—'}</td>}
                  {showDetails && <td className={`${td} text-slate-600 dark:text-slate-300 whitespace-nowrap max-w-[14rem] truncate`} title={responsibleNamesOf(task) || undefined}>{responsibleNamesOf(task) || "—"}</td>}
                  <td className={`${td} whitespace-nowrap ${overdue ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                    <span className="inline-flex items-center gap-1">
                      {overdue && <AlertCircle className="w-3.5 h-3.5" />}
                      {task.dueDate ? formatToJalali(task.dueDate) : '—'}
                    </span>
                  </td>
                  <td className={td}>
                    {onViewDetails && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onViewDetails(task); }}
                        title="مشاهده جزئیات و گفتگو"
                        aria-label="مشاهده جزئیات و گفتگو"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
};
