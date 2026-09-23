import React, { useState, useRef } from 'react';
import { Task, TaskStatus, Priority, PRIORITIES, Attachment, User } from '../types';
import {
  formatToJalali,
  getDaysDiff,
  isOverdue,
  isCompletionDelayed,
  toPersianDigits,
  formatFileSize
} from '../utils/helpers';
import {
  Calendar,
  Paperclip,
  Edit2,
  Trash2,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Check,
  CheckCircle2,
  Lock,
  MessageSquare,
  User as UserIcon,
  FolderKanban,
  Repeat,
  Tag,
  GripVertical
} from 'lucide-react';
import { can, isTaskAdmin, PERMISSIONS } from '../utils/permissions';

interface TaskCardProps {
  task: Task;
  currentUser?: User | null;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onPreviewAttachment: (attachment: Attachment) => void;
  onViewDetails?: (task: Task) => void;
  onOpenProjectDetails?: (task: Task) => void;
  onToggleSubTask?: (taskId: string, subTaskId: string) => void;
}

const TaskCardBase: React.FC<TaskCardProps> = ({
  task,
  currentUser,
  onEdit,
  onDelete,
  onStatusChange,
  onPreviewAttachment,
  onViewDetails,
  onOpenProjectDetails,
  onToggleSubTask,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showSubTasks, setShowSubTasks] = useState(false);
  const [isDraggingCard, setIsDraggingCard] = useState(false);

  // Swipe Left to Complete State & Handlers
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea, [role="button"]')) return;
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
      const clamped = Math.max(-120, Math.min(120, deltaX));
      setDragOffset(clamped);
    }
  };

  const handlePointerEnd = () => {
    if (isDragging) {
      if (Math.abs(dragOffset) >= 50) {
        if (canChangeStatus) {
          if (task.status !== 'completed') {
            onStatusChange(task.id, 'completed');
          }
        } else {
          alert('شما دسترسی لازم برای تغییر وضعیت این فعالیت را ندارید.');
        }
      }
    }
    setIsDragging(false);
    setDragOffset(0);
    startXRef.current = null;
    startYRef.current = null;
    isHorizontalSwipeRef.current = null;
  };

  const handleToggleSubTaskClick = (subTaskId: string) => {
    if (onToggleSubTask) {
      onToggleSubTask(task.id, subTaskId);
    } else {
      const currentSubTasks = task.projectSubTasks || [];
      const updated = currentSubTasks.map((st) =>
        st.id === subTaskId ? { ...st, completed: !st.completed } : st
      );
      onEdit({ ...task, projectSubTasks: updated });
    }
  };

  const priorityCfg = PRIORITIES[task.priority] || PRIORITIES.medium;
  const overdue = isOverdue(task.dueDate, task.status);
  const daysDiff = getDaysDiff(task.dueDate);

  const isAdmin = isTaskAdmin(currentUser);

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

  // Task Creator Check
  const isTaskCreator = !!(currentUser && task.user && task.user === currentUser.id);

  // Task Owner by name match (ONLY valid if user is NOT an assignee/team member assigned by someone else)
  const isOwnerByDetails = !!(
    currentUser &&
    task.ownerName &&
    (task.ownerName.trim().toLowerCase() === (currentUser.name || '').trim().toLowerCase() ||
      task.ownerName.trim().toLowerCase() === (currentUser.username || '').trim().toLowerCase() ||
      task.ownerName.trim().toLowerCase() === (currentUser.email || '').trim().toLowerCase()) &&
    !isAssignee &&
    !isTeamMember
  );

  // Real Owner: Creator OR OwnerByDetails when NOT an assignee/team member assigned by another user
  const isTaskOwner = isTaskCreator || isOwnerByDetails;

  const allowStatusUpdateForAssignee = task.allowAssigneeStatusUpdate !== false;

  // Permissions:
  // Status Change: Allowed for Admin, Task Owner, Assignee (if allowStatusUpdateForAssignee is true), or Team Member
  const canChangeStatus = (isAdmin || isTaskOwner || (isAssignee && allowStatusUpdateForAssignee) || isTeamMember) && can(currentUser, PERMISSIONS.tasksEdit);

  // Edit Button: Allowed for Admin, Creator/Owner, OR Assignee with status update permission
  // Full edit and delete: owner or task administrator only (the server enforces the same).
  const canEditTask = (isAdmin || (isTaskCreator && (!isAssignee && !isTeamMember || isTaskCreator)) || isOwnerByDetails) && can(currentUser, PERMISSIONS.tasksEdit);
  const canDeleteTask = (isAdmin || (isTaskCreator && (!isAssignee && !isTeamMember || isTaskCreator)) || isOwnerByDetails) && can(currentUser, PERMISSIONS.tasksDelete);

  const commentCount = task.comments?.length || 0;

  const priorityBorderShadowMap: Record<Priority, string> = {
    high: 'border-r-[5px] border-r-rose-500 shadow-[4px_0_12px_-2px_rgba(244,63,94,0.35)] dark:shadow-[4px_0_14px_-2px_rgba(244,63,94,0.45)]',
    medium: 'border-r-[5px] border-r-amber-400 dark:border-r-amber-500 shadow-[4px_0_12px_-2px_rgba(251,191,36,0.35)] dark:shadow-[4px_0_14px_-2px_rgba(245,158,11,0.45)]',
    low: 'border-r-[5px] border-r-emerald-500 shadow-[4px_0_12px_-2px_rgba(16,185,129,0.35)] dark:shadow-[4px_0_14px_-2px_rgba(16,185,129,0.45)]',
  };

  const priorityStyle = priorityBorderShadowMap[task.priority || 'medium'];

  return (
    <div className="relative overflow-hidden rounded-2xl select-none">
      {/* Revealed Action Layer on Drag (Left or Right) */}
      <div
        className={`absolute inset-y-0 inset-x-0 ${
          canChangeStatus ? 'bg-emerald-600 dark:bg-emerald-700' : 'bg-rose-600 dark:bg-rose-700'
        } flex items-center ${
          dragOffset > 0 ? 'justify-start pl-4' : 'justify-end pr-4'
        } text-white font-bold text-xs transition-opacity rounded-2xl ${
          Math.abs(dragOffset) > 8 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {canChangeStatus ? (
          <div className="flex items-center gap-1.5 bg-emerald-700/90 dark:bg-emerald-800/90 px-3 py-1.5 rounded-xl shadow-xs border border-white/20">
            <Check className="w-4 h-4 stroke-[3]" />
            <span>خاتمه یافته</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-rose-700/90 dark:bg-rose-800/90 px-3 py-1.5 rounded-xl shadow-xs border border-white/20">
            <Lock className="w-4 h-4 stroke-[2.5]" />
            <span>عدم دسترسی بروزرسانی</span>
          </div>
        )}
      </div>

      <div
        draggable={canChangeStatus}
        onDragStart={(e) => {
          if (!canChangeStatus) {
            e.preventDefault();
            return;
          }
          e.dataTransfer.setData('text/plain', task.id);
          e.dataTransfer.setData('application/json', JSON.stringify({ taskId: task.id, fromStatus: task.status }));
          e.dataTransfer.effectAllowed = 'move';
          setIsDraggingCard(true);
        }}
        onDragEnd={() => {
          setIsDraggingCard(false);
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{
          transform: `translateX(${dragOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)',
          touchAction: 'pan-y',
        }}
        className={`group relative rounded-2xl border transition-all duration-200 hover:shadow-md ${
          canChangeStatus ? 'cursor-grab active:cursor-grabbing' : ''
        } ${
          isDraggingCard
            ? 'opacity-30 scale-95 border-dashed border-indigo-500 shadow-2xl ring-2 ring-indigo-500/80 bg-indigo-50 dark:bg-indigo-950'
            : overdue && task.status !== 'completed'
            ? 'border-slate-200 dark:border-slate-700 bg-rose-50/40 dark:bg-rose-950/40'
            : 'border-slate-200/90 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-500/60 bg-white/85 dark:bg-slate-800/85 backdrop-blur-xs'
        } ${priorityStyle} p-4 sm:p-4.5 flex flex-col justify-between overflow-hidden`}
      >
      {/* Top Section: Title & Actions First, then Tags below */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          {/* Title & Drag Handle */}
          <div className="flex items-start gap-1 flex-1 min-w-0">
            {canChangeStatus && (
              <div
                className="opacity-40 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-slate-400 dark:text-slate-500 pt-0.5 shrink-0"
                title="برای انتقال به ستون دیگر کشیده و رها کنید (Drag & Drop)"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>
            )}
            <h3
              onClick={() => onViewDetails && onViewDetails(task)}
              title={canChangeStatus ? 'امکان کشیدن و رها کردن (Drag & Drop) یا کلیک جهت جزئیات' : 'مشاهده جزئیات'}
              className={`text-[11px] sm:text-xs font-bold leading-snug cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex-1 break-words ${
                task.status === 'completed' || task.status === 'paused'
                  ? 'line-through text-slate-400 dark:text-slate-500'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {task.title}
            </h3>
          </div>

          {/* Card Action Buttons (Horizontal layout) */}
          <div className="flex flex-row items-center gap-1 opacity-90 sm:opacity-70 group-hover:opacity-100 transition-opacity shrink-0 flex-nowrap pt-0.5">
            {/* View Details / Discussion Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onViewDetails) onViewDetails(task);
              }}
              className="p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-0.5 text-[10px] font-bold"
              title="مشاهده جزئیات و گفتگو"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {commentCount > 0 && <span>{toPersianDigits(commentCount)}</span>}
            </button>

            {/* Edit Button - STRICTLY allowed ONLY for Owner/Admin */}
            {canEditTask && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task);
                }}
                className="p-1 text-slate-400 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer"
                title="ویرایش کامل فعالیت (مالک)"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Delete Button - Strictly Owner/Admin */}
            {canDeleteTask && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirmDelete(true);
                }}
                className="p-1 text-slate-400 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer"
                title="حذف فعالیت"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tags Row - Rendered BELOW Title */}
        <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
          {overdue && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse">
              <AlertCircle className="w-2.5 h-2.5" />
              عقب افتاده
            </span>
          )}

          {task.ownerName && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700" title="مالک / ایجادکننده فعالیت">
              <UserIcon className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400" />
              <span>مالک: {task.ownerName}</span>
            </span>
          )}

          {/* NOTE: main work team tag (task.assignedTeamName) and status tags are excluded from card tags */}

          {task.assignedUserName && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <UserIcon className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
              <span>مسئول: {task.assignedUserName}</span>
            </span>
          )}

          {task.isProject && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenProjectDetails && onOpenProjectDetails(task);
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors cursor-pointer"
              title="مشاهده داشبورد پروژه"
            >
              <FolderKanban className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>پروژه</span>
            </button>
          )}

          {task.tags &&
            task.tags
              .filter((t) => t !== 'تکرارشونده' && t !== 'تکرار' && t !== 'فعالیت تکرارشونده')
              .map((t, idx) => (
                <span key={idx} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  <Tag className="w-2.5 h-2.5 text-indigo-500" />
                  <span>#{t}</span>
                </span>
              ))}
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3 line-clamp-3 whitespace-pre-line bg-slate-50/60 dark:bg-slate-900/50 p-2 rounded-xl border border-slate-100 dark:border-slate-700/60">
            {task.description}
          </p>
        )}

        {/* Attachments Section */}
        {task.attachments && task.attachments.length > 0 && (
          <div className="mb-3.5 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-1.5">
              <Paperclip className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
              <span>فایل‌های ضمیمه ({toPersianDigits(task.attachments.length)}):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {task.attachments.map((att) => {
                const isImage = att.type.startsWith('image/') || att.dataUrl.startsWith('data:image/');
                return (
                  <button
                    key={att.id}
                    onClick={() => onPreviewAttachment(att)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700/60 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-700 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 text-[11px] border border-slate-200 dark:border-slate-600 transition-all max-w-full truncate cursor-pointer"
                    title={`${att.name} (${formatFileSize(att.size)})`}
                  >
                    {isImage ? (
                      <ImageIcon className="w-3 h-3 text-indigo-500 dark:text-indigo-400 shrink-0" />
                    ) : (
                      <FileText className="w-3 h-3 text-amber-500 shrink-0" />
                    )}
                    <span className="truncate max-w-[120px]">{att.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {/* Subtasks / Recurring Occurrences Section */}
        {((task.projectSubTasks && task.projectSubTasks.length > 0) || task.isRecurring) && (
          <div className="mb-3 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            {(() => {
              const subList = task.projectSubTasks || [];
              const completedCount = subList.filter((s) => s.completed).length;
              const totalCount = subList.length;

              const getRecurringDetailStr = () => {
                const cfg = task.recurringConfig;
                if (!cfg) return 'تکرارشونده';
                const sTime = cfg.startTime || cfg.dailyTime || cfg.time;
                const eTime = cfg.endTime;
                let timeStr = '';
                if (sTime && eTime) {
                  timeStr = ` ${toPersianDigits(sTime)} تا ${toPersianDigits(eTime)}`;
                } else if (sTime) {
                  timeStr = ` ${toPersianDigits(sTime)}`;
                }

                if (cfg.frequency === 'weekly') {
                  const dayNames = ['شنبه', '۱شنبه', '۲شنبه', '۳شنبه', '۴شنبه', '۵شنبه', 'جمعه'];
                  const selected = (cfg.weeklyDays || [0]).map((d) => dayNames[d] || '').filter(Boolean);
                  return `هفتگی (${selected.join('، ')}${timeStr})`;
                } else if (cfg.frequency === 'monthly') {
                  const selected = (cfg.monthlyDays || [1]).map((d) => toPersianDigits(d));
                  return `ماهیانه (${selected.join('، ')}${timeStr})`;
                } else if (sTime) {
                  return `روزانه (${toPersianDigits(sTime)})`;
                }
                return 'روزانه';
              };

              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSubTasks((prev) => !prev);
                  }}
                  className="w-full flex items-center justify-between p-1.5 rounded-lg bg-purple-50/80 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-800 dark:text-purple-200 text-[10px] font-bold border border-purple-200/80 dark:border-purple-800/80 transition-all cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1 overflow-hidden">
                    <Repeat className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                    <span className="truncate">
                      {task.isRecurring
                        ? `تکرارهای فعالیتی: ${getRecurringDetailStr()}${totalCount > 0 ? ` (${toPersianDigits(completedCount)} از ${toPersianDigits(totalCount)})` : ''}`
                        : `زیرفعالیت‌ها (${toPersianDigits(completedCount)} از ${toPersianDigits(totalCount)})`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {totalCount > 0 && (
                      <span className="text-[9px] px-1 py-0.5 rounded-md bg-purple-200/80 dark:bg-purple-900/80 text-purple-900 dark:text-purple-100 font-bold">
                        {toPersianDigits(Math.round((completedCount / totalCount) * 100))}٪
                      </span>
                    )}
                    {showSubTasks ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </div>
                </button>
              );
            })()}

            {/* Expanded Subtasks List */}
            {showSubTasks && task.projectSubTasks && task.projectSubTasks.length > 0 && (
              <div className="mt-2 space-y-1.5 max-h-52 overflow-y-auto pr-1 pl-1">
                {task.projectSubTasks.map((st) => {
                  const isDone = !!st.completed;
                  return (
                    <div
                      key={st.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSubTaskClick(st.id);
                      }}
                      className={`flex items-center justify-between p-2 rounded-xl border text-xs transition-all cursor-pointer ${
                        isDone
                          ? 'bg-slate-50/80 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 line-through'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-purple-300 dark:hover:border-purple-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleToggleSubTaskClick(st.id);
                          }}
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 dark:border-slate-600 cursor-pointer shrink-0"
                        />
                        <span className="font-semibold text-xs truncate">{st.title}</span>
                      </div>

                      {st.startDate && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-medium dir-rtl mr-2">
                          {formatToJalali(st.startDate)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Info: Due Date & Status Selector */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2 mt-2 text-xs">
        
        {/* Due Date Indicator */}
        <div className="flex items-center gap-1.5 text-xs md:text-[10px] text-slate-500 dark:text-slate-400 font-medium">
          <Calendar className={`w-3.5 h-3.5 ${overdue ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}`} />
          <span className={overdue ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}>
            {formatToJalali(task.dueDate)}
          </span>
          {daysDiff.text && task.status !== 'completed' && (
            <span className={`text-[10px] md:text-[9px] px-1.5 py-0.5 rounded-md ${
              overdue ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              ({daysDiff.text})
            </span>
          )}
        </div>

        {/* Actual Completion Date for completed tasks */}
        {task.status === 'completed' && (task.actualCompletionDate || task.updatedAt) && (() => {
          const completionDate = task.actualCompletionDate || task.updatedAt;
          const isDelayed = isCompletionDelayed(task.dueDate, completionDate);
          return (
            <div
              className={`w-full flex items-center justify-between gap-1.5 text-xs md:text-[10px] font-medium px-2 py-1 rounded-lg border mt-1 transition-colors ${
                isDelayed
                  ? 'text-rose-700 dark:text-rose-300 bg-rose-50/90 dark:bg-rose-950/50 border-rose-200/80 dark:border-rose-800/60'
                  : 'text-emerald-700 dark:text-emerald-300 bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-200/70 dark:border-emerald-800/50'
              }`}
              title={isDelayed ? 'تکمیل با تاخیر نسبت به تاریخ برنامه‌ریزی شده' : 'تکمیل در موعد برنامه‌ریزی شده (به‌موقع)'}
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isDelayed ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                />
                <span>تکمیل واقعی:</span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  className={`font-bold ${
                    isDelayed ? 'text-rose-800 dark:text-rose-200' : 'text-emerald-800 dark:text-emerald-200'
                  }`}
                >
                  {formatToJalali(completionDate)}
                </span>
                {isDelayed && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-rose-200/80 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200 font-semibold mr-0.5">
                    تاخیر
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Priority Tag Group (Status tag removed per user request) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Priority Tag */}
          <span
            className={`inline-flex items-center px-2 py-1 rounded-xl text-xs font-semibold border ${priorityCfg.bgColor} ${priorityCfg.textColor} ${priorityCfg.borderColor} dark:bg-slate-900/90 dark:text-slate-200 dark:border-slate-700`}
            title={`اولویت ${priorityCfg.title}`}
          >
            {priorityCfg.title}
          </span>
        </div>

      </div>

      {/* Delete Confirmation Modal Overlay inside card context or confirm popover */}
      {showConfirmDelete && (
        <div className="absolute inset-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs rounded-2xl p-4 flex flex-col justify-center items-center text-center border border-rose-200 dark:border-rose-900 animate-in fade-in">
          <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-1">
            آیا از حذف این فعالیت اطمینان دارید؟
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 line-clamp-1 max-w-[200px]">
            "{task.title}"
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDelete(task.id)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
            >
              حذف شود
            </button>
            <button
              onClick={() => setShowConfirmDelete(false)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            >
              انصراف
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

// Cards re-render on every board update; task objects are replaced immutably
// on change, so a shallow prop comparison is enough to skip untouched cards.
export const TaskCard = React.memo(TaskCardBase);
