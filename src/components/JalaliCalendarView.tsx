import React, { useState, useRef, useEffect } from 'react';
import { Task, TaskStatus, Priority, Attachment, User } from '../types';
import {
  PERSIAN_MONTH_NAMES,
  PERSIAN_WEEK_DAYS,
  PERSIAN_WEEK_DAYS_SHORT,
  getJalaliMonthDays,
  getJalaliMonthFirstDayOfWeek,
  getCurrentJalali,
  parseISOToJalali,
  jalaliToISO,
  getJalaliHoliday,
  isPastDay,
} from '../utils/jalali';
import { toPersianDigits, getTaskLastModifiedTime } from '../utils/helpers';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  CalendarDays,
  MessageSquare,
  Edit2,
  Trash2,
  AlertCircle,
  Check,
  Lock,
  Eye,
} from 'lucide-react';
import { can, isTaskAdmin, PERMISSIONS } from '../utils/permissions';
import { isResponsibleFor, responsibleNamesOf } from '../utils/taskPeople';
import { appAlert, appConfirm } from '../utils/appDialog';
import { Meeting, MeetingPeopleOptions, getMeetingPeople, listMeetings, deleteMeeting } from '../services/meetingApi';
import { MeetingFormModal } from './MeetingFormModal';
import { CalendarCreateMenu } from './CalendarCreateMenu';
import { isoToIranDateTimeParts } from '../utils/jalali';
import { Notice } from './admin/AdminUi';
import { userErrorMessage } from '../utils/errorMessages';
import { showToast } from '../utils/toast';
import { PageHeader, btnPrimary, btnSecondary, surface } from './layout/PageHeader';
import { schedulingOffDayInfo } from '../utils/jalali';
import { useSchedulingCalendarVersion } from '../utils/useSchedulingCalendar';

interface JalaliCalendarViewProps {
  tasks: Task[];
  registeredUsers?: User[];
  currentUser?: User | null;
  onOpenCreateForDate?: (isoDateString: string) => void;
  /** Opens the new-task form for a meeting: its title as the default, its day when still open for new work. */
  onConvertMeetingToTask?: (title: string, isoDate?: string, tags?: string[], onCreated?: (taskId: string) => void) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onPreviewAttachment: (attachment: Attachment) => void;
  onViewDetails?: (task: Task) => void;
}

export interface CalendarItem {
  id: string;
  title: string;
  parentTask: Task;
  isSubTask: boolean;
  status: TaskStatus;
  priority: Priority;
  timeStr?: string;
  assignedUserName?: string;
}

