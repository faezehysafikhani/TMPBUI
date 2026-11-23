import React, { useState } from 'react';
import { Task, TaskStatus, STATUSES, Attachment, User } from '../types';
import { TaskCardList } from './TaskCardList';
import { toPersianDigits } from '../utils/helpers';
import { Plus, ChevronDown, Move } from 'lucide-react';

const DOT: Record<TaskStatus, string> = { todo: 'bg-slate-400', in_progress: 'bg-blue-500', paused: 'bg-amber-500', completed: 'bg-emerald-500' };
import { can, PERMISSIONS } from '../utils/permissions';

interface KanbanColumnProps {
  status: TaskStatus;
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
  showDetails?: boolean;
}

const KanbanColumnBase: React.FC<KanbanColumnProps> = ({
  status,
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
  showDetails = true,
}) => {
  // Columns start open (the board is the main screen); the header closes one.
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const canCreate = can(currentUser, PERMISSIONS.tasksCreate);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const cfg = STATUSES[status];

  const dragHighlightStyles: Record<TaskStatus, string> = {
    todo: 'border-indigo-500 ring-4 ring-indigo-400/50 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-xl scale-[1.01]',
    in_progress: 'border-blue-500 ring-4 ring-blue-400/50 bg-blue-50/70 dark:bg-blue-950/50 shadow-xl scale-[1.01]',
    paused: 'border-amber-500 ring-4 ring-amber-400/50 bg-amber-50/70 dark:bg-amber-950/50 shadow-xl scale-[1.01]',
    completed: 'border-emerald-500 ring-4 ring-emerald-400/50 bg-emerald-50/70 dark:bg-emerald-950/50 shadow-xl scale-[1.01]',
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!isDragOver) setIsDragOver(true);
        if (isCollapsed) setIsCollapsed(false);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const taskId = e.dataTransfer.getData('text/plain');
        if (taskId) {
          onStatusChange(taskId, status);
        }
      }}
      className={`w-full max-w-full overflow-hidden flex flex-col rounded-2xl border transition-all duration-200 bg-slate-100/70 dark:bg-slate-900/60 ${
        isDragOver ? dragHighlightStyles[status] : 'border-transparent'
      }`}
    >
      {/* Column header: status, count, add, close */}
      <div className="flex items-center gap-2 h-12 px-3.5 select-none">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT[status]}`} aria-hidden="true" />
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{cfg.title}</h2>
        <span className="min-w-[24px] h-6 px-2 rounded-full bg-white dark:bg-slate-800 text-xs font-bold text-slate-500 dark:text-slate-300 flex items-center justify-center tabular-nums">
          {toPersianDigits(tasks.length)}
        </span>
        {isDragOver && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">رها کنید</span>}
        <span className="flex-1" />
        {canCreate && (
          <button
            type="button"
            onClick={() => onOpenCreateForStatus(status)}
            title={`فعالیت جدید در «${cfg.title}»`}
            aria-label={`فعالیت جدید در «${cfg.title}»`}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? 'باز کردن ستون' : 'بستن ستون'}
          aria-label={isCollapsed ? `باز کردن ستون «${cfg.title}»` : `بستن ستون «${cfg.title}»`}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-colors"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {/* Drop Indicator Header if Collapsed */}
      {isCollapsed && isDragOver && (
        <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-xs font-bold text-center border-t border-indigo-200 dark:border-indigo-800 animate-pulse">
          رها کنید تا کارت به «{cfg.title}» منتقل شود
        </div>
      )}

      {/* Accordion Body (Only rendered/visible when NOT collapsed) */}
      {!isCollapsed && (
        <div className="px-2.5 pb-2.5 animate-in fade-in duration-200">
          {/* Active Drag Over Drop Box */}
          {isDragOver && (
            <div className="my-3 p-3.5 rounded-2xl border-2 border-dashed border-indigo-500 dark:border-indigo-400 bg-indigo-100/80 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 text-center animate-pulse flex items-center justify-center gap-2 font-bold text-xs shadow-inner">
              <Move className="w-4 h-4 animate-bounce text-indigo-600 dark:text-indigo-400" />
              <span>کارت را اینجا رها کنید تا به «{cfg.title}» منتقل شود</span>
            </div>
          )}

          <div className="space-y-2.5 overflow-y-auto max-h-[calc(100vh-300px)] p-0.5">
            {tasks.length === 0 ? (
              <div className="h-28 flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-2">
                  هیچ فعالیتی در این بخش وجود ندارد
                </p>
                {canCreate && (
                <button
                  type="button"
                  onClick={() => onOpenCreateForStatus(status)}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ثبت فعالیت جدید</span>
                </button>
                )}
              </div>
            ) : (
              <TaskCardList
                tasks={tasks}
                currentUser={currentUser}
                showDetails={showDetails}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                onStatusChange={onStatusChange}
                onPreviewAttachment={onPreviewAttachment}
                onViewDetails={onViewDetails}
                onOpenProjectDetails={onOpenProjectDetails}
                onToggleSubTask={onToggleSubTask}
              />
            )}
          </div>
          {canCreate && tasks.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenCreateForStatus(status)}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-xl text-sm font-semibold text-slate-500 hover:text-indigo-700 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-300 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" /> افزودن فعالیت
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const KanbanColumn = React.memo(KanbanColumnBase);
