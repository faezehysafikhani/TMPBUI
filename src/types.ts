/**
 * Maximum size of any uploaded attachment: 200 KB.
 *
 * Mirrors the backend limit (Nexus.TaskManagement's TaskFileAsset.MaxFileSizeBytes and the
 * CK_Files_MaxSize check constraint). The API rejects anything larger, so accepting a bigger
 * file here would only fail later — and the attachment travels as a base64 data URL, which
 * inflates it by roughly a third on the way.
 */
export const MAX_ATTACHMENT_BYTES = 204800;

/** How that limit is written in user-facing messages. */
export const MAX_ATTACHMENT_LABEL = '۲۰۰ کیلوبایت';

export type TaskStatus = 'todo' | 'in_progress' | 'paused' | 'completed';

export type Priority = 'low' | 'medium' | 'high';

export type AppTheme = 'default' | 'checkerboard' | 'diagonal' | 'grid' | 'dots' | 'cross' | 'waves';

export type AppColorPalette = 'indigo' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'slate';

export interface WorkTeamMember {
  userId: string;
  name: string;
  username: string;
  avatar?: string;
  role?: string; // e.g. 'مدیر تیم' | 'عضو تیم'
}

export interface WorkTeam {
  id: string;
  name: string;
  ownerId: string;
  members: WorkTeamMember[];
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  name?: string;
  avatar?: string;
  theme?: AppTheme;
  colorPalette?: AppColorPalette;
  themeMode?: 'light' | 'dark';
  role?: 'admin' | 'user' | string;
  /** Permission names granted by the server (GET /auth/me). Undefined until known. */
  permissions?: string[];
  disabled?: boolean;
  teams?: WorkTeam[];
  lastLogin?: string;
  phoneNumber?: string;
  notifySms?: boolean;
}

export interface SmsGatewaySettings {
  enabled: boolean;
  provider: 'kavenegar' | 'farazsms' | 'melipayamak' | 'custom';
  apiKey: string;
  lineNumber: string;
  patternCode?: string;
  apiUrl?: string;
}

export interface SystemNotificationSettings {
  sms: SmsGatewaySettings;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string; // Base64 data URL for preview and download
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  attachments?: Attachment[];
  createdAt: string;
  updatedAt?: string;
}

export interface TaskLog {
  id: string;
  taskId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  action: string;
  details?: string;
  createdAt: string;
}

export type SubTaskImportance = 'low' | 'medium' | 'high';

export interface ProjectSubTask {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  importance: SubTaskImportance; // 'low' (1), 'medium' (2), 'high' (3)
  completed: boolean;
  createdAt: string;
}

export interface ProjectCharter {
  description?: string;
  projectManager?: string;
  startDate?: string;
  endDate?: string;
}

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'monthly_day' | 'monthly_nth_weekday';

export type OccurrenceNth = 'first' | 'second' | 'third' | 'fourth' | 'last';

export interface RecurringConfig {
  frequency: RecurringFrequency; // 'daily' | 'weekly' | 'monthly' | 'monthly_day' | 'monthly_nth_weekday'
  intervalWeeks?: number; // 1 = هر هفته, 2 = ۲ هفته یکبار, 3 = ۳ هفته یکبار, ...
  startTime?: string; // e.g., "09:00"
  endTime?: string; // e.g., "11:00"
  dailyTime?: string; // fallback / legacy e.g., "09:00"
  time?: string; // fallback / legacy
  weeklyDays?: number[]; // 0=شنبه, 1=یکشنبه, 2=دوشنبه, 3=سه‌شنبه, 4=چهارشنبه, 5=پنج‌شنبه, 6=جمعه
  monthlyDays?: number[]; // 1 to 31
  nthOccurrence?: OccurrenceNth; // 'first' | 'second' | 'third' | 'fourth' | 'last'
  nthWeekday?: number; // 0=شنبه, 1=یکشنبه, 2=دوشنبه, 3=سه‌شنبه, 4=چهارشنبه, 5=پنج‌شنبه, 6=جمعه
  startDate?: string; // YYYY-MM-DD or ISO
  endDate?: string; // YYYY-MM-DD or ISO
}

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  actualCompletionDate?: string; // تاریخ واقعی تکمیل فعالیت موقع خاتمه یافتن
  priority: Priority;
  status: TaskStatus;
  attachments: Attachment[];
  user?: string; // id of the owner/creator
  ownerName?: string;
  ownerAvatar?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  assignedUserAvatar?: string;
  assignedTeamId?: string;
  assignedTeamName?: string;
  teamMemberIds?: string[];
  allowAssigneeStatusUpdate?: boolean; // آیا مسئول امکان بروزرسانی وضعیت را دارد یا خیر
  tags?: string[];
  isProject?: boolean;
  isRecurring?: boolean;
  recurringConfig?: RecurringConfig;
  projectCharter?: ProjectCharter;
  projectSubTasks?: ProjectSubTask[];
  comments?: TaskComment[];
  logs?: TaskLog[];
  createdAt: string;
  updatedAt: string;
}

