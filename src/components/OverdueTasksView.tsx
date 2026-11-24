import { PageHeader, surface } from './layout/PageHeader';
import React, { useState } from 'react';
import { Task, TaskStatus, Attachment, PRIORITIES, User, Priority } from '../types';
import { isOverdue, toPersianDigits, formatToJalali, getDaysDiff } from '../utils/helpers';
import { parseDateSafely } from '../utils/jalali';
import { AlertCircle, AlertTriangle, CheckCircle2, Calendar, MessageSquare, Edit2, Trash2, ArrowDownUp } from 'lucide-react';
import { can, isTaskAdmin, PERMISSIONS } from '../utils/permissions';
import { isResponsibleFor } from '../utils/taskPeople';
import { appAlert } from '../utils/appDialog';

interface OverdueTasksViewProps {
  tasks: Task[];
  currentUser?: User | null;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onPreviewAttachment: (attachment: Attachment) => void;
  onViewDetails?: (task: Task) => void;
  onToggleSubTask?: (taskId: string, subTaskId: string) => void;
}

interface OverdueTaskItem {
  id: string;
  title: string;
  dueDate: string;
  priority: Priority;
  parentTask: Task;
  isSubTask: boolean;
  subTaskId?: string;
}

interface OverdueTaskRowProps {
  item: OverdueTaskItem;
  index: number;
  currentUser?: User | null;
  onEditTask: (task: Task) => void;
  setDeletingTaskId: (taskId: string) => void;
  onViewDetails?: (task: Task) => void;
  onCompleteItem: (item: OverdueTaskItem) => void;
  checkTaskPermissions: (task: Task) => { canEditTask: boolean; canDeleteTask: boolean; canCompleteTask: boolean };
}

