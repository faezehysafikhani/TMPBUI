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

  // A sub-activity can itself have sub-activities, to any depth: each level sits inside its
  // parent's indented block. Past a few levels the indent stops growing so cards keep their width.
  const renderChildren = (parentId: string, depth: number): React.ReactNode =>
    (childrenOf.get(parentId) || []).map((child) => (
      <div
        key={child.id}
        className={`border-r-2 border-indigo-300 dark:border-indigo-700 space-y-1.5 ${depth <= 4 ? 'mr-4 pr-2' : 'pr-1'}`}
      >
        <div className="origin-top-right scale-[0.94]">
          <TaskCard task={child} {...cardProps} />
        </div>
        {renderChildren(child.id, depth + 1)}
      </div>
    ));

  return (
    <>
      {topLevel.map((task) => {
        const parentTitle = task.parentTaskId ? titles.get(task.parentTaskId) : undefined;
        return (
          <div key={task.id} className="space-y-1.5">
            {parentTitle && (
              <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-300 px-1">
                <CornerDownLeft className="w-3 h-3 shrink-0" />
                <span className="truncate">زیرمجموعه‌ی «{parentTitle}»</span>
              </div>
            )}
            <TaskCard task={task} {...cardProps} />
            {renderChildren(task.id, 1)}
          </div>
        );
      })}
    </>
  );
};
