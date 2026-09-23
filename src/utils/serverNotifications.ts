// The bell shows two kinds of items: ones the UI derives from the visible tasks (comments and
// task history, read state kept in this browser) and notifications stored by the server
// (GET /api/notifications - e.g. the reminder when a recurring task falls due, read state kept
// on the server). This merges them into one list without duplicates.
import type { AppNotification, Task } from '../types';

export interface ServerNotificationDto {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

/** Ids of server notifications carry this prefix, so they never collide with derived ones. */
export const SERVER_NOTIFICATION_PREFIX = 'ntf_';

const REMINDER_TITLE_PREFIX = 'یادآوری وظیفه: ';

export function isServerNotificationId(id: string): boolean {
  return id.startsWith(SERVER_NOTIFICATION_PREFIX);
}

export function serverNotificationKey(id: string): string {
  return id.slice(SERVER_NOTIFICATION_PREFIX.length);
}

/** The server stores UTC without an offset marker; read it as UTC, not as local time. */
function asUtc(value: string): string {
  return /[zZ]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
}

/**
 * One server notification as a bell item. A task reminder names its task in the title; when
 * exactly one task the user can see has that title it is linked, so "view task" opens it.
 */
export function toAppNotification(dto: ServerNotificationDto, visibleTasks: Task[]): AppNotification {
  const isReminder = dto.title.startsWith(REMINDER_TITLE_PREFIX);
  const taskTitle = isReminder ? dto.title.slice(REMINDER_TITLE_PREFIX.length).trim() : dto.title;
  const matches = isReminder ? visibleTasks.filter((t) => t.title.trim() === taskTitle) : [];
  return {
    id: SERVER_NOTIFICATION_PREFIX + dto.id,
    type: 'reminder',
    taskId: matches.length === 1 ? matches[0].id : '',
    taskTitle,
    actorName: 'سامانه',
    actionTitle: isReminder ? 'یادآوری موعد وظیفه' : dto.title,
    details: dto.message,
    createdAt: asUtc(dto.createdAt),
    isRead: dto.isRead,
  };
}

/** Both lists, newest first, each id once. */
export function mergeNotifications(derived: AppNotification[], server: AppNotification[]): AppNotification[] {
  const byId = new Map<string, AppNotification>();
  for (const item of [...derived, ...server]) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return Array.from(byId.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