const OverdueTaskRow: React.FC<OverdueTaskRowProps> = ({
  item,
  index,
  onEditTask,
  setDeletingTaskId,
  onViewDetails,
  onCompleteItem,
  checkTaskPermissions,
}) => {
  const parent = item.parentTask;
  const priorityCfg = PRIORITIES[item.priority] || PRIORITIES.medium;
  const commentCount = parent.comments?.length || 0;
  const { canEditTask, canDeleteTask, canCompleteTask } = checkTaskPermissions(parent);

  const daysDiffInfo = getDaysDiff(item.dueDate);
  const delayDays = daysDiffInfo.isPast ? Math.abs(daysDiffInfo.days) : 0;
  const isCritical = delayDays >= 2 || (item.priority === 'high' && delayDays >= 1);


  const [dragX, setDragX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isCompletedAnim, setIsCompletedAnim] = useState<boolean>(false);

  const startXRef = React.useRef<number | null>(null);
  const startYRef = React.useRef<number | null>(null);
  const isHorizontalSwipeRef = React.useRef<boolean | null>(null);
  const preventClickRef = React.useRef<boolean>(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    isHorizontalSwipeRef.current = null;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || startXRef.current === null || startYRef.current === null) return;

    const deltaX = e.clientX - startXRef.current;
    const deltaY = e.clientY - startYRef.current;

    if (isHorizontalSwipeRef.current === null) {
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        isHorizontalSwipeRef.current = Math.abs(deltaX) > Math.abs(deltaY);
      }
    }

    if (isHorizontalSwipeRef.current) {
      // In RTL, dragging left means moving to negative X
      const clamped = Math.min(0, Math.max(-180, deltaX));
      setDragX(clamped);
      preventClickRef.current = Math.abs(clamped) > 10;
    }
  };

  const handlePointerEnd = () => {
    if (isDragging) {
      if (dragX <= -50) {
        if (canCompleteTask) {
          setIsCompletedAnim(true);
          setTimeout(() => {
            onCompleteItem(item);
          }, 250);
        } else {
          void appAlert('شما دسترسی لازم برای تغییر وضعیت این فعالیت را ندارید.');
          setDragX(0);
        }
      } else {
        setDragX(0);
      }
    }
    setIsDragging(false);
    startXRef.current = null;
    startYRef.current = null;
    isHorizontalSwipeRef.current = null;
    setTimeout(() => {
      preventClickRef.current = false;
    }, 150);
  };

  const handleClickRow = () => {
    if (preventClickRef.current) return;
    if (onViewDetails) {
      onViewDetails(parent);
    } else {
      onEditTask(parent);
    }
  };

  return (
    <div className="relative overflow-hidden group select-none touch-pan-y">
      {/* Revealed background when dragging left */}
      <div
        className={`absolute inset-0 bg-emerald-600 dark:bg-emerald-700 text-white flex items-center justify-end px-6 gap-2 transition-opacity ${
          dragX < -10 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center gap-2 font-black text-xs sm:text-sm animate-pulse dir-rtl">
          <span>تغییر وضعیت به خاتمه یافته</span>
          <CheckCircle2 className={`w-5 h-5 transition-transform ${dragX <= -50 ? 'scale-125 text-emerald-200' : 'scale-100'}`} />
        </div>
      </div>

      {/* Sliding row content */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClick={handleClickRow}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.25s ease',
          opacity: isCompletedAnim ? 0 : 1,
        }}
        className="relative z-10 flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
      >
        {/* Severity bar */}
        <span className={`self-stretch w-1 rounded-full shrink-0 ${delayDays >= 7 ? 'bg-rose-600' : isCritical ? 'bg-rose-400' : 'bg-amber-400'}`} aria-hidden="true" />
        <span className="hidden sm:inline w-6 text-center text-xs font-semibold text-slate-400 tabular-nums shrink-0">{toPersianDigits(index + 1)}</span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{item.title.replace(/\*\*/g, '')}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {item.isSubTask && <span className="truncate max-w-[14rem]">از «{parent.title}»</span>}
            <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{formatToJalali(item.dueDate)}</span>
            <span className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${item.priority === 'high' ? 'bg-rose-500' : item.priority === 'low' ? 'bg-emerald-500' : 'bg-amber-400'}`} />اولویت {priorityCfg.title}</span>
            {commentCount > 0 && <span className="inline-flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" />{toPersianDigits(commentCount)}</span>}
          </div>
        </div>

        <span className={`hidden md:inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-bold shrink-0 tabular-nums ${delayDays >= 7 ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'}`}>
          {delayDays > 0 ? `${toPersianDigits(delayDays)} روز تأخیر` : 'امروز'}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {canCompleteTask && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsCompletedAnim(true); setTimeout(() => onCompleteItem(item), 200); }}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 cursor-pointer whitespace-nowrap"
              title="ثبت به‌عنوان خاتمه یافته"
            >
              <CheckCircle2 className="w-4 h-4" /><span className="hidden sm:inline">خاتمه</span>
            </button>
          )}
          <button type="button" onClick={(e) => { e.stopPropagation(); if (onViewDetails) onViewDetails(parent); else onEditTask(parent); }} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title="جزئیات و گفتگو" aria-label="جزئیات و گفتگو">
            <MessageSquare className="w-4 h-4" />
          </button>
          {canEditTask && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onEditTask(parent); }} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" title="ویرایش" aria-label="ویرایش">
              <Edit2 className="w-4 h-4" />
            </button>
          )}
          {canDeleteTask && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setDeletingTaskId(parent.id); }} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer" title="حذف" aria-label="حذف">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const OverdueTasksView: React.FC<OverdueTasksViewProps> = ({
  tasks,
  currentUser,
  onEditTask,
  onDeleteTask,
  onStatusChange,
  onViewDetails,
  onToggleSubTask,
}) => {
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  
  // Extract overdue items and sort by HIGHEST DELAY FIRST, then HIGHEST PRIORITY
  const overdueItems = React.useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      dueDate: string;
      priority: Priority;
      parentTask: Task;
      isSubTask: boolean;
      subTaskId?: string;
    }> = [];

    tasks.forEach((task) => {
      if (task.status === 'completed' || task.status === 'paused') {
        return;
      }

      if (task.isRecurring) {
        // For recurring tasks, ONLY subtasks (occurrences) are included if overdue, NEVER the main parent task
        if (task.projectSubTasks && task.projectSubTasks.length > 0) {
          task.projectSubTasks.forEach((st) => {
            if (st.completed) return;
            const stStatus = st.completed ? 'completed' : task.status;
            const stDueDate = st.endDate || st.startDate || task.dueDate;
            if (isOverdue(stDueDate, stStatus)) {
              items.push({
                id: `${task.id}_${st.id}`,
                title: `${task.title} (${st.title})`,
                dueDate: stDueDate,
                priority: (st.importance as Priority) || task.priority,
                parentTask: task,
                isSubTask: true,
                subTaskId: st.id,
              });
            }
          });
        }
      } else {
        if (task.projectSubTasks && task.projectSubTasks.length > 0) {
          task.projectSubTasks.forEach((st) => {
            if (st.completed) return;
            const stStatus = st.completed ? 'completed' : task.status;
            const stDueDate = st.endDate || st.startDate || task.dueDate;
            if (isOverdue(stDueDate, stStatus)) {
              items.push({
                id: `${task.id}_${st.id}`,
                title: `${task.title} > ${st.title}`,
                dueDate: stDueDate,
                priority: (st.importance as Priority) || task.priority,
                parentTask: task,
                isSubTask: true,
                subTaskId: st.id,
              });
            }
          });
        } else {
          if (isOverdue(task.dueDate, task.status)) {
            items.push({
              id: task.id,
              title: task.title,
              dueDate: task.dueDate,
              priority: task.priority,
              parentTask: task,
              isSubTask: false,
            });
          }
        }
      }
    });

    const priorityWeights: Record<Priority, number> = {
      high: 3,
      medium: 2,
      low: 1,
    };

    return items.sort((a, b) => {
      const dateA = parseDateSafely(a.dueDate);
      const dateB = parseDateSafely(b.dueDate);

      const nowMs = Date.now();
      const delayA = dateA ? nowMs - dateA.getTime() : 0;
      const delayB = dateB ? nowMs - dateB.getTime() : 0;

      // Primary sort: Highest delay duration first
      if (Math.abs(delayB - delayA) > 1000) {
        return delayB - delayA;
      }

      // Secondary sort: Priority (high > medium > low)
      const weightA = priorityWeights[a.priority] || 1;
      const weightB = priorityWeights[b.priority] || 1;
      return weightB - weightA;
    });
  }, [tasks]);

  // Permission calculation helper for a task
  const checkTaskPermissions = (task: Task) => {
    const isAdmin = isTaskAdmin(currentUser);

    const isAssignee = isResponsibleFor(task, currentUser);

    const isTeamMember = !!(
      currentUser &&
      ((task.teamMemberIds && task.teamMemberIds.includes(currentUser.id)) ||
        (task.assignedTeamId && currentUser.teams?.some((t) => t.id === task.assignedTeamId)))
    );

    const isTaskCreator = !!(currentUser && task.user && task.user === currentUser.id);

    const isOwnerByDetails = !!(
      currentUser &&
      task.ownerName &&
      (task.ownerName.trim().toLowerCase() === (currentUser.name || '').trim().toLowerCase() ||
        task.ownerName.trim().toLowerCase() === (currentUser.username || '').trim().toLowerCase() ||
        task.ownerName.trim().toLowerCase() === (currentUser.email || '').trim().toLowerCase()) &&
      !isAssignee &&
      !isTeamMember
    );

    const allowStatusUpdateForAssignee = task.allowAssigneeStatusUpdate !== false;
    const isOwnerOrTaskAdmin = isAdmin || (isTaskCreator && (!isAssignee && !isTeamMember || isTaskCreator)) || isOwnerByDetails;
    // Completing is a status change, open to the assignee when the owner allows it.
    const canCompleteTask = (isOwnerOrTaskAdmin || (isAssignee && allowStatusUpdateForAssignee)) && can(currentUser, PERMISSIONS.tasksEdit);
    const canEditTask = isOwnerOrTaskAdmin && can(currentUser, PERMISSIONS.tasksEdit);
    const canDeleteTask = isOwnerOrTaskAdmin && can(currentUser, PERMISSIONS.tasksDelete);

    return { canEditTask, canDeleteTask, canCompleteTask };
  };

  const handleCompleteItem = (item: OverdueTaskItem) => {
    if (item.isSubTask && item.subTaskId) {
      if (onToggleSubTask) {
        onToggleSubTask(item.parentTask.id, item.subTaskId);
      } else if (item.parentTask.projectSubTasks) {
        const updatedSubTasks = item.parentTask.projectSubTasks.map((st) =>
          st.id === item.subTaskId ? { ...st, completed: true } : st
        );
        onEditTask({ ...item.parentTask, projectSubTasks: updatedSubTasks });
      }
    } else {
      onStatusChange(item.parentTask.id, 'completed');
    }
  };

  const stats = (() => {
    let week = 0, high = 0, max = 0;
    for (const it of overdueItems) {
      const d = getDaysDiff(it.dueDate);
      const late = d.isPast ? Math.abs(d.days) : 0;
      if (late >= 7) week++;
      if (it.priority === 'high') high++;
      if (late > max) max = late;
    }
    return { week, high, max };
  })();

  return (
    <div className="w-full">
      <PageHeader
        title="موعد گذشته"
        subtitle="فعالیت‌هایی که موعدشان گذشته و هنوز خاتمه نیافته‌اند؛ بیشترین تأخیر و اولویت بالاتر اول."
      />

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'کل موارد', value: toPersianDigits(overdueItems.length), tone: 'text-slate-900 dark:text-white' },
          { label: 'بیش از یک هفته تأخیر', value: toPersianDigits(stats.week), tone: stats.week ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white' },
          { label: 'اولویت زیاد', value: toPersianDigits(stats.high), tone: 'text-slate-900 dark:text-white' },
          { label: 'بیشترین تأخیر', value: stats.max ? `${toPersianDigits(stats.max)} روز` : '—', tone: 'text-slate-900 dark:text-white' },
        ].map((k) => (
          <div key={k.label} className={`${surface} px-4 py-3.5`}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{k.label}</p>
            <p className={`mt-1 text-2xl font-extrabold tabular-nums ${k.tone}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {overdueItems.length > 0 ? (
        <div className={`${surface} overflow-hidden`}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5"><ArrowDownUp className="w-3.5 h-3.5" /> مرتب بر اساس بیشترین تأخیر و اولویت</span>
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> روی موبایل با کشیدن ردیف به چپ، خاتمه می‌یابد</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {overdueItems.map((item, index) => (
              <OverdueTaskRow
                key={item.id}
                item={item}
                index={index}
                currentUser={currentUser}
                onEditTask={onEditTask}
                setDeletingTaskId={setDeletingTaskId}
                onViewDetails={onViewDetails}
                onCompleteItem={handleCompleteItem}
                checkTaskPermissions={checkTaskPermissions}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">هیچ فعالیتی عقب نیفتاده است</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">همهٔ فعالیت‌های شما در موعد خود پیش می‌روند.</p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTaskId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div role="alertdialog" aria-modal="true" className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                آیا از حذف این فعالیت اطمینان دارید؟
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                این اقدام غیرقابل بازگشت است.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  onDeleteTask(deletingTaskId);
                  setDeletingTaskId(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                حذف شود
              </button>
              <button
                type="button"
                onClick={() => setDeletingTaskId(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
