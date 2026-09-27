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
  todo: 'bg-blue-500',
  in_progress: 'bg-violet-500',
  paused: 'bg-amber-500',
  completed: 'bg-emerald-500',
};

// The actual hex behind each icon color, for the header's soft wave background.
const STATUS_WAVE_COLOR: Record<TaskStatus, string> = {
  todo: '#3b82f6',
  in_progress: '#8b5cf6',
  paused: '#f59e0b',
  completed: '#10b981',
};

/** Two soft, overlapping waves in the status color - the header's decorative backdrop. */
const HeaderWaves: React.FC<{ color: string }> = ({ color }) => (
  <svg
    className="pointer-events-none absolute inset-0 w-full h-full"
    viewBox="0 0 400 120"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <path d="M0,85 C110,45 290,115 400,55 L400,120 L0,120 Z" fill={color} opacity="0.08" />
    <path d="M0,100 C130,65 270,125 400,85 L400,120 L0,120 Z" fill={color} opacity="0.14" />
  </svg>
);

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
  // Default state is COLLAPSED by user request
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const cfg = STATUSES[status];
  const StatusIcon = STATUS_ICONS[status];

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
      className={`w-full max-w-full overflow-hidden flex flex-col rounded-3xl border transition-all duration-300 bg-white/90 dark:bg-slate-900/80 shadow-2xs ${
        isDragOver ? dragHighlightStyles[status] : `${cfg.borderColor} dark:border-slate-800`
      }`}
    >
      {/* Column Accordion Header */}
      <div
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="relative overflow-hidden flex items-center justify-between gap-3 p-3.5 sm:p-4 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-700/50 rounded-3xl transition-colors select-none"
      >
        {/* Soft wave backdrop in the status color */}
        <HeaderWaves color={STATUS_WAVE_COLOR[status]} />

        <div className="relative flex items-center gap-3 min-w-0">
          {/* Status Icon: one friendly, solid-colored badge per status */}
          <div className={`w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-2xl flex items-center justify-center shadow-md text-white ${STATUS_ICON_BG[status]}`}>
            <StatusIcon className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {cfg.title}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${cfg.badgeBg} ${cfg.badgeText}`}>
                {toPersianDigits(tasks.length)} مورد
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block mt-0.5">{cfg.description}</p>
          </div>
        </div>

        <div className="relative shrink-0 flex items-center gap-1.5">
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
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-300 dark:hover:text-indigo-400 shadow-sm transition-colors"
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
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
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
              <div className="h-28 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-2">
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
