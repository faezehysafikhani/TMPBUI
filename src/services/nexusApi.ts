/**
 * REST connection to the NexusCore backend (ASP.NET Core 8, TaskManagement module).
 *
 * Active only when VITE_API_BASE_URL is set. Without it the app keeps running against
 * PocketBase exactly as before, so nothing changes for a deployment that has not been
 * configured for NexusCore yet.
 *
 * The functions in pocketbase.ts delegate here for every operation the backend fully
 * supports; the components keep calling the same functions and receive the same shapes.
 * All translation between the backend DTOs and the UI types happens in this file.
 *
 * Request and response shapes are taken from the backend source:
 *   NexusCore.Application/Identity/Dtos/*.cs
 *   Nexus.TaskManagement/Application/Dtos/TaskManagementDtos.cs
 * Enums travel as strings (JsonStringEnumConverter) and property names are camelCase.
 */
import {
  Task,
  TaskStatus,
  Priority,
  Attachment,
  User,
  WorkTeam,
  TaskComment,
  TaskLog,
  ProjectSubTask,
  SubTaskImportance,
  RecurringConfig,
  RecurringFrequency,
  OccurrenceNth,
  STATUSES,
} from '../types';
import { parseDateSafely } from '../utils/jalali';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const env = ((import.meta as any).env || {}) as Record<string, string | undefined>;

/** Backend origin, e.g. http://localhost:5151. Empty means "stay on PocketBase". */
export const NEXUS_API_BASE_URL = (env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

/** Optional tenant slug sent with login. Leave empty for a single-tenant install. */
const NEXUS_TENANT_SLUG = (env.VITE_NEXUS_TENANT_SLUG || '').trim();

/**
 * NexusCore signs in by email only. When this is set, a username typed without '@' (as the
 * login form allows) is sent as <username>@<domain>, e.g. Admin -> admin@taskmanager.local.
 */
const LOGIN_EMAIL_DOMAIN = (env.VITE_NEXUS_LOGIN_EMAIL_DOMAIN || '').trim().replace(/^@/, '');

const REQUEST_TIMEOUT_MS = Number(env.VITE_API_TIMEOUT_MS) > 0 ? Number(env.VITE_API_TIMEOUT_MS) : 30000;

export const NEXUS_API_ENABLED = NEXUS_API_BASE_URL.length > 0;

/** Name of the seeded system role (NexusCore.Infrastructure/Persistence/DefaultDataSeeder.cs). */
const ADMIN_ROLE_NAME = 'Administrator';

/**
 * The upload endpoint stores the file record but not its bytes (TaskFileService.UploadAsync
 * never writes the content; download then answers 404). Uploading would lose the file
 * silently, so it stays off until the backend persists file content.
 */
const BACKEND_STORES_FILE_CONTENT = false;

/** Parallel requests used when a screen needs one call per task. */
const DETAIL_CONCURRENCY = 6;

// ---------------------------------------------------------------------------
// Backend DTOs (camelCase JSON)
// ---------------------------------------------------------------------------

interface UserDto {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  isActive: boolean;
  lastLoginAtUtc: string | null;
  roles: string[];
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAtUtc: string;
  user: UserDto;
}

interface CurrentUserResponse {
  user: UserDto;
  permissions: string[];
}

interface PagedResult<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}

interface UserSummaryDto { id: string; displayName: string; email: string; }
interface UserGroupSummaryDto { id: string; name: string; }
interface TagDto { id: string; name: string; color: string | null; }

interface TaskFileDto {
  linkId: string;
  fileId: string;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  uploadedByUserId: string | null;
  createdAtUtc: string;
}

interface SubTaskDto {
  id: string;
  taskId: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  importance: 'Low' | 'Medium' | 'High';
  isCompleted: boolean;
  sortOrder: number;
  tags: TagDto[];
  files: TaskFileDto[];
  createdAtUtc: string;
}

interface RepetitiveTaskDto {
  id: string;
  taskId: string;
  frequency: string;
  intervalWeeks: number | null;
  startTime: string | null;
  endTime: string | null;
  weeklyDays: number[];
  monthlyDays: number[];
  nthOccurrence: string | null;
  nthWeekday: number | null;
  startDate: string;
  endDate: string | null;
  nextExecutionAtUtc: string | null;
  lastExecutionAtUtc: string | null;
  isActive: boolean;
}

interface TaskDto {
  id: string;
  title: string;
  description: string | null;
  isProject: boolean;
  isRecurring: boolean;
  status: string;
  priority: string;
  dueDate: string;
  actualCompletionDateUtc: string | null;
  owner: UserSummaryDto | null;
  assignedUser: UserSummaryDto | null;
  assignedUserGroup: UserGroupSummaryDto | null;
  assignees: UserSummaryDto[];
  allowAssigneeStatusUpdate: boolean;
  charterDescription: string | null;
  charterProjectManager: string | null;
  charterStartDate: string | null;
  charterEndDate: string | null;
  subTasks: SubTaskDto[];
  tags: TagDto[];
  files: TaskFileDto[];
  recurrence: RepetitiveTaskDto | null;
  createdAtUtc: string;
  modifiedAtUtc: string | null;
}

interface TaskListItemDto { id: string; }

