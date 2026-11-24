import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Task, TaskStatus, Attachment, User } from '../types';
import { TaskCardList } from './TaskCardList';
import { toPersianDigits } from '../utils/helpers';
import { TaskGroup } from '../utils/boardView';

interface TaskGroupColumnProps {
  group: TaskGroup;
  currentUser?: User | null;
  showDetails: boolean;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onPreviewAttachment: (attachment: Attachment) => void;
  onViewDetails?: (task: Task) => void;
  onOpenProjectDetails?: (task: Task) => void;
  onToggleSubTask?: (taskId: string, subTaskId: string) => void;
}

/**
 * One column of the board when it is grouped by something other than status (owner, priority,
 * ...). Looks and folds like a Kanban column; dropping a card here changes nothing, since these
 * groups are not a field the card can be moved into.
 */
const TaskGroupColumnBase: React.FC<TaskGroupColumnProps> = ({
  group,
  currentUser,
  showDetails,
  onEditTask,
  onDeleteTask,
  onStatusChange,
  onPreviewAttachment,
  onViewDetails,
  onOpenProjectDetails,
  onToggleSubTask,
}) => {
  // Groups start open, like the Kanban columns.
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const isPerson = group.key.startsWith('person:');

  return (
    <div className="w-full max-w-full overflow-hidden flex flex-col rounded-2xl bg-slate-100/70 dark:bg-slate-900/60">
      <div className="flex items-center gap-2 h-12 px-3.5 select-none" title={group.description}>
        {isPerson ? (
          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-[11px] font-bold flex items-center justify-center shrink-0" aria-hidden="true">{group.title.trim().charAt(0)}</span>
        ) : (
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${TONE_DOT[group.tone] || 'bg-slate-400'}`} aria-hidden="true" />
        )}
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate min-w-0" dir="auto" title={group.title}>{group.title}</h2>
        <span className="min-w-[24px] h-6 px-2 rounded-full bg-white dark:bg-slate-800 text-xs font-bold text-slate-500 dark:text-slate-300 flex items-center justify-center tabular-nums shrink-0">
          {toPersianDigits(group.tasks.length)}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-expanded={!isCollapsed}
          title={isCollapsed ? 'باز کردن ستون' : 'بستن ستون'}
          aria-label={isCollapsed ? `باز کردن «${group.title}»` : `بستن «${group.title}»`}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-colors"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-90' : ''}`} />
        </button>
      </div>

      {!isCollapsed && (
        <div className="px-2.5 pb-2.5 animate-in fade-in duration-200">
          <div className="space-y-2.5 overflow-y-auto max-h-[calc(100vh-300px)] p-0.5">
            {group.tasks.length === 0 ? (
              <div className="h-24 flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500">فعالیتی در این گروه نیست</p>
              </div>
            ) : (
              <TaskCardList
                tasks={group.tasks}
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
        </div>
      )}
    </div>
  );
};

const TONE_DOT: Record<string, string> = {
  slate: 'bg-slate-400', indigo: 'bg-indigo-500', blue: 'bg-blue-500', amber: 'bg-amber-500', emerald: 'bg-emerald-500', rose: 'bg-rose-500',
};

export const TaskGroupColumn = React.memo(TaskGroupColumnBase);
