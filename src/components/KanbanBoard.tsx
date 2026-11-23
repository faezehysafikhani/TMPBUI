import React, { lazy, Suspense, useMemo, useState } from 'react';
import { BarChart3, Kanban, LayoutList, Plus, SlidersHorizontal, ListFilter } from 'lucide-react';
import { PageHeader, btnPrimary } from './layout/PageHeader';
import { toPersianDigits } from '../utils/helpers';
import { QuickAddBar } from './tasks/QuickAddBar';
import { Task, TaskStatus, Attachment, User } from '../types';
import { KanbanColumn } from './KanbanColumn';
import { TaskGroupColumn } from './TaskGroupColumn';
import { TaskListView } from './TaskListView';
import { TaskMatrixBoard } from './TaskMatrixBoard';
import { getTaskLastModifiedTime } from '../utils/helpers';
import { BoardViewSettings, DEFAULT_BOARD_VIEW, buildTaskGroups, isCurrentTask } from '../utils/boardView';

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
  /** The grouping bar's choices; the plain status Kanban with full cards when omitted. */
  view?: BoardViewSettings;
  /** Board / list switch in the toolbar. */
  onViewChange?: (next: BoardViewSettings) => void;
  /** «فیلترها» in the toolbar and the filter panel it opens. */
  filtersOpen?: boolean;
  onToggleFilters?: () => void;
  activeFilterCount?: number;
  filterPanel?: React.ReactNode;
  /** «گروه‌بندی و نما» in the toolbar and its panel. */
  viewOpen?: boolean;
  onToggleView?: () => void;
  viewPanel?: React.ReactNode;
  /** «فعالیت جدید» in the page header (only with permission to create). */
  onCreateTask?: () => void;
}

const STATS_KEY = 'tm.board.showStats';
const readShowStats = () => { try { return localStorage.getItem(STATS_KEY) !== '0'; } catch { return true; } };