interface TaskCommentDto {
  id: string;
  taskId: string;
  userId: string;
  userDisplayName: string | null;
  text: string;
  createdAtUtc: string;
  modifiedAtUtc: string | null;
}

interface TaskActivityDto {
  id: string;
  taskId: string;
  userId: string | null;
  userDisplayName: string | null;
  action: string;
  details: string | null;
  occurredAtUtc: string;
}

interface UserGroupMemberDto { userId: string; displayName: string; email: string; }

interface UserGroupDto {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  memberCount: number;
  members: UserGroupMemberDto[];
}

export interface NoteDto {
  id: string;
  userId: string;
  title: string;
  content: string;
  color: string | null;
  isPinned: boolean;
  createdAtUtc: string;
  modifiedAtUtc: string | null;
}

// ---------------------------------------------------------------------------
// Session (access + refresh token)
// ---------------------------------------------------------------------------

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAtUtc: string;
  user: UserDto;
}

const SESSION_KEY = 'nexuscore_auth_session_v1';

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function writeSession(session: StoredSession | null): void {
  try {
    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Storage unavailable (private mode); the session simply will not survive a reload.
  }
}

function saveAuthResponse(auth: AuthResponse): void {
  writeSession({
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    accessTokenExpiresAtUtc: auth.accessTokenExpiresAtUtc,
    user: auth.user,
  });
}

