import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, Priority, Attachment, STATUSES, PRIORITIES, AppColorPalette, User, WorkTeam, WorkTeamMember, RecurringFrequency, RecurringConfig, OccurrenceNth, ProjectCharter, ProjectSubTask, SubTaskImportance, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_LABEL } from '../types';
import { COLOR_PALETTES } from '../utils/theme';
import { readFileAsDataUrl } from '../utils/storage';
import { formatFileSize, toPersianDigits, computeAutoTaskStatus } from '../utils/helpers';
import { JalaliDateTimePicker } from './JalaliDateTimePicker';
import { getNowISO, iranDateTimeToISO, isoToIranDateTimeParts } from '../utils/jalali';
import { fetchUserTeamsPB, fetchUserTeamsAsyncPB, fetchAllUsersPB } from '../services/dataService';
import { generateRecurringOccurrences } from '../utils/recurring';
import {
  X,
  UploadCloud,
  FileText,
  Trash2,
  AlertCircle,
  Plus,
  Check,
  Paperclip,
  Users,
  User as UserIcon,
  Search,
  UserX,
  ChevronDown,
  Tag,
  Repeat,
  Clock,
  Calendar,
  FolderKanban,
  ListChecks,
} from 'lucide-react';
import { can, isTaskAdmin, PERMISSIONS } from '../utils/permissions';
import { isResponsibleFor, responsibleIdsOf } from '../utils/taskPeople';

