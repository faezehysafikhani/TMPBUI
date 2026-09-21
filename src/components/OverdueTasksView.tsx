import React, { useState } from 'react';
import { Task, TaskStatus, Attachment, PRIORITIES, User, Priority } from '../types';
import { isOverdue, toPersianDigits, formatToJalali, getDaysDiff } from '../utils/helpers';
import { parseDateSafely } from '../utils/jalali';
import { AlertCircle, AlertTriangle, CheckCircle2, Calendar, MessageSquare, Edit2, Trash2, ArrowDownUp } from 'lucide-react';

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
  checkTaskPermissions: (task: Task) => { canEditTask: boolean; canDeleteTask: boolean };
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
  const { canEditTask, canDeleteTask } = checkTaskPermissions(parent);

  const daysDiffInfo = getDaysDiff(item.dueDate);
  const delayDays = daysDiffInfo.isPast ? Math.abs(daysDiffInfo.days) : 0;
  const isCritical = delayDays >= 2 || (item.priority === 'high' && delayDays >= 1);

  let pulseDuration = 1.6;
  if (delayDays >= 7) pulseDuration = 0.4;
  else if (delayDays >= 4) pulseDuration = 0.7;
  else if (delayDays >= 2) pulseDuration = 1.1;
  else if (isCritical) pulseDuration = 1.4;

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
        if (canEditTask) {
          setIsCompletedAnim(true);
          setTimeout(() => {
            onCompleteItem(item);
          }, 250);
        } else {
          alert('شما دسترسی لازم برای تغییر وضعیت این فعالیت را ندارید.');
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
        className={`relative z-10 grid grid-cols-12 gap-3 px-5 py-3.5 items-center transition-colors cursor-grab active:cursor-grabbing bg-white dark:bg-slate-900 ${
          isCritical
            ? 'bg-rose-50/80 dark:bg-rose-950/30 border-r-4 border-r-rose-600 dark:border-r-rose-500 hover:bg-rose-100/90 dark:hover:bg-rose-950/50'
            : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
        }`}
      >
        {/* Row Number */}
        <div className="col-span-1 flex justify-center">
          <span
            style={isCritical ? { animationDuration: `${pulseDuration}s` } : undefined}
            className={`w-7 h-7 rounded-xl font-bold text-xs flex items-center justify-center shrink-0 border ${
              isCritical
                ? 'bg-rose-600 text-white border-rose-500 animate-pulse shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            {toPersianDigits(index + 1)}
          </span>
        </div>

        {/* Task Title & Details */}
        <div className="col-span-7 sm:col-span-7 md:col-span-8 flex flex-col md:flex-row md:items-center justify-between gap-2 min-w-0 pr-1">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isCritical && (
              <span
                style={{ animationDuration: `${pulseDuration}s` }}
                className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping shrink-0"
                title={`تاخیر: ${toPersianDigits(delayDays)} روز`}
              />
            )}
            <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
              {item.title}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
            {/* Priority Tag */}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${priorityCfg.bgColor} ${priorityCfg.textColor}`}>
              {priorityCfg.title}
            </span>

            {/* Due date relative tag */}
            {isCritical ? (
              <span
                style={{ animationDuration: `${pulseDuration}s` }}
                className={`inline-flex items-center gap-1 text-[10px] font-bold text-white px-2 py-0.5 rounded-lg shadow-xs shrink-0 ${
                  delayDays >= 7
                    ? 'bg-rose-700'
                    : 'bg-rose-600'
                }`}
              >
                <AlertTriangle
                  className="w-3 h-3 text-amber-300 shrink-0"
                />
                <span>
                  {delayDays >= 7 ? 'تاخیر شدید' : 'معوقه'} ({getDaysDiff(item.dueDate).text})
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-lg border border-rose-200 dark:border-rose-900/60 shrink-0">
                <Calendar className="w-3 h-3 shrink-0" />
                <span>{getDaysDiff(item.dueDate).text || formatToJalali(item.dueDate)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Actions Column */}
        <div className="col-span-4 sm:col-span-4 md:col-span-3 flex items-center justify-end gap-1.5 pl-1 shrink-0">
          {/* Complete Button (Mark as finished) */}
          {canEditTask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCompletedAnim(true);
                setTimeout(() => {
                  onCompleteItem(item);
                }, 200);
              }}
              className="px-2.5 py-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 text-[11px] font-bold border border-emerald-200/80 dark:border-emerald-800/80 shrink-0 whitespace-nowrap shadow-2xs"
              title="خاتمه یافته (تکمیل سریع)"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">خاتمه یافته</span>
            </button>
          )}

          {/* Discussion / View Details */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onViewDetails) {
                onViewDetails(parent);
              } else {
                onEditTask(parent);
              }
            }}
            className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
            title="مشاهده جزئیات و گفتگو"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            {commentCount > 0 && <span>({toPersianDigits(commentCount)})</span>}
          </button>

          {/* Edit Button */}
          {canEditTask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditTask(parent);
              }}
              className="p-1.5 text-slate-400 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer"
              title="ویرایش کامل فعالیت (مالک)"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Delete Button */}
          {canDeleteTask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeletingTaskId(parent.id);
              }}
              className="p-1.5 text-slate-400 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer"
              title="حذف فعالیت"
            >
              <Trash2 className="w-3.5 h-3.5" />
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
    const isAdmin = !!(
      currentUser &&
      (currentUser.isAdmin ||
        currentUser.role === 'admin' ||
        currentUser.username?.toLowerCase() === 'admin' ||
        currentUser.email?.toLowerCase().startsWith('admin@'))
    );

    const isAssignee = !!(
      currentUser &&
      ((task.assignedUserId && task.assignedUserId === currentUser.id) ||
        (task.assignedUserName &&
          (task.assignedUserName.trim().toLowerCase() === (currentUser.name || '').trim().toLowerCase() ||
            task.assignedUserName.trim().toLowerCase() === (currentUser.username || '').trim().toLowerCase())))
    );

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
    const canEditTask = isAdmin || (isTaskCreator && (!isAssignee && !isTeamMember || isTaskCreator)) || isOwnerByDetails || (isAssignee && allowStatusUpdateForAssignee);
    const canDeleteTask = isAdmin || (isTaskCreator && (!isAssignee && !isTeamMember || isTaskCreator)) || isOwnerByDetails;

    return { canEditTask, canDeleteTask };
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

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-500 via-rose-600 to-amber-600 rounded-3xl p-5 text-white shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 mt-0.5">
            <AlertCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">فعالیت‌های از موعد گذشته</h2>
            <p className="text-xs text-rose-100 mt-0.5">
              لیست فعالیت‌هایی که تاریخ موعد آن‌ها سپری شده اما هنوز تکمیل نشده‌اند
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <div className="inline-flex items-center gap-1.5 text-[11px] text-amber-100 bg-black/20 px-2.5 py-1 rounded-xl font-medium border border-white/10">
                <ArrowDownUp className="w-3.5 h-3.5 shrink-0 text-amber-300" />
                <span>مرتب‌شده بر اساس **بیشترین تاخیر** و **اولویت بالاتر**</span>
              </div>
              <div className="inline-flex items-center gap-1.5 text-[11px] text-emerald-100 bg-emerald-900/40 px-2.5 py-1 rounded-xl font-medium border border-emerald-400/20">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-300" />
                <span>با **درگ به سمت چپ**، فعالیت به «خاتمه یافته» تغییر می‌یابد</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-3.5 py-1.5 rounded-2xl bg-white/20 backdrop-blur-md text-xs font-bold border border-white/30 shrink-0 self-end sm:self-auto">
          {toPersianDigits(overdueItems.length)} مورد معوقه
        </div>
      </div>

      {/* Overdue Task List (جدول / لیست) */}
      {overdueItems.length > 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-3 px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400">
            <div className="col-span-1 text-center">ردیف</div>
            <div className="col-span-7 sm:col-span-7 md:col-span-8">عنوان فعالیت و زمان‌بندی</div>
            <div className="col-span-4 sm:col-span-4 md:col-span-3 text-left pl-2">عملیات</div>
          </div>

          {/* List Items */}
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
        <div className="bg-white dark:bg-slate-800/90 rounded-3xl border border-slate-200 dark:border-slate-700 p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1">
            عالی است! هیچ فعالیت معوقه‌ای وجود ندارد 🎉
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            تمام فعالیت‌های زمان‌بندی شده شما به‌موقع در حال پیگیری یا تکمیل هستند.
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTaskId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-rose-200 dark:border-rose-900 shadow-2xl text-center space-y-4 animate-in fade-in zoom-in-95">
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