// Refresh tokens rotate on every use (IdentityService.RefreshTokenAsync revokes the old one),
// so concurrent 401s must share a single refresh call rather than racing each other.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const session = readSession();
    if (!session?.refreshToken) return false;
    try {
      const auth = await request<AuthResponse>('POST', '/api/identity/auth/refresh', {
        body: { refreshToken: session.refreshToken },
        auth: false,
        retryOnUnauthorized: false,
      });
      saveAuthResponse(auth);
      return true;
    } catch (err) {
      if (err instanceof NexusApiError && (err.httpStatus === 401 || err.httpStatus === 400)) {
        writeSession(null);
      }
      return false;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

/**
 * Carries the HTTP status as `httpStatus`, not `status`: App.tsx reads `error.status` to
 * show PocketBase-specific hints ("collection tasks not found"), which would be wrong here.
 */
export class NexusApiError extends Error {
  constructor(message: string, public readonly httpStatus: number, public readonly code?: string) {
    super(message);
    this.name = 'NexusApiError';
  }
}

interface RequestOptions {
  body?: unknown;
  form?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
  auth?: boolean;
  retryOnUnauthorized?: boolean;
  responseType?: 'json' | 'blob';
  /** Message used for 401 instead of the generic session-expired text (login form). */
  unauthorizedMessage?: string;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${NEXUS_API_BASE_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/**
 * Turns a backend failure into a Persian message for the existing alert/banner mechanism.
 * The backend answers failures with RFC 7807 ProblemDetails: { title: <error code>,
 * detail: <message>, status } (NexusCore.Application/Common/EndpointResults.cs). Policy
 * failures (403) and authentication failures from the JWT middleware have an empty body.
 */
function toApiError(status: number, body: any, unauthorizedMessage?: string): NexusApiError {
  const detail: string = (body && (body.detail || body.message)) || '';
  const code: string | undefined = body?.title;

  switch (status) {
    case 400:
      return new NexusApiError(`خطا در اطلاعات ورودی: ${detail || 'درخواست نامعتبر است.'}`, status, code);
    case 401:
      return new NexusApiError(
        unauthorizedMessage || 'نشست کاربری شما منقضی شده است. لطفاً دوباره وارد سیستم شوید.',
        status,
        code
      );
    case 403:
      return new NexusApiError('دسترسی غیرمجاز: حساب کاربری شما مجوز لازم برای این عملیات را ندارد.', status, code);
    case 404:
      return new NexusApiError(`مورد درخواستی در سرور یافت نشد.${detail ? ` (${detail})` : ''}`, status, code);
    case 409:
      return new NexusApiError(`تداخل اطلاعات: ${detail || 'این مورد قبلاً ثبت شده است.'}`, status, code);
    default:
      if (status >= 500) {
        return new NexusApiError('خطای داخلی در سرور NexusCore رخ داد. لطفاً بعداً دوباره تلاش کنید.', status, code);
      }
      return new NexusApiError(detail || `خطای ارتباط با سرور (کد ${status})`, status, code);
  }
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { body, form, query, auth = true, retryOnUnauthorized = true, responseType = 'json' } = options;

  const headers: Record<string, string> = { Accept: responseType === 'json' ? 'application/json' : '*/*' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const session = readSession();
    if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      // FormData sets its own multipart boundary header.
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new NexusApiError('زمان انتظار برای پاسخ سرور NexusCore به پایان رسید.', 0);
    }
    throw new NexusApiError('ارتباط با سرور NexusCore برقرار نشد. آدرس سرور و وضعیت شبکه را بررسی کنید.', 0);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 && auth && retryOnUnauthorized) {
    if (await refreshSession()) {
      return request<T>(method, path, { ...options, retryOnUnauthorized: false });
    }
  }

  if (!response.ok) {
    let problem: any = null;
    try {
      const text = await response.text();
      problem = text ? JSON.parse(text) : null;
    } catch {
      problem = null;
    }
    throw toApiError(response.status, problem, options.unauthorizedMessage);
  }

  if (responseType === 'blob') {
    return (await response.blob()) as unknown as T;
  }
  if (response.status === 204) {
    return undefined as unknown as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function mapWithLimit<TIn, TOut>(items: TIn[], limit: number, fn: (item: TIn) => Promise<TOut>): Promise<TOut[]> {
  const results = new Array<TOut>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function getAllPages<T>(path: string, query: RequestOptions['query'] = {}, pageSize = 200): Promise<T[]> {
  const all: T[] = [];
  for (let pageNumber = 1; ; pageNumber++) {
    const page = await request<PagedResult<T>>('GET', path, { query: { ...query, pageNumber, pageSize } });
    all.push(...page.items);
    if (page.items.length === 0 || all.length >= page.totalCount) break;
  }
  return all;
}

// ---------------------------------------------------------------------------
// Value conversions
// ---------------------------------------------------------------------------

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isGuid(value: string | undefined | null): value is string {
  return !!value && GUID_PATTERN.test(value);
}

const STATUS_TO_API: Record<TaskStatus, string> = {
  todo: 'Todo',
  in_progress: 'InProgress',
  paused: 'Paused',
  completed: 'Completed',
};
const STATUS_FROM_API: Record<string, TaskStatus> = {
  Todo: 'todo',
  InProgress: 'in_progress',
  Paused: 'paused',
  Completed: 'completed',
};

const LEVEL_TO_API: Record<Priority | SubTaskImportance, 'Low' | 'Medium' | 'High'> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};
const LEVEL_FROM_API: Record<string, Priority> = { Low: 'low', Medium: 'medium', High: 'high' };

const FREQUENCY_TO_API: Record<RecurringFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  monthly_day: 'MonthlyDay',
  monthly_nth_weekday: 'MonthlyNthWeekday',
};
const FREQUENCY_FROM_API: Record<string, RecurringFrequency> = {
  Daily: 'daily',
  Weekly: 'weekly',
  Monthly: 'monthly',
  MonthlyDay: 'monthly_day',
  MonthlyNthWeekday: 'monthly_nth_weekday',
};

const NTH_TO_API: Record<OccurrenceNth, string> = {
  first: 'First',
  second: 'Second',
  third: 'Third',
  fourth: 'Fourth',
  last: 'Last',
};
const NTH_FROM_API: Record<string, OccurrenceNth> = {
  First: 'first',
  Second: 'second',
  Third: 'third',
  Fourth: 'fourth',
  Last: 'last',
};

/**
 * UI dates are ISO instants of a local calendar day; the backend stores a DateOnly. The
 * local calendar parts are used, not the UTC ones: in Iran (UTC+3:30) local midnight is the
 * previous day in UTC, and taking the UTC date would shift every due date back by one.
 */
function toDateOnly(value: string | undefined | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = parseDateSafely(value) || new Date(value);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Inverse of toDateOnly: local midnight of that calendar day, as the UI stores dates. */
function fromDateOnly(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toISOString();
}

/** "09:00" -> "09:00:00" (System.Text.Json TimeOnly format). */
function toTimeOnly(value: string | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}:${match[3] || '00'}`;
}

/** "09:00:00" -> "09:00". */
function fromTimeOnly(value: string | null): string | undefined {
  return value ? value.substring(0, 5) : undefined;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string, fallbackType: string): Blob {
  const [header, payload = ''] = dataUrl.split(',', 2);
  const isBase64 = /;base64/i.test(header);
  const mime = /^data:([^;,]+)/i.exec(header)?.[1] || fallbackType || 'application/octet-stream';
  if (!isBase64) {
    return new Blob([decodeURIComponent(payload)], { type: mime });
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// ---------------------------------------------------------------------------
// Mapping: backend -> UI
// ---------------------------------------------------------------------------

export function mapUserDto(u: UserDto): User {
  return {
    id: u.id,
    // NexusCore has no username; the email is the login identifier, so it fills that role.
    username: u.email,
    email: u.email,
    name: u.displayName || u.email,
    role: (u.roles || []).includes(ADMIN_ROLE_NAME) ? 'admin' : 'user',
    disabled: !u.isActive,
    lastLogin: u.lastLoginAtUtc || undefined,
  };
}

function mapRecurrence(r: RepetitiveTaskDto): RecurringConfig {
  const startTime = fromTimeOnly(r.startTime);
  return {
    frequency: FREQUENCY_FROM_API[r.frequency] || 'daily',
    intervalWeeks: r.intervalWeeks ?? undefined,
    startTime,
    endTime: fromTimeOnly(r.endTime),
    dailyTime: startTime,
    time: startTime,
    weeklyDays: r.weeklyDays?.length ? r.weeklyDays : undefined,
    monthlyDays: r.monthlyDays?.length ? r.monthlyDays : undefined,
    nthOccurrence: r.nthOccurrence ? NTH_FROM_API[r.nthOccurrence] : undefined,
    nthWeekday: r.nthWeekday ?? undefined,
    startDate: fromDateOnly(r.startDate),
    endDate: fromDateOnly(r.endDate),
  };
}

function mapSubTask(s: SubTaskDto): ProjectSubTask {
  return {
    id: s.id,
    title: s.title,
    startDate: fromDateOnly(s.startDate),
    endDate: fromDateOnly(s.endDate),
    importance: LEVEL_FROM_API[s.importance] || 'medium',
    completed: s.isCompleted,
    createdAt: s.createdAtUtc,
  };
}

async function downloadFileAsDataUrl(fileId: string): Promise<string> {
  const blob = await request<Blob>('GET', `/api/task-management/files/${fileId}/content`, { responseType: 'blob' });
  return blobToDataUrl(blob);
}

/**
 * The UI shows and downloads attachments straight from `dataUrl`, so the bytes are fetched
 * here. The attachment id is the TaskFile link id - the handle the delete endpoint takes.
 */
async function mapFiles(files: TaskFileDto[]): Promise<Attachment[]> {
  return Promise.all(
    files.map(async (f) => ({
      id: f.linkId,
      name: f.fileName,
      size: f.fileSizeBytes,
      type: f.contentType,
      // One unreadable file must not stop the whole board from loading. The entry is kept
      // (with no content) so its link id survives and a later save does not delete it.
      dataUrl: await downloadFileAsDataUrl(f.fileId).catch((err) => {
        console.warn(`Attachment ${f.fileName} could not be downloaded:`, err instanceof Error ? err.message : err);
        return '';
      }),
      createdAt: f.createdAtUtc,
    }))
  );
}

const ACTIVITY_ACTION_TITLES: Record<string, string> = {
  'Task created': 'ثبت و ایجاد فعالیت جدید',
  'Task updated': 'ویرایش مشخصات فعالیت',
  'Task deleted': 'حذف کامل فعالیت',
  'Status changed': 'تغییر وضعیت فعالیت',
  'Priority changed': 'تغییر اولویت فعالیت',
  'Assignee changed': 'تغییر مسئول انجام',
  'Team changed': 'تغییر تیم مسئول',
  'Subtask added': 'افزودن زیرفعالیت',
  'Subtask updated': 'ویرایش زیرفعالیت',
  'Subtask deleted': 'حذف زیرفعالیت',
};

function translateActivityDetails(action: string, details: string | null): string {
  if (!details) return '';
  if (action === 'Status changed') {
    const match = /^(\w+)\s*->\s*(\w+)$/.exec(details.trim());
    if (match) {
      const from = STATUSES[STATUS_FROM_API[match[1]]]?.title || match[1];
      const to = STATUSES[STATUS_FROM_API[match[2]]]?.title || match[2];
      return `تغییر وضعیت از "${from}" به "${to}"`;
    }
  }
  return details;
}

function mapActivity(a: TaskActivityDto): TaskLog {
  return {
    id: a.id,
    taskId: a.taskId,
    userId: a.userId || '',
    userName: a.userDisplayName || 'کاربر',
    action: ACTIVITY_ACTION_TITLES[a.action] || a.action,
    details: translateActivityDetails(a.action, a.details),
    createdAt: a.occurredAtUtc,
  };
}

function mapComment(c: TaskCommentDto): TaskComment {
  return {
    id: c.id,
    taskId: c.taskId,
    userId: c.userId,
    userName: c.userDisplayName || 'کاربر',
    text: c.text,
    createdAt: c.createdAtUtc,
    updatedAt: c.modifiedAtUtc || undefined,
  };
}

async function mapTask(dto: TaskDto, comments?: TaskComment[], logs?: TaskLog[]): Promise<Task> {
  const hasCharter =
    dto.charterDescription || dto.charterProjectManager || dto.charterStartDate || dto.charterEndDate;

  return {
    id: dto.id,
    title: dto.title,
    description: dto.description || '',
    dueDate: fromDateOnly(dto.dueDate) || new Date().toISOString(),
    actualCompletionDate: dto.actualCompletionDateUtc || undefined,
    priority: LEVEL_FROM_API[dto.priority] || 'medium',
    status: STATUS_FROM_API[dto.status] || 'todo',
    attachments: await mapFiles(dto.files || []),
    user: dto.owner?.id,
    ownerName: dto.owner?.displayName,
    assignedUserId: dto.assignedUser?.id,
    assignedUserName: dto.assignedUser?.displayName,
    assignedTeamId: dto.assignedUserGroup?.id,
    assignedTeamName: dto.assignedUserGroup?.name,
    teamMemberIds: (dto.assignees || []).map((a) => a.id),
    allowAssigneeStatusUpdate: dto.allowAssigneeStatusUpdate,
    tags: (dto.tags || []).map((t) => t.name),
    isProject: dto.isProject,
    isRecurring: dto.isRecurring,
    recurringConfig: dto.recurrence ? mapRecurrence(dto.recurrence) : undefined,
    projectCharter: hasCharter
      ? {
          description: dto.charterDescription || undefined,
          projectManager: dto.charterProjectManager || undefined,
          startDate: fromDateOnly(dto.charterStartDate),
          endDate: fromDateOnly(dto.charterEndDate),
        }
      : undefined,
    projectSubTasks: [...(dto.subTasks || [])].sort((a, b) => a.sortOrder - b.sortOrder).map(mapSubTask),
    comments: comments || [],
    logs: logs || [],
    createdAt: dto.createdAtUtc,
    updatedAt: dto.modifiedAtUtc || dto.createdAtUtc,
  };
}

// ---------------------------------------------------------------------------
// Mapping: UI -> backend
// ---------------------------------------------------------------------------

function requireGuid(value: string | undefined, what: string): string | null {
  if (!value) return null;
  if (!isGuid(value)) {
    throw new NexusApiError(
      `شناسه ${what} («${value}») با سرور NexusCore سازگار نیست. لطفاً ${what} را دوباره از فهرست انتخاب کنید.`,
      400
    );
  }
  return value;
}

function toRecurrenceInput(cfg: RecurringConfig, fallbackStart: string | undefined) {
  const start = toDateOnly(cfg.startDate) || toDateOnly(fallbackStart);
  if (!start) {
    throw new NexusApiError('تاریخ شروع تکرار مشخص نشده است.', 400);
  }
  return {
    frequency: FREQUENCY_TO_API[cfg.frequency] || 'Daily',
    startDate: start,
    intervalWeeks: cfg.frequency === 'weekly' ? cfg.intervalWeeks ?? null : null,
    startTime: toTimeOnly(cfg.startTime || cfg.dailyTime || cfg.time),
    endTime: toTimeOnly(cfg.endTime),
    weeklyDays: cfg.weeklyDays ?? null,
    monthlyDays: cfg.monthlyDays ?? null,
    nthOccurrence: cfg.nthOccurrence ? NTH_TO_API[cfg.nthOccurrence] : null,
    nthWeekday: cfg.nthWeekday ?? null,
    endDate: toDateOnly(cfg.endDate),
  };
}

function toSubTaskBody(s: ProjectSubTask, sortOrder: number) {
  return {
    title: s.title,
    importance: LEVEL_TO_API[s.importance] || 'Medium',
    startDate: toDateOnly(s.startDate),
    endDate: toDateOnly(s.endDate),
    sortOrder,
  };
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

export async function login(identity: string, password: string): Promise<User> {
  let email = identity.trim();
  if (!email.includes('@') && LOGIN_EMAIL_DOMAIN) {
    email = `${email}@${LOGIN_EMAIL_DOMAIN}`;
  }
  if (!email.includes('@')) {
    // LoginRequest(Email, Password, TenantSlug): NexusCore authenticates by email only.
    throw new NexusApiError('ورود به سامانه فقط با ایمیل امکان‌پذیر است. لطفاً ایمیل حساب کاربری خود را وارد کنید.', 400);
  }

  const auth = await request<AuthResponse>('POST', '/api/identity/auth/login', {
    body: { email, password, tenantSlug: NEXUS_TENANT_SLUG || null },
    auth: false,
    retryOnUnauthorized: false,
    unauthorizedMessage: 'ورود ناموفق بود! ایمیل یا رمز عبور اشتباه است، یا حساب کاربری غیرفعال شده است.',
  });
  saveAuthResponse(auth);
  return mapUserDto(auth.user);
}

/** Signed-in user from the stored session, without a network call (used on first render). */
export function getSessionUser(): User | null {
  const session = readSession();
  return session?.refreshToken && session.user ? mapUserDto(session.user) : null;
}

export function getSessionTenantId(): string | null {
  return readSession()?.user?.tenantId || null;
}

/**
 * GET /api/identity/auth/me. Returns null when the session is gone (refresh failed); keeps
 * the stored user when the server is merely unreachable, as the PocketBase version did.
 */
export async function refreshCurrentUser(): Promise<User | null> {
  const session = readSession();
  if (!session) return null;
  try {
    const me = await request<CurrentUserResponse>('GET', '/api/identity/auth/me');
    const latest = readSession();
    if (latest) writeSession({ ...latest, user: me.user });
    return me.user.isActive ? mapUserDto(me.user) : null;
  } catch (err) {
    if (err instanceof NexusApiError && err.httpStatus === 401) {
      writeSession(null);
      return null;
    }
    console.warn('Could not refresh the current user from NexusCore:', err instanceof Error ? err.message : err);
    return getSessionUser();
  }
}

/** The backend has no logout/revoke endpoint, so signing out only discards the tokens. */
export function logout(): void {
  writeSession(null);
}

// ---------------------------------------------------------------------------
// Users & user groups (UI "teams")
// ---------------------------------------------------------------------------

export async function fetchUsers(): Promise<User[]> {
  if (!readSession()) return [];
  const users = await getAllPages<UserDto>('/api/identity/users', {}, 100);
  return users.map(mapUserDto);
}

export async function deleteUser(userId: string): Promise<void> {
  await request<void>('DELETE', `/api/identity/users/${requireGuid(userId, 'کاربر')}`);
}

export async function fetchUserGroupsAsTeams(): Promise<WorkTeam[]> {
  if (!readSession()) return [];
  const tenantId = getSessionTenantId();
  const result = await request<UserGroupDto[] | PagedResult<UserGroupDto>>('GET', '/api/identity/groups', {
    query: { tenantId },
  });
  const groups = Array.isArray(result) ? result : result?.items || [];
  return groups
    .filter((g) => g.isActive)
    .map((g) => ({
      id: g.id,
      name: g.name,
      // UserGroup has no owner - the field is left empty rather than invented.
      ownerId: '',
      members: (g.members || []).map((m) => ({ userId: m.userId, name: m.displayName, username: m.email })),
      createdAt: '',
    }));
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

const TASKS = '/api/task-management/tasks';

async function getTaskDto(taskId: string): Promise<TaskDto> {
  return request<TaskDto>('GET', `${TASKS}/${taskId}`);
}

async function fetchComments(taskId: string): Promise<TaskComment[]> {
  const items = await request<TaskCommentDto[]>('GET', `${TASKS}/${taskId}/comments`);
  return (items || []).map(mapComment).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function fetchActivity(taskId: string): Promise<TaskLog[]> {
  const items = await request<TaskActivityDto[]>('GET', `${TASKS}/${taskId}/activity`);
  return (items || []).map(mapActivity).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * The list endpoint returns a trimmed TaskListItemDto (no description, subtasks, files,
 * charter or recurrence), while the board needs the full task. So the list supplies the ids
 * and each task is then read in full, together with its comments and activity (the
 * notification bell is built from those).
 */
export async function fetchTasks(): Promise<Task[]> {
  // Signed out: nothing to show, and no point sending requests that can only return 401.
  if (!readSession()) return [];
  const list = await getAllPages<TaskListItemDto>(TASKS, { sortBy: 'CreatedAtUtc', sortDescending: true }, 200);
  return mapWithLimit(list, DETAIL_CONCURRENCY, async (item) => {
    const [dto, comments, logs] = await Promise.all([
      getTaskDto(item.id),
      fetchComments(item.id),
      fetchActivity(item.id),
    ]);
    return mapTask(dto, comments, logs);
  });
}

async function fetchTask(taskId: string): Promise<Task> {
  const [dto, comments, logs] = await Promise.all([getTaskDto(taskId), fetchComments(taskId), fetchActivity(taskId)]);
  return mapTask(dto, comments, logs);
}

function assertUploadsSupported(): void {
  if (!BACKEND_STORES_FILE_CONTENT) {
    throw new NexusApiError(
      'بارگذاری فایل پیوست در سرور NexusCore فعلاً ممکن نیست: سرور مشخصات فایل را ثبت می‌کند اما محتوای آن را ذخیره نمی‌کند. فعالیت را بدون فایل جدید ذخیره کنید.',
      501
    );
  }
}

async function uploadAttachment(taskId: string, attachment: Attachment): Promise<void> {
  assertUploadsSupported();
  const form = new FormData();
  form.append('file', dataUrlToBlob(attachment.dataUrl, attachment.type), attachment.name);
  await request<TaskFileDto>('POST', `/api/task-management/files/tasks/${taskId}`, { form });
}

async function resolveTagId(name: string): Promise<string> {
  const wanted = name.trim().toUpperCase();
  const found = await request<TagDto[]>('GET', '/api/task-management/tags', { query: { search: name.trim() } });
  const exact = (found || []).find((t) => t.name.trim().toUpperCase() === wanted);
  if (exact) return exact.id;
  const created = await request<TagDto>('POST', '/api/task-management/tags', { body: { name: name.trim() } });
  return created.id;
}

export async function createTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
  if ((taskData.attachments || []).length > 0) assertUploadsSupported();
  const subTasks = taskData.projectSubTasks || [];
  const dueDate = toDateOnly(taskData.dueDate);
  if (!dueDate) throw new NexusApiError('تاریخ سررسید فعالیت نامعتبر است.', 400);

  // Task, subtasks and tags are written by one call and one transaction on the server.
  const created = await request<TaskDto>('POST', TASKS, {
    body: {
      title: taskData.title,
      dueDate,
      priority: LEVEL_TO_API[taskData.priority] || 'Medium',
      description: taskData.description || null,
      isProject: !!taskData.isProject,
      assignedUserId: requireGuid(taskData.assignedUserId, 'کاربر مسئول'),
      assignedUserGroupId: requireGuid(taskData.assignedTeamId, 'تیم'),
      assigneeUserIds: (taskData.teamMemberIds || []).map((id) => requireGuid(id, 'عضو تیم')),
      allowAssigneeStatusUpdate: taskData.allowAssigneeStatusUpdate ?? true,
      charterDescription: taskData.projectCharter?.description || null,
      charterProjectManager: taskData.projectCharter?.projectManager || null,
      charterStartDate: toDateOnly(taskData.projectCharter?.startDate),
      charterEndDate: toDateOnly(taskData.projectCharter?.endDate),
      subTasks: subTasks.map((s, i) => toSubTaskBody(s, i)),
      tags: (taskData.tags || []).filter((t) => t && t.trim()),
    },
  });

  // The remaining steps use their own endpoints. If one fails, the task is removed again so
  // a half-saved task is not left behind - the same all-or-nothing result as before.
  try {
    const createdSubTasks = [...created.subTasks].sort((a, b) => a.sortOrder - b.sortOrder);
    for (let i = 0; i < subTasks.length && i < createdSubTasks.length; i++) {
      if (subTasks[i].completed) {
        await request('PATCH', `/api/task-management/subtasks/${createdSubTasks[i].id}/status`, {
          body: { isCompleted: true },
        });
      }
    }

    if (taskData.status && STATUS_TO_API[taskData.status] !== created.status) {
      await request('PATCH', `${TASKS}/${created.id}/status`, { body: { status: STATUS_TO_API[taskData.status] } });
    }

    if (taskData.isRecurring && taskData.recurringConfig) {
      await request('POST', '/api/task-management/repetitive-tasks', {
        body: { taskId: created.id, recurrence: toRecurrenceInput(taskData.recurringConfig, taskData.dueDate) },
      });
    }

    for (const attachment of taskData.attachments || []) {
      await uploadAttachment(created.id, attachment);
    }
  } catch (err) {
    await request('DELETE', `${TASKS}/${created.id}`).catch(() => undefined);
    throw err;
  }

  return fetchTask(created.id);
}

/**
 * Applies a partial update. Mirrors the PocketBase contract: a field left `undefined` is not
 * changed. Each part goes to the endpoint that owns it - details (PUT), status (PATCH),
 * subtasks, tags, files and the recurrence schedule.
 */
export async function updateTask(
  taskId: string,
  taskData: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Task> {
  const current = await getTaskDto(taskId);

  // Refuse before changing anything, so a rejected upload does not leave a half-applied edit.
  if (taskData.attachments?.some((a) => !current.files.some((f) => f.linkId === a.id))) {
    assertUploadsSupported();
  }

  // The UI rebuilds a recurring task's occurrences on every save and recognises the old ones
  // by their "rec_occ_" ids. The backend assigns its own ids, so after a reload the old
  // occurrences are no longer recognisable and a save would add a second full set.
  const desiredSubTasks = taskData.projectSubTasks;
  if (
    desiredSubTasks &&
    current.recurrence &&
    current.subTasks.length > 0 &&
    desiredSubTasks.some((s) => s.id.startsWith('rec_occ_'))
  ) {
    throw new NexusApiError(
      'ویرایش فرم وظیفهٔ تکرارشونده در اتصال NexusCore پشتیبانی نمی‌شود: سرور شناسهٔ رخدادهای تولیدشده را نگه نمی‌دارد و ذخیره باعث تکرار همهٔ رخدادها می‌شود. تغییر وضعیت زیرفعالیت‌ها همچنان ممکن است.',
      409
    );
  }

  // 1. New subtasks first: promoting a task to a project requires subtasks to exist already.
  const currentById = new Map(current.subTasks.map((s) => [s.id, s]));
  if (desiredSubTasks) {
    for (let i = 0; i < desiredSubTasks.length; i++) {
      const s = desiredSubTasks[i];
      if (currentById.has(s.id)) continue;
      const added = await request<SubTaskDto>('POST', `${TASKS}/${taskId}/subtasks`, { body: toSubTaskBody(s, i) });
      if (s.completed) {
        await request('PATCH', `/api/task-management/subtasks/${added.id}/status`, { body: { isCompleted: true } });
      }
    }
  }

  // 2. Task details. PUT replaces every field, so untouched ones are carried over.
  const touchesDetails = [
    taskData.title,
    taskData.description,
    taskData.dueDate,
    taskData.priority,
    taskData.isProject,
    taskData.assignedUserId,
    taskData.assignedTeamId,
    taskData.teamMemberIds,
    taskData.allowAssigneeStatusUpdate,
    taskData.projectCharter,
  ].some((v) => v !== undefined);

  if (touchesDetails) {
    const charter = taskData.projectCharter;
    await request('PUT', `${TASKS}/${taskId}`, {
      body: {
        title: taskData.title ?? current.title,
        dueDate: toDateOnly(taskData.dueDate) || current.dueDate,
        priority: taskData.priority ? LEVEL_TO_API[taskData.priority] : current.priority,
        description: taskData.description !== undefined ? taskData.description || null : current.description,
        isProject: taskData.isProject ?? current.isProject,
        assignedUserId:
          taskData.assignedUserId !== undefined
            ? requireGuid(taskData.assignedUserId, 'کاربر مسئول')
            : current.assignedUser?.id ?? null,
        assignedUserGroupId:
          taskData.assignedTeamId !== undefined
            ? requireGuid(taskData.assignedTeamId, 'تیم')
            : current.assignedUserGroup?.id ?? null,
        assigneeUserIds:
          taskData.teamMemberIds !== undefined
            ? taskData.teamMemberIds.map((id) => requireGuid(id, 'عضو تیم'))
            : null,
        allowAssigneeStatusUpdate: taskData.allowAssigneeStatusUpdate ?? current.allowAssigneeStatusUpdate,
        charterDescription: charter !== undefined ? charter?.description || null : current.charterDescription,
        charterProjectManager: charter !== undefined ? charter?.projectManager || null : current.charterProjectManager,
        charterStartDate: charter !== undefined ? toDateOnly(charter?.startDate) : current.charterStartDate,
        charterEndDate: charter !== undefined ? toDateOnly(charter?.endDate) : current.charterEndDate,
      },
    });
  }

  // 3. Existing subtasks: edits, completion toggles, then removals (a plain task may drop
  //    them all; a project keeps at least one, which the server enforces).
  if (desiredSubTasks) {
    const desiredIds = new Set(desiredSubTasks.map((s) => s.id));
    for (let i = 0; i < desiredSubTasks.length; i++) {
      const s = desiredSubTasks[i];
      const existing = currentById.get(s.id);
      if (!existing) continue;
      const body = toSubTaskBody(s, i);
      const changed =
        existing.title !== body.title ||
        existing.importance !== body.importance ||
        (existing.startDate || null) !== body.startDate ||
        (existing.endDate || null) !== body.endDate ||
        existing.sortOrder !== body.sortOrder;
      if (changed) {
        await request('PUT', `/api/task-management/subtasks/${s.id}`, { body });
      }
      if (existing.isCompleted !== !!s.completed) {
        await request('PATCH', `/api/task-management/subtasks/${s.id}/status`, { body: { isCompleted: !!s.completed } });
      }
    }
    for (const existing of current.subTasks) {
      if (!desiredIds.has(existing.id)) {
        await request('DELETE', `/api/task-management/subtasks/${existing.id}`);
      }
    }
  }

  // 4. Status.
  if (taskData.status && STATUS_TO_API[taskData.status] !== current.status) {
    await request('PATCH', `${TASKS}/${taskId}/status`, { body: { status: STATUS_TO_API[taskData.status] } });
  }

  // 5. Tags, by name.
  if (taskData.tags !== undefined) {
    const wanted = new Map(
      taskData.tags.filter((t) => t && t.trim()).map((t) => [t.trim().toUpperCase(), t.trim()])
    );
    for (const tag of current.tags) {
      if (!wanted.has(tag.name.trim().toUpperCase())) {
        await request('DELETE', `${TASKS}/${taskId}/tags/${tag.id}`);
      }
    }
    const have = new Set(current.tags.map((t) => t.name.trim().toUpperCase()));
    for (const [key, name] of wanted) {
      if (have.has(key)) continue;
      const tagId = await resolveTagId(name);
      await request('POST', `${TASKS}/${taskId}/tags`, { body: { tagId } });
    }
  }

  // 6. Attachments: anything without a known link id is new, anything missing is removed.
  if (taskData.attachments !== undefined) {
    const currentLinks = new Set(current.files.map((f) => f.linkId));
    const keep = new Set(taskData.attachments.map((a) => a.id));
    for (const f of current.files) {
      if (!keep.has(f.linkId)) {
        await request('DELETE', `/api/task-management/files/${f.linkId}`);
      }
    }
    for (const attachment of taskData.attachments) {
      if (!currentLinks.has(attachment.id)) {
        await uploadAttachment(taskId, attachment);
      }
    }
  }

  // 7. Recurrence schedule, through the RepetitiveTask endpoints.
  if (taskData.isRecurring !== undefined || taskData.recurringConfig !== undefined) {
    const wantsRecurrence = taskData.isRecurring ?? current.isRecurring;
    if (!wantsRecurrence) {
      if (current.recurrence) {
        await request('DELETE', `/api/task-management/repetitive-tasks/${current.recurrence.id}`);
      }
    } else if (taskData.recurringConfig) {
      const recurrence = toRecurrenceInput(taskData.recurringConfig, taskData.dueDate || current.dueDate);
      if (current.recurrence) {
        await request('PUT', `/api/task-management/repetitive-tasks/${current.recurrence.id}`, { body: { recurrence } });
      } else {
        await request('POST', '/api/task-management/repetitive-tasks', { body: { taskId, recurrence } });
      }
    }
  }

  return fetchTask(taskId);
}

export async function deleteTask(taskId: string): Promise<void> {
  await request('DELETE', `${TASKS}/${taskId}`);
}

// ---------------------------------------------------------------------------
// Comments & activity
// ---------------------------------------------------------------------------

export async function fetchTaskComments(taskId: string): Promise<TaskComment[]> {
  return fetchComments(taskId);
}

export async function createTaskComment(taskId: string, text: string, hasAttachments: boolean): Promise<TaskComment> {
  if (hasAttachments) {
    // CreateTaskCommentRequest carries only Text; the files would be silently lost.
    throw new NexusApiError('پیوست کردن فایل به نظر در سرور NexusCore پشتیبانی نمی‌شود. نظر را بدون پیوست ارسال کنید.', 400);
  }
  const created = await request<TaskCommentDto>('POST', `${TASKS}/${taskId}/comments`, { body: { text } });
  return mapComment(created);
}

export async function deleteTaskComment(commentId: string): Promise<void> {
  await request('DELETE', `/api/task-management/comments/${commentId}`);
}

export async function fetchTaskActivity(taskId: string): Promise<TaskLog[]> {
  return fetchActivity(taskId);
}

// ---------------------------------------------------------------------------
// Personal notes (owner comes from the token; no user id is sent)
// ---------------------------------------------------------------------------

const NOTES = '/api/task-management/notes';

export function listNotes(): Promise<NoteDto[]> {
  return request<NoteDto[]>('GET', NOTES);
}

export function getNote(id: string): Promise<NoteDto> {
  return request<NoteDto>('GET', `${NOTES}/${id}`);
}

export function createNote(body: { title: string; content: string; color: string | null; isPinned: boolean }): Promise<NoteDto> {
  return request<NoteDto>('POST', NOTES, { body });
}

export function updateNote(
  id: string,
  body: { title: string; content: string; color: string | null; isPinned: boolean }
): Promise<NoteDto> {
  return request<NoteDto>('PUT', `${NOTES}/${id}`, { body });
}

export async function deleteNote(id: string): Promise<void> {
  await request('DELETE', `${NOTES}/${id}`);
}

/** Message for operations the backend cannot serve, shown through the existing error UI. */
export function unsupportedOperation(what: string): NexusApiError {
  return new NexusApiError(`${what} در سرور NexusCore پشتیبانی نمی‌شود.`, 501);
}
