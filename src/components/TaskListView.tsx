import React, { useMemo } from 'react';
import { Eye, Tag, FolderKanban, Repeat, AlertCircle } from 'lucide-react';
import { Task, STATUSES, PRIORITIES } from '../types';
import { formatToJalali, getTaskLastModifiedTime, isOverdue, toPersianDigits } from '../utils/helpers';
import { responsibleNamesOf } from '../utils/taskPeople';

interface TaskListViewProps {
  tasks: Task[];
  showDetails: boolean;
  onViewDetails?: (task: Task) => void;
}

const SYSTEM_TAGS = new Set(['تکرارشونده', 'تکرار', 'فعالیت تکرارشونده']);

/** «بدون گروه‌بندی»: every task as one numbered row, newest change first. A row opens the task. */
export const TaskListView: React.FC<TaskListViewProps> = ({ tasks, showDetails, onViewDetails }) => {
  const rows = useMemo(
    () => [...tasks].sort((a, b) => getTaskLastModifiedTime(b) - getTaskLastModifiedTime(a)),
    [tasks],
  );

  if (rows.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40">
        <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">هیچ فعالیتی برای نمایش وجود ندارد</p>
      </div>
    );
  }

  const th = 'px-3 py-2.5 text-right text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap';
  const td = 'px-3 py-2.5 align-middle';

  return (
    <div className="ui-surface w-full overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[720px] text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700">
            <tr>
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
                  className={`transition-colors ${onViewDetails ? 'cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-slate-800/60' : ''}`}
                >
                  <td className={`${td} text-slate-400 font-bold tabular-nums`}>{toPersianDigits(index + 1)}</td>
                  <td className={`${td} min-w-[220px]`}>
                    <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                      {task.isProject && <FolderKanban className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      {task.isRecurring && <Repeat className="w-3.5 h-3.5 text-violet-600 shrink-0" />}
                      <span className="line-clamp-1" title={task.title}>{task.title}</span>
                    </div>
                    {showDetails && tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tags.map((t) => (
                          <span key={t} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            <Tag className="w-2.5 h-2.5" />#{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className={td}>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${status.badgeBg} ${status.badgeText}`}>
                      {status.title}
                    </span>
                  </td>
                  <td className={td}>
                    <span className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold border whitespace-nowrap ${priority.bgColor} ${priority.textColor} ${priority.borderColor}`}>
                      {priority.title}
                    </span>
                  </td>
                  {showDetails && <td className={`${td} text-slate-600 dark:text-slate-300 whitespace-nowrap`}>{task.ownerName || '—'}</td>}
                  {showDetails && <td className={`${td} text-slate-600 dark:text-slate-300`}>{responsibleNamesOf(task) || '—'}</td>}
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
  );
};
