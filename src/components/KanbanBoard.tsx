import React, { lazy, Suspense, useMemo, useState } from 'react';
import { Task, TaskStatus, Attachment, User } from '../types';
import { KanbanColumn } from './KanbanColumn';
import { getTaskLastModifiedTime } from '../utils/helpers';
import { X } from 'lucide-react';

const DashboardCharts = lazy(() => import('./DashboardCharts').then(m => ({ default: m.DashboardCharts })));

const STATUS_KEYS: TaskStatus[] = ['todo', 'in_progress', 'paused', 'completed'];

interface KanbanBoardProps {
  tasks: Task[];
  currentUser?: User | null;
  onOpenCreateForStatus: (status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onPreviewAttachment: (attachment: Attachment) => void;
  onViewDetails?: (task: Task) => void;
  onOpenProjectDetails?: (task: Task) => void;
  onToggleSubTask?: (taskId: string, subTaskId: string) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  tasks,
  currentUser,
  onOpenCreateForStatus,
  onEditTask,
  onDeleteTask,
  onStatusChange,
  onPreviewAttachment,
  onViewDetails,
  onOpenProjectDetails,
  onToggleSubTask,
}) => {
  const [showDragGuide, setShowDragGuide] = useState(() => localStorage.getItem('tm_drag_guide_seen') !== 'true');

  const dismissDragGuide = () => {
    localStorage.setItem('tm_drag_guide_seen', 'true');
    setShowDragGuide(false);
  };

  // Group tasks by status in a single pass, then sort each column by last
  // modification time (newest first). Every status gets a column, even an empty one - an
  // empty column is still a valid drop target (design.md section 12.1), and hiding it would
  // make dragging a card into an empty status impossible.
  const columns = useMemo(() => {
    const byStatus = new Map<TaskStatus, Task[]>();
    for (const task of tasks) {
      const bucket = byStatus.get(task.status);
      if (bucket) {
        bucket.push(task);
      } else {
        byStatus.set(task.status, [task]);
      }
    }
    return STATUS_KEYS.map((st) => ({
      status: st,
      tasks: (byStatus.get(st) ?? []).sort((a, b) => getTaskLastModifiedTime(b) - getTaskLastModifiedTime(a)),
    }));
  }, [tasks]);

  return (
    <div className="w-full space-y-6">
      {/* First-use guidance stays dismissible instead of becoming permanent page content. */}
      {showDragGuide && <div className="hidden sm:flex items-center justify-between gap-4 px-4 py-3 bg-white dark:bg-[#15172D] rounded-[14px] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
          <span>برای تغییر وضعیت، کارت فعالیت را روی ستون مقصد رها کنید.</span>
        </div>
        <button type="button" onClick={dismissDragGuide} aria-label="بستن راهنمای جابه‌جایی" className="min-w-10 min-h-10 rounded-[10px] inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200">
          <X className="w-4 h-4" />
        </button>
      </div>}

      {/* Every status gets a column, empty ones included - an empty column is still a valid
          drop target (design.md section 12.1). */}
      <div className="grid gap-4 sm:gap-4.5 items-start grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {columns.map(({ status, tasks: columnTasks }) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={columnTasks}
            currentUser={currentUser}
            onOpenCreateForStatus={onOpenCreateForStatus}
            onEditTask={onEditTask}
            onDeleteTask={onDeleteTask}
            onStatusChange={onStatusChange}
            onPreviewAttachment={onPreviewAttachment}
            onViewDetails={onViewDetails}
            onOpenProjectDetails={onOpenProjectDetails}
            onToggleSubTask={onToggleSubTask}
          />
        ))}
      </div>

      {/* Dashboard Charts: 2 side-by-side charts under grouping boxes */}
      <Suspense fallback={<div className="h-48 bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl animate-pulse my-4" />}>
        <DashboardCharts
          tasks={tasks}
          currentUser={currentUser}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          onViewDetails={onViewDetails}
        />
      </Suspense>
    </div>
  );
};
