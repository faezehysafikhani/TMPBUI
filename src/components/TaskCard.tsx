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
import { isResponsibleFor, responsibleNamesOf } from '../utils/taskPeople';
import { appAlert } from '../utils/appDialog';
import { TaskSlaBadge } from './work/TaskSlaBadge';
import { TaskStatusExtras } from './tasks/TaskStatusExtras';

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
  /** «نمایش اطلاعات» in the grouping bar: when false, the owner, responsible and tag chips are hidden. */
  showDetails?: boolean;
}

const PRIORITY_CHIP: Record<string, string> = {
  high: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  medium: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  low: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
};

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
  showDetails = true,
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
          void appAlert('شما دسترسی لازم برای تغییر وضعیت این فعالیت را ندارید.');
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

  const isAssignee = isResponsibleFor(task, currentUser);

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
  // Status Change: allowed for the admin/ManageAll, the task's real owner, or its assignee (when
  // allowStatusUpdateForAssignee is true) - never a team member who is not also an assignee, to
  // match the server's own resource-level rule (Nexus.TaskManagement CanChangeStatus).
  const canChangeStatus = (isAdmin || isTaskOwner || (isAssignee && allowStatusUpdateForAssignee)) && can(currentUser, PERMISSIONS.tasksEdit);

  // Edit Button: Allowed for Admin, Creator/Owner, OR Assignee with status update permission
  // Full edit and delete: owner or task administrator only (the server enforces the same).
  const canEditTask = (isAdmin || (isTaskCreator && (!isAssignee && !isTeamMember || isTaskCreator)) || isOwnerByDetails) && can(currentUser, PERMISSIONS.tasksEdit);
  const canDeleteTask = (isAdmin || (isTaskCreator && (!isAssignee && !isTeamMember || isTaskCreator)) || isOwnerByDetails) && can(currentUser, PERMISSIONS.tasksDelete);

  const commentCount = task.comments?.length || 0;



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
        className={`ui-surface group relative rounded-2xl border transition-all duration-200 hover:shadow-md ${
          canChangeStatus ? 'cursor-grab active:cursor-grabbing' : ''
        } ${
          isDraggingCard
            ? 'opacity-30 scale-95 border-dashed border-indigo-500 shadow-2xl ring-2 ring-indigo-500/80 bg-indigo-50 dark:bg-indigo-950'
            : 'border-slate-200/80 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-500/60 bg-white dark:bg-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
        } p-3.5 flex flex-col overflow-hidden`}
      >
      {/* Top: priority, then the actions on hover */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold whitespace-nowrap ${PRIORITY_CHIP[task.priority || 'medium']}`} title={`اولویت ${priorityCfg.title}`}>
          {priorityCfg.title}
        </span>
        {overdue && task.status !== 'completed' && (
          <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold whitespace-nowrap bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
            <AlertCircle className="w-3 h-3" /> موعد گذشته
          </span>
        )}
        <span className="flex-1" />
        <div className="flex items-center gap-0.5 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {canChangeStatus && (
            <span className="p-1 text-slate-300 dark:text-slate-600 cursor-grab" title="برای انتقال به ستون دیگر بکشید" aria-hidden="true">
              <GripVertical className="w-3.5 h-3.5" />
            </span>
          )}
          {canEditTask && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(task); }} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer" title="ویرایش فعالیت" aria-label="ویرایش فعالیت">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canDeleteTask && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setShowConfirmDelete(true); }} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer" title="حذف فعالیت" aria-label="حذف فعالیت">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <h3
        onClick={() => onViewDetails && onViewDetails(task)}
        title="مشاهدهٔ جزئیات"
        className={`text-sm font-bold leading-6 break-words cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors ${
          task.status === 'completed' ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {task.title}
      </h3>

      {/* Description, two lines */}
      {task.description && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-5 line-clamp-2 whitespace-pre-line">{task.description}</p>
      )}

      {/* Soft chips: custom status, project, stand-ins, tags */}
      {(() => {
        const tags = showDetails ? (task.tags || []).filter((t) => t !== 'تکرارشونده' && t !== 'تکرار' && t !== 'فعالیت تکرارشونده') : [];
        const hasStandIns = showDetails && task.standIns && task.standIns.length > 0;
        return (
          <div className="flex items-center gap-1.5 flex-wrap mt-2.5 empty:hidden">
            <TaskStatusExtras task={task} />
            {task.isProject && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onOpenProjectDetails && onOpenProjectDetails(task); }} className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 cursor-pointer" title="داشبورد پروژه">
                <FolderKanban className="w-3 h-3" /> پروژه
              </button>
            )}
            {hasStandIns && (
              <span className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-semibold bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300" data-stand-in
                title={task.standIns!.map((s) => `${s.name}${s.note ? ` (${s.note})` : ''}`).join('، ')}>
                <UserIcon className="w-3 h-3" /> جانشین: {task.standIns!.map((s) => s.name).join('، ')}
              </span>
            )}
            {tags.map((t, idx) => (
              <span key={idx} className="inline-flex items-center h-6 px-2 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
                <Tag className="w-3 h-3 ml-1 text-slate-400" />{t}
              </span>
            ))}
          </div>
        );
      })()}

      {/* Subtasks / occurrences: progress, list on demand */}
      {((task.projectSubTasks && task.projectSubTasks.length > 0) || task.isRecurring) && (() => {
        const subList = task.projectSubTasks || [];
        const done = subList.filter((x) => x.completed).length;
        const total = subList.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return (
          <div className="mt-3">
            <button type="button" onClick={(e) => { e.stopPropagation(); setShowSubTasks((v) => !v); }} className="w-full flex items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 cursor-pointer" aria-expanded={showSubTasks}>
              {task.isRecurring ? <Repeat className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">{task.isRecurring ? 'تکرارها' : 'زیرفعالیت‌ها'}</span>
              {total > 0 && <span className="tabular-nums">{toPersianDigits(done)}/{toPersianDigits(total)}</span>}
              <span className="flex-1" />
              {showSubTasks ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {total > 0 && (
              <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
              </div>
            )}
            {showSubTasks && total > 0 && (
              <div className="mt-2 space-y-1 max-h-52 overflow-y-auto">
                {subList.map((st) => (
                  <label key={st.id} onClick={(e) => e.stopPropagation()} className={`flex items-start gap-2 p-1.5 rounded-lg text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 ${st.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                    <input type="checkbox" checked={!!st.completed} onChange={(e) => { e.stopPropagation(); handleToggleSubTaskClick(st.id); }} className="w-4 h-4 mt-0.5 rounded accent-indigo-600 cursor-pointer shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium leading-5 break-words line-clamp-2" title={st.title}>{st.title}</span>
                      {st.startDate && <span className="block text-[10px] text-slate-400">{formatToJalali(st.startDate)}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Footer: people, counts, date */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-2 flex-wrap">
        {showDetails && (() => {
          const names = (task.responsibleUserNames && task.responsibleUserNames.length ? task.responsibleUserNames : (task.assignedUserName ? [task.assignedUserName] : [])).filter(Boolean);
          if (!names.length) return null;
          return (
            <span className="flex -space-x-1.5 space-x-reverse" title={`مسئول: ${responsibleNamesOf(task)}${task.ownerName ? ` · مالک: ${task.ownerName}` : ''}`}>
              {names.slice(0, 3).map((n, i) => (
                <span key={i} className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 ring-2 ring-white dark:ring-slate-800 text-[10px] font-bold flex items-center justify-center">{n.trim().charAt(0)}</span>
              ))}
              {names.length > 3 && <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 ring-2 ring-white dark:ring-slate-800 text-[10px] font-bold flex items-center justify-center">+{toPersianDigits(names.length - 3)}</span>}
            </span>
          );
        })()}
        <button type="button" onClick={(e) => { e.stopPropagation(); onViewDetails && onViewDetails(task); }} className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-600 cursor-pointer" title="گفتگو و جزئیات">
          <MessageSquare className="w-3.5 h-3.5" />{commentCount > 0 && <span className="tabular-nums">{toPersianDigits(commentCount)}</span>}
        </button>
        {task.attachments && task.attachments.length > 0 && (
          <button type="button" onClick={(e) => { e.stopPropagation(); if (task.attachments!.length === 1) onPreviewAttachment(task.attachments![0]); else onViewDetails && onViewDetails(task); }} className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-600 cursor-pointer" title={task.attachments.map((a) => `${a.name} (${formatFileSize(a.size)})`).join('\n')}>
            <Paperclip className="w-3.5 h-3.5" /><span className="tabular-nums">{toPersianDigits(task.attachments.length)}</span>
          </button>
        )}
        <span className="flex-1" />
        <TaskSlaBadge task={task} />
        <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${overdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`} title={formatToJalali(task.dueDate)}>
          <Calendar className="w-3.5 h-3.5" />
          {daysDiff.text && task.status !== 'completed' ? daysDiff.text : formatToJalali(task.dueDate).split(' ')[0]}
        </span>
        {task.status === 'completed' && (task.actualCompletionDate || task.updatedAt) && (() => {
          const completionDate = task.actualCompletionDate || task.updatedAt;
          const late = isCompletionDelayed(task.dueDate, completionDate);
          return (
            <span className={`w-full inline-flex items-center gap-1.5 text-[11px] font-medium ${late ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`} title={late ? 'تکمیل با تأخیر' : 'تکمیل به‌موقع'}>
              <CheckCircle2 className="w-3.5 h-3.5" /> تکمیل: {formatToJalali(completionDate)}{late && ' · با تأخیر'}
            </span>
          );
        })()}
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