const CalendarTaskCardItem: React.FC<{
  item: CalendarItem;
  index: number;
  parent: Task;
  commentCount: number;
  canEditTask: boolean;
  canDeleteTask: boolean;
  canChangeStatus: boolean;
  priorityStyle: string;
  onViewDetails?: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onDeleteRequest: (taskId: string) => void;
}> = ({
  item,
  index,
  parent,
  commentCount,
  canEditTask,
  canDeleteTask,
  canChangeStatus,
  priorityStyle,
  onViewDetails,
  onEditTask,
  onStatusChange,
  onDeleteRequest,
}) => {
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
          if (parent.status !== 'completed') {
            onStatusChange(parent.id, 'completed');
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

  return (
    <div className="relative overflow-hidden rounded-2xl select-none">
      {/* Revealed Action Layer on Drag (Left or Right) */}
      <div
        className={`absolute inset-y-0 inset-x-0 ${
          canChangeStatus ? 'bg-emerald-600 dark:bg-emerald-700' : 'bg-rose-600 dark:bg-rose-700'
        } flex items-center ${
          dragOffset > 0 ? 'justify-start pl-3' : 'justify-end pr-3'
        } text-white font-bold text-xs transition-opacity rounded-2xl ${
          Math.abs(dragOffset) > 8 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {canChangeStatus ? (
          <div className="flex items-center gap-1.5 bg-emerald-700/90 dark:bg-emerald-800/90 px-2.5 py-1 rounded-xl shadow-xs border border-white/20">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>خاتمه یافته</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-rose-700/90 dark:bg-rose-800/90 px-2.5 py-1 rounded-xl shadow-xs border border-white/20">
            <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>عدم دسترسی بروزرسانی</span>
          </div>
        )}
      </div>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClick={() => (onViewDetails ? onViewDetails(parent) : onEditTask(parent))}
        style={{
          transform: `translateX(${dragOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)',
          touchAction: 'pan-y',
        }}
        className={`group flex items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 hover:border-indigo-300 border border-slate-200/80 dark:border-slate-700/80 ${priorityStyle} transition-colors cursor-pointer`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Index Badge */}
          <span className="w-5 h-5 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0">
            {toPersianDigits(index + 1)}
          </span>

          {/* Title */}
          <span
            className={`font-bold text-xs leading-snug break-words min-w-0 flex-1 transition-colors ${
              item.status === 'completed' ||
              item.status === 'paused' ||
              parent.status === 'completed' ||
              parent.status === 'paused'
                ? 'line-through text-slate-400 dark:text-slate-500'
                : 'text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
            }`}
          >
            {item.title}
          </span>
        </div>

        {/* Action Buttons on Left (RTL Far Left) */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Discussion / View Details Button */}
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

          {/* Edit Button - STRICTLY for Owner/Admin */}
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

          {/* Delete Button - Strictly Owner/Admin */}
          {canDeleteTask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteRequest(parent.id);
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

export const JalaliCalendarView: React.FC<JalaliCalendarViewProps> = ({
  tasks,
  registeredUsers = [],
  currentUser,
  onOpenCreateForDate,
  onConvertMeetingToTask,
  onEditTask,
  onDeleteTask,
  onStatusChange,
  onPreviewAttachment,
  onViewDetails,
}) => {
  useSchedulingCalendarVersion();
  const currentJ = getCurrentJalali();
  const [viewYear, setViewYear] = useState<number>(currentJ.jy);
  const [viewMonth, setViewMonth] = useState<number>(currentJ.jm);
  const [selectedDay, setSelectedDay] = useState<number>(
    viewYear === currentJ.jy && viewMonth === currentJ.jm ? currentJ.jd : 1
  );

  const [showAllTasks, setShowAllTasks] = useState<boolean>(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [reloadMeetings, setReloadMeetings] = useState(0);
  const [meetingDate, setMeetingDate] = useState<string | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | undefined>();
  const [createMenu, setCreateMenu] = useState<{day:number;anchor:DOMRect} | null>(null);
  const [meetingPeople, setMeetingPeople] = useState<MeetingPeopleOptions | null>(null);
  const [meetingPeopleError, setMeetingPeopleError] = useState<string | null>(null);
  useEffect(()=>{
    let alive=true;setMeetingPeople(null);setMeetingPeopleError(null);
    if(currentUser?.id) getMeetingPeople().then(value=>{if(alive)setMeetingPeople(value);})
      .catch(e=>{if(alive)setMeetingPeopleError(userErrorMessage(e,'دریافت دسترسی ایجاد جلسه انجام نشد.'));});
    return()=>{alive=false;};
  },[currentUser?.id,reloadMeetings]);
  useEffect(() => {
    setSelectedDay(day => Math.min(day, getJalaliMonthDays(viewYear, viewMonth)));
  }, [viewYear, viewMonth]);
  const dayDate = (day: number) => isoToIranDateTimeParts(jalaliToISO(viewYear,viewMonth,day))!.date;
  useEffect(() => {
    if (!currentUser?.id || !can(currentUser, PERMISSIONS.meetingsView)) {setMeetings([]);setMeetingError(null); return;}
    let alive = true; setMeetingsLoading(true); setMeetingError(null);
    const from = isoToIranDateTimeParts(jalaliToISO(viewYear,viewMonth,1))!.date;
    const to = isoToIranDateTimeParts(jalaliToISO(viewMonth === 12 ? viewYear+1 : viewYear,viewMonth === 12 ? 1 : viewMonth+1,1))!.date;
    listMeetings(from,to).then(rows => {if(alive)setMeetings(rows);}).catch(e => {if(alive){setMeetings([]);setMeetingError(userErrorMessage(e,'دریافت جلسه‌ها انجام نشد.'));}}).finally(()=>{if(alive)setMeetingsLoading(false);});
    return () => {alive=false;};
  }, [viewYear,viewMonth,currentUser?.id,reloadMeetings]);
  const dayMeetings = meetings.filter(m => m.details.date === dayDate(Math.min(selectedDay,getJalaliMonthDays(viewYear,viewMonth))));
  const openCreateMenu = (day:number,button:HTMLButtonElement) => {setSelectedDay(day);setCreateMenu({day,anchor:button.getBoundingClientRect()});};
  const savedMeeting = (m:Meeting) => {
    setMeetings(rows => [...rows.filter(old=>old.id!==m.id),m]);
    const date=parseISOToJalali(m.details.date);setViewYear(date.jy);setViewMonth(date.jm);setSelectedDay(date.jd);
    setMeetingDate(null);setEditingMeeting(undefined);setReloadMeetings(n=>n+1);showToast(m.notice || 'جلسه ذخیره شد.',m.notice ? 'info' : 'ok');
  };
  const removeMeeting = async (m:Meeting) => {
    if(!await appConfirm('جلسه «'+m.details.title+'» حذف شود؟'))return;
    try {await deleteMeeting(m);setMeetings(rows=>rows.filter(row=>row.id!==m.id));showToast('جلسه حذف شد.','ok');}
    catch(e){setMeetingError(userErrorMessage(e,'حذف جلسه انجام نشد.'));}
  };

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

    const isTaskOwner = isTaskCreator || isOwnerByDetails;
    const allowStatusUpdateForAssignee = task.allowAssigneeStatusUpdate !== false;
    // A team member who is not also an assignee may never change status - matches the server's
    // own resource-level rule (Nexus.TaskManagement CanChangeStatus).
    const canChangeStatus = (isAdmin || isTaskOwner || (isAssignee && allowStatusUpdateForAssignee)) && can(currentUser, PERMISSIONS.tasksEdit);

    const isOwnerOrTaskAdmin = isAdmin || (isTaskCreator && (!isAssignee && !isTeamMember || isTaskCreator)) || isOwnerByDetails;
    const canEditTask = isOwnerOrTaskAdmin && can(currentUser, PERMISSIONS.tasksEdit);
    const canDeleteTask = isOwnerOrTaskAdmin && can(currentUser, PERMISSIONS.tasksDelete);

    return { canEditTask, canDeleteTask, canChangeStatus };
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handlePrevYear = () => setViewYear(viewYear - 1);
  const handleNextYear = () => setViewYear(viewYear + 1);

  // Opens the new-activity form for a day of the month on view. The date is built from the
  // Jalali year/month/day that was clicked (in Iran time, like every date in the app), with the
  // current time of day - the same default the "افزودن" button has always used.
  const openCreateForDay = (day: number) => {
    if (!onOpenCreateForDate) return;
    const cur = getCurrentJalali();
    onOpenCreateForDate(jalaliToISO(viewYear, viewMonth, day, cur.hour, cur.minute));
  };

  // Clicking a day shows its activities; the new-activity form opens only from the day's + button.
  const handleSelectDay = (day: number) => {
    setSelectedDay(day);
  };

  const handleGoToToday = () => {
    const today = getCurrentJalali();
    setViewYear(today.jy);
    setViewMonth(today.jm);
    setSelectedDay(today.jd);
  };

  // Calendar calculations
  const totalDays = getJalaliMonthDays(viewYear, viewMonth);
  const firstDayOfWeek = getJalaliMonthFirstDayOfWeek(viewYear, viewMonth); // 0 = Shanbeh, 6 = Jomeh

  // Map tasks & subtasks/occurrences to days of the current month view
  const dayItemsMap: Record<number, CalendarItem[]> = {};

  tasks.forEach((task) => {
    // Exclude completed or paused tasks from calendar view unless showAllTasks is true
    if (!showAllTasks && (task.status === 'completed' || task.status === 'paused')) {
      return;
    }

    // 1) Main task mapping (if dueDate exists and not a recurring parent task with occurrences OR even if it has occurrences)
    if (task.dueDate) {
      const taskJ = parseISOToJalali(task.dueDate);
      if (taskJ.jy === viewYear && taskJ.jm === viewMonth) {
        if (!dayItemsMap[taskJ.jd]) {
          dayItemsMap[taskJ.jd] = [];
        }

        let timeStr = '';
        if (taskJ.hour !== undefined && taskJ.minute !== undefined) {
          const hStr = taskJ.hour.toString().padStart(2, '0');
          const mStr = taskJ.minute.toString().padStart(2, '0');
          if (hStr !== '00' || mStr !== '00') {
            timeStr = `${toPersianDigits(hStr)}:${toPersianDigits(mStr)}`;
          }
        }

        // Avoid adding duplicate main task if it's a recurring parent whose subtasks already cover occurrences
        // Unless it has no subtasks
        if (!task.isRecurring || !task.projectSubTasks || task.projectSubTasks.length === 0) {
          dayItemsMap[taskJ.jd].push({
            id: task.id,
            title: task.title,
            parentTask: task,
            isSubTask: false,
            status: task.status,
            priority: task.priority,
            timeStr,
            assignedUserName: responsibleNamesOf(task) || undefined,
          });
        }
      }
    }

    // 2) Subtasks / Occurrences mapping
    if (task.projectSubTasks && task.projectSubTasks.length > 0) {
      task.projectSubTasks.forEach((st) => {
        // Exclude completed subtasks unless showAllTasks is true
        if (!showAllTasks && st.completed) return;

        const dateISO = st.startDate || st.endDate;
        if (!dateISO) return;
        const stJ = parseISOToJalali(dateISO);
        if (stJ.jy === viewYear && stJ.jm === viewMonth) {
          if (!dayItemsMap[stJ.jd]) {
            dayItemsMap[stJ.jd] = [];
          }

          let timeStr = '';
          const cfg = task.recurringConfig;
          if (cfg && (cfg.startTime || cfg.dailyTime || cfg.time)) {
            const sT = cfg.startTime || cfg.dailyTime || cfg.time;
            const eT = cfg.endTime;
            if (sT && eT) {
              timeStr = `${toPersianDigits(sT)} تا ${toPersianDigits(eT)}`;
            } else if (sT) {
              timeStr = `${toPersianDigits(sT)}`;
            }
          } else if (stJ.hour !== undefined && stJ.minute !== undefined) {
            const hStr = stJ.hour.toString().padStart(2, '0');
            const mStr = stJ.minute.toString().padStart(2, '0');
            if (hStr !== '00' || mStr !== '00') {
              timeStr = `${toPersianDigits(hStr)}:${toPersianDigits(mStr)}`;
            }
          }

          dayItemsMap[stJ.jd].push({
            id: st.id,
            title: task.isRecurring ? `${task.title} (${st.title})` : `${task.title} > ${st.title}`,
            parentTask: task,
            isSubTask: true,
            status: st.completed ? 'completed' : 'todo',
            priority: (st.importance as any) || task.priority,
            timeStr,
            assignedUserName: responsibleNamesOf(task) || undefined,
          });
        }
      });
    }
  });

  const selectedDayItems = (dayItemsMap[selectedDay] || []).sort((a, b) => {
    return getTaskLastModifiedTime(b.parentTask) - getTaskLastModifiedTime(a.parentTask);
  });

  const canCreateAny = !!onOpenCreateForDate || !!meetingPeople?.canCreate;
  const PRIORITY_DOT: Record<Priority, string> = { high: 'bg-rose-500', medium: 'bg-amber-400', low: 'bg-emerald-500' };
  const navBtn = 'w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-white dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-700 cursor-pointer transition-colors';
  const isTodayView = currentJ.jy === viewYear && currentJ.jm === viewMonth;
  const rows = Math.ceil((firstDayOfWeek + totalDays) / 7);

  return (
    <div className="w-full">
      <PageHeader
        title="تقویم"
        subtitle="جلسه‌ها، موعد فعالیت‌ها و روزهای کاری سازمان در یک نگاه."
        actions={<>
          <button
            type="button"
            role="switch"
            aria-checked={!showAllTasks}
            onClick={() => setShowAllTasks((prev) => !prev)}
            title="نمایش یا پنهان کردن فعالیت‌های خاتمه‌یافته و متوقف"
            className="inline-flex items-center gap-2 h-10 px-3 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
          >
            <span className={`relative inline-flex w-8 h-[18px] rounded-full transition-colors ${!showAllTasks ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <span className={`absolute top-[3px] w-3 h-3 rounded-full bg-white shadow transition-all ${!showAllTasks ? 'right-[3px]' : 'right-[17px]'}`} />
            </span>
            فقط جاری
          </button>
          {canCreateAny && !isPastDay(dayDate(Math.min(selectedDay, totalDays))) && !schedulingOffDayInfo(dayDate(Math.min(selectedDay, totalDays))).off && (
            <button type="button" className={btnPrimary} onClick={(e) => openCreateMenu(selectedDay, e.currentTarget)}><Plus className="w-4 h-4" /> افزودن</button>
          )}
        </>}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
        {/* Month */}
        <section className={`${surface} p-3 sm:p-4`} aria-label="ماه">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white min-w-[9rem]">{PERSIAN_MONTH_NAMES[viewMonth - 1]} {toPersianDigits(viewYear)}</h2>
            <span className="flex-1" />
            {!isTodayView && <button type="button" onClick={handleGoToToday} className={`${btnSecondary} !h-9`}>امروز</button>}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <button type="button" onClick={handlePrevYear} className={navBtn} title="سال قبل" aria-label="سال قبل"><ChevronsRight className="w-4 h-4" /></button>
              <button type="button" onClick={handlePrevMonth} className={navBtn} title="ماه قبل" aria-label="ماه قبل"><ChevronRight className="w-4 h-4" /></button>
              <button type="button" onClick={handleNextMonth} className={navBtn} title="ماه بعد" aria-label="ماه بعد"><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" onClick={handleNextYear} className={navBtn} title="سال بعد" aria-label="سال بعد"><ChevronsLeft className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center mb-1">
            {PERSIAN_WEEK_DAYS.map((dayName, idx) => (
              <div key={dayName} className="py-2 text-xs font-semibold text-slate-400 dark:text-slate-500">
                <span className="hidden sm:inline">{dayName}</span>
                <span className="sm:hidden" aria-label={dayName}>{PERSIAN_WEEK_DAYS_SHORT[idx]}</span>
              </div>
            ))}
          </div>

          <div
            className="grid grid-cols-7 gap-px rounded-xl overflow-hidden bg-slate-200/70 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-800"
            style={{ '--cal-cell-h': `clamp(5.5rem, calc((100dvh - 22rem) / ${rows}), 8rem)` } as React.CSSProperties}
          >
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`offset-${i}`} className="h-20 sm:h-24 lg:h-(--cal-cell-h) bg-slate-50 dark:bg-slate-900/70" />
            ))}
            {Array.from({ length: totalDays }).map((_, i) => {
              const dayNum = i + 1;
              const iso = dayDate(dayNum);
              const isToday = isTodayView && currentJ.jd === dayNum;
              const isSelected = selectedDay === dayNum;
              const off = schedulingOffDayInfo(iso);
              const past = isPastDay(iso);
              const creationBlocked = off.off || past;
              const dayTasks = dayItemsMap[dayNum] || [];
              const dayMeets = meetings.filter((m) => m.details.date === iso);
              const chips = [
                ...dayMeets.map((m) => ({ key: 'm' + m.id, label: m.details.title, meeting: true as const, dot: '' })),
                ...dayTasks.map((t, n) => ({ key: 't' + t.id + n, label: t.title, meeting: false as const, dot: PRIORITY_DOT[t.priority || 'medium'] })),
              ];
              const shownChips = chips.slice(0, 2);
              return (
                <div
                  key={`day-${dayNum}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${toPersianDigits(dayNum)} ${PERSIAN_MONTH_NAMES[viewMonth - 1]}${off.off ? `، ${off.title || 'تعطیل'}` : ''}، ${toPersianDigits(chips.length)} مورد`}
                  onClick={() => handleSelectDay(dayNum)}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); handleSelectDay(dayNum); }
                  }}
                  title={off.off ? off.title : undefined}
                  className={`group/day relative h-20 sm:h-24 lg:h-(--cal-cell-h) p-1.5 sm:p-2 flex flex-col gap-1 text-right cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 ring-2 ring-inset ring-indigo-500'
                      : off.off
                      ? 'bg-rose-50/50 hover:bg-rose-50 dark:bg-rose-950/15 dark:hover:bg-rose-950/30'
                      : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold tabular-nums ${
                      isToday ? 'bg-indigo-600 text-white' : off.off ? 'text-rose-500 dark:text-rose-400' : past ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-200'
                    }`}>{toPersianDigits(dayNum)}</span>
                    {canCreateAny && !creationBlocked && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setSelectedDay(dayNum); openCreateMenu(dayNum, e.currentTarget); }}
                        title="افزودن در این روز"
                        aria-label={`افزودن در روز ${toPersianDigits(dayNum)}`}
                        className="w-6 h-6 rounded-md flex items-center justify-center text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 cursor-pointer [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/day:opacity-100 focus-visible:opacity-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {/* Up to two items, then a count */}
                  <div className="hidden sm:flex flex-col gap-0.5 min-w-0">
                    {shownChips.map((c) => (
                      <span key={c.key} className={`flex items-center gap-1 px-1.5 h-5 rounded-md text-[11px] font-semibold truncate ${c.meeting ? 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}>
                        {!c.meeting && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />}
                        <span className="truncate">{c.label}</span>
                      </span>
                    ))}
                    {chips.length > 2 && <span className="text-[11px] font-semibold text-slate-400 px-1">{toPersianDigits(chips.length - 2)}+ مورد دیگر</span>}
                  </div>
                  {chips.length > 0 && (
                    <span className="sm:hidden mt-auto mx-auto w-1.5 h-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-100 dark:bg-sky-950" /> جلسه</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> اولویت زیاد</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-50 border border-rose-100 dark:bg-rose-950/30 dark:border-rose-900" /> تعطیل در تقویم کاری</span>
          </div>
        </section>

        {/* Selected day */}
        {(() => {
          const iso = dayDate(Math.min(selectedDay, totalDays));
          const off = schedulingOffDayInfo(iso);
          const past = isPastDay(iso);
          const blocked = off.off || past;
          const weekday = PERSIAN_WEEK_DAYS[(firstDayOfWeek + selectedDay - 1) % 7];
          return (
            <aside className={`${surface} p-4 space-y-4 xl:sticky xl:top-20`} aria-label="روز انتخاب‌شده">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-400">{weekday}</p>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{toPersianDigits(selectedDay)} {PERSIAN_MONTH_NAMES[viewMonth - 1]}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{toPersianDigits(selectedDayItems.length)} فعالیت · {toPersianDigits(dayMeetings.length)} جلسه</p>
                </div>
                {canCreateAny && !blocked && (
                  <button type="button" onClick={(e) => openCreateMenu(selectedDay, e.currentTarget)} className={`${btnSecondary} !h-9`}><Plus className="w-4 h-4" /> افزودن</button>
                )}
              </div>

              {off.off ? (
                <p className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                  {off.title || 'تعطیل'}؛ فعالیت یا جلسهٔ جدید در این روز ثبت نمی‌شود.
                </p>
              ) : past ? (
                <p className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                  روز گذشته؛ فعالیت یا جلسهٔ جدید ثبت نمی‌شود.
                </p>
              ) : null}

              <section className="space-y-2" aria-label="جلسات روز">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400">جلسه‌ها</h4>
                  <button type="button" onClick={() => setReloadMeetings((n) => n + 1)} className="text-xs font-semibold text-slate-400 hover:text-indigo-600 cursor-pointer">تازه‌سازی</button>
                </div>
                {meetingError && <Notice type="error">{meetingError}</Notice>}
                {meetingsLoading && <p className="text-xs text-slate-400">در حال دریافت جلسه‌ها…</p>}
                {!meetingsLoading && !meetingError && dayMeetings.length === 0 && <p className="text-xs text-slate-400 py-2">جلسه‌ای ثبت نشده است.</p>}
                {dayMeetings.map((m) => (
                  <div key={m.id} className="group/meet flex gap-3 p-3 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/60">
                    <span className="w-1 rounded-full bg-sky-500 shrink-0" aria-hidden="true" />
                    <button type="button" onClick={() => { setEditingMeeting(m); setMeetingDate(m.details.date); }} className="flex-1 min-w-0 text-right cursor-pointer" title={m.canEdit ? 'جزئیات و ویرایش جلسه' : 'مشاهده جزئیات جلسه'}>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{m.details.title}</p>
                      <p className="text-xs text-sky-700 dark:text-sky-300 mt-0.5 tabular-nums">{toPersianDigits(m.details.startTime)} تا {toPersianDigits(m.details.endTime)}{m.details.location && ' · ' + m.details.location}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{toPersianDigits(m.details.participantIds.length)} نفر · {toPersianDigits(m.details.agenda.length)} بند دستور جلسه</p>
                    </button>
                    <span className="flex flex-col gap-1 shrink-0">
                      <button type="button" title="مشاهده" aria-label={'مشاهده جلسه ' + m.details.title} onClick={() => { setEditingMeeting(m); setMeetingDate(m.details.date); }} className="p-1 rounded-lg text-sky-600 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/50 cursor-pointer"><Eye className="w-4 h-4" /></button>
                      {m.canDelete && <button type="button" title="حذف جلسه" aria-label={'حذف جلسه ' + m.details.title} onClick={() => removeMeeting(m)} className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"><Trash2 className="w-4 h-4" /></button>}
                    </span>
                  </div>
                ))}
              </section>

              <section className="space-y-2" aria-label="فعالیت‌های روز">
                <h4 className="text-xs font-bold text-slate-400">فعالیت‌ها</h4>
                {selectedDayItems.length > 0 ? (
                  <div className="space-y-2 max-h-[520px] overflow-y-auto p-0.5">
                    {selectedDayItems.map((item, index) => {
                      const parent = item.parentTask;
                      const { canEditTask, canDeleteTask, canChangeStatus } = checkTaskPermissions(parent);
                      const priorityStyle = { high: 'border-r-[3px] border-r-rose-500', medium: 'border-r-[3px] border-r-amber-400', low: 'border-r-[3px] border-r-emerald-500' }[item.priority || 'medium'];
                      return (
                        <CalendarTaskCardItem
                          key={item.id + '_' + index}
                          item={item}
                          index={index}
                          parent={parent}
                          commentCount={parent.comments?.length || 0}
                          canEditTask={canEditTask}
                          canDeleteTask={canDeleteTask}
                          canChangeStatus={canChangeStatus}
                          priorityStyle={priorityStyle}
                          onViewDetails={onViewDetails}
                          onEditTask={onEditTask}
                          onStatusChange={onStatusChange}
                          onDeleteRequest={(id) => setDeletingTaskId(id)}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                    <CalendarIcon className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">فعالیتی با موعد این روز نیست.</p>
                  </div>
                )}
              </section>
            </aside>
          );
        })()}
      </div>

      {createMenu && <CalendarCreateMenu anchor={createMenu.anchor} canCreateMeeting={!!meetingPeople?.canCreate} canCreateTask={!!onOpenCreateForDate} meetingReason={meetingPeopleError || meetingPeople?.message || (!meetingPeople?'در حال بررسی دسترسی…':!meetingPeople.canCreate?'دسترسی ایجاد جلسه ندارید.':undefined)} onClose={()=>setCreateMenu(null)} onTask={()=>{const day=createMenu.day;setCreateMenu(null);openCreateForDay(day);}} onMeeting={()=>{if(!meetingPeople?.canCreate)return;setEditingMeeting(undefined);setMeetingDate(dayDate(createMenu.day));setCreateMenu(null);}} />}
      {meetingDate && currentUser && <MeetingFormModal initialDate={meetingDate} meeting={editingMeeting} currentUser={currentUser} people={registeredUsers} tasks={tasks} onClose={()=>{setMeetingDate(null);setEditingMeeting(undefined);}} onSaved={savedMeeting} onConvertToTask={onConvertMeetingToTask && ((title,isoDate,tags,onCreated)=>onConvertMeetingToTask(title,isoDate,tags,onCreated))} onLinked={m=>setMeetings(rows=>rows.map(old=>old.id===m.id?m:old))} />}
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