/** One person the responsible-people picker offers. */
interface PersonOption {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  email?: string;
}

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>, taskId?: string) => void;
  taskToEdit?: Task | null;
  initialStatus?: TaskStatus;
  initialDueDate?: string;
  initialTitle?: string;
  initialDescription?: string;
  appColorPalette?: AppColorPalette;
  currentUser?: User | null;
  existingTasks?: Task[];
  registeredUsers?: User[];
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  taskToEdit,
  initialStatus = 'todo',
  initialDueDate,
  initialTitle = '',
  initialDescription = '',
  appColorPalette = 'indigo',
  currentUser,
  existingTasks = [],
  registeredUsers = [],
}) => {
  const palette = COLOR_PALETTES[appColorPalette] || COLOR_PALETTES.indigo;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDateISO, setDueDateISO] = useState<string>(() => initialDueDate || getNowISO());
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<TaskStatus>(initialStatus);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  // Everyone responsible for doing the task (one or more); the first is sent as assignedUserId too.
  const [responsibleIds, setResponsibleIds] = useState<string[]>([]);
  const [allowAssigneeStatusUpdate, setAllowAssigneeStatusUpdate] = useState<boolean>(true);
  const [allRegisteredUsers, setAllRegisteredUsers] = useState<User[]>(registeredUsers);
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState<boolean>(false);
  const assigneeDropdownRef = useRef<HTMLDivElement>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [isProject, setIsProject] = useState<boolean>(false);
  const [isRecurring, setIsRecurring] = useState<boolean>(false);

  // Project inline options state
  const [projectCharterManager, setProjectCharterManager] = useState<string>('');
  const [projectCharterDesc, setProjectCharterDesc] = useState<string>('');
  const [projectCharterStartDate, setProjectCharterStartDate] = useState<string>(getNowISO());
  const [projectCharterEndDate, setProjectCharterEndDate] = useState<string>(getNowISO());
  const [projectSubTasks, setProjectSubTasks] = useState<ProjectSubTask[]>([]);
  const [newSubTaskTitle, setNewSubTaskTitle] = useState<string>('');
  const [newSubTaskImportance, setNewSubTaskImportance] = useState<SubTaskImportance>('medium');

  // Recurring options state
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('daily');
  const [recurringIntervalWeeks, setRecurringIntervalWeeks] = useState<number>(1);
  const [recurringNthOccurrence, setRecurringNthOccurrence] = useState<OccurrenceNth>('first');
  const [recurringNthWeekday, setRecurringNthWeekday] = useState<number>(2); // 2 = دوشنبه
  const [recurringStartTime, setRecurringStartTime] = useState<string>('09:00');
  const [recurringEndTime, setRecurringEndTime] = useState<string>('10:00');
  const [recurringWeeklyDays, setRecurringWeeklyDays] = useState<number[]>([0]); // 0 = شنبه
  const [recurringMonthlyDays, setRecurringMonthlyDays] = useState<number[]>([1]); // 1
  const [recurringStartDate, setRecurringStartDate] = useState<string>(getNowISO());
  const [recurringEndDate, setRecurringEndDate] = useState<string>('');

  const [availableTeams, setAvailableTeams] = useState<WorkTeam[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; assignee?: string }>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  // Collect previous unique tags used across tasks
  const userPreviousTags = React.useMemo(() => {
    if (!existingTasks || existingTasks.length === 0) return [];
    const tagSet = new Set<string>();
    existingTasks.forEach((t) => {
      if (t.tags && Array.isArray(t.tags)) {
        t.tags.forEach((tag) => {
          if (tag && tag.trim()) {
            tagSet.add(tag.trim());
          }
        });
      }
    });
    return Array.from(tagSet);
  }, [existingTasks]);

  const filteredPreviousTags = userPreviousTags.filter(
    (t) => !tags.includes(t) && t.toLowerCase().includes(tagInput.trim().toLowerCase())
  );

  const isAdmin = isTaskAdmin(currentUser);

  const isAssignee = !!(taskToEdit && currentUser && isResponsibleFor(taskToEdit, currentUser));

  const isTeamMember = !!(
    taskToEdit &&
    currentUser &&
    ((taskToEdit.teamMemberIds && taskToEdit.teamMemberIds.includes(currentUser.id)) ||
      (taskToEdit.assignedTeamId && currentUser.teams?.some((t) => t.id === taskToEdit.assignedTeamId)))
  );

  const isTaskCreator = !!(taskToEdit && currentUser && taskToEdit.user && taskToEdit.user === currentUser.id);

  const isOwnerByDetails = !!(
    taskToEdit &&
    currentUser &&
    taskToEdit.ownerName &&
    (taskToEdit.ownerName.trim().toLowerCase() === (currentUser.name || '').trim().toLowerCase() ||
      taskToEdit.ownerName.trim().toLowerCase() === (currentUser.username || '').trim().toLowerCase() ||
      taskToEdit.ownerName.trim().toLowerCase() === (currentUser.email || '').trim().toLowerCase()) &&
    !isAssignee &&
    !isTeamMember
  );

  const isTaskOwner = isAdmin || isTaskCreator || isOwnerByDetails;

  const canUploadFiles = can(currentUser, PERMISSIONS.tasksUploadFiles);
  const isStatusOnlyEdit = !!(
    taskToEdit &&
    !isTaskOwner &&
    isAssignee &&
    taskToEdit.allowAssigneeStatusUpdate !== false
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false);
      }
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(event.target as Node)) {
        setIsAssigneeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch all registered users for quick search & assignment
  useEffect(() => {
    if (registeredUsers && registeredUsers.length > 0) {
      setAllRegisteredUsers(registeredUsers);
    }
    fetchAllUsersPB()
      .then((users) => {
        if (users && users.length > 0) {
          setAllRegisteredUsers(users);
        }
      })
      .catch(() => {});
  }, [registeredUsers, isOpen]);

  // The teams to choose from. Only the teams: the form's own selections are set once when it
  // opens (below) and never reset here - the signed-in user object is replaced whenever the
  // window regains focus, and that used to throw away what had been picked before saving.
  const currentUserId = currentUser?.id;
  useEffect(() => {
    if (!currentUserId) return;
    // First load synchronously from local cache
    setAvailableTeams(fetchUserTeamsPB(currentUserId));

    // Then refresh from the server
    fetchUserTeamsAsyncPB(currentUserId).then((liveTeams) => {
      if (liveTeams && liveTeams.length > 0) {
        setAvailableTeams(liveTeams);
      }
    }).catch(() => {});
  }, [currentUserId, isOpen]);

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || '');
      setDueDateISO(taskToEdit.dueDate || getNowISO());
      setPriority(taskToEdit.priority || 'medium');
      setStatus(taskToEdit.status || 'todo');
      setAttachments(taskToEdit.attachments || []);
      setSelectedTeamId(taskToEdit.assignedTeamId || '');
      // The access list as saved, without the responsible people (they have access anyway): so
      // taking someone off the responsible list does not silently leave them with access.
      const responsible = responsibleIdsOf(taskToEdit);
      setResponsibleIds(responsible);
      setSelectedMemberIds((taskToEdit.teamMemberIds || []).filter((id) => !responsible.includes(id)));
      setAllowAssigneeStatusUpdate(taskToEdit.allowAssigneeStatusUpdate !== false);
      setTags(taskToEdit.tags || []);
      setTagInput('');
      const projectFlag = !!taskToEdit.isProject;
      const recurringFlag = !projectFlag && !!taskToEdit.isRecurring;
      setIsProject(projectFlag);
      setIsRecurring(recurringFlag);
      const pc = taskToEdit.projectCharter || {};
      setProjectCharterManager(
        pc.projectManager || taskToEdit.assignedUserName || taskToEdit.ownerName || (currentUser ? currentUser.name || currentUser.username : '')
      );
      setProjectCharterDesc(pc.description || '');
      setProjectCharterStartDate(pc.startDate || taskToEdit.createdAt || getNowISO());
      setProjectCharterEndDate(pc.endDate || taskToEdit.dueDate || getNowISO());
      setProjectSubTasks(taskToEdit.projectSubTasks || []);
      setNewSubTaskTitle('');
      setNewSubTaskImportance('medium');
      if (taskToEdit.recurringConfig) {
        setRecurringFrequency(taskToEdit.recurringConfig.frequency || 'daily');
        setRecurringIntervalWeeks(taskToEdit.recurringConfig.intervalWeeks || 1);
        setRecurringNthOccurrence(taskToEdit.recurringConfig.nthOccurrence || 'first');
        setRecurringNthWeekday(taskToEdit.recurringConfig.nthWeekday ?? 2);
        setRecurringStartTime(
          taskToEdit.recurringConfig.startTime ||
            taskToEdit.recurringConfig.dailyTime ||
            taskToEdit.recurringConfig.time ||
            '09:00'
        );
        setRecurringEndTime(taskToEdit.recurringConfig.endTime || '10:00');
        setRecurringWeeklyDays(taskToEdit.recurringConfig.weeklyDays || [0]);
        setRecurringMonthlyDays(taskToEdit.recurringConfig.monthlyDays || [1]);
        setRecurringStartDate(taskToEdit.recurringConfig.startDate || taskToEdit.dueDate || getNowISO());
        setRecurringEndDate(taskToEdit.recurringConfig.endDate || '');
      } else {
        setRecurringFrequency('daily');
        setRecurringIntervalWeeks(1);
        setRecurringNthOccurrence('first');
        setRecurringNthWeekday(2);
        setRecurringStartTime('09:00');
        setRecurringEndTime('10:00');
        setRecurringWeeklyDays([0]);
        setRecurringMonthlyDays([1]);
        setRecurringStartDate(taskToEdit.dueDate || getNowISO());
        setRecurringEndDate('');
      }
    } else {
      setTitle(initialTitle || '');
      setDescription(initialDescription || '');
      const defaultDateTime = initialDueDate || getNowISO();
      setDueDateISO(defaultDateTime);
      setPriority('medium');
      setStatus(initialStatus);
      setAttachments([]);
      setResponsibleIds([]);
      setTags([]);
      setTagInput('');
      setIsProject(false);
      setProjectCharterManager(currentUser ? currentUser.name || currentUser.username : '');
      setProjectCharterDesc('');
      setProjectCharterStartDate(defaultDateTime);
      setProjectCharterEndDate(defaultDateTime);
      setProjectSubTasks([]);
      setNewSubTaskTitle('');
      setNewSubTaskImportance('medium');
      setIsRecurring(false);
      setRecurringFrequency('daily');
      setRecurringIntervalWeeks(1);
      setRecurringNthOccurrence('first');
      setRecurringNthWeekday(2);
      setRecurringStartTime('09:00');
      setRecurringEndTime('10:00');
      setRecurringWeeklyDays([0]);
      setRecurringMonthlyDays([1]);
      setRecurringStartDate(defaultDateTime);
      setRecurringEndDate('');
      setSelectedTeamId('');
      setSelectedMemberIds(currentUser ? [currentUser.id] : []);
    }
    setErrors({});
  }, [taskToEdit, initialStatus, initialDueDate, isOpen]);

  // Auto update status if project or recurring or has subtasks
  const isAutoStatusTask = isProject || isRecurring || projectSubTasks.length > 0;
  // A recurring task is scheduled by its own recurrence settings; its plain due date is not asked for.
  const hideDueDate = !isProject && isRecurring;

  useEffect(() => {
    if (isAutoStatusTask) {
      setStatus(computeAutoTaskStatus(projectSubTasks));
    }
  }, [isProject, isRecurring, projectSubTasks]);

  if (!isOpen) return null;

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    try {
      const newAttachments: Attachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > MAX_ATTACHMENT_BYTES) {
          alert(`حجم فایل «${file.name}» بیشتر از ${MAX_ATTACHMENT_LABEL} است.`);
          continue;
        }
        // The server refuses empty files, which would fail the whole save later on.
        if (file.size === 0) {
          alert(`فایل «${file.name}» خالی است و قابل پیوست نیست.`);
          continue;
        }
        // Choosing the same file again would upload and store it twice.
        const isDuplicate = [...attachments, ...newAttachments].some(
          (att) => att.name === file.name && att.size === file.size
        );
        if (isDuplicate) {
          alert(`فایل «${file.name}» قبلاً به این فعالیت پیوست شده است.`);
          continue;
        }
        // Read file content as base64
        const dataUrl = await readFileAsDataUrl(file);
        newAttachments.push({
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          dataUrl,
          createdAt: new Date().toISOString(),
        });
      }
      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (err) {
      console.error('Failed to attach file:', err);
      alert('خطا در بارگذاری فایل. لطفاً دوباره تلاش کنید.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== attachmentId));
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  };

  const handleAddProjectSubTask = () => {
    if (!newSubTaskTitle.trim()) return;
    const newSub: ProjectSubTask = {
      id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: newSubTaskTitle.trim(),
      startDate: projectCharterStartDate || dueDateISO || getNowISO(),
      endDate: projectCharterEndDate || dueDateISO || getNowISO(),
      importance: newSubTaskImportance,
      completed: false,
      createdAt: getNowISO(),
    };
    setProjectSubTasks((prev) => [...prev, newSub]);
    setNewSubTaskTitle('');
  };

  const handleRemoveProjectSubTask = (subId: string) => {
    setProjectSubTasks((prev) => prev.filter((s) => s.id !== subId));
  };

  const handleToggleModalSubTask = (subId: string) => {
    setProjectSubTasks((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, completed: !s.completed } : s))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrors({ title: 'عنوان فعالیت الزامی است' });
      return;
    }
    // Every new task needs someone responsible for doing it (the server enforces this too).
    if (!taskToEdit && responsibleIds.length === 0) {
      setErrors({ assignee: 'لطفاً مسئول اجرای فعالیت را انتخاب کنید.' });
      assigneeDropdownRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    const selectedTeam = availableTeams.find((t) => t.id === selectedTeamId);
    let finalTeamMemberIds: string[] = [];
    if (selectedMemberIds.length > 0) {
      finalTeamMemberIds = [...selectedMemberIds];
    } else if (currentUser && !selectedTeamId) {
      finalTeamMemberIds = [currentUser.id];
    }

    // Names of the responsible people, for display until the server's copy arrives. They are not
    // added to the access list: responsible people have access anyway, and the server keeps it.
    const allMembers = availableTeams.flatMap((t) => t.members);
    const personOf = (id: string): { name?: string; avatar?: string } => {
      const regUser = allRegisteredUsers.find((u) => u.id === id);
      if (regUser) return { name: regUser.name || regUser.username, avatar: regUser.avatar };
      const member = allMembers.find((m) => m.userId === id);
      if (member) return { name: member.name, avatar: member.avatar };
      if (currentUser && currentUser.id === id) return { name: currentUser.name || currentUser.username, avatar: currentUser.avatar };
      const known = (taskToEdit?.responsibleUserIds || []).indexOf(id);
      return { name: known >= 0 ? taskToEdit?.responsibleUserNames?.[known] : undefined };
    };
    const responsibleNames = responsibleIds.map((id) => personOf(id).name || 'کاربر');
    const assignedName = responsibleIds.length > 0 ? responsibleNames[0] : undefined;
    const assignedAvatar = responsibleIds.length > 0 ? personOf(responsibleIds[0]).avatar : undefined;

    const finalIsProject = isProject;
    const finalIsRecurring = !isProject && isRecurring;

    const recurringConfig: RecurringConfig | undefined = finalIsRecurring
      ? {
          frequency: recurringFrequency,
          intervalWeeks: recurringFrequency === 'weekly' ? recurringIntervalWeeks : undefined,
          startTime: recurringStartTime,
          endTime: recurringEndTime,
          dailyTime: recurringStartTime,
          time: recurringStartTime,
          weeklyDays: recurringFrequency === 'weekly' ? recurringWeeklyDays : undefined,
          monthlyDays: (recurringFrequency === 'monthly' || recurringFrequency === 'monthly_day') ? recurringMonthlyDays : undefined,
          nthOccurrence: recurringFrequency === 'monthly_nth_weekday' ? recurringNthOccurrence : undefined,
          nthWeekday: recurringFrequency === 'monthly_nth_weekday' ? recurringNthWeekday : undefined,
          startDate: recurringStartDate || dueDateISO || getNowISO(),
          endDate: recurringEndDate || undefined,
        }
      : undefined;

    const projectCharter: ProjectCharter | undefined = finalIsProject
      ? {
          description: projectCharterDesc.trim(),
          projectManager: projectCharterManager.trim(),
          startDate: projectCharterStartDate || dueDateISO || getNowISO(),
          endDate: projectCharterEndDate || dueDateISO || getNowISO(),
        }
      : undefined;

    let finalSubTasks = finalIsProject ? projectSubTasks : (taskToEdit?.projectSubTasks || []);
    if (finalIsRecurring && recurringConfig) {
      finalSubTasks = generateRecurringOccurrences(recurringConfig, finalSubTasks);
    }

    // A recurring task's date is its schedule's first occurrence (start date at the start time),
    // not the hidden due-date field.
    const recurrenceStartDay = isoToIranDateTimeParts(recurringStartDate || dueDateISO || getNowISO())?.date;
    const finalDueDate = finalIsRecurring
      ? iranDateTimeToISO(recurrenceStartDay, recurringStartTime) || recurringStartDate || dueDateISO || getNowISO()
      : dueDateISO || getNowISO();

    const finalStatus = (finalIsProject || finalIsRecurring || (finalSubTasks && finalSubTasks.length > 0))
      ? computeAutoTaskStatus(finalSubTasks)
      : status;

    onSave(
      {
        title: title.trim(),
        description: description.trim(),
        dueDate: finalDueDate,
        priority,
        status: finalStatus,
        attachments,
        tags,
        user: taskToEdit?.user || (currentUser ? currentUser.id : undefined),
        ownerName: taskToEdit?.ownerName || (currentUser ? currentUser.name || currentUser.username : undefined),
        ownerAvatar: taskToEdit?.ownerAvatar || (currentUser ? currentUser.avatar : undefined),
        assignedUserId: responsibleIds[0] || undefined,
        responsibleUserIds: responsibleIds,
        responsibleUserNames: responsibleNames,
        assignedUserName: assignedName,
        assignedUserAvatar: assignedAvatar,
        assignedTeamId: selectedTeam ? selectedTeam.id : undefined,
        assignedTeamName: selectedTeam ? selectedTeam.name : undefined,
        teamMemberIds: finalTeamMemberIds,
        allowAssigneeStatusUpdate: responsibleIds.length > 0 ? allowAssigneeStatusUpdate : true,
        isProject: finalIsProject,
        isRecurring: finalIsRecurring,
        recurringConfig,
        projectCharter,
        projectSubTasks: finalSubTasks,
        comments: taskToEdit?.comments || [],
      },
      taskToEdit ? taskToEdit.id : undefined
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 my-auto text-slate-800 dark:text-slate-100 max-h-[90vh] flex flex-col">
        
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
                <Paperclip className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  {taskToEdit ? 'ویرایش فعالیت' : 'ثبت فعالیت جدید'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                  مشخصات فعالیت، موعد انجام، اولویت و فایل‌های ضمیمه را وارد کنید
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 rounded-xl transition-colors cursor-pointer"
              title="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <div className="p-5 space-y-4 overflow-y-auto grow">

          {/* Notice Banner for Assignees who can only update status */}
          {isStatusOnlyEdit && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>شما به‌عنوان مسئول این فعالیت، مجاز به تغییر وضعیت فعالیت می‌باشید. سایر فیلدها قفل شده‌اند.</span>
            </div>
          )}

          {/* Title Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
              عنوان فعالیت <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={title}
                disabled={isStatusOnlyEdit}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (e.target.value.trim()) setErrors({});
                }}
                placeholder="مثال: طراحی صفحات داشبورد جدید"
                className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 text-xs font-medium border rounded-xl focus:outline-hidden focus:ring-2 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 ${
                  isStatusOnlyEdit ? 'opacity-60 cursor-not-allowed' : 'focus:bg-white dark:focus:bg-slate-800'
                } ${
                  errors.title
                    ? 'border-rose-400 focus:ring-rose-400'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-indigo-500 focus:border-indigo-500'
                }`}
              />
            </div>
            {errors.title && (
              <p className="mt-1 text-xs text-rose-500 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.title}
              </p>
            )}
          </div>

          {/* Description Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
              شرح توضیحات
            </label>
            <textarea
              rows={3}
              value={description}
              disabled={isStatusOnlyEdit}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="جزئیات و نکات مربوط به این فعالیت..."
              className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none ${
                isStatusOnlyEdit ? 'opacity-60 cursor-not-allowed' : 'focus:bg-white dark:focus:bg-slate-800'
              }`}
            />
          </div>

          {/* Jalali Date Time Picker & Status Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Jalali Date & Time Picker (not for a recurring task: its schedule sets the dates) */}
            {!hideDueDate && (
              <div>
                <JalaliDateTimePicker
                  valueISO={dueDateISO}
                  onChangeISO={(iso) => setDueDateISO(iso)}
                  label="موعد انجام (تاریخ و ساعت شمسی)"
                  disabled={isStatusOnlyEdit}
                />
              </div>
            )}

            {/* Status Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                وضعیت فعالیت
              </label>
              <select
                value={status}
                disabled={isStatusOnlyEdit ? false : isAutoStatusTask}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all ${
                  isAutoStatusTask && !isStatusOnlyEdit
                    ? 'opacity-70 bg-slate-100 dark:bg-slate-800/50 cursor-not-allowed'
                    : 'focus:bg-white dark:focus:bg-slate-800 cursor-pointer'
                }`}
              >
                {(Object.keys(STATUSES) as TaskStatus[]).map((st) => (
                  <option key={st} value={st} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                    {STATUSES[st].title}
                  </option>
                ))}
              </select>
              {isAutoStatusTask && (
                <p className="mt-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                  <span>* وضعیت پروژه‌ها و فعالیت‌های تکرارشونده بر اساس زیرمجموعه‌ها به‌طور خودکار محاسبه می‌شود.</span>
                </p>
              )}
            </div>

          </div>

          {/* Work Team & Individual Member Selection */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-500" />
                  <span>اعضای تیم کاری</span>
                </span>
                {selectedMemberIds.length > 0 && selectedTeamId && (
                  <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    {toPersianDigits(selectedMemberIds.length)} کاربر عضو تیم
                  </span>
                )}
              </label>
              <select
                value={selectedTeamId}
                disabled={isStatusOnlyEdit}
                onChange={(e) => {
                  const teamId = e.target.value;
                  setSelectedTeamId(teamId);
                  // A chosen team's members get access by default (as when the team itself gave it);
                  // each can be taken off below. No team: the task stays with its people.
                  const team = availableTeams.find((t) => t.id === teamId);
                  setSelectedMemberIds(team ? team.members.map((m) => m.userId) : currentUser ? [currentUser.id] : []);
                }}
                className={`w-full px-3.5 py-2 bg-white dark:bg-slate-900 text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all ${
                  isStatusOnlyEdit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <option value="" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                  بدون اختصاص به تیم (شخصی / دسترسی به همه کاربران)
                </option>
                {availableTeams.map((team) => (
                  <option key={team.id} value={team.id} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                    تیم: {team.name} ({toPersianDigits(team.members.length)} عضو)
                  </option>
                ))}
              </select>
            </div>

            {/* Responsible people: one or more, from inside or outside the team */}
            <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-700/80 space-y-2" ref={assigneeDropdownRef}>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-indigo-500" />
                  <span>مسئولان اجرای فعالیت</span>
                  {!taskToEdit && <span className="text-rose-500">*</span>}
                </label>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {responsibleIds.length > 0
                    ? `${toPersianDigits(responsibleIds.length)} نفر انتخاب شده`
                    : 'یک یا چند نفر را انتخاب کنید'}
                </span>
              </div>

              {(() => {
                const currentTeamObj = availableTeams.find((t) => t.id === selectedTeamId);
                const teamIds = new Set((currentTeamObj?.members || []).map((m) => m.userId));

                // Every active user of the organization can be responsible - the team's members are
                // listed first, but the team does not limit the choice. Disabled accounts cannot be
                // picked (the server refuses them); one already responsible on an edited task stays.
                const byId = new Map<string, PersonOption>();
                for (const u of allRegisteredUsers) {
                  if (u.disabled && !responsibleIds.includes(u.id)) continue;
                  byId.set(u.id, { id: u.id, name: u.name || u.username, username: u.username, avatar: u.avatar, email: u.email || '' });
                }
                // The signed-in user can always take the task themselves, even without the user list.
                if (currentUser && !currentUser.disabled && !byId.has(currentUser.id)) {
                  byId.set(currentUser.id, { id: currentUser.id, name: currentUser.name || currentUser.username, username: currentUser.username, avatar: currentUser.avatar, email: currentUser.email || '' });
                }
                for (const m of currentTeamObj?.members || []) {
                  if (!byId.has(m.userId) && !allRegisteredUsers.some((u) => u.id === m.userId && u.disabled)) {
                    byId.set(m.userId, { id: m.userId, name: m.name, username: m.username || m.name, avatar: m.avatar, email: '' });
                  }
                }
                // Names for people already responsible whom the list does not hold.
                (taskToEdit?.responsibleUserIds || []).forEach((id, i) => {
                  if (!byId.has(id) && responsibleIds.includes(id)) {
                    byId.set(id, { id, name: taskToEdit?.responsibleUserNames?.[i] || 'کاربر', username: '', email: '' });
                  }
                });

                const candidates = Array.from(byId.values()).sort((a, b) => {
                  const rank = (p: PersonOption) => (p.id === currentUser?.id ? 0 : teamIds.has(p.id) ? 1 : 2);
                  return rank(a) - rank(b) || a.name.localeCompare(b.name, 'fa');
                });
                const selected = responsibleIds.map((id) => byId.get(id)).filter((p): p is PersonOption => !!p);

                const query = userSearchQuery.trim().toLowerCase();
                const filtered = candidates.filter((u) =>
                  !query ||
                  u.name.toLowerCase().includes(query) ||
                  (u.username || '').toLowerCase().includes(query) ||
                  (u.email || '').toLowerCase().includes(query)
                );

                const toggle = (id: string) => {
                  setResponsibleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
                  setErrors((prev) => ({ ...prev, assignee: undefined }));
                };

                return (
                  <div className="space-y-2">
                    {/* Chosen people */}
                    {selected.length > 0 && (
                      <div className="flex flex-wrap gap-1.5" data-responsible-list>
                        {selected.map((person) => (
                          <span
                            key={person.id}
                            data-responsible={person.id}
                            className="inline-flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-indigo-900 dark:text-indigo-100"
                          >
                            <span className="w-5 h-5 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                              {person.name.charAt(0).toUpperCase()}
                            </span>
                            <span>{person.id === currentUser?.id ? `${person.name} (من)` : person.name}</span>
                            {teamIds.has(person.id) && <span className="text-[9px] text-indigo-500 dark:text-indigo-300">عضو تیم</span>}
                            {!isStatusOnlyEdit && (
                              <button
                                type="button"
                                aria-label={`حذف ${person.name} از مسئولان`}
                                onClick={() => toggle(person.id)}
                                className="p-0.5 rounded-md text-indigo-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Search and add */}
                    {!isStatusOnlyEdit && (
                      <div className="relative">
                        <div className="relative flex items-center">
                          <Search className="w-4 h-4 absolute right-3 text-slate-400 pointer-events-none" />
                          <input
                            type="text"
                            placeholder={selected.length > 0 ? 'افزودن مسئول دیگر (جستجوی نام)...' : `جستجو در میان افراد (${toPersianDigits(candidates.length)} نفر)...`}
                            value={userSearchQuery}
                            onFocus={() => setIsAssigneeDropdownOpen(true)}
                            onChange={(e) => {
                              setUserSearchQuery(e.target.value);
                              setIsAssigneeDropdownOpen(true);
                            }}
                            className="w-full pl-9 pr-9 py-2 bg-white dark:bg-slate-900 text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
                          />
                          <button
                            type="button"
                            aria-label="نمایش فهرست افراد"
                            onClick={() => setIsAssigneeDropdownOpen((prev) => !prev)}
                            className="absolute left-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isAssigneeDropdownOpen ? 'rotate-180' : ''}`} />
                          </button>
                        </div>

                        {isAssigneeDropdownOpen && (
                          <div className="absolute z-50 top-full mt-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150" data-responsible-options>
                            <div className="px-2 py-1 text-[10px] text-slate-400 flex items-center justify-between">
                              <span>{currentTeamObj ? 'اعضای تیم و سایر افراد:' : 'افراد سازمان:'}</span>
                              <span>{toPersianDigits(filtered.length)} نفر</span>
                            </div>
                            {filtered.length === 0 ? (
                              <div className="py-4 text-center text-xs text-slate-400">کاربری با این مشخصات یافت نشد.</div>
                            ) : (
                              filtered.map((user) => {
                                const isSelected = responsibleIds.includes(user.id);
                                return (
                                  <button
                                    key={user.id}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    data-option={user.id}
                                    onClick={() => toggle(user.id)}
                                    className={`w-full flex items-center justify-between p-2 rounded-lg text-xs text-right transition-colors cursor-pointer ${
                                      isSelected
                                        ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-100 border border-indigo-200 dark:border-indigo-800'
                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {user.avatar ? (
                                        <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0" />
                                      ) : (
                                        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                                          {user.name.charAt(0).toUpperCase()}
                                        </div>
                                      )}
                                      <div className="truncate">
                                        <p className="font-bold text-xs truncate text-slate-800 dark:text-slate-100">
                                          {user.id === currentUser?.id ? `${user.name} (من)` : user.name}
                                        </p>
                                        {user.username && <p className="text-[10px] text-slate-400 truncate">@{user.username}</p>}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                        {teamIds.has(user.id) ? 'عضو تیم' : currentTeamObj ? 'خارج از تیم' : 'کاربر'}
                                      </span>
                                      <span className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600'}`}>
                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {errors.assignee && (
                      <p className="text-xs text-red-500 font-medium">{errors.assignee}</p>
                    )}

                    {/* Checkbox for status update permission when someone is responsible */}
                    {responsibleIds.length > 0 && (
                      <div className="mt-2.5 flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 transition-all animate-in fade-in">
                        <input
                          type="checkbox"
                          id="allowAssigneeStatusUpdate"
                          checked={allowAssigneeStatusUpdate}
                          disabled={isStatusOnlyEdit}
                          onChange={(e) => setAllowAssigneeStatusUpdate(e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded-md border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                        <label
                          htmlFor="allowAssigneeStatusUpdate"
                          className="text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer select-none flex items-center gap-1.5"
                        >
                          <span>امکان بروزرسانی</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                            (اجازه بروزرسانی و تغییر وضعیت فعالیت توسط مسئولان)
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* The team's members who may see the task (its access list). Responsible people always may. */}
            {selectedTeamId && (() => {
              const currentTeamObj = availableTeams.find((t) => t.id === selectedTeamId);
              if (!currentTeamObj || currentTeamObj.members.length === 0) return null;

              const uniqueMembersMap = new Map<string, WorkTeamMember>();
              currentTeamObj.members.forEach((m) => uniqueMembersMap.set(m.userId, m));
              const uniqueMembers: WorkTeamMember[] = Array.from(uniqueMembersMap.values());

              return (
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 space-y-2" data-access-list>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      اعضای تیم با دسترسی به این فعالیت:
                    </span>
                    {!isStatusOnlyEdit && (
                      <div className="flex items-center gap-2 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setSelectedMemberIds(uniqueMembers.map((m) => m.userId))}
                          className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer font-semibold"
                        >
                          همه ({toPersianDigits(uniqueMembers.length)})
                        </button>
                        <span className="text-slate-300 dark:text-slate-600">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedMemberIds([])}
                          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:underline cursor-pointer"
                        >
                          فقط مسئولان
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    فقط اعضای انتخاب‌شده (و مسئولان اجرا) این فعالیت را می‌بینند.
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {uniqueMembers.map((member) => {
                      const isResponsible = responsibleIds.includes(member.userId);
                      const isSelected = isResponsible || selectedMemberIds.includes(member.userId);
                      return (
                        <button
                          key={member.userId}
                          type="button"
                          data-access-member={member.userId}
                          aria-pressed={isSelected}
                          disabled={isStatusOnlyEdit || isResponsible}
                          title={isResponsible ? 'مسئول اجرا همیشه به فعالیت دسترسی دارد' : undefined}
                          onClick={() => {
                            setSelectedMemberIds((prev) =>
                              prev.includes(member.userId) ? prev.filter((id) => id !== member.userId) : [...prev, member.userId]
                            );
                          }}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer disabled:cursor-default ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                              isSelected ? 'bg-white text-indigo-700' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {isSelected ? <Check className="w-3 h-3 text-indigo-600" /> : member.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{member.name}</span>
                          {isResponsible && (
                            <span className="text-[9px] text-indigo-100">(مسئول)</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Priority (درجه اهمیت: کم، متوسط، زیاد) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
              درجه اهمیت (اولویت)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(PRIORITIES) as Priority[]).map((prKey) => {
                const pr = PRIORITIES[prKey];
                const isSelected = priority === prKey;
                return (
                  <button
                    type="button"
                    key={prKey}
                    disabled={isStatusOnlyEdit}
                    onClick={() => setPriority(prKey)}
                    className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      isStatusOnlyEdit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      isSelected
                        ? `${pr.bgColor} ${pr.textColor} ${pr.borderColor} ring-2 ring-indigo-500 shadow-xs`
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>{pr.title}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags / Labels Input Section */}
          <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                <span>برچسب‌های کاری (تگ)</span>
              </span>
              {tags.length > 0 && (
                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                  {toPersianDigits(tags.length)} برچسب ثبت شده
                </span>
              )}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1" ref={tagDropdownRef}>
                <input
                  type="text"
                  value={tagInput}
                  disabled={isStatusOnlyEdit}
                  onFocus={() => !isStatusOnlyEdit && setShowTagDropdown(true)}
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    setShowTagDropdown(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                      setShowTagDropdown(false);
                    }
                  }}
                  placeholder={isStatusOnlyEdit ? 'برچسب‌ها قفل شده‌اند' : 'کلیک کنید تا برچسب‌های قبلی انتخاب شود یا نام برچسب جدید را تایپ کنید...'}
                  className={`w-full px-3 py-2 bg-white dark:bg-slate-900 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 ${
                    isStatusOnlyEdit ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                />

                {/* Dropdown Menu for Previous Tags */}
                {showTagDropdown && filteredPreviousTags.length > 0 && (
                  <div className="absolute right-0 left-0 top-full mt-1 z-30 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 text-xs animate-in fade-in zoom-in-95">
                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700/60 mb-1 flex items-center justify-between">
                      <span>برچسب‌های قبلی استفاده شده ({toPersianDigits(filteredPreviousTags.length)}):</span>
                      <Tag className="w-3 h-3 text-indigo-500" />
                    </div>
                    {filteredPreviousTags.map((pTag, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          if (!tags.includes(pTag)) {
                            setTags((prev) => [...prev, pTag]);
                          }
                          setTagInput('');
                          setShowTagDropdown(false);
                        }}
                        className="w-full flex items-center justify-between px-3 py-1.5 text-right text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/80 hover:text-indigo-700 dark:hover:text-indigo-300 font-bold transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5">
                          <Tag className="w-3 h-3 text-indigo-500" />
                          <span>#{pTag}</span>
                        </span>
                        <Plus className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-600" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  handleAddTag();
                  setShowTagDropdown(false);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                افزودن
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((t, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="text-indigo-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer p-0.5 rounded-md"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Special Options: Project and Recurring Checkboxes */}
          <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              ویژگی‌های تکمیلی فعالیت
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Checkbox: Project */}
              <label className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 transition-colors cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={isProject}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsProject(checked);
                    if (checked) setIsRecurring(false);
                  }}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
                <span>پروژه است</span>
              </label>

              {/* Checkbox: Recurring */}
              <label className="flex items-center gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-purple-300 transition-colors cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsRecurring(checked);
                    if (checked) setIsProject(false);
                  }}
                  className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                />
                <span>فعالیت تکرارشونده است</span>
              </label>
            </div>

            {/* Project Options Inline Panel */}
            {isProject && (
              <div className="mt-3 p-3.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800/70 space-y-4 animate-in fade-in zoom-in-98">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200 border-b border-emerald-200/60 dark:border-emerald-800/60 pb-2">
                  <FolderKanban className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>تنظیمات و جزئیات منشور و زیرفعالیت‌های پروژه</span>
                </div>

                {/* 1) Project Charter Fields */}
                <div className="space-y-3">
                  <h5 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>منشور پروژه:</span>
                  </h5>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      نام مدیر / مسئول پروژه:
                    </label>
                    <input
                      type="text"
                      value={projectCharterManager}
                      onChange={(e) => setProjectCharterManager(e.target.value)}
                      placeholder="نام مدیر پروژه..."
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      اهداف و شرح منشور پروژه:
                    </label>
                    <textarea
                      rows={2}
                      value={projectCharterDesc}
                      onChange={(e) => setProjectCharterDesc(e.target.value)}
                      placeholder="توضیحات، خروجی‌ها و اهداف کلیدی پروژه..."
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-100 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        تاریخ شروع پروژه:
                      </label>
                      <JalaliDateTimePicker
                        valueISO={projectCharterStartDate}
                        onChangeISO={(iso) => setProjectCharterStartDate(iso)}
                        label=""
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                        تاریخ پایان پروژه:
                      </label>
                      <JalaliDateTimePicker
                        valueISO={projectCharterEndDate}
                        onChangeISO={(iso) => setProjectCharterEndDate(iso)}
                        label=""
                      />
                    </div>
                  </div>
                </div>

                {/* 2) Subtasks / Milestones */}
                <div className="pt-3 border-t border-emerald-200/60 dark:border-emerald-800/60 space-y-2.5">
                  <h5 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>زیرفعالیت‌ها / مایلستون‌های پروژه ({toPersianDigits(projectSubTasks.length)} مورد):</span>
                  </h5>

                  {/* Add Subtask Form Inline */}
                  <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <input
                      type="text"
                      value={newSubTaskTitle}
                      onChange={(e) => setNewSubTaskTitle(e.target.value)}
                      placeholder="عنوان زیرفعالیت جدید..."
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                    />

                    <div className="flex items-center gap-2">
                      <select
                        value={newSubTaskImportance}
                        onChange={(e) => setNewSubTaskImportance(e.target.value as SubTaskImportance)}
                        className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 cursor-pointer"
                      >
                        <option value="low">اهمیت: کم (وزن ۱)</option>
                        <option value="medium">اهمیت: متوسط (وزن ۲)</option>
                        <option value="high">اهمیت: زیاد (وزن ۳)</option>
                      </select>

                      <button
                        type="button"
                        onClick={handleAddProjectSubTask}
                        className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>افزودن زیرفعالیت</span>
                      </button>
                    </div>
                  </div>

                  {/* Subtasks List */}
                  {projectSubTasks.length > 0 && (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {projectSubTasks.map((st) => (
                        <div
                          key={st.id}
                          className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                            <input
                              type="checkbox"
                              checked={!!st.completed}
                              onChange={() => handleToggleModalSubTask(st.id)}
                              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
                            />
                            <span className={`font-semibold truncate ${st.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}`}>
                              {st.title}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              st.importance === 'high' ? 'bg-rose-100 text-rose-800' : st.importance === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {st.importance === 'high' ? 'وزن ۳' : st.importance === 'medium' ? 'وزن ۲' : 'وزن ۱'}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveProjectSubTask(st.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="حذف زیرفعالیت"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recurring Options Panel */}
            {isRecurring && (
              <div className="mt-3 p-3.5 bg-purple-50/70 dark:bg-purple-950/40 rounded-2xl border border-purple-200 dark:border-purple-800/70 space-y-3 animate-in fade-in zoom-in-98">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-900 dark:text-purple-200">
                  <Repeat className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>تنظیمات دوره تکرار فعالیت</span>
                </div>

                {/* Frequency selection tabs */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    نوع و الگوی تکرار:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setRecurringFrequency('daily')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        recurringFrequency === 'daily'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>روزانه</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRecurringFrequency('weekly')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        recurringFrequency === 'weekly'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>هفتگی</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRecurringFrequency('monthly_day')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        recurringFrequency === 'monthly_day' || recurringFrequency === 'monthly'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                      }`}
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      <span>روز ماه</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRecurringFrequency('monthly_nth_weekday')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                        recurringFrequency === 'monthly_nth_weekday'
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                      }`}
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      <span>پیشرفته ماه</span>
                    </button>
                  </div>
                </div>

                {/* Sub-options for Weekly */}
                {recurringFrequency === 'weekly' && (
                  <div className="pt-2 border-t border-purple-200/60 dark:border-purple-900/60 space-y-3">
                    {/* Interval selector */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        فاصله زمانی هفته‌ها:
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { val: 1, label: 'هر هفته' },
                          { val: 2, label: '۲ هفته یکبار' },
                          { val: 3, label: '۳ هفته یکبار' },
                          { val: 4, label: '۴ هفته یکبار' },
                        ].map((item) => (
                          <button
                            key={item.val}
                            type="button"
                            onClick={() => setRecurringIntervalWeeks(item.val)}
                            className={`py-1.5 px-2 text-center rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                              recurringIntervalWeeks === item.val
                                ? 'bg-purple-600 text-white border-purple-600'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Weekdays */}
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>روزهای هفته (از شنبه تا جمعه):</span>
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { id: 0, name: 'شنبه' },
                          { id: 1, name: 'یکشنبه' },
                          { id: 2, name: 'دوشنبه' },
                          { id: 3, name: 'سه‌شنبه' },
                          { id: 4, name: 'چهارشنبه' },
                          { id: 5, name: 'پنج‌شنبه' },
                          { id: 6, name: 'جمعه' },
                        ].map((day) => {
                          const isSelected = recurringWeeklyDays.includes(day.id);
                          return (
                            <button
                              key={day.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  if (recurringWeeklyDays.length > 1) {
                                    setRecurringWeeklyDays(recurringWeeklyDays.filter((d) => d !== day.id));
                                  }
                                } else {
                                  setRecurringWeeklyDays([...recurringWeeklyDays, day.id].sort((a, b) => a - b));
                                }
                              }}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                isSelected
                                  ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                              }`}
                            >
                              {day.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-options for Monthly Day (1..31) */}
                {(recurringFrequency === 'monthly_day' || recurringFrequency === 'monthly') && (
                  <div className="pt-2 border-t border-purple-200/60 dark:border-purple-900/60 space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Repeat className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      <span>روزهای ماه (انتخاب از ۱ تا ۳۱):</span>
                    </label>
                    <div className="grid grid-cols-7 sm:grid-cols-10 gap-1">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((dayNum) => {
                        const isSelected = recurringMonthlyDays.includes(dayNum);
                        return (
                          <button
                            key={dayNum}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                if (recurringMonthlyDays.length > 1) {
                                  setRecurringMonthlyDays(recurringMonthlyDays.filter((d) => d !== dayNum));
                                }
                              } else {
                                setRecurringMonthlyDays([...recurringMonthlyDays, dayNum].sort((a, b) => a - b));
                              }
                            }}
                            className={`py-1 text-center rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300'
                            }`}
                          >
                            {toPersianDigits(dayNum)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sub-options for Monthly Nth Weekday (e.g. اولین/آخرین دوشنبه هر ماه) */}
                {recurringFrequency === 'monthly_nth_weekday' && (
                  <div className="pt-2 border-t border-purple-200/60 dark:border-purple-900/60 space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        مرتبه وقوع در ماه:
                      </label>
                      <div className="grid grid-cols-5 gap-1">
                        {[
                          { key: 'first', label: 'اولین' },
                          { key: 'second', label: 'دومین' },
                          { key: 'third', label: 'سومین' },
                          { key: 'fourth', label: 'چهارمین' },
                          { key: 'last', label: 'آخرین' },
                        ].map((nth) => (
                          <button
                            key={nth.key}
                            type="button"
                            onClick={() => setRecurringNthOccurrence(nth.key as OccurrenceNth)}
                            className={`py-1.5 text-center rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                              recurringNthOccurrence === nth.key
                                ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {nth.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        روز هفته:
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { id: 0, name: 'شنبه' },
                          { id: 1, name: 'یکشنبه' },
                          { id: 2, name: 'دوشنبه' },
                          { id: 3, name: 'سه‌شنبه' },
                          { id: 4, name: 'چهارشنبه' },
                          { id: 5, name: 'پنج‌شنبه' },
                          { id: 6, name: 'جمعه' },
                        ].map((day) => (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => setRecurringNthWeekday(day.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                              recurringNthWeekday === day.id
                                ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {day.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-2.5 bg-purple-100/70 dark:bg-purple-900/40 rounded-xl text-xs text-purple-900 dark:text-purple-200 font-medium border border-purple-200 dark:border-purple-800">
                      💡 الگوی انتخابی: <span className="font-bold">
                        {recurringNthOccurrence === 'first' ? 'اولین' : recurringNthOccurrence === 'second' ? 'دومین' : recurringNthOccurrence === 'third' ? 'سومین' : recurringNthOccurrence === 'fourth' ? 'چهارمین' : 'آخرین'}{' '}
                        {['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'][recurringNthWeekday]} هر ماه شمسی
                      </span>
                    </div>
                  </div>
                )}

                {/* 3) Start & End Time Fields (ساعت شروع و ساعت پایان) */}
                <div className="pt-2 border-t border-purple-200/60 dark:border-purple-900/60 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                      <Clock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      <span>ساعت شروع برگزاری:</span>
                    </label>
                    <input
                      type="time"
                      value={recurringStartTime}
                      onChange={(e) => setRecurringStartTime(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                      <Clock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                      <span>ساعت پایان برگزاری:</span>
                    </label>
                    <input
                      type="time"
                      value={recurringEndTime}
                      onChange={(e) => setRecurringEndTime(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-purple-500 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Start & End Interval */}
                <div className="pt-2.5 border-t border-purple-200/60 dark:border-purple-900/60 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      تاریخ شروع بازه تکرار:
                    </label>
                    <JalaliDateTimePicker
                      valueISO={recurringStartDate}
                      onChangeISO={(iso) => setRecurringStartDate(iso)}
                      label=""
                      popoverPosition="top"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      تاریخ پایان بازه تکرار (اختیاری):
                    </label>
                    <JalaliDateTimePicker
                      valueISO={recurringEndDate}
                      onChangeISO={(iso) => setRecurringEndDate(iso)}
                      label=""
                      popoverPosition="top"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* File Attachments Area (امکان اضافه کردن فایل ضمیمه) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>فایل‌های ضمیمه</span>
                {attachments.length > 0 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold">
                    {toPersianDigits(attachments.length)} فایل
                  </span>
                )}
              </label>
              
              {!isStatusOnlyEdit && canUploadFiles && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن فایل</span>
                </button>
              )}
            </div>

            {/* Hidden Input File */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFileUpload(e.target.files)}
              multiple
              className="hidden"
            />

            {/* Drag & Drop Dropzone */}
            {!isStatusOnlyEdit && canUploadFiles && (
              <div
                onClick={() => fileInputRef.current?.click()}
                // Without these the browser handles a dropped file itself: it opens the file in
                // the tab and the form is lost.
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'copy';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!isUploading) handleFileUpload(e.dataTransfer.files);
                }}
                className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-400 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/30 rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1"
              >
                <UploadCloud className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  جهت آپلود فایل ضمیمه، اینجا کلیک کنید یا فایل را بکشید و رها کنید
                </p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  پشتیبانی از تصاویر (PNG, JPG, SVG)، اسناد (PDF, DOCX) و سایر فایل‌ها
                </p>
              </div>
            )}

            {/* Attachments List */}
            {attachments.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachments.map((att) => {
                  const isImage = att.type.startsWith('image/') || att.dataUrl.startsWith('data:image/');
                  return (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        {isImage ? (
                          <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-700">
                            <img
                              src={att.dataUrl}
                              alt={att.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800">
                            <FileText className="w-4 h-4" />
                          </div>
                        )}
                        <div className="overflow-hidden">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={att.name}>
                            {att.name}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">
                            {formatFileSize(att.size)}
                          </p>
                        </div>
                      </div>

                      {!isStatusOnlyEdit && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(att.id)}
                          className="p-1.5 text-slate-400 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-lg transition-colors shrink-0 cursor-pointer"
                          title="حذف ضمیمه"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>

          {/* Form Actions Footer */}
          <div className="p-4 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className={`px-5 py-2.5 rounded-xl ${palette.accentBg} ${palette.accentHover} text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50`}
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{taskToEdit ? 'ذخیره تغییرات' : 'ثبت فعالیت جدید'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
