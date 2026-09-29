import React, { useState } from 'react';
import { Task, TaskStatus, STATUSES, Attachment, User } from '../types';
import { TaskCard } from './TaskCard';
import { toPersianDigits } from '../utils/helpers';
import { Plus, Move, Play, Zap, Pause, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { can, PERMISSIONS } from '../utils/permissions';

// One friendly, solid-colored icon per status, so every column reads at a glance - not just
// "شروع نشده" and "متوقف".
const STATUS_ICONS: Record<TaskStatus, React.ComponentType<{ className?: string }>> = {
  todo: Play,
  in_progress: Zap,
  paused: Pause,
  completed: Check,
};

const STATUS_ICON_BG: Record<TaskStatus, string> = {
  todo: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
  in_progress: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
  paused: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
};

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
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const cfg = STATUSES[status];
  const StatusIcon = STATUS_ICONS[status];

  // A valid drop target always reads the same way, whatever status it is: pale lavender with
  // an indigo border - the drag-state meaning belongs to "valid destination", not the column's
  // own color.
  const dragHighlightStyle =
    'border-indigo-500 ring-4 ring-indigo-300/60 bg-indigo-50/80 dark:bg-indigo-950/50 shadow-xl scale-[1.01]';

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
      className={`w-full max-w-full overflow-hidden flex flex-col rounded-[14px] border transition-all duration-200 bg-white dark:bg-[#15172D] ${
        isDragOver ? dragHighlightStyle : `${cfg.borderColor} dark:border-slate-800`
      }`}
    >
      {/* Column Accordion Header */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="relative flex items-center justify-between gap-3 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-[14px] transition-colors select-none"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Status Icon: one friendly, solid-colored badge per status */}
          <div className={`w-10 h-10 shrink-0 rounded-[10px] flex items-center justify-center ${STATUS_ICON_BG[status]}`}>
            <StatusIcon className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {cfg.title}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${cfg.badgeBg} ${cfg.badgeText}`}>
                {toPersianDigits(tasks.length)} مورد
              </span>
            </div>
            {/* Reserved height for exactly 2 lines, whatever the actual description length, so
                every collapsed status card reads at the same height regardless of wrap. */}
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400 hidden sm:line-clamp-2 sm:min-h-[2.5rem] mt-0.5">{cfg.description}</p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          {isDragOver && (
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-600 text-white animate-pulse">
              رها کنید
            </span>
          )}
          {can(currentUser, PERMISSIONS.tasksCreate) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCreateForStatus(status);
              }}
              aria-label={`ثبت فعالیت جدید در ستون ${cfg.title}`}
              className="w-10 h-10 rounded-[10px] flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-300 dark:hover:text-indigo-400 transition-colors"
              title="ثبت فعالیت جدید"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
            aria-label={isCollapsed ? `باز کردن ستون ${cfg.title}` : `بستن ستون ${cfg.title}`}
            className="w-10 h-10 rounded-[10px] flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            title={isCollapsed ? 'باز کردن گروه‌بندی' : 'بستن گروه‌بندی'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Drop Indicator Header if Collapsed */}
      {isCollapsed && isDragOver && (
        <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-xs font-bold text-center border-t border-indigo-200 dark:border-indigo-800 animate-pulse">
          رها کنید تا کارت به «{cfg.title}» منتقل شود
        </div>
      )}

      {/* Accordion Body (Only rendered/visible when NOT collapsed) */}
      {!isCollapsed && (
        <div className="p-3 sm:p-4 pt-0 border-t border-slate-100 dark:border-slate-700/60 animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Active Drag Over Drop Box */}
          {isDragOver && (
            <div className="my-3 p-3.5 rounded-2xl border-2 border-dashed border-indigo-500 dark:border-indigo-400 bg-indigo-100/80 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 text-center animate-pulse flex items-center justify-center gap-2 font-bold text-xs shadow-inner">
              <Move className="w-4 h-4 animate-bounce text-indigo-600 dark:text-indigo-400" />
              <span>کارت را اینجا رها کنید تا به «{cfg.title}» منتقل شود</span>
            </div>
          )}

          <div className="space-y-3 mt-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-0.5 pl-0.5">
            {tasks.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-700 rounded-[14px] bg-slate-50/60 dark:bg-slate-900/30 p-4 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-2">
                  هیچ فعالیتی در این بخش وجود ندارد
                </p>
                {can(currentUser, PERMISSIONS.tasksCreate) && (
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
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  currentUser={currentUser}
                  onEdit={onEditTask}
                  onDelete={onDeleteTask}
                  onStatusChange={onStatusChange}
                  onPreviewAttachment={onPreviewAttachment}
                  onViewDetails={onViewDetails}
                  onOpenProjectDetails={onOpenProjectDetails}
                  onToggleSubTask={onToggleSubTask}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const KanbanColumn = React.memo(KanbanColumnBase);