export interface StatusConfig {
  id: TaskStatus;
  title: string;
  shortTitle: string;
  description: string;
  color: string; // TailWind color key e.g. 'slate', 'indigo', 'amber', 'emerald'
  bgLight: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  iconName: string;
}

export interface PriorityConfig {
  id: Priority;
  title: string;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

export const STATUSES: Record<TaskStatus, StatusConfig> = {
  todo: {
    id: 'todo',
    title: 'شروع نشده',
    shortTitle: 'شروع نشده',
    description: 'فعالیت‌های آماده جهت شروع',
    color: 'slate',
    bgLight: 'bg-slate-50/80 border-slate-200',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700 border-slate-300',
    borderColor: 'border-slate-400',
    iconName: 'Circle'
  },
  in_progress: {
    id: 'in_progress',
    title: 'درحال اجرا',
    shortTitle: 'درحال اجرا',
    description: 'فعالیتهای جاری',
    color: 'blue',
    bgLight: 'bg-blue-50/80 border-blue-200',
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-700 border-blue-300',
    borderColor: 'border-blue-500',
    iconName: 'Clock'
  },
  paused: {
    id: 'paused',
    title: 'متوقف',
    shortTitle: 'متوقف',
    description: 'فعالیت‌های منتظر یا معلق شده',
    color: 'amber',
    bgLight: 'bg-amber-50/80 border-amber-200',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800 border-amber-300',
    borderColor: 'border-amber-500',
    iconName: 'PauseCircle'
  },
  completed: {
    id: 'completed',
    title: 'خاتمه یافته',
    shortTitle: 'خاتمه یافته',
    description: 'فعالیت‌های تکمیل شده',
    color: 'emerald',
    bgLight: 'bg-emerald-50/80 border-emerald-200',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800 border-emerald-300',
    borderColor: 'border-emerald-500',
    iconName: 'CheckCircle2'
  }
};

export const PRIORITIES: Record<Priority, PriorityConfig> = {
  low: {
    id: 'low',
    title: 'کم',
    color: 'emerald',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200'
  },
  medium: {
    id: 'medium',
    title: 'متوسط',
    color: 'amber',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-800',
    borderColor: 'border-amber-200'
  },
  high: {
    id: 'high',
    title: 'زیاد',
    color: 'rose',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200'
  }
};

export interface AppNotification {
  id: string;
  type: 'comment' | 'task_log';
  taskId: string;
  taskTitle: string;
  actorName: string;
  actorAvatar?: string;
  actionTitle: string;
  details?: string;
  createdAt: string;
  isRead: boolean;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  receiverId: string;
  text: string;
  attachmentUrl?: string;
  attachmentName?: string;
  isRead: boolean;
  createdAt: string;
}

export interface NoteAttachment {
  id: string;
  name: string;
  size?: number;
  type?: string;
  dataUrl: string;
  createdAt?: string;
}

export interface PersonalNote {
  id: string;
  userId: string;
  title: string;
  content: string;
  color?: string; // 'amber' | 'indigo' | 'emerald' | 'rose' | 'cyan' | 'slate'
  isPinned?: boolean;
  tags?: string[];
  attachments?: NoteAttachment[];
  createdAt: string;
  updatedAt?: string;
}
