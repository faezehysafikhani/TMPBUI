import React, { lazy, Suspense, useMemo } from 'react';
import { Task, TaskStatus, Attachment, User } from '../types';
import { KanbanColumn } from './KanbanColumn';
import { getTaskLastModifiedTime } from '../utils/helpers';

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
  // Group tasks by status in a single pass, then sort each column by last
  // modification time (newest first). Only statuses with tasks get a column.
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
    return STATUS_KEYS.filter((st) => byStatus.has(st)).map((st) => ({
      status: st,
      tasks: byStatus
        .get(st)!
        .sort((a, b) => getTaskLastModifiedTime(b) - getTaskLastModifiedTime(a)),
    }));
  }, [tasks]);

  return (
    <div className="w-full space-y-6">
      {/* Desktop Drag and Drop Quick Guidance */}
      {columns.length > 1 && (
        <div className="hidden sm:flex items-center justify-between px-4 py-2.5 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 text-indigo-900 dark:text-indigo-200 text-xs font-medium shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
            <span>قابلیت کشیدن و رها کردن (Drag & Drop): کارت هر فعالیت را می‌توانید به ستون دلخواه بکشید تا وضعیت آن بروزرسانی شود.</span>
          </div>
        </div>
      )}

      {columns.length === 0 ? (
        <div className="p-8 text-center bg-white/80 dark:bg-slate-900/80 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            هیچ فعالیتی جهت نمایش وجود ندارد.
          </p>
        </div>
      ) : (
        <div
          className={`grid gap-4 sm:gap-4.5 items-start ${
            columns.length === 1
              ? 'grid-cols-1 max-w-3xl mx-auto'
              : columns.length === 2
              ? 'grid-cols-1 md:grid-cols-2'
              : columns.length === 3
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
          }`}
        >
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
      )}

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
