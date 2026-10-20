import React, { createContext, useContext } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { Task } from '../types';
import { TaskCard } from './TaskCard';

/** Task id -> title, so a sub-activity can say which activity it belongs to. */
export const TaskTitleContext = createContext<Map<string, string>>(new Map());

type CardProps = Omit<React.ComponentProps<typeof TaskCard>, 'task'>;

/**
 * A column's cards. A sub-activity (created from a comment of another activity) is drawn right
 * under its parent, indented and smaller, when both are in this column. Otherwise it is a normal
 * card with a small «sub-activity of …» tag.
 */
export const TaskCardList: React.FC<{ tasks: Task[] } & CardProps> = ({ tasks, ...cardProps }) => {
  const titles = useContext(TaskTitleContext);
  const ids = new Set(tasks.map((t) => t.id));
  const childrenOf = new Map<string, Task[]>();
  const topLevel: Task[] = [];
  for (const t of tasks) {
    if (t.parentTaskId && ids.has(t.parentTaskId)) {
      childrenOf.set(t.parentTaskId, [...(childrenOf.get(t.parentTaskId) || []), t]);
    } else {
      topLevel.push(t);
    }
  }

  return (
    <>
      {topLevel.map((task) => {
        const parentTitle = task.parentTaskId ? titles.get(task.parentTaskId) : undefined;
        const children = childrenOf.get(task.id) || [];
        return (
          <div key={task.id} className="space-y-1.5">
            {parentTitle && (
              <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-300 px-1">
                <CornerDownLeft className="w-3 h-3 shrink-0" />
                <span className="truncate">زیرمجموعه‌ی «{parentTitle}»</span>
              </div>
            )}
            <TaskCard task={task} {...cardProps} />
            {children.map((child) => (
              <div key={child.id} className="mr-5 pr-2 border-r-2 border-indigo-300 dark:border-indigo-700 origin-top-right scale-[0.94]">
                <TaskCard task={child} {...cardProps} />
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
};
