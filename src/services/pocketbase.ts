import PocketBase, { RecordModel } from 'pocketbase';
import { Task, TaskStatus, Priority, Attachment, User, AppTheme, AppColorPalette, WorkTeam, TaskComment, TaskLog, SystemNotificationSettings, DirectMessage, PersonalNote, NoteAttachment } from '../types';
import { parseDateSafely } from '../utils/jalali';

export const POCKETBASE_URL = 'https://parstask.pockethost.io';
export const pb = new PocketBase(POCKETBASE_URL);

// Local Storage Keys for offline/fallback caching
const LOCAL_USERS_KEY = 'parstask_managed_users_v2';
const LOCAL_TEAMS_PREFIX = 'parstask_teams_';
const IDENTITY_MAP_KEY = 'parstask_identity_to_email_map_v1';

function getIdentityToEmailMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(IDENTITY_MAP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function registerIdentityEmailMapping(identity: string, email: string) {
  if (!identity || !email) return;
  try {
    const map = getIdentityToEmailMap();
    const cleanId = identity.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    if (cleanId && cleanEmail) {
      map[cleanId] = cleanEmail;
      localStorage.setItem(IDENTITY_MAP_KEY, JSON.stringify(map));
    }
  } catch (e) {
    console.error('Failed to update identity email map:', e);
  }
}

export function updateIdentityMapFromUsers(users: User[]) {
  try {
    const map = getIdentityToEmailMap();
    for (const u of users) {
      if (u.email) {
        const emailLower = u.email.trim().toLowerCase();
        if (u.username) map[u.username.trim().toLowerCase()] = emailLower;
        if (u.id) map[u.id.trim().toLowerCase()] = emailLower;
        if (u.phoneNumber) map[u.phoneNumber.trim().toLowerCase()] = emailLower;
      }
    }
    localStorage.setItem(IDENTITY_MAP_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Failed to update identity map from users:', e);
  }
}

// Disable auto cancellation for concurrent requests
pb.autoCancellation(false);

export function parsePBError(error: any): string {
  if (!error) return 'خطای نامشخص در ارتباط با سرور';
  if (typeof error === 'string') return error;

  const status = error?.status || error?.response?.status || error?.statusCode;
  const rawMessage = error?.message || error?.response?.message || '';

  if (status === 404) {
    return 'کالکشن کاربران (users) یا فعالیت‌ها (tasks) در سرور یافت نشد. لطفاً از راهنمای بالای صفحه، کالکشن‌ها را چک کنید.';
  }

  // Extract field validation errors safely from PocketBase ClientResponseError structure
  // error.data = { code: 400, message: "...", data: { fieldName: { message: "...", code: "..." } } }
  let rawData = error?.data || error?.response?.data;
  if (rawData && typeof rawData === 'object' && rawData.data && typeof rawData.data === 'object') {
    rawData = rawData.data;
  }

  if (rawData && typeof rawData === 'object') {
    const errorDetails: string[] = [];

    for (const [key, val] of Object.entries(rawData)) {
      if (['code', 'message', 'status'].includes(key)) continue;

      let valMsg = '';
      if (typeof val === 'object' && val !== null) {
        valMsg = (val as any).message || (val as any).code || JSON.stringify(val);
      } else {
        valMsg = String(val);
      }

      if (!valMsg) continue;

      // Friendly Persian translations for standard PocketBase validation messages
      if (valMsg.includes('must be unique') || valMsg.includes('already in use') || valMsg.includes('validation_not_unique')) {
        valMsg = 'قبلاً ثبت شده و تکراری می‌باشد.';
      } else if (valMsg.includes('invalid') || valMsg.includes('validation_invalid') || valMsg.includes('validation_is_email')) {
        valMsg = 'فرمت وارد شده نامعتبر است (نام کاربری باید شامل حروف انگلیسی یا اعداد باشد).';
      } else if (valMsg.includes('length must be between') || valMsg.includes('validation_length')) {
        valMsg = 'طول کاراکتر غیرمجاز است (رمز عبور باید حداقل ۸ کاراکتر باشد).';
      }

      let fName = key;
      if (key === 'username') fName = 'نام کاربری';
      if (key === 'email') fName = 'ایمیل';
      if (key === 'password') fName = 'رمز عبور';
      if (key === 'passwordConfirm') fName = 'تکرار رمز عبور';
      if (key === 'identity') fName = 'شناسه ورود';
      if (key === 'user') fName = 'ایجادکننده (user)';
      if (key === 'name') fName = 'نام و نام خانوادگی';

      errorDetails.push(`${fName}: ${valMsg}`);
    }

    if (errorDetails.length > 0) {
      return `خطا در اطلاعات ورودی: ${errorDetails.join(' | ')}`;
    }
  }

  // Authentication error ONLY on auth/login failure
  if (rawMessage.includes('Failed to authenticate') || rawMessage.includes('invalid credentials')) {
    return 'ورود ناموفق بود! نام کاربری/ایمیل یا رمز عبور اشتباه است (یا این حساب هنوز ساخته نشده است). اگر حساب ندارید، ابتدا از تب «ثبت‌نام» حساب جدید ایجاد کنید.';
  }

  if (rawMessage.includes('Failed to create record')) {
    return 'ایجاد حساب کاربری در سرور انجام نشد. لطفاً ایمیل یا نام کاربری متفاوتی امتحان کنید.';
  }

  return rawMessage || 'خطا در ارتباط با سرور';
}

// User & Authentication Helpers
const formatAvatarUrl = (m: any): string | undefined => {
  if (!m?.avatar) return undefined;
  if (typeof m.avatar === 'string' && (m.avatar.startsWith('http') || m.avatar.startsWith('data:'))) {
    return m.avatar;
  }
  return pb.getFileUrl(m, m.avatar);
};

// Helper: Check local disabled status cache
function getDisabledUserIds(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem('parstask_disabled_users');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setDisabledUserId(userId: string, disabled: boolean) {
  try {
    const map = getDisabledUserIds();
    map[userId] = disabled;
    localStorage.setItem('parstask_disabled_users', JSON.stringify(map));
  } catch (e) {
    console.error('Failed to update disabled user map:', e);
  }
}

function getLastLoginUserMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem('parstask_user_last_logins');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function recordUserLastLogin(userId: string, timeIso?: string) {
  try {
    const map = getLastLoginUserMap();
    const nowIso = timeIso || new Date().toISOString();
    map[userId] = nowIso;
    localStorage.setItem('parstask_user_last_logins', JSON.stringify(map));
  } catch (e) {
    console.error('Failed to update last login map:', e);
  }
}

export function mapRecordToUser(m: RecordModel | any): User {
  const usernameLower = (m.username || '').toLowerCase();
  const emailLower = (m.email || '').toLowerCase();
  const isAdmin = usernameLower === 'admin' || emailLower === 'admin@admin.com' || m.role === 'admin';

  const disabledMap = getDisabledUserIds();
  const isDisabled = m.disabled === true || disabledMap[m.id] === true;

  const lastLoginMap = getLastLoginUserMap();
  const lastLoginTime = m.lastLogin || m.lastLoginAt || lastLoginMap[m.id] || m.updated || undefined;

  return {
    id: m.id,
    username: m.username || '',
    email: m.email || '',
    name: m.name || m.username || 'کاربر سیستم',
    avatar: formatAvatarUrl(m),
    theme: (m.theme as AppTheme) || 'default',
    colorPalette: (m.colorPalette as AppColorPalette) || 'indigo',
    themeMode: (m.themeMode as 'light' | 'dark') || 'light',
    role: isAdmin ? 'admin' : (m.role || 'user'),
    disabled: isDisabled,
    teams: fetchUserTeamsPB(m.id),
    lastLogin: lastLoginTime,
    phoneNumber: m.phoneNumber || m.phone || m.mobile || '',
    telegramChatId: m.telegramChatId || m.chatId || m.telegram_chat_id || '',
    notifySms: m.notifySms === false || m.notifySms === 'false' ? false : true,
    notifyTelegram: m.notifyTelegram === false || m.notifyTelegram === 'false' ? false : true,
  };
}

export function getCurrentUser(): User | null {
  if (!pb.authStore.isValid || !pb.authStore.model) {
    return null;
  }
  return mapRecordToUser(pb.authStore.model);
}

export async function loginPB(identity: string, password: string): Promise<User> {
  try {
    const trimmedIdentity = identity.trim();
    const isEmail = trimmedIdentity.includes('@');
    const lowerIdentity = trimmedIdentity.toLowerCase();

    // Prepare list of potential email/identity candidates to authenticate with
    const candidatesToTry: string[] = [];

    if (isEmail) {
      candidatesToTry.push(lowerIdentity);
    } else {
      // 1. Direct identity (in case PocketBase supports username auth)
      candidatesToTry.push(trimmedIdentity);
      if (lowerIdentity !== trimmedIdentity) {
        candidatesToTry.push(lowerIdentity);
      }

      // 2. Check identity map
      const map = getIdentityToEmailMap();
      const mappedEmail = map[lowerIdentity] || map[trimmedIdentity];
      if (mappedEmail && !candidatesToTry.includes(mappedEmail)) {
        candidatesToTry.push(mappedEmail);
      }

      // 3. Search local users cache
      const localUsers = getLocalUsersCache();
      const foundInCache = localUsers.find(
        (u) =>
          (u.username && u.username.toLowerCase() === lowerIdentity) ||
          (u.phoneNumber && u.phoneNumber.trim() === trimmedIdentity) ||
          (u.name && u.name.toLowerCase() === lowerIdentity) ||
          u.id === trimmedIdentity
      );
      if (foundInCache && foundInCache.email && !candidatesToTry.includes(foundInCache.email.toLowerCase())) {
        candidatesToTry.push(foundInCache.email.toLowerCase());
      }
    }

    let authData: any = null;
    let authSuccess = false;
    let lastError: any = null;

    for (const cand of candidatesToTry) {
      try {
        authData = await pb.collection('users').authWithPassword(cand, password);
        authSuccess = true;
        break;
      } catch (err: any) {
        lastError = err;
      }
    }

    // Fallback: If non-email identity failed, attempt lookup in PocketBase users collection
    if (!authSuccess && !isEmail) {
      try {
        const filterStr = `username = "${trimmedIdentity}" || username = "${lowerIdentity}" || email = "${lowerIdentity}" || phoneNumber = "${trimmedIdentity}" || phone = "${trimmedIdentity}" || mobile = "${trimmedIdentity}"`;
        const record = await pb.collection('users').getFirstListItem(filterStr);
        if (record && record.email) {
          authData = await pb.collection('users').authWithPassword(record.email, password);
          authSuccess = true;
        }
      } catch (lookupErr: any) {
        if (lookupErr.message && lookupErr.message.includes('غیرفعال شده است')) {
          throw lookupErr;
        }
      }
    }

    if (!authSuccess || !authData) {
      throw lastError || new Error('نام کاربری، ایمیل یا رمز عبور نامعتبر است.');
    }

    const user = mapRecordToUser(authData.record);
    if (user.disabled) {
      pb.authStore.clear();
      throw new Error('حساب کاربری شما توسط مدیر سیستم غیرفعال شده است.');
    }

    // Keep identity mappings fresh
    registerIdentityEmailMapping(user.username, user.email);
    if (user.phoneNumber) registerIdentityEmailMapping(user.phoneNumber, user.email);
    if (user.id) registerIdentityEmailMapping(user.id, user.email);

    const nowIso = new Date().toISOString();
    recordUserLastLogin(user.id, nowIso);
    user.lastLogin = nowIso;

    try {
      await pb.collection('users').update(user.id, { lastLogin: nowIso });
    } catch {}

    return user;
  } catch (err: any) {
    if (err.message && err.message.includes('غیرفعال شده است')) {
      throw err;
    }
    const msg = parsePBError(err);
    console.error('Login failed:', msg, err);
    throw new Error(msg);
  }
}

export async function registerPB(data: {
  username?: string;
  email: string;
  password: string;
  passwordConfirm: string;
  name?: string;
  phoneNumber?: string;
  telegramChatId?: string;
  notifySms?: boolean;
  notifyTelegram?: boolean;
  theme?: AppTheme;
  colorPalette?: AppColorPalette;
  themeMode?: 'light' | 'dark';
}): Promise<User> {
  const emailClean = data.email.trim().toLowerCase();
  const fullName = (data.name || '').trim() || 'کاربر جدید';

  // Sanitize username for PocketBase compatibility (alphanumeric, _, .)
  let cleanUsername = (data.username || emailClean.split('@')[0] || 'user')
    .trim()
    .replace(/[^a-zA-Z0-9_.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (cleanUsername.length < 3) {
    cleanUsername = 'user_' + Math.random().toString(36).substring(2, 8);
  }

  const payload: Record<string, any> = {
    username: cleanUsername,
    email: emailClean,
    password: data.password,
    passwordConfirm: data.passwordConfirm,
    name: fullName,
    theme: data.theme || 'default',
    colorPalette: data.colorPalette || 'indigo',
    themeMode: data.themeMode || 'light',
    notifySms: data.notifySms !== undefined ? data.notifySms : true,
    notifyTelegram: data.notifyTelegram !== undefined ? data.notifyTelegram : true,
  };

  if (data.phoneNumber) {
    const cleanPhone = data.phoneNumber.trim();
    payload.phoneNumber = cleanPhone;
    payload.phone = cleanPhone;
    payload.mobile = cleanPhone;
  }
  if (data.telegramChatId) {
    const cleanTg = data.telegramChatId.trim();
    payload.telegramChatId = cleanTg;
    payload.telegram_chat_id = cleanTg;
  }

  try {
    // 1. Create user in PocketBase
    try {
      await pb.collection('users').create(payload);
    } catch (createErr1: any) {
      console.warn('Initial registration attempt failed:', createErr1?.data || createErr1);

      const rawData = createErr1?.data?.data || createErr1?.data || createErr1?.response?.data;

      // If username conflict or invalid username format, append random suffix
      if (rawData?.username) {
        cleanUsername = `${cleanUsername.substring(0, 10)}_${Math.random().toString(36).substring(2, 6)}`;
        payload.username = cleanUsername;
      }

      // Try again without custom optional fields if custom schema fields caused issue
      try {
        await pb.collection('users').create(payload);
      } catch (createErr2: any) {
        console.warn('Second attempt failed, retrying with core PocketBase fields...', createErr2?.data || createErr2);
        
        const corePayload = {
          username: cleanUsername,
          email: emailClean,
          password: data.password,
          passwordConfirm: data.passwordConfirm,
          name: fullName,
        };

        try {
          await pb.collection('users').create(corePayload);
        } catch (createErr3: any) {
          // If all attempts failed, throw the detailed error
          throw createErr3 || createErr2 || createErr1;
        }
      }
    }

    // Save mapping for username, email, phone
    registerIdentityEmailMapping(emailClean, emailClean);
    registerIdentityEmailMapping(cleanUsername, emailClean);
    if (data.username) registerIdentityEmailMapping(data.username, emailClean);
    if (data.phoneNumber) registerIdentityEmailMapping(data.phoneNumber, emailClean);

    // 2. Auto login with email
    const user = await loginPB(emailClean, data.password);

    // Try to ensure phoneNumber, telegramChatId & notification preferences are set on user record
    try {
      const updateObj: Record<string, any> = {
        notifySms: data.notifySms !== undefined ? data.notifySms : true,
        notifyTelegram: data.notifyTelegram !== undefined ? data.notifyTelegram : true,
      };
      if (data.phoneNumber) {
        updateObj.phoneNumber = data.phoneNumber.trim();
        updateObj.phone = data.phoneNumber.trim();
        updateObj.mobile = data.phoneNumber.trim();
      }
      if (data.telegramChatId) {
        updateObj.telegramChatId = data.telegramChatId.trim();
        updateObj.telegram_chat_id = data.telegramChatId.trim();
      }
      await pb.collection('users').update(user.id, updateObj);
    } catch {
      // Ignore if update fails
    }
    user.phoneNumber = data.phoneNumber?.trim() || user.phoneNumber;
    user.telegramChatId = data.telegramChatId?.trim() || user.telegramChatId;
    user.notifySms = data.notifySms !== undefined ? data.notifySms : true;
    user.notifyTelegram = data.notifyTelegram !== undefined ? data.notifyTelegram : true;

    return user;
  } catch (err: any) {
    const msg = parsePBError(err);
    console.error('Registration failed:', msg, err);
    throw new Error(msg);
  }
}

export async function requestPasswordResetPB(emailOrUsername: string): Promise<string> {
  const trimmed = emailOrUsername.trim();
  if (!trimmed) {
    throw new Error('لطفاً ایمیل یا نام کاربری خود را وارد نمایید.');
  }

  let targetEmail = trimmed;

  // If input is not an email address, search by username in PocketBase users collection
  if (!trimmed.includes('@')) {
    try {
      const cleanUsername = trimmed.toLowerCase();
      const record = await pb.collection('users').getFirstListItem(`username = "${cleanUsername}"`);
      if (record && record.email) {
        targetEmail = record.email;
      } else {
        throw new Error('کاربری با این نام کاربری یافت نشد.');
      }
    } catch (e: any) {
      if (e.message && e.message.includes('کاربری با این نام کاربری')) {
        throw e;
      }
      throw new Error('کاربری با این نام کاربری در سیستم یافت نشد. لطفاً ایمیل خود را مستقیم وارد کنید.');
    }
  }

  try {
    await pb.collection('users').requestPasswordReset(targetEmail.toLowerCase());
    return targetEmail;
  } catch (err: any) {
    const msg = parsePBError(err);
    console.error('Password reset request failed:', msg, err);
    throw new Error(msg);
  }
}

export async function confirmPasswordResetPB(
  token: string,
  password: string,
  passwordConfirm: string
): Promise<boolean> {
  if (!token || !token.trim()) {
    throw new Error('توکن بازیابی رمز عبور یافت نشد یا معتبر نمی‌باشد.');
  }
  if (!password || password.length < 8) {
    throw new Error('رمز عبور جدید باید حداقل ۸ کاراکتر باشد.');
  }
  if (password !== passwordConfirm) {
    throw new Error('رمز عبور جدید و تکرار آن با یکدیگر مطابقت ندارند.');
  }

  try {
    await pb.collection('users').confirmPasswordReset(token.trim(), password, passwordConfirm);
    return true;
  } catch (err: any) {
    const msg = parsePBError(err);
    console.error('Password reset confirmation failed:', msg, err);
    throw new Error(msg);
  }
}

export function extractResetTokenFromURL(): string | null {
  if (typeof window === 'undefined') return null;
  const href = window.location.href;

  try {
    // 1. Check for query parameter ?token=TOKEN
    const urlObj = new URL(href);
    const tokenQuery = urlObj.searchParams.get('token');
    if (tokenQuery) return tokenQuery;

    // 2. Check for hash parameters e.g. #token=TOKEN
    if (window.location.hash) {
      const hashStr = window.location.hash;
      const hashMatch = hashStr.match(/token=([A-Za-z0-9_\-.]+)/);
      if (hashMatch && hashMatch[1]) {
        return hashMatch[1];
      }
    }

    // 3. Check for confirm-password-reset/TOKEN or reset-password/TOKEN in path or hash
    const matchPath = href.match(/(?:confirm-password-reset|reset-password)\/([A-Za-z0-9_\-.]+)/);
    if (matchPath && matchPath[1]) {
      return matchPath[1];
    }
  } catch (e) {
    console.error('Error parsing reset token from URL', e);
  }

  return null;
}

export async function refreshCurrentUserPB(): Promise<User | null> {
  if (!pb.authStore.isValid) return null;
  try {
    const authData = await pb.collection('users').authRefresh();
    const user = mapRecordToUser(authData.record);
    if (user.disabled) {
      pb.authStore.clear();
      return null;
    }
    return user;
  } catch (err) {
    console.warn('authRefresh failed:', err);
    return getCurrentUser();
  }
}

export function logoutPB(): void {
  pb.authStore.clear();
}

// Local Storage Cache Helpers for Managed Users & Work Teams
function getLocalUsersCache(): User[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalUsersCache(users: User[]): void {
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save local users cache:', e);
  }
}

export function fetchUserTeamsPB(userId: string): WorkTeam[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(LOCAL_TEAMS_PREFIX + userId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function fetchUserTeamsAsyncPB(userId: string): Promise<WorkTeam[]> {
  if (!userId) return [];

  try {
    const userRec = await pb.collection('users').getOne(userId);
    if (userRec && userRec.teams) {
      let parsed: WorkTeam[] = [];
      if (typeof userRec.teams === 'string') {
        parsed = JSON.parse(userRec.teams);
      } else if (Array.isArray(userRec.teams)) {
        parsed = userRec.teams;
      }
      if (Array.isArray(parsed)) {
        try {
          localStorage.setItem(LOCAL_TEAMS_PREFIX + userId, JSON.stringify(parsed));
        } catch {}
        return parsed;
      }
    }
  } catch (err) {
    console.warn('PocketBase fetchUserTeams error, falling back to local storage:', err);
  }

  // Fallback to local storage if offline or initial load
  return fetchUserTeamsPB(userId);
}

export async function saveUserTeamsPB(userId: string, teams: WorkTeam[]): Promise<void> {
  if (!userId) return;

  // 1. Instant local storage cache update for smooth UI
  try {
    localStorage.setItem(LOCAL_TEAMS_PREFIX + userId, JSON.stringify(teams));
  } catch (e) {
    console.error('Failed to save teams locally:', e);
  }

  // 2. Direct live PocketBase database persistence on users collection
  try {
    await pb.collection('users').update(userId, {
      teams: JSON.stringify(teams),
    });
  } catch (err) {
    // If PocketBase expects raw array for JSON field
    try {
      await pb.collection('users').update(userId, {
        teams: teams,
      });
    } catch (e2) {
      console.error('Failed to save teams to PocketBase database:', e2);
    }
  }
}

export async function fetchAllUsersPB(): Promise<User[]> {
  let pbUsers: User[] = [];
  try {
    const records = await pb.collection('users').getFullList({ sort: '-created' });
    pbUsers = records.map(mapRecordToUser);
  } catch (err) {
    console.warn('Could not fetch user list from PocketBase API (possibly rule restricted):', err);
  }

  const localUsers = getLocalUsersCache();
  
  // Combine pbUsers and localUsers, deduplicating by id or username
  const userMap = new Map<string, User>();

  // Pre-seed default Admin if not present
  const adminUser: User = {
    id: 'user_admin_001',
    username: 'admin',
    email: 'admin@admin.com',
    name: 'مدیر کل سیستم (Admin)',
    role: 'admin',
    disabled: false,
    theme: 'default',
    colorPalette: 'indigo',
    themeMode: 'light',
    notifySms: true,
    notifyTelegram: true,
  };
  userMap.set('admin', adminUser);

  // Add PB users
  for (const u of pbUsers) {
    userMap.set(u.id, u);
    userMap.set(u.username.toLowerCase(), u);
  }

  // Add local users
  for (const u of localUsers) {
    if (!userMap.has(u.id) && !userMap.has(u.username.toLowerCase())) {
      userMap.set(u.id, u);
    } else {
      const existing = userMap.get(u.id) || userMap.get(u.username.toLowerCase());
      if (existing) {
        existing.disabled = u.disabled ?? existing.disabled;
        existing.name = u.name || existing.name;
        existing.email = u.email || existing.email;
      }
    }
  }

  // Include current logged-in user if not already present
  if (pb.authStore.isValid && pb.authStore.model) {
    const cur = mapRecordToUser(pb.authStore.model);
    userMap.set(cur.id, cur);
  }

  const resultList = Array.from(userMap.values());
  const uniqueResult = resultList.filter((v, idx, self) => self.findIndex(t => t.id === v.id) === idx);
  updateIdentityMapFromUsers(uniqueResult);
  saveLocalUsersCache(uniqueResult);
  return uniqueResult;
}

export async function adminCreateUserPB(data: {
  username: string;
  name: string;
  email: string;
  password: string;
  role?: string;
  disabled?: boolean;
  phoneNumber?: string;
  telegramChatId?: string;
  notifySms?: boolean;
  notifyTelegram?: boolean;
}): Promise<User> {
  const current = getCurrentUser();
  if (!current || current.role !== 'admin') {
    throw new Error('فقط مدیر سیستم (Admin) مجاز به تعریف و مدیریت کاربران می‌باشد.');
  }

  let newUser: User;
  try {
    const payload: Record<string, any> = {
      username: data.username,
      name: data.name,
      email: data.email,
      password: data.password,
      passwordConfirm: data.password,
      role: data.role || 'user',
      notifySms: data.notifySms !== undefined ? data.notifySms : true,
      notifyTelegram: data.notifyTelegram !== undefined ? data.notifyTelegram : true,
    };
    if (data.phoneNumber !== undefined) payload.phoneNumber = data.phoneNumber;
    if (data.telegramChatId !== undefined) payload.telegramChatId = data.telegramChatId;
    if (data.notifySms !== undefined) payload.notifySms = data.notifySms;
    if (data.notifyTelegram !== undefined) payload.notifyTelegram = data.notifyTelegram;

    const record = await pb.collection('users').create(payload);
    newUser = mapRecordToUser(record);
  } catch (err: any) {
    console.warn('PocketBase create user API failed, creating in local cache:', err);
    newUser = {
      id: 'usr_' + Date.now(),
      username: data.username,
      name: data.name,
      email: data.email,
      role: data.role || 'user',
      disabled: data.disabled || false,
      theme: 'default',
      colorPalette: 'indigo',
      themeMode: 'light',
      phoneNumber: data.phoneNumber,
      telegramChatId: data.telegramChatId,
      notifySms: data.notifySms !== undefined ? data.notifySms : true,
      notifyTelegram: data.notifyTelegram !== undefined ? data.notifyTelegram : true,
    };
  }

  if (data.disabled) {
    setDisabledUserId(newUser.id, true);
    newUser.disabled = true;
  }

  const localList = getLocalUsersCache();
  localList.push(newUser);
  saveLocalUsersCache(localList);

  return newUser;
}

export async function adminUpdateUserPB(
  userId: string,
  updates: {
    name?: string;
    username?: string;
    email?: string;
    password?: string;
    role?: string;
    disabled?: boolean;
    phoneNumber?: string;
    telegramChatId?: string;
    notifySms?: boolean;
    notifyTelegram?: boolean;
  }
): Promise<User> {
  const current = getCurrentUser();
  if (!current || current.role !== 'admin') {
    throw new Error('فقط مدیر سیستم (Admin) مجاز به ویرایش کاربران می‌باشد.');
  }

  if (updates.disabled !== undefined) {
    setDisabledUserId(userId, updates.disabled);
  }

  let updatedUser: User | null = null;
  const pbPayload: Record<string, any> = {};
  if (updates.name) pbPayload.name = updates.name;
  if (updates.username) pbPayload.username = updates.username;
  if (updates.email) pbPayload.email = updates.email;
  if (updates.role) pbPayload.role = updates.role;
  if (updates.phoneNumber !== undefined) pbPayload.phoneNumber = updates.phoneNumber;
  if (updates.telegramChatId !== undefined) pbPayload.telegramChatId = updates.telegramChatId;
  if (updates.notifySms !== undefined) pbPayload.notifySms = updates.notifySms;
  if (updates.notifyTelegram !== undefined) pbPayload.notifyTelegram = updates.notifyTelegram;

  if (updates.password) {
    pbPayload.password = updates.password;
    pbPayload.passwordConfirm = updates.password;
  }

  try {
    const record = await pb.collection('users').update(userId, pbPayload);
    updatedUser = mapRecordToUser(record);
  } catch (err) {
    console.warn(`PB update failed for user ${userId}, updating local cache:`, err);
  }

  const localList = getLocalUsersCache();
  const idx = localList.findIndex((u) => u.id === userId);
  if (idx !== -1) {
    localList[idx] = {
      ...localList[idx],
      ...updates,
    };
    saveLocalUsersCache(localList);
    if (!updatedUser) updatedUser = localList[idx];
  }

  if (!updatedUser) {
    updatedUser = {
      id: userId,
      username: updates.username || 'user',
      name: updates.name || 'کاربر',
      email: updates.email || 'user@email.com',
      disabled: updates.disabled || false,
      role: updates.role || 'user',
    };
  }

  return updatedUser;
}

export async function adminDeleteUserPB(userId: string): Promise<boolean> {
  const current = getCurrentUser();
  if (!current || current.role !== 'admin') {
    throw new Error('فقط مدیر سیستم (Admin) مجاز به حذف کاربران می‌باشد.');
  }

  if (current.id === userId) {
    throw new Error('امکان حذف حساب مدیر فعال (حساب جاری) وجود ندارد.');
  }

  try {
    await pb.collection('users').delete(userId);
  } catch (err) {
    console.warn(`PB delete failed for user ${userId}, removing from local cache:`, err);
  }

  const localList = getLocalUsersCache().filter((u) => u.id !== userId);
  saveLocalUsersCache(localList);
  return true;
}

export async function updateUserThemePB(settings: { theme?: AppTheme; colorPalette?: AppColorPalette; themeMode?: 'light' | 'dark' }): Promise<void> {
  if (!pb.authStore.isValid || !pb.authStore.model?.id) return;
  const userId = pb.authStore.model.id;
  try {
    const updatedRecord = await pb.collection('users').update(userId, settings);
    if (updatedRecord) {
      pb.authStore.save(pb.authStore.token, updatedRecord);
    }
  } catch (err) {
    console.warn('Could not save theme/settings to PocketBase user record:', err);
  }
}

export async function updateUserProfilePB(updates: {
  name?: string;
  username?: string;
  avatar?: string;
  phoneNumber?: string;
  telegramChatId?: string;
  notifySms?: boolean;
  notifyTelegram?: boolean;
}): Promise<User> {
  if (!pb.authStore.isValid || !pb.authStore.model?.id) {
    throw new Error('کاربر وارد سیستم نشده است.');
  }
  const userId = pb.authStore.model.id;
  try {
    let updatedRecord: RecordModel | null = null;
    try {
      updatedRecord = await pb.collection('users').update(userId, updates);
    } catch (firstErr: any) {
      console.warn('PB update failed with custom fields, trying core fields if notification fields do not exist in schema yet:', firstErr);
      const coreUpdates = {
        name: updates.name,
        username: updates.username,
        avatar: updates.avatar,
      };
      updatedRecord = await pb.collection('users').update(userId, coreUpdates);
    }

    if (updatedRecord) {
      const mergedRecord = {
        ...updatedRecord,
        phoneNumber: updates.phoneNumber !== undefined ? updates.phoneNumber : (updatedRecord.phoneNumber || ''),
        telegramChatId: updates.telegramChatId !== undefined ? updates.telegramChatId : (updatedRecord.telegramChatId || ''),
        notifySms: updates.notifySms !== undefined ? updates.notifySms : (updatedRecord.notifySms !== false),
        notifyTelegram: updates.notifyTelegram !== undefined ? updates.notifyTelegram : (updatedRecord.notifyTelegram !== false),
      };
      pb.authStore.save(pb.authStore.token, mergedRecord);
      return mapRecordToUser(mergedRecord);
    }
    return mapRecordToUser(updatedRecord);
  } catch (err: any) {
    const msg = parsePBError(err);
    console.error('Could not save profile updates to PocketBase user record:', msg, err);
    throw new Error(msg);
  }
}

// System Notification Gateway Settings Persistence (SMS & Telegram)
const NOTIFICATION_SETTINGS_STORAGE_KEY = 'parstask_system_notification_settings';

export function getSystemNotificationSettingsPB(): SystemNotificationSettings {
  const defaultSettings: SystemNotificationSettings = {
    sms: {
      enabled: false,
      provider: 'kavenegar',
      apiKey: '',
      lineNumber: '',
      patternCode: '',
      apiUrl: 'https://api.kavenegar.com/v1/',
    },
    telegram: {
      enabled: false,
      botToken: '',
      botUsername: '',
      adminChatId: '',
      apiUrl: 'https://api.telegram.org',
    },
  };

  try {
    const raw = localStorage.getItem(NOTIFICATION_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        sms: { ...defaultSettings.sms, ...(parsed.sms || {}) },
        telegram: { ...defaultSettings.telegram, ...(parsed.telegram || {}) },
      };
    }
  } catch (e) {
    console.error('Error reading system notification settings:', e);
  }

  return defaultSettings;
}

export async function fetchSystemNotificationSettingsPB(): Promise<SystemNotificationSettings> {
  const current = getSystemNotificationSettingsPB();
  const collectionsToTry = ['system_setting', 'system_settings'];

  for (const colName of collectionsToTry) {
    try {
      let rec: any = null;
      try {
        rec = await pb.collection(colName).getFirstListItem('key="notifications"');
      } catch {
        try {
          rec = await pb.collection(colName).getFirstListItem("key='notifications'");
        } catch {}
      }

      if (rec && rec.value !== undefined) {
        let parsedVal: any = {};
        if (typeof rec.value === 'string') {
          try { parsedVal = JSON.parse(rec.value); } catch { parsedVal = {}; }
        } else if (typeof rec.value === 'object' && rec.value !== null) {
          parsedVal = rec.value;
        }

        const merged: SystemNotificationSettings = {
          sms: { ...current.sms, ...(parsedVal.sms || {}) },
          telegram: { ...current.telegram, ...(parsedVal.telegram || {}) },
        };
        localStorage.setItem(NOTIFICATION_SETTINGS_STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
    } catch (err) {
      console.warn(`Could not fetch notification settings from ${colName}:`, err);
    }
  }

  return current;
}

export async function saveSystemNotificationSettingsPB(settings: SystemNotificationSettings): Promise<void> {
  // Always update local cache for immediate feedback
  localStorage.setItem(NOTIFICATION_SETTINGS_STORAGE_KEY, JSON.stringify(settings));

  const jsonVal = JSON.stringify(settings);
  const collectionsToTry = ['system_setting', 'system_settings'];
  let lastError: any = null;
  let pbSaved = false;

  for (const colName of collectionsToTry) {
    try {
      let existing: any = null;
      try {
        existing = await pb.collection(colName).getFirstListItem('key="notifications"');
      } catch {
        try {
          existing = await pb.collection(colName).getFirstListItem("key='notifications'");
        } catch {}
      }

      // Payload - support both JSON or Text field types in PB
      const payload: Record<string, any> = {
        key: 'notifications',
        value: jsonVal,
      };

      if (existing) {
        try {
          await pb.collection(colName).update(existing.id, payload);
        } catch {
          // If string value failed (e.g. strict JSON type requirement), try object
          await pb.collection(colName).update(existing.id, { key: 'notifications', value: settings });
        }
      } else {
        try {
          await pb.collection(colName).create(payload);
        } catch {
          // If string value failed, try object payload
          await pb.collection(colName).create({ key: 'notifications', value: settings });
        }
      }

      pbSaved = true;
      break; // Successfully saved
    } catch (err: any) {
      lastError = err;
      console.warn(`Save to ${colName} failed:`, err);
    }
  }

  if (!pbSaved) {
    let msg = 'خطا در ذخیره‌سازی در پایگاه داده PocketBase.';
    if (lastError?.status === 403) {
      msg = 'دسترسی غیرمجاز (403): لطفاً قوانین API Rules کالکشن system_setting را در پنل پاکت‌بیس برای Create و Update باز یا تنظیم نمایید.';
    } else if (lastError?.status === 404) {
      msg = 'کالکشن system_setting در پاکت‌بیس یافت نشد. لطفاً این کالکشن را با فیلدهای key و value بسازید.';
    } else if (lastError?.message) {
      msg = `خطای پاکت‌بیس: ${lastError.message}`;
    }
    throw new Error(msg);
  }
}

export async function testSmsNotificationPB(phone: string, message?: string): Promise<{ success: boolean; message: string }> {
  if (!phone) {
    return { success: false, message: 'لطفاً شماره تلفن همراه را جهت تست وارد نمایید.' };
  }
  const config = getSystemNotificationSettingsPB();
  if (!config.sms.enabled) {
    return { success: false, message: 'ارسال پیامک در تنظیمات پارامتریک ادمین غیرفعال است.' };
  }

  const apiKey = config.sms.apiKey;
  const sender = config.sms.lineNumber;
  const msgText = message || '🔔 پیامک آزمایشی سامانه مدیریت فعالیت‌های پارس‌تسک (ParsTask)';

  if (!apiKey) {
    return { success: false, message: 'کلید API پیامک (API Key) تنظیم نشده است. لطفاً آن را در تنظیمات ادمین وارد کنید.' };
  }

  if (config.sms.provider === 'kavenegar') {
    try {
      const baseUrl = config.sms.apiUrl ? config.sms.apiUrl.replace(/\/+$/, '') : 'https://api.kavenegar.com/v1';
      const url = `${baseUrl}/${apiKey}/sms/send.json?receptor=${encodeURIComponent(phone)}&sender=${encodeURIComponent(sender || '')}&message=${encodeURIComponent(msgText)}`;
      const response = await fetch(url);
      const resData = await response.json();
      if (resData.return && (resData.return.status === 200 || resData.return.status === 201)) {
        return {
          success: true,
          message: `پیامک با موفقیت توسط کاوه نگار به شماره ${phone} ارسال گردید. (شناسه پیام: ${resData.entries?.[0]?.messageid || 'ثبت شد'})`,
        };
      } else {
        return {
          success: false,
          message: `خطای کاوه نگار (${resData.return?.status || 'ناشناخته'}): ${resData.return?.message || 'ارسال پیامک ناموفق بود.'}`,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `خطا در ارتباط با وب‌سرویس کاوه نگار: ${err.message || 'خطای شبکه'}`,
      };
    }
  }

  return {
    success: true,
    message: `درخواست تست پیامک به شماره ${phone} با موفقیت در درگاه (${config.sms.provider}) ثبت گردید.`,
  };
}

export async function testTelegramNotificationPB(chatId: string, text?: string): Promise<{ success: boolean; message: string }> {
  if (!chatId) {
    return { success: false, message: 'لطفاً شناسه چت تلگرام (Chat ID) را جهت تست وارد نمایید.' };
  }
  const config = getSystemNotificationSettingsPB();
  if (!config.telegram.enabled) {
    return { success: false, message: 'ارسال اطلاع‌رسانی تلگرام در تنظیمات پارامتریک ادمین غیرفعال است.' };
  }
  if (!config.telegram.botToken) {
    return { success: false, message: 'توکن ربات تلگرام (Bot Token) تنظیم نشده است.' };
  }

  try {
    const baseUrl = config.telegram.apiUrl || 'https://api.telegram.org';
    const response = await fetch(`${baseUrl}/bot${config.telegram.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text || '🔔 پیام آزمایشی سیستم مدیریت فعالیت‌های پارس‌تسک (ParsTask)',
      }),
    });
    const resData = await response.json();
    if (resData.ok) {
      return { success: true, message: `پیام آزمایشی تلگرام با موفقیت به شناسه چت ${chatId} ارسال گردید 🎉` };
    } else {
      return { success: false, message: `پاسخ تلگرام: ${resData.description || 'توکن ربات یا چت آیدی معتبر نیست.'}` };
    }
  } catch (err: any) {
    return { success: false, message: `خطا در اتصال به API تلگرام: ${err.message || 'شبکه غیرقابل دسترس است.'}` };
  }
}

export async function sendNewTaskNotificationsPB(task: Task): Promise<void> {
  try {
    const config = await fetchSystemNotificationSettingsPB().catch(() => getSystemNotificationSettingsPB());

    const smsEnabled = config?.sms?.enabled;
    const telegramEnabled = config?.telegram?.enabled;

    if (!smsEnabled && !telegramEnabled) {
      return;
    }

    const allUsers = await fetchAllUsersPB().catch(() => []);
    if (allUsers.length === 0) return;

    const recipientUserIds = new Set<string>();

    // 1. Direct Assignee User ID
    if (task.assignedUserId) {
      recipientUserIds.add(task.assignedUserId);
    }

    // 2. Direct Assignee User Name / Username match
    if (task.assignedUserName) {
      const matchName = task.assignedUserName.trim().toLowerCase();
      allUsers.forEach((u) => {
        if (
          (u.name && u.name.trim().toLowerCase() === matchName) ||
          (u.username && u.username.trim().toLowerCase() === matchName)
        ) {
          recipientUserIds.add(u.id);
        }
      });
    }

    // 3. Team Member IDs
    if (Array.isArray(task.teamMemberIds)) {
      task.teamMemberIds.forEach((id) => {
        if (id) recipientUserIds.add(id);
      });
    }

    // 4. Assigned Team Members
    if (task.assignedTeamId) {
      allUsers.forEach((u) => {
        if (Array.isArray(u.teams) && u.teams.some((t) => t.id === task.assignedTeamId)) {
          recipientUserIds.add(u.id);
        }
      });
    }

    // 5. Creator / Owner
    if (task.user) {
      recipientUserIds.add(task.user);
    }

    if (recipientUserIds.size === 0) {
      return;
    }

    const recipients = allUsers.filter((u) => recipientUserIds.has(u.id));

    const title = task.title || 'فعالیت جدید';
    const creator = task.ownerName || 'همکار';
    const assignee = task.assignedUserName || task.assignedTeamName || 'شما / تیم شما';
    const priority = (task.priority as string) === 'urgent' ? 'فوری' : task.priority === 'high' ? 'بالا' : task.priority === 'medium' ? 'متوسط' : 'پایین';
    let formattedDue = 'تعیین نشده';
    if (task.dueDate) {
      try {
        const d = parseDateSafely(task.dueDate) || new Date(task.dueDate);
        formattedDue = d.toLocaleDateString('fa-IR');
      } catch {
        formattedDue = task.dueDate;
      }
    }

    const smsText = `📋 پارس‌تسک: فعالیت جدید "${title}" به ${assignee} واگذار شد.\nایجادکننده: ${creator}\nاولویت: ${priority} | مهلت: ${formattedDue}`;

    const telegramText = `🔔 *فعالیت جدید در پارس‌تسک*\n\n📌 *عنوان:* ${title}\n👤 *ایجادکننده:* ${creator}\n🎯 *واگذار شده به:* ${assignee}\n⚡ *اولویت:* ${priority}\n📅 *مهلت تحویل:* ${formattedDue}\n\nجهت مشاهده و مدیریت فعالیت وارد سامانه شوید.`;

    for (const user of recipients) {
      if (smsEnabled && user.notifySms !== false && user.phoneNumber) {
        testSmsNotificationPB(user.phoneNumber, smsText).catch((e) =>
          console.warn(`Failed to send SMS to user ${user.name || user.id}:`, e)
        );
      }

      if (telegramEnabled && user.notifyTelegram !== false && user.telegramChatId) {
        testTelegramNotificationPB(user.telegramChatId, telegramText).catch((e) =>
          console.warn(`Failed to send Telegram to user ${user.name || user.id}:`, e)
        );
      }
    }
  } catch (err) {
    console.warn('Error in sendNewTaskNotificationsPB:', err);
  }
}

// Local metadata storage helper for tasks (comments, team member IDs, owner info)
function getTaskExtraMeta(taskId: string): Partial<Task> {
  try {
    const raw = localStorage.getItem(`parstask_meta_${taskId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveTaskExtraMeta(taskId: string, meta: Partial<Task>): void {
  try {
    const existing = getTaskExtraMeta(taskId);
    const updated = { ...existing, ...meta };
    localStorage.setItem(`parstask_meta_${taskId}`, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save task extra meta:', e);
  }
}

export function mapRecordToTask(record: RecordModel): Task {
  let parsedAttachments: Attachment[] = [];
  if (Array.isArray(record.attachments)) {
    parsedAttachments = record.attachments;
  } else if (typeof record.attachments === 'string' && record.attachments.trim().length > 0) {
    try {
      parsedAttachments = JSON.parse(record.attachments);
    } catch (e) {
      console.error('Error parsing attachments JSON:', e);
      parsedAttachments = [];
    }
  }

  let parsedComments = Array.isArray(record.comments) ? record.comments : [];
  if (typeof record.comments === 'string' && record.comments.trim().length > 0) {
    try {
      parsedComments = JSON.parse(record.comments);
    } catch (e) {
      parsedComments = [];
    }
  }

  let parsedTeamMemberIds = Array.isArray(record.teamMemberIds) ? record.teamMemberIds : [];
  if (typeof record.teamMemberIds === 'string' && record.teamMemberIds.trim().length > 0) {
    try {
      parsedTeamMemberIds = JSON.parse(record.teamMemberIds);
    } catch (e) {
      parsedTeamMemberIds = [];
    }
  }

  let parsedTags = Array.isArray(record.tags) ? record.tags : [];
  if (typeof record.tags === 'string' && record.tags.trim().length > 0) {
    try {
      parsedTags = JSON.parse(record.tags);
    } catch (e) {
      parsedTags = record.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    }
  }

  // Format date to ISO string safely without timezone offset shifts
  let formattedDueDate = record.dueDate;
  if (formattedDueDate) {
    const d = parseDateSafely(formattedDueDate);
    if (d) {
      formattedDueDate = d.toISOString();
    }
  }

  const extraMeta = getTaskExtraMeta(record.id);

  let formattedActualCompletionDate = record.actualCompletionDate || extraMeta.actualCompletionDate || undefined;
  if (formattedActualCompletionDate) {
    const d = parseDateSafely(formattedActualCompletionDate);
    if (d) {
      formattedActualCompletionDate = d.toISOString();
    }
  }

  const defaultOwnerName = (pb.authStore.isValid && pb.authStore.model?.id === record.user)
    ? (pb.authStore.model?.name || pb.authStore.model?.username)
    : undefined;
  const defaultOwnerAvatar = (pb.authStore.isValid && pb.authStore.model?.id === record.user)
    ? formatAvatarUrl(pb.authStore.model)
    : undefined;

  let parsedProjectCharter = record.projectCharter || extraMeta.projectCharter || undefined;
  if (typeof record.projectCharter === 'string' && record.projectCharter.trim().length > 0) {
    try {
      parsedProjectCharter = JSON.parse(record.projectCharter);
    } catch (e) {
      parsedProjectCharter = extraMeta.projectCharter;
    }
  }

  let parsedProjectSubTasks = Array.isArray(record.projectSubTasks)
    ? record.projectSubTasks
    : (extraMeta.projectSubTasks || []);
  if (typeof record.projectSubTasks === 'string' && record.projectSubTasks.trim().length > 0) {
    try {
      parsedProjectSubTasks = JSON.parse(record.projectSubTasks);
    } catch (e) {
      parsedProjectSubTasks = extraMeta.projectSubTasks || [];
    }
  }

  let parsedRecurringConfig = record.recurringConfig || extraMeta.recurringConfig || undefined;
  if (typeof record.recurringConfig === 'string' && record.recurringConfig.trim().length > 0) {
    try {
      parsedRecurringConfig = JSON.parse(record.recurringConfig);
    } catch (e) {
      parsedRecurringConfig = extraMeta.recurringConfig;
    }
  }

  return {
    id: record.id,
    title: record.title || extraMeta.title || '',
    description: record.description || extraMeta.description || '',
    dueDate: formattedDueDate || extraMeta.dueDate || new Date().toISOString(),
    actualCompletionDate: formattedActualCompletionDate,
    priority: (record.priority as Priority) || extraMeta.priority || 'medium',
    status: (record.status as TaskStatus) || extraMeta.status || 'todo',
    attachments: parsedAttachments.length > 0 ? parsedAttachments : (extraMeta.attachments || []),
    user: record.user || extraMeta.user || undefined,
    ownerName: record.ownerName || extraMeta.ownerName || defaultOwnerName || undefined,
    ownerAvatar: record.ownerAvatar || extraMeta.ownerAvatar || defaultOwnerAvatar || undefined,
    assignedUserId: record.assignedUserId || extraMeta.assignedUserId || undefined,
    assignedUserName: record.assignedUserName || extraMeta.assignedUserName || undefined,
    assignedUserAvatar: record.assignedUserAvatar || extraMeta.assignedUserAvatar || undefined,
    assignedTeamId: record.assignedTeamId || extraMeta.assignedTeamId || undefined,
    assignedTeamName: record.assignedTeamName || extraMeta.assignedTeamName || undefined,
    teamMemberIds: parsedTeamMemberIds.length > 0 ? parsedTeamMemberIds : (extraMeta.teamMemberIds || []),
    allowAssigneeStatusUpdate: typeof record.allowAssigneeStatusUpdate === 'boolean'
      ? record.allowAssigneeStatusUpdate
      : typeof extraMeta.allowAssigneeStatusUpdate === 'boolean'
      ? extraMeta.allowAssigneeStatusUpdate
      : true,
    tags: parsedTags.length > 0 ? parsedTags : (extraMeta.tags || []),
    isProject: typeof record.isProject === 'boolean' ? record.isProject : extraMeta.isProject || false,
    isRecurring: typeof record.isRecurring === 'boolean' ? record.isRecurring : extraMeta.isRecurring || false,
    recurringConfig: parsedRecurringConfig,
    projectCharter: parsedProjectCharter,
    projectSubTasks: parsedProjectSubTasks,
    comments: parsedComments.length > 0 ? parsedComments : (extraMeta.comments || []),
    logs: extraMeta.logs || [],
    createdAt: record.created || record.createdAt || extraMeta.createdAt || new Date().toISOString(),
    updatedAt: record.updated || record.updatedAt || extraMeta.updatedAt || new Date().toISOString(),
  };
}

export async function fetchTasksFromPB(): Promise<Task[]> {
  try {
    // Fetch all tasks so team members, assignees and owners can see shared team tasks
    const records = await pb.collection('tasks').getFullList({
      sort: '-created',
    });

    // Try to fetch all task comments from 'task_comments' collection
    const commentsByTaskId = new Map<string, TaskComment[]>();
    try {
      const allComments = await pb.collection('task_comments').getFullList({
        sort: '-created',
      });
      allComments.forEach((r) => {
        const tId = r.taskId;
        if (tId) {
          let parsedAtts: Attachment[] = [];
          if (Array.isArray(r.attachments)) {
            parsedAtts = r.attachments;
          } else if (typeof r.attachments === 'string' && r.attachments.trim().length > 0) {
            try {
              parsedAtts = JSON.parse(r.attachments);
            } catch {}
          }

          const cItem: TaskComment = {
            id: r.id,
            taskId: tId,
            userId: r.userId || '',
            userName: r.userName || 'کاربر',
            userAvatar: r.userAvatar || undefined,
            text: r.text || '',
            attachments: parsedAtts.length > 0 ? parsedAtts : undefined,
            createdAt: r.created || r.createdAt || new Date().toISOString(),
          };
          const existing = commentsByTaskId.get(tId) || [];
          existing.push(cItem);
          commentsByTaskId.set(tId, existing);
        }
      });
    } catch (e) {
      // Offline fallback
    }

    // Try to fetch all task logs from 'task_logs' collection
    const logsByTaskId = new Map<string, TaskLog[]>();
    try {
      const allLogs = await pb.collection('task_logs').getFullList({
        sort: '-created',
      });
      allLogs.forEach((r) => {
        const tId = r.taskId;
        if (tId) {
          const logItem: TaskLog = {
            id: r.id,
            taskId: tId,
            userId: r.userId || '',
            userName: r.userName || 'کاربر',
            userAvatar: r.userAvatar || undefined,
            action: r.action || 'تغییر فعالیت',
            details: r.details || '',
            createdAt: r.created || r.createdAt || new Date().toISOString(),
          };
          const existing = logsByTaskId.get(tId) || [];
          existing.push(logItem);
          logsByTaskId.set(tId, existing);
        }
      });
    } catch (e) {
      // Offline fallback to local extraMeta logs
    }

    const tasks = records.map((rec) => {
      const task = mapRecordToTask(rec);
      const fetchedComments = commentsByTaskId.get(task.id);
      if (fetchedComments && fetchedComments.length > 0) {
        task.comments = fetchedComments;
      }
      const fetchedLogs = logsByTaskId.get(task.id);
      if (fetchedLogs && fetchedLogs.length > 0) {
        task.logs = fetchedLogs;
      }
      return task;
    });

    try {
      localStorage.setItem('parstask_tasks_cache_v2', JSON.stringify(tasks));
    } catch {}

    return tasks;
  } catch (error) {
    console.warn('Failed to fetch tasks from PocketBase, checking offline local cache:', error);
    try {
      const cached = localStorage.getItem('parstask_tasks_cache_v2');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {}
    return [];
  }
}

function buildBasePayload(taskData: Partial<Task>, isCreate = false) {
  const payload: Record<string, any> = {};

  if (taskData.title !== undefined) payload.title = taskData.title;
  if (taskData.description !== undefined) payload.description = taskData.description || '';
  if (taskData.priority !== undefined) payload.priority = taskData.priority;
  if (taskData.status !== undefined) payload.status = taskData.status;

  if (taskData.ownerName !== undefined) payload.ownerName = taskData.ownerName;
  if (taskData.ownerAvatar !== undefined) payload.ownerAvatar = taskData.ownerAvatar;
  if (taskData.assignedUserId !== undefined) payload.assignedUserId = taskData.assignedUserId;
  if (taskData.assignedUserName !== undefined) payload.assignedUserName = taskData.assignedUserName;
  if (taskData.assignedUserAvatar !== undefined) payload.assignedUserAvatar = taskData.assignedUserAvatar;
  if (taskData.assignedTeamId !== undefined) payload.assignedTeamId = taskData.assignedTeamId;
  if (taskData.assignedTeamName !== undefined) payload.assignedTeamName = taskData.assignedTeamName;
  if (taskData.teamMemberIds !== undefined) payload.teamMemberIds = taskData.teamMemberIds;
  if (taskData.allowAssigneeStatusUpdate !== undefined) payload.allowAssigneeStatusUpdate = taskData.allowAssigneeStatusUpdate;
  if (taskData.tags !== undefined) payload.tags = taskData.tags;
  if (taskData.isProject !== undefined) payload.isProject = taskData.isProject;
  if (taskData.isRecurring !== undefined) payload.isRecurring = taskData.isRecurring;
  if (taskData.recurringConfig !== undefined) payload.recurringConfig = taskData.recurringConfig;
  if (taskData.projectCharter !== undefined) payload.projectCharter = taskData.projectCharter;
  if (taskData.projectSubTasks !== undefined) payload.projectSubTasks = taskData.projectSubTasks;
  // NOTE: task_comments are now managed exclusively in the dedicated 'task_comments' collection!

  if (taskData.dueDate) {
    const d = parseDateSafely(taskData.dueDate) || new Date(taskData.dueDate);
    payload.dueDate = isNaN(d.getTime()) ? taskData.dueDate : d.toISOString();
  }

  if (taskData.actualCompletionDate !== undefined) {
    if (taskData.actualCompletionDate) {
      const d = parseDateSafely(taskData.actualCompletionDate) || new Date(taskData.actualCompletionDate);
      payload.actualCompletionDate = isNaN(d.getTime()) ? taskData.actualCompletionDate : d.toISOString();
    } else {
      payload.actualCompletionDate = '';
    }
  }

  // Attach creator user ID ONLY when creating a new task or if user is explicitly provided
  if (isCreate) {
    if (taskData.user) {
      payload.user = taskData.user;
    } else if (pb.authStore.isValid && pb.authStore.model?.id) {
      payload.user = pb.authStore.model.id;
    }
  } else if (taskData.user !== undefined) {
    payload.user = taskData.user;
  }

  return payload;
}

export async function createTaskInPB(
  taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Task> {
  const basePayload = buildBasePayload(taskData, true);
  const attachments = taskData.attachments || [];

  // Helper to execute create with auto-retry stripping failing fields
  const tryCreate = async (payload: Record<string, any>): Promise<RecordModel> => {
    try {
      return await pb.collection('tasks').create(payload);
    } catch (err: any) {
      const fieldErrors = err?.data || err?.response?.data;
      if (fieldErrors && typeof fieldErrors === 'object') {
        const errorKeys = Object.keys(fieldErrors);
        let cleanedPayload = { ...payload };
        let modified = false;

        for (const key of errorKeys) {
          if (key in cleanedPayload) {
            delete cleanedPayload[key];
            modified = true;
          }
        }

        if (modified) {
          console.warn('PocketBase validation failed on fields:', errorKeys, 'Retrying without failing fields...');
          return await pb.collection('tasks').create(cleanedPayload);
        }
      }
      throw err;
    }
  };

  // Attempt 1: Send with array attachments
  let createdRecord: RecordModel | undefined;
  try {
    createdRecord = await tryCreate({
      ...basePayload,
      attachments: attachments,
    });
  } catch (err1: any) {
    console.warn('Attempt 1 failed, trying stringified attachments format...', err1?.data || err1);

    // Attempt 2: Send with stringified attachments
    try {
      createdRecord = await tryCreate({
        ...basePayload,
        attachments: JSON.stringify(attachments),
      });
    } catch (err2: any) {
      console.warn('Attempt 2 failed, trying without attachments field...', err2?.data || err2);

      // Attempt 3: Omit attachments field
      try {
        createdRecord = await tryCreate(basePayload);
      } catch (err3: any) {
        const parsedMsg = parsePBError(err3 || err1);
        console.error('All attempts to create task in PocketBase failed:', parsedMsg);
        throw new Error(parsedMsg);
      }
    }
  }

  // Save full task metadata (owner, assignee, teams, recurring, project) locally as backup
  if (createdRecord) {
    saveTaskExtraMeta(createdRecord.id, taskData);
    const newTask = mapRecordToTask(createdRecord);

    // Automatically trigger SMS and Telegram notifications for assignee and team members
    sendNewTaskNotificationsPB(newTask).catch((err) =>
      console.warn('Task creation notification dispatch error:', err)
    );

    return newTask;
  }
  throw new Error('خطا در ایجاد فعالیت');
}

export async function updateTaskInPB(
  taskId: string,
  taskData: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Task> {
  const basePayload = buildBasePayload(taskData);

  // Always save task extra meta immediately
  saveTaskExtraMeta(taskId, taskData);

  const tryUpdate = async (payload: Record<string, any>): Promise<RecordModel> => {
    try {
      return await pb.collection('tasks').update(taskId, payload);
    } catch (err: any) {
      const fieldErrors = err?.data || err?.response?.data;
      if (fieldErrors && typeof fieldErrors === 'object') {
        const errorKeys = Object.keys(fieldErrors);
        let cleanedPayload = { ...payload };
        let modified = false;

        for (const key of errorKeys) {
          if (key in cleanedPayload) {
            delete cleanedPayload[key];
            modified = true;
          }
        }

        if (modified && Object.keys(cleanedPayload).length > 0) {
          console.warn('PocketBase update validation failed on fields:', errorKeys, 'Retrying update...');
          return await pb.collection('tasks').update(taskId, cleanedPayload);
        }
      }
      throw err;
    }
  };

  let updatedRecord: RecordModel | undefined;

  // Attempt 1: Send with array attachments if provided
  try {
    const payload = { ...basePayload };
    if (taskData.attachments !== undefined) {
      payload.attachments = taskData.attachments;
    }
    updatedRecord = await tryUpdate(payload);
  } catch (err1: any) {
    // Attempt 2: Send with stringified attachments if provided
    try {
      const payload = { ...basePayload };
      if (taskData.attachments !== undefined) {
        payload.attachments = JSON.stringify(taskData.attachments);
      }
      updatedRecord = await tryUpdate(payload);
    } catch (err2: any) {
      // Attempt 3: Without attachments
      try {
        updatedRecord = await tryUpdate(basePayload);
      } catch (err3: any) {
        const parsedMsg = parsePBError(err3 || err1);
        console.error(`All attempts to update task ${taskId} in PocketBase failed:`, parsedMsg);
        throw new Error(parsedMsg);
      }
    }
  }

  saveTaskExtraMeta(updatedRecord.id, taskData);
  return mapRecordToTask(updatedRecord);
}

export async function deleteTaskFromPB(taskId: string): Promise<boolean> {
  try {
    await pb.collection('tasks').delete(taskId);
    return true;
  } catch (error: any) {
    const parsedMsg = parsePBError(error);
    console.error(`Failed to delete task ${taskId} from PocketBase:`, parsedMsg);
    throw new Error(parsedMsg);
  }
}

export function subscribeToTasksPB(onChange: () => void): () => void {
  let unsubTasks: (() => void) | null = null;
  let unsubComments: (() => void) | null = null;
  let unsubLogs: (() => void) | null = null;

  pb.collection('tasks').subscribe('*', () => {
    onChange();
  }).then((unsub) => {
    unsubTasks = unsub;
  }).catch(() => {});

  pb.collection('task_comments').subscribe('*', () => {
    onChange();
  }).then((unsub) => {
    unsubComments = unsub;
  }).catch(() => {});

  pb.collection('task_logs').subscribe('*', () => {
    onChange();
  }).then((unsub) => {
    unsubLogs = unsub;
  }).catch(() => {});

  return () => {
    if (unsubTasks) unsubTasks();
    else pb.collection('tasks').unsubscribe('*').catch(() => {});

    if (unsubComments) unsubComments();
    else pb.collection('task_comments').unsubscribe('*').catch(() => {});

    if (unsubLogs) unsubLogs();
    else pb.collection('task_logs').unsubscribe('*').catch(() => {});
  };
}

// Dedicated PocketBase collection: 'task_comments'
export async function fetchCommentsForTaskPB(taskId: string): Promise<TaskComment[]> {
  try {
    let records: any[] = [];
    try {
      records = await pb.collection('task_comments').getFullList({
        filter: `taskId = "${taskId}" || tadId = "${taskId}" || tasId = "${taskId}" || task = "${taskId}"`,
        sort: '-created',
      });
    } catch {
      // Fallback if multi-filter fails due to unknown fields in PB
      try {
        records = await pb.collection('task_comments').getFullList({
          filter: `taskId = "${taskId}"`,
          sort: '-created',
        });
      } catch {
        try {
          records = await pb.collection('task_comments').getFullList({
            filter: `tadId = "${taskId}"`,
            sort: '-created',
          });
        } catch {
          records = await pb.collection('task_comments').getFullList({
            sort: '-created',
          });
          records = records.filter(
            (r) => (r.taskId || r.tadId || r.tasId || r.task) === taskId
          );
        }
      }
    }

    return records.map((r) => {
      let parsedAtts: Attachment[] = [];
      if (Array.isArray(r.attachments)) {
        parsedAtts = r.attachments;
      } else if (typeof r.attachments === 'string' && r.attachments.trim().length > 0) {
        try {
          parsedAtts = JSON.parse(r.attachments);
        } catch {}
      }

      return {
        id: r.id,
        taskId: r.taskId || r.tadId || r.tasId || r.task || taskId,
        userId: r.userId || '',
        userName: r.userName || 'کاربر',
        userAvatar: r.userAvatar || undefined,
        text: r.text || '',
        attachments: parsedAtts.length > 0 ? parsedAtts : undefined,
        createdAt: r.created || r.createdAt || new Date().toISOString(),
      };
    });
  } catch (err) {
    console.warn(`Collection 'task_comments' query failed or offline fallback active for task ${taskId}:`, err);
    // Fallback to local extraMeta
    const extraMeta = getTaskExtraMeta(taskId);
    const comments = extraMeta.comments || [];
    return [...comments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
}

export async function createTaskCommentPB(commentData: {
  taskId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  attachments?: Attachment[];
}): Promise<TaskComment> {
  const payload: Record<string, any> = {
    taskId: commentData.taskId,
    tasId: commentData.taskId,
    tadId: commentData.taskId,
    task: commentData.taskId,
    userId: commentData.userId,
    userName: commentData.userName,
    userAvatar: commentData.userAvatar || '',
    text: commentData.text,
  };
  if (commentData.attachments && commentData.attachments.length > 0) {
    payload.attachments = commentData.attachments;
  }

  try {
    let record: any;
    try {
      record = await pb.collection('task_comments').create(payload);
    } catch {
      // If schema in PocketBase rejects attachments field, retry without it in PB payload
      const fallbackPayload = { ...payload };
      delete fallbackPayload.attachments;
      record = await pb.collection('task_comments').create(fallbackPayload);
    }

    let atts = commentData.attachments;
    if (!atts && record?.attachments) {
      if (Array.isArray(record.attachments)) atts = record.attachments;
      else if (typeof record.attachments === 'string') {
        try { atts = JSON.parse(record.attachments); } catch {}
      }
    }

    return {
      id: record.id,
      taskId: record.taskId || record.tadId || record.tasId || record.task || commentData.taskId,
      userId: record.userId,
      userName: record.userName,
      userAvatar: record.userAvatar || undefined,
      text: record.text,
      attachments: atts && atts.length > 0 ? atts : undefined,
      createdAt: record.created || new Date().toISOString(),
    };
  } catch (err) {
    console.warn("Saving to 'task_comments' collection failed. Generating local ID...", err);
    return {
      id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      taskId: commentData.taskId,
      userId: commentData.userId,
      userName: commentData.userName,
      userAvatar: commentData.userAvatar,
      text: commentData.text,
      attachments: commentData.attachments && commentData.attachments.length > 0 ? commentData.attachments : undefined,
      createdAt: new Date().toISOString(),
    };
  }
}

export async function deleteTaskCommentPB(commentId: string): Promise<boolean> {
  try {
    await pb.collection('task_comments').delete(commentId);
    return true;
  } catch (err) {
    console.warn(`Deleting comment ${commentId} from 'task_comments' failed:`, err);
    return false;
  }
}

// Dedicated PocketBase collection: 'task_logs'
export async function fetchTaskLogsPB(taskId: string): Promise<TaskLog[]> {
  try {
    let records: any[] = [];
    try {
      records = await pb.collection('task_logs').getFullList({
        filter: `taskId = "${taskId}" || tasId = "${taskId}" || tadId = "${taskId}" || task = "${taskId}"`,
        sort: '-created',
      });
    } catch {
      try {
        records = await pb.collection('task_logs').getFullList({
          filter: `taskId = "${taskId}"`,
          sort: '-created',
        });
      } catch {
        try {
          records = await pb.collection('task_logs').getFullList({
            filter: `tasId = "${taskId}"`,
            sort: '-created',
          });
        } catch {
          records = await pb.collection('task_logs').getFullList({
            sort: '-created',
          });
          records = records.filter(
            (r) => (r.taskId || r.tasId || r.tadId || r.task) === taskId
          );
        }
      }
    }

    return records.map((r) => ({
      id: r.id,
      taskId: r.taskId || r.tasId || r.tadId || r.task || taskId,
      userId: r.userId || '',
      userName: r.userName || 'کاربر',
      userAvatar: r.userAvatar || undefined,
      action: r.action || 'تغییر فعالیت',
      details: r.details || '',
      createdAt: r.created || r.createdAt || new Date().toISOString(),
    }));
  } catch (err) {
    // Fallback: load from local storage extraMeta logs
    const extraMeta = getTaskExtraMeta(taskId);
    return extraMeta.logs || [];
  }
}

export async function createTaskLogPB(logData: {
  taskId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  action: string;
  details?: string;
}): Promise<TaskLog> {
  const newLog: TaskLog = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    taskId: logData.taskId,
    userId: logData.userId,
    userName: logData.userName,
    userAvatar: logData.userAvatar,
    action: logData.action,
    details: logData.details,
    createdAt: new Date().toISOString(),
  };

  // Try saving to PocketBase
  try {
    const record = await pb.collection('task_logs').create({
      taskId: logData.taskId,
      tasId: logData.taskId,
      tadId: logData.taskId,
      task: logData.taskId,
      userId: logData.userId,
      userName: logData.userName,
      userAvatar: logData.userAvatar || '',
      action: logData.action,
      details: logData.details || '',
    });
    newLog.id = record.id;
    if (record.created) newLog.createdAt = record.created;
  } catch (err) {
    console.warn("Saving to 'task_logs' collection failed or offline. Storing in local extraMeta...", err);
  }

  // Also save to local extraMeta as fallback
  const extraMeta = getTaskExtraMeta(logData.taskId);
  const existingLogs = extraMeta.logs || [];
  saveTaskExtraMeta(logData.taskId, {
    logs: [newLog, ...existingLogs],
  });

  return newLog;
}

// ==========================================
// DIRECT MESSAGES (CHAT) API & LOCAL STORAGE
// ==========================================
const LOCAL_DIRECT_MESSAGES_KEY = 'parstask_direct_messages_v1';

function getLocalDirectMessages(): DirectMessage[] {
  try {
    const raw = localStorage.getItem(LOCAL_DIRECT_MESSAGES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalDirectMessages(messages: DirectMessage[]) {
  try {
    localStorage.setItem(LOCAL_DIRECT_MESSAGES_KEY, JSON.stringify(messages));
  } catch (e) {
    console.error('Failed to save direct messages locally:', e);
  }
}

export async function fetchDirectMessagesPB(currentUserId: string, partnerId: string): Promise<DirectMessage[]> {
  if (!currentUserId || !partnerId) return [];

  try {
    const filterStr = `(senderId = "${currentUserId}" && receiverId = "${partnerId}") || (senderId = "${partnerId}" && receiverId = "${currentUserId}")`;
    const records = await pb.collection('direct_messages').getFullList({
      filter: filterStr,
      sort: 'created',
    });

    return records.map((r: any) => ({
      id: r.id,
      senderId: r.senderId || r.sender || '',
      senderName: r.senderName || 'کاربر',
      senderAvatar: r.senderAvatar || undefined,
      receiverId: r.receiverId || r.receiver || '',
      text: r.text || '',
      attachmentUrl: r.attachmentUrl || undefined,
      attachmentName: r.attachmentName || undefined,
      isRead: !!r.isRead,
      createdAt: r.created || r.createdAt || new Date().toISOString(),
    }));
  } catch {
    // Fallback to local storage
    const localMsgs = getLocalDirectMessages();
    return localMsgs.filter(
      (m) =>
        (m.senderId === currentUserId && m.receiverId === partnerId) ||
        (m.senderId === partnerId && m.receiverId === currentUserId)
    );
  }
}

export async function sendDirectMessagePB(msgData: {
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  receiverId: string;
  text: string;
  attachmentUrl?: string;
  attachmentName?: string;
}): Promise<DirectMessage> {
  const newMsg: DirectMessage = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    senderId: msgData.senderId,
    senderName: msgData.senderName,
    senderAvatar: msgData.senderAvatar,
    receiverId: msgData.receiverId,
    text: msgData.text,
    attachmentUrl: msgData.attachmentUrl,
    attachmentName: msgData.attachmentName,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  try {
    const rec = await pb.collection('direct_messages').create({
      senderId: msgData.senderId,
      senderName: msgData.senderName,
      senderAvatar: msgData.senderAvatar || '',
      receiverId: msgData.receiverId,
      text: msgData.text,
      attachmentUrl: msgData.attachmentUrl || '',
      attachmentName: msgData.attachmentName || '',
      isRead: false,
    });
    newMsg.id = rec.id;
    if (rec.created) newMsg.createdAt = rec.created;
  } catch (err) {
    console.warn("Saving to 'direct_messages' collection failed or offline. Storing locally...", err);
  }

  // Always update local cache
  const localMsgs = getLocalDirectMessages();
  saveLocalDirectMessages([...localMsgs, newMsg]);

  return newMsg;
}

export async function markDirectMessagesAsReadPB(senderId: string, receiverId: string): Promise<void> {
  if (!senderId || !receiverId) return;

  try {
    const unread = await pb.collection('direct_messages').getFullList({
      filter: `senderId = "${senderId}" && receiverId = "${receiverId}" && isRead = false`,
    });

    for (const r of unread) {
      await pb.collection('direct_messages').update(r.id, { isRead: true }).catch(() => {});
    }
  } catch {}

  // Update local
  const localMsgs = getLocalDirectMessages();
  const updated = localMsgs.map((m) =>
    m.senderId === senderId && m.receiverId === receiverId ? { ...m, isRead: true } : m
  );
  saveLocalDirectMessages(updated);
}

export async function updateDirectMessagePB(messageId: string, text: string): Promise<void> {
  if (!messageId) return;
  try {
    await pb.collection('direct_messages').update(messageId, { text });
  } catch (err) {
    console.warn('Failed to update direct message in PB:', err);
  }

  const localMsgs = getLocalDirectMessages();
  const updated = localMsgs.map((m) => (m.id === messageId ? { ...m, text } : m));
  saveLocalDirectMessages(updated);
}

export async function deleteDirectMessagePB(messageId: string): Promise<void> {
  if (!messageId) return;
  try {
    await pb.collection('direct_messages').delete(messageId);
  } catch (err) {
    console.warn('Failed to delete direct message in PB:', err);
  }

  const localMsgs = getLocalDirectMessages();
  const filtered = localMsgs.filter((m) => m.id !== messageId);
  saveLocalDirectMessages(filtered);
}

export async function fetchUnreadMessageCountsPB(currentUserId: string): Promise<Record<string, number>> {
  if (!currentUserId) return {};
  const counts: Record<string, number> = {};

  try {
    const unreadList = await pb.collection('direct_messages').getFullList({
      filter: `receiverId = "${currentUserId}" && isRead = false`,
    });

    unreadList.forEach((r: any) => {
      const sId = r.senderId || r.sender;
      if (sId) {
        counts[sId] = (counts[sId] || 0) + 1;
      }
    });
    return counts;
  } catch {
    const localMsgs = getLocalDirectMessages();
    localMsgs.forEach((m) => {
      if (m.receiverId === currentUserId && !m.isRead) {
        counts[m.senderId] = (counts[m.senderId] || 0) + 1;
      }
    });
    return counts;
  }
}


// ==========================================
// PERSONAL NOTES API & LOCAL STORAGE
// ==========================================
// PERSONAL NOTES SERVICE
// ==========================================
function encodeNoteContent(content: string, attachments?: NoteAttachment[]): string {
  if (!attachments || attachments.length === 0) return content || '';
  return `${content || ''}\n\n<!--ATTACHMENTS_DATA:${JSON.stringify(attachments)}-->`;
}

function decodeNoteContent(rawContent: string, rawAttachments?: any): { content: string; attachments: NoteAttachment[] } {
  let attachments: NoteAttachment[] = [];
  
  if (Array.isArray(rawAttachments) && rawAttachments.length > 0) {
    attachments = rawAttachments;
  } else if (typeof rawAttachments === 'string' && rawAttachments.trim().startsWith('[')) {
    try { attachments = JSON.parse(rawAttachments); } catch {}
  }

  let content = rawContent || '';
  const match = content.match(/<!--ATTACHMENTS_DATA:(.*?)-->/s);
  if (match) {
    try {
      if (attachments.length === 0) {
        attachments = JSON.parse(match[1]);
      }
    } catch {}
    content = content.replace(/<!--ATTACHMENTS_DATA:(.*?)-->/s, '').trim();
  }

  return { content, attachments };
}

function getLocalPersonalNotes(userId: string): PersonalNote[] {
  try {
    const raw = localStorage.getItem(`parstask_notes_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalPersonalNotes(userId: string, notes: PersonalNote[]) {
  try {
    localStorage.setItem(`parstask_notes_${userId}`, JSON.stringify(notes));
  } catch (e) {
    console.error('Failed to save personal notes locally:', e);
  }
}

export async function fetchPersonalNotesPB(userId: string): Promise<PersonalNote[]> {
  if (!userId) return [];

  // 1. Sync any local unsynced notes (created offline or when PB failed)
  const localNotes = getLocalPersonalNotes(userId);
  const unsyncedNotes = localNotes.filter(n => n.id && n.id.startsWith('note_'));
  
  if (unsyncedNotes.length > 0) {
    for (const un of unsyncedNotes) {
      try {
        const rawContent = encodeNoteContent(un.content, un.attachments);
        const rec = await pb.collection('personal_notes').create({
          userId,
          title: un.title || '',
          content: rawContent,
          color: un.color || 'amber',
          isPinned: !!un.isPinned,
          tags: un.tags || [],
        });
        un.id = rec.id;
      } catch (err) {
        console.warn('Failed to auto-sync local note to PocketBase:', err);
      }
    }
    saveLocalPersonalNotes(userId, localNotes);
  }

  // 2. Fetch all notes from PocketBase
  try {
    const records = await pb.collection('personal_notes').getFullList({
      filter: `userId = "${userId}"`,
      sort: '-created',
    });

    const remoteNotes: PersonalNote[] = records.map((r: any) => {
      const { content, attachments } = decodeNoteContent(r.content, r.attachments);
      return {
        id: r.id,
        userId: r.userId || userId,
        title: r.title || '',
        content,
        color: r.color || 'amber',
        isPinned: !!r.isPinned,
        tags: Array.isArray(r.tags) ? r.tags : typeof r.tags === 'string' ? JSON.parse(r.tags) : [],
        attachments,
        createdAt: r.created || r.createdAt || new Date().toISOString(),
        updatedAt: r.updated || r.updatedAt,
      };
    });

    saveLocalPersonalNotes(userId, remoteNotes);
    return remoteNotes;
  } catch (err) {
    console.warn("Failed fetching personal notes from PB, using local storage fallback:", err);
    return getLocalPersonalNotes(userId);
  }
}

export async function createPersonalNotePB(
  userId: string,
  noteData: { title: string; content: string; color?: string; isPinned?: boolean; tags?: string[]; attachments?: NoteAttachment[] }
): Promise<PersonalNote> {
  const newNote: PersonalNote = {
    id: 'note_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    userId,
    title: noteData.title,
    content: noteData.content,
    color: noteData.color || 'amber',
    isPinned: !!noteData.isPinned,
    tags: noteData.tags || [],
    attachments: noteData.attachments || [],
    createdAt: new Date().toISOString(),
  };

  try {
    const rawContent = encodeNoteContent(noteData.content, noteData.attachments);
    const rec = await pb.collection('personal_notes').create({
      userId,
      title: noteData.title || '',
      content: rawContent,
      color: noteData.color || 'amber',
      isPinned: !!noteData.isPinned,
      tags: noteData.tags || [],
    });
    newNote.id = rec.id;
    if (rec.created) newNote.createdAt = rec.created;
  } catch (err) {
    console.warn("Saving to 'personal_notes' collection failed or offline. Storing locally...", err);
  }

  const localNotes = getLocalPersonalNotes(userId);
  saveLocalPersonalNotes(userId, [newNote, ...localNotes]);

  return newNote;
}

export async function updatePersonalNotePB(
  id: string,
  userId: string,
  updates: Partial<PersonalNote>
): Promise<PersonalNote> {
  let updatedNote: PersonalNote | null = null;

  try {
    const pbUpdates: Record<string, any> = {};
    if (updates.title !== undefined) pbUpdates.title = updates.title;
    if (updates.color !== undefined) pbUpdates.color = updates.color;
    if (updates.isPinned !== undefined) pbUpdates.isPinned = updates.isPinned;
    if (updates.tags !== undefined) pbUpdates.tags = updates.tags;

    if (updates.content !== undefined || updates.attachments !== undefined) {
      // Find current note to preserve content or attachments if one is omitted in updates
      const currentLocals = getLocalPersonalNotes(userId);
      const existing = currentLocals.find(n => n.id === id);
      const finalContent = updates.content !== undefined ? updates.content : (existing?.content || '');
      const finalAtts = updates.attachments !== undefined ? updates.attachments : (existing?.attachments || []);
      
      pbUpdates.content = encodeNoteContent(finalContent, finalAtts);
    }

    const rec = await pb.collection('personal_notes').update(id, pbUpdates);
    const { content, attachments } = decodeNoteContent(rec.content, rec.attachments);
    
    updatedNote = {
      id: rec.id,
      userId: rec.userId || userId,
      title: rec.title || '',
      content,
      color: rec.color || 'amber',
      isPinned: !!rec.isPinned,
      tags: Array.isArray(rec.tags) ? rec.tags : [],
      attachments,
      createdAt: rec.created || rec.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn("Failed updating personal note in PB:", err);
  }

  const localNotes = getLocalPersonalNotes(userId);
  const updatedList = localNotes.map((n) => {
    if (n.id === id) {
      const merged = { ...n, ...updates, updatedAt: new Date().toISOString() };
      if (!updatedNote) updatedNote = merged;
      return merged;
    }
    return n;
  });

  saveLocalPersonalNotes(userId, updatedList);
  return updatedNote || {
    id,
    userId,
    title: updates.title || '',
    content: updates.content || '',
    createdAt: new Date().toISOString(),
  };
}

export async function deletePersonalNotePB(id: string, userId: string): Promise<void> {
  try {
    await pb.collection('personal_notes').delete(id);
  } catch {}

  const localNotes = getLocalPersonalNotes(userId);
  const filtered = localNotes.filter((n) => n.id !== id);
  saveLocalPersonalNotes(userId, filtered);
}

