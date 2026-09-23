// What the signed-in user may do, from the permissions the server grants them (GET /auth/me:
// roles, direct grants and groups). The UI only hides what would be refused anyway - the server
// checks every request itself, so this is never the security boundary.
import type { User } from '../types';
import type { ActiveTab } from '../components/SandwichBar';
import type { UserAccessEntry } from '../services/nexusApi';

export const PERMISSIONS = {
  tasksView: 'Tasks.View',
  tasksCreate: 'Tasks.Create',
  tasksEdit: 'Tasks.Edit',
  tasksDelete: 'Tasks.Delete',
  tasksComment: 'Tasks.Comment',
  tasksUploadFiles: 'Tasks.UploadFiles',
  tasksManageAll: 'Tasks.ManageAll',
  notesManage: 'Notes.Manage',
} as const;

/**
 * True when the user holds the permission. While the permissions are not known yet (signed out,
 * or before the first /me answer) nothing is hidden: the server still refuses what is not allowed.
 */
export function can(user: User | null | undefined, permission: string): boolean {
  if (!user || !user.permissions) return true;
  return user.permissions.includes(permission);
}

/** Manages every task of the organization (and is treated as the UI's task administrator). */
export function isTaskAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return !!user.permissions?.includes(PERMISSIONS.tasksManageAll);
}

const TAB_PERMISSION: Partial<Record<ActiveTab, string>> = {
  kanban: PERMISSIONS.tasksView,
  calendar: PERMISSIONS.tasksView,
  overdue: PERMISSIONS.tasksView,
  notes: PERMISSIONS.notesManage,
};

/** Whether a section (menu entry and page) is available to the user. Chat and settings always are. */
export function canOpenTab(user: User | null | undefined, tab: ActiveTab): boolean {
  const permission = TAB_PERMISSION[tab];
  return !permission || can(user, permission);
}

/** The first section the user may open, for when the current one is not allowed. */
export function firstAllowedTab(user: User | null | undefined): ActiveTab {
  const order: ActiveTab[] = ['kanban', 'calendar', 'overdue', 'notes', 'chat', 'settings'];
  return order.find((tab) => canOpenTab(user, tab)) || 'settings';
}

/**
 * One permission on the user access page, as the server will apply it after saving: the user
 * has it unless it is denied to them, when it is granted directly, by a role or group, or needed
 * by another permission they have. `direct` and `denied` are the page's current (unsaved) choices.
 */
export function accessIsEffective(entry: UserAccessEntry, direct: ReadonlySet<string>, denied: ReadonlySet<string>): boolean {
  if (denied.has(entry.permissionId)) return false;
  return direct.has(entry.permissionId) || entry.grantedByRole || entry.grantedByGroup || !!entry.grantedAsPrerequisite;
}

/**
 * Turning a permission on or off for this user. Off: the direct grant goes, and if a role, a
 * group or another permission would still give it, it is denied to the user. On: a denial goes,
 * and it is granted directly only when nothing else gives it.
 */
export function toggleUserAccess(
  entry: UserAccessEntry,
  enable: boolean,
  direct: ReadonlySet<string>,
  denied: ReadonlySet<string>,
): { direct: Set<string>; denied: Set<string> } {
  const nextDirect = new Set(direct);
  const nextDenied = new Set(denied);
  const inherited = entry.grantedByRole || entry.grantedByGroup || !!entry.grantedAsPrerequisite;
  if (enable) {
    nextDenied.delete(entry.permissionId);
    if (!inherited) nextDirect.add(entry.permissionId);
  } else {
    nextDirect.delete(entry.permissionId);
    if (inherited) nextDenied.add(entry.permissionId);
  }
  return { direct: nextDirect, denied: nextDenied };
}

/** Persian titles of the permission groups (the server sends module ids such as "TaskManagement"). */
const MODULE_TITLES: Record<string, string> = {
  Identity: 'کاربران، نقش‌ها و گروه‌ها',
  Platform: 'تنظیمات سامانه و سازمان‌ها',
  TaskManagement: 'مدیریت وظایف',
  Ticketing: 'تیکت‌ها',
  Organization: 'ساختار سازمانی',
  Calendar: 'تقویم کاری',
  Workflow: 'گردش‌کار',
  Actions: 'اقدامات',
  Knowledge: 'مدیریت دانش',
  Strategy: 'راهبرد',
  ProjectManagement: 'پروژه‌ها',
  WaterfallPlanning: 'برنامه‌ریزی آبشاری',
  AgilePlanning: 'برنامه‌ریزی چابک',
  ProjectTeam: 'تیم پروژه',
  Deliverables: 'تحویل‌دادنی‌ها',
  Kpi: 'شاخص‌های کلیدی عملکرد',
  RiskManagement: 'مدیریت ریسک',
  StakeholderManagement: 'مدیریت ذی‌نفعان',
  ProgressManagement: 'گزارش پیشرفت',
  ProjectDocuments: 'مستندات پروژه',
  ProjectWorkflow: 'گردش‌کار پروژه',
  ProjectStrategyAlignment: 'هم‌راستایی پروژه و راهبرد',
  Portfolio: 'سبد پروژه‌ها',
  Reporting: 'گزارش‌ها و داشبورد',
};

export function moduleTitle(module: string): string {
  return MODULE_TITLES[module] || module;
}