const toolbarButton = (active: boolean) =>
  `inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-indigo-600 ${
    active
      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-800 dark:text-indigo-300'
      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;

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
  view = DEFAULT_BOARD_VIEW,
  onViewChange,
  filtersOpen = false,
  onToggleFilters,
  activeFilterCount = 0,
  filterPanel,
  viewOpen = false,
  onToggleView,
  viewPanel,
  onCreateTask,
}) => {
  const [showStats, setShowStats] = useState(readShowStats);
  const toggleStats = () => setShowStats((v) => { try { localStorage.setItem(STATS_KEY, v ? '0' : '1'); } catch { /* private mode */ } return !v; });
  const isList = view.groupBy === 'none';
  // «فعالیت‌های جاری» narrows the board only; the charts below keep counting every task.
  const boardTasks = useMemo(
    () => (view.currentOnly ? tasks.filter(isCurrentTask) : tasks),
    [tasks, view.currentOnly],
  );

  // Group tasks by status in a single pass, then sort each column by last
  // modification time (newest first). Every status always gets a column, even with zero tasks
  // (all four statuses, also while only current tasks are shown).
  const columns = useMemo(() => {
    const byStatus = new Map<TaskStatus, Task[]>();
    for (const task of boardTasks) {
      const bucket = byStatus.get(task.status);
      if (bucket) {
        bucket.push(task);
      } else {
        byStatus.set(task.status, [task]);
      }
    }

    return STATUS_KEYS.map((st) => ({
      status: st,
      tasks: (byStatus.get(st) ?? [])
        .sort((a, b) => getTaskLastModifiedTime(b) - getTaskLastModifiedTime(a)),
    }));
  }, [boardTasks]);

  const groups = useMemo(
    () => (view.groupBy === 'status' || view.groupBy === 'none' || view.groupBy === 'matrix' ? [] : buildTaskGroups(boardTasks, view.groupBy)),
    [boardTasks, view.groupBy],
  );

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title="بورد فعالیت‌ها"
        subtitle="کارهای تیم را اولویت‌بندی کنید و تا رسیدن به نتیجه پیگیری کنید."
        actions={onCreateTask && (
          <button type="button" onClick={onCreateTask} className={`${btnPrimary} max-sm:hidden`}><Plus className="w-4 h-4" /> فعالیت جدید</button>
        )}
      >
        {/* Quick add and «from template» (Track 1) */}
        <QuickAddBar currentUser={currentUser} />
      </PageHeader>

      {/* Toolbar: board / list, filters, grouping, statistics */}
      <div className="flex flex-wrap items-center gap-2">
        {onViewChange && (
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80" role="group" aria-label="نوع نمایش">
            {[
              { list: false, label: 'بورد', icon: Kanban },
              { list: true, label: 'فهرست', icon: LayoutList },
            ].map(({ list, label, icon: Icon }) => {
              const active = isList === list;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onViewChange({ ...view, groupBy: list ? 'none' : (view.groupBy === 'none' ? 'status' : view.groupBy) })}
                  className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                    active ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" /> {label}
                </button>
              );
            })}
          </div>
        )}
        {onToggleFilters && (
          <button type="button" onClick={onToggleFilters} aria-expanded={filtersOpen} className={toolbarButton(filtersOpen || activeFilterCount > 0)}>
            <ListFilter className="w-4 h-4" /> فیلترها
            {activeFilterCount > 0 && <span className="min-w-[20px] h-5 px-1 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">{toPersianDigits(activeFilterCount)}</span>}
          </button>
        )}
        {onToggleView && (
          <button type="button" onClick={onToggleView} aria-expanded={viewOpen} className={toolbarButton(viewOpen)}>
            <SlidersHorizontal className="w-4 h-4" /> گروه‌بندی و نما
          </button>
        )}
        <span className="flex-1" />
        <span className="text-xs text-slate-400 dark:text-slate-500">{toPersianDigits(boardTasks.length)} فعالیت</span>
        <button type="button" onClick={toggleStats} aria-pressed={showStats} className={toolbarButton(showStats)}>
          <BarChart3 className="w-4 h-4" /> آمار
        </button>
      </div>
      {filterPanel}
      {viewPanel}

      {view.groupBy === 'status' && (
        <div className={`grid gap-4 sm:gap-4.5 items-start grid-cols-1 md:grid-cols-2 lg:grid-cols-4`}>
          {columns.map(({ status, tasks: columnTasks }) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={columnTasks}
              currentUser={currentUser}
              showDetails={view.showDetails}
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

      {view.groupBy === 'none' && (
        <TaskListView tasks={boardTasks} showDetails={view.showDetails} onViewDetails={onViewDetails} currentUser={currentUser} />
      )}

      {view.groupBy === 'matrix' && (
        <TaskMatrixBoard
          tasks={boardTasks}
          currentUser={currentUser}
          showDetails={view.showDetails}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          onStatusChange={onStatusChange}
          onPreviewAttachment={onPreviewAttachment}
          onViewDetails={onViewDetails}
          onOpenProjectDetails={onOpenProjectDetails}
          onToggleSubTask={onToggleSubTask}
        />
      )}

      {view.groupBy !== 'status' && view.groupBy !== 'none' && view.groupBy !== 'matrix' && (
        groups.length === 0 ? (
          <div className="h-32 flex items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40">
            <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">هیچ فعالیتی برای نمایش وجود ندارد</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-4.5 items-start grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {groups.map((group) => (
              <TaskGroupColumn
                key={`${view.groupBy}:${group.key}`}
                group={group}
                currentUser={currentUser}
                showDetails={view.showDetails}
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
        )
      )}

      {/* Statistics under the board, shown or hidden from the toolbar */}
      {showStats && <Suspense fallback={<div className="h-48 bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl animate-pulse my-4" />}>
        <DashboardCharts
          tasks={tasks}
          currentUser={currentUser}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          onViewDetails={onViewDetails}
        />
      </Suspense>}
    </div>
  );
};
