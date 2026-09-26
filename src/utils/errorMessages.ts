// Every error the user sees is Persian and free of internals. The server answers failures as
// ProblemDetails { title: <stable error code>, detail: <message>, status }
// (NexusCore.Application/Common/EndpointResults.cs and SafeErrorResponses.cs). The message
// shown is, in order: the server's own text when it is Persian; a Persian translation of a
// known server message; the Persian message for the error code; the one for the HTTP status.
// English text, exception messages, SQL and paths never reach the screen.

export const GENERIC_ERROR = 'خطایی در انجام عملیات رخ داد. لطفاً دوباره تلاش کنید.';
export const NETWORK_ERROR = 'ارتباط با سرور برقرار نشد. لطفاً اتصال خود را بررسی کنید.';
export const TIMEOUT_ERROR = 'پاسخی از سرور دریافت نشد. لطفاً دوباره تلاش کنید.';
export const FORBIDDEN_ERROR = 'شما مجوز انجام این عملیات را ندارید.';
export const SESSION_EXPIRED_ERROR = 'نشست کاربری شما به پایان رسیده است. لطفاً دوباره وارد شوید.';
export const FILE_TOO_LARGE_ERROR = 'حجم فایل نباید بیشتر از ۲۰۰ کیلوبایت باشد.';

/** Stable error codes (ProblemDetails.title) and what they mean to the user. */
const CODE_MESSAGES: Record<string, string> = {
  'validation.error': 'اطلاعات واردشده معتبر نیست. لطفاً موارد را بررسی کنید.',
  not_found: 'مورد درخواستی پیدا نشد یا به آن دسترسی ندارید.',
  conflict: 'این اطلاعات با اطلاعات ثبت‌شده قبلی تداخل دارد.',
  unauthorized: SESSION_EXPIRED_ERROR,
  'unauthorized.captcha_required': 'نام کاربری، شماره تلفن یا رمز عبور صحیح نیست.',
  forbidden: FORBIDDEN_ERROR,
  too_many_requests: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً چند دقیقه بعد دوباره تلاش کنید.',
  'server.error': GENERIC_ERROR,
  'account.disabled': 'حساب کاربری شما غیرفعال شده است. لطفاً با مدیر سامانه تماس بگیرید.',
  'captcha.required': 'برای ادامه، کد امنیتی تصویر را وارد کنید.',
  'captcha.invalid': 'کد امنیتی نادرست است یا منقضی شده است. کد جدید را وارد کنید.',
  'reset_code.invalid': 'کد تأیید صحیح نیست.',
  'reset_code.expired': 'اعتبار کد تأیید به پایان رسیده است. لطفاً کد جدید دریافت کنید.',
  'reset_token.invalid': 'مهلت تعیین رمز عبور جدید به پایان رسیده است. لطفاً دوباره کد بازیابی دریافت کنید.',
  'tickets.not_found': 'تیکت یافت نشد.',
};

const STATUS_MESSAGES: Record<number, string> = {
  400: CODE_MESSAGES['validation.error'],
  401: SESSION_EXPIRED_ERROR,
  403: FORBIDDEN_ERROR,
  404: CODE_MESSAGES.not_found,
  409: CODE_MESSAGES.conflict,
  413: FILE_TOO_LARGE_ERROR,
  429: CODE_MESSAGES.too_many_requests,
};

/** Known server messages (English) and their Persian text. */
const KNOWN_MESSAGES: Record<string, string> = {
  'Invalid username/mobile number or password.': 'نام کاربری، شماره تلفن یا رمز عبور صحیح نیست.',
  'A code was sent a moment ago. Please wait before asking for another one.': 'کد بازیابی لحظاتی پیش ارسال شد. لطفاً کمی صبر کنید و دوباره درخواست دهید.',
  'Too many failed sign-in attempts. Please wait a while before trying again.': 'تعداد تلاش‌های ناموفق ورود بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.',
  'Too many attempts. Please wait a few minutes and try again.': CODE_MESSAGES.too_many_requests,
  'Complete the CAPTCHA to sign in.': CODE_MESSAGES['captcha.required'],
  'The CAPTCHA answer is wrong or has expired. Try the new one.': CODE_MESSAGES['captcha.invalid'],
  'Invalid refresh token.': SESSION_EXPIRED_ERROR,
  'Refresh token is required.': SESSION_EXPIRED_ERROR,
  'Authentication is required.': SESSION_EXPIRED_ERROR,
  'You are not allowed to perform this action.': FORBIDDEN_ERROR,
  'The current password is not correct.': 'رمز عبور فعلی صحیح نیست.',
  'The new password must differ from the current one.': 'رمز عبور جدید باید با رمز فعلی متفاوت باشد.',
  // Users, roles, groups
  'User was not found.': 'کاربر یافت نشد.',
  'Role was not found.': 'نقش یافت نشد.',
  'Tenant was not found.': 'سازمان یافت نشد.',
  'User group was not found.': 'گروه کاربری یافت نشد.',
  'Team was not found.': 'تیم یافت نشد.',
  'A user with this username already exists in the tenant.': 'کاربری با این نام کاربری (کد ملی) قبلاً ثبت شده است.',
  'A user with this mobile number already exists in the tenant.': 'کاربری با این شماره تلفن همراه قبلاً ثبت شده است.',
  'A user with this email already exists in the tenant.': 'کاربری با این ایمیل قبلاً ثبت شده است.',
  'A role with this name already exists in the tenant.': 'نقشی با این نام قبلاً ثبت شده است.',
  'A group with this name already exists.': 'گروهی با این نام قبلاً ثبت شده است.',
  'You already have a team with this name.': 'شما قبلاً تیمی با این نام ساخته‌اید.',
  'A tenant with this slug already exists.': 'سازمانی با این شناسه قبلاً ثبت شده است.',
  'Username must be a national code: exactly 10 digits.': 'نام کاربری باید کد ملی ۱۰ رقمی باشد.',
  'This mobile number cannot be used. Enter another one.': 'این شماره تلفن همراه قابل استفاده نیست. شماره دیگری وارد کنید.',
  'One or more permissions do not exist.': 'یک یا چند مجوز انتخاب‌شده وجود ندارد.',
  "One or more roles do not exist in the user's organization.": 'یک یا چند نقش انتخاب‌شده در سازمان کاربر وجود ندارد.',
  'One or more users do not exist.': 'یک یا چند کاربر انتخاب‌شده وجود ندارد.',
  'All members must belong to the same tenant as the group.': 'همه اعضا باید از سازمان همین گروه باشند.',
  'All members must belong to the same tenant as the team.': 'همه اعضا باید از سازمان همین تیم باشند.',
  'A personal work team cannot carry permissions.': 'به تیم کاری شخصی نمی‌توان مجوز داد.',
  'Group name is required.': 'نام گروه را وارد کنید.',
  'Team name is required.': 'نام تیم را وارد کنید.',
  'Team name must be at most 128 characters.': 'نام تیم نباید بیشتر از ۱۲۸ کاراکتر باشد.',
  'The team is still in use (for example, tasks are assigned to it). Reassign them first.': 'این تیم هنوز در حال استفاده است (مثلاً فعالیت‌هایی به آن واگذار شده). ابتدا آن‌ها را به تیم دیگری واگذار کنید.',
  'The user is still referenced by other records (for example tasks they own). Deactivate the account instead, or reassign that data first.': 'این کاربر هنوز به اطلاعات دیگری (مثلاً فعالیت‌هایش) متصل است. به‌جای حذف، حساب را غیرفعال کنید یا ابتدا آن اطلاعات را واگذار کنید.',
  'You cannot disable your own account.': 'نمی‌توانید حساب کاربری خودتان را غیرفعال کنید.',
  'You cannot delete your own account.': 'نمی‌توانید حساب کاربری خودتان را حذف کنید.',
  'You cannot change your own roles or permissions.': 'نمی‌توانید نقش‌ها یا مجوزهای خودتان را تغییر دهید.',
  'The built-in system administrator cannot be disabled.': 'مدیر اصلی سامانه قابل غیرفعال‌سازی نیست.',
  'The built-in system administrator cannot be deleted.': 'مدیر اصلی سامانه قابل حذف نیست.',
  'The access of the built-in system administrator cannot be changed.': 'دسترسی مدیر اصلی سامانه قابل تغییر نیست.',
  'The built-in system administrator cannot be changed here. It changes its own password from its profile.': 'مشخصات مدیر اصلی سامانه از این بخش قابل تغییر نیست. رمز عبور آن فقط از پروفایل خودش تغییر می‌کند.',
  'The built-in Administrator role cannot be changed.': 'نقش مدیر سامانه قابل تغییر نیست.',
  'The permissions of the built-in Administrator role cannot be changed.': 'مجوزهای نقش مدیر سامانه قابل تغییر نیست.',
  'Enabling or disabling users needs the users.change_status permission.': FORBIDDEN_ERROR,
  'You can only change the settings of your own organization.': 'فقط تنظیمات سازمان خودتان را می‌توانید تغییر دهید.',
  'The avatar image is too large.': 'حجم تصویر پروفایل بیش از حد مجاز است.',
  // Tasks, subtasks, schedules, tags, files, notes, comments
  'Task not found.': 'فعالیت یافت نشد یا به آن دسترسی ندارید.',
  'Subtask not found.': 'زیرفعالیت یافت نشد یا به آن دسترسی ندارید.',
  'Recurrence schedule not found.': 'زمان‌بندی تکرار یافت نشد.',
  'Tag not found.': 'برچسب یافت نشد.',
  'Note not found.': 'یادداشت یافت نشد.',
  'Comment not found.': 'نظر یافت نشد.',
  'File not found.': 'فایل یافت نشد یا به آن دسترسی ندارید.',
  'File link not found.': 'فایل یافت نشد یا به آن دسترسی ندارید.',
  'Attachment was not found.': 'فایل پیوست یافت نشد.',
  'The file record exists but its contents are missing from storage.': 'محتوای این فایل در سرور موجود نیست.',
  "The attachment's content is missing from storage.": 'محتوای این فایل در سرور موجود نیست.',
  'The uploaded file is empty.': 'فایل انتخاب‌شده خالی است.',
  'The attached file is empty.': 'فایل انتخاب‌شده خالی است.',
  'A tag with this name already exists.': 'برچسبی با این نام قبلاً ثبت شده است.',
  'A project must have at least one subtask.': 'پروژه باید حداقل یک زیرفعالیت داشته باشد.',
  'A project must keep at least one subtask. Delete the project instead.': 'پروژه باید حداقل یک زیرفعالیت داشته باشد. در صورت نیاز خود پروژه را حذف کنید.',
  'Add at least one subtask before turning this task into a project.': 'برای تبدیل فعالیت به پروژه، ابتدا حداقل یک زیرفعالیت اضافه کنید.',
  'This task already has a recurrence schedule. Update it instead.': 'این فعالیت از قبل زمان‌بندی تکرار دارد. همان را ویرایش کنید.',
  'The assigned user does not exist in this tenant.': 'کاربر مسئول در این سازمان وجود ندارد.',
  'The assigned team does not exist in this tenant.': 'تیم انتخاب‌شده در این سازمان وجود ندارد.',
  'Choose who is responsible for the task.': 'لطفاً مسئول اجرای فعالیت را انتخاب کنید.',
  'The responsible user is not an active user of this organization.': 'مسئول اجرای انتخاب‌شده کاربر فعال این سازمان نیست.',
  'The owner of this task has not allowed the assignee to change its status.': 'مالک این فعالیت اجازه تغییر وضعیت را به مسئول آن نداده است.',
  'Only the owner of this task, or a user who manages all tasks, can do this.': 'این کار فقط توسط مالک فعالیت یا مدیر وظایف سازمان امکان‌پذیر است.',
  'The charter end date cannot be before its start date.': 'تاریخ پایان منشور پروژه نمی‌تواند قبل از تاریخ شروع آن باشد.',
  'The recurrence end date cannot be before its start date.': 'تاریخ پایان تکرار نمی‌تواند قبل از تاریخ شروع آن باشد.',
  'The end time must be after the start time.': 'ساعت پایان باید بعد از ساعت شروع باشد.',
  'Select at least one day of the week.': 'حداقل یک روز از هفته را انتخاب کنید.',
  'Select at least one day of the month.': 'حداقل یک روز از ماه را انتخاب کنید.',
  'Choose which occurrence in the month this falls on.': 'مشخص کنید تکرار در کدام هفته ماه باشد.',
  'Choose a weekday from 0 (Saturday) to 6 (Friday).': 'روز هفته معتبر نیست.',
  'Days of the week run from 0 (Saturday) to 6 (Friday).': 'روز هفته معتبر نیست.',
  'An activity action of 1-120 characters is required.': 'شرح تغییر باید بین ۱ تا ۱۲۰ کاراکتر باشد.',
  'Activity details can be at most 2000 characters.': 'جزئیات تغییر نباید بیشتر از ۲۰۰۰ کاراکتر باشد.',
  'You can only attach files to your own comments.': 'فقط به نظرهای خودتان می‌توانید فایل پیوست کنید.',
  'You can only remove files from your own comments.': 'فقط فایل‌های نظرهای خودتان را می‌توانید حذف کنید.',
  'You can only edit your own comments.': 'فقط نظرهای خودتان را می‌توانید ویرایش کنید.',
  'You can only delete your own comments.': 'فقط نظرهای خودتان را می‌توانید حذف کنید.',
  // Chat, notifications, tickets
  'Conversation not found': 'گفتگو یافت نشد.',
  'Conversation not found.': 'گفتگو یافت نشد.',
  'Message not found': 'پیام یافت نشد.',
  'Participant not found': 'عضو گفتگو یافت نشد.',
  'Notification was not found.': 'اعلان یافت نشد.',
  'A message needs text or an attachment.': 'متن پیام یا فایل پیوست را وارد کنید.',
  'A message needs 1-4000 characters of text.': 'متن پیام باید بین ۱ تا ۴۰۰۰ کاراکتر باشد.',
  'You cannot start a conversation with yourself.': 'نمی‌توانید با خودتان گفتگو کنید.',
  'Only the assignee or a ticket manager can change the status.': 'وضعیت تیکت را فقط مسئول آن یا مدیر تیکت‌ها می‌تواند تغییر دهد.',
  'The assignee must be an active user of the same organization.': 'مسئول تیکت باید کاربر فعال همین سازمان باشد.',
  // SMS and LDAP settings
  'SMS delivery is disabled.': 'ارسال پیامک غیرفعال است.',
  'SMS settings are incomplete.': 'تنظیمات پنل پیامکی کامل نیست.',
  'An enabled SMS panel needs an API key.': 'برای فعال کردن پنل پیامکی، کلید API را وارد کنید.',
  'The sender number must be digits only (20 at most).': 'شماره فرستنده باید فقط شامل رقم (حداکثر ۲۰ رقم) باشد.',
  'The sms section is required.': 'تنظیمات پیامک ارسال نشده است.',
  'Enter a valid mobile number for the test message.': 'برای پیامک آزمایشی یک شماره تلفن همراه معتبر وارد کنید.',
  'The test message is too long (500 characters at most).': 'متن پیامک آزمایشی نباید بیشتر از ۵۰۰ کاراکتر باشد.',
  'The notification settings are too long to store.': 'حجم تنظیمات اعلان بیش از حد مجاز است.',
  'The LDAP server (host) is required.': 'نشانی سرور LDAP را وارد کنید.',
  'Enter the LDAP server as a host name or IP address only (no ldap:// prefix, no spaces).': 'نشانی سرور LDAP را فقط به‌صورت نام میزبان یا IP (بدون ldap:// و فاصله) وارد کنید.',
  'The port must be between 1 and 65535.': 'شماره پورت باید بین ۱ تا ۶۵۵۳۵ باشد.',
  'The connection timeout must be between 1 and 120 seconds.': 'زمان انتظار اتصال باید بین ۱ تا ۱۲۰ ثانیه باشد.',
  'Choose either SSL (LDAPS) or StartTLS, not both.': 'فقط یکی از SSL (LDAPS) یا StartTLS را انتخاب کنید.',
  'The user filter must be a valid LDAP filter, e.g. (objectClass=person).': 'فیلتر کاربران باید یک فیلتر معتبر LDAP باشد؛ مثلاً (objectClass=person).',
  'The LDAP settings are too long to store.': 'حجم تنظیمات LDAP بیش از حد مجاز است.',
  'Email delivery is not configured (Email:Smtp).': 'ارسال ایمیل روی سرور پیکربندی نشده است.',
  'The email could not be sent.': 'ارسال ایمیل انجام نشد.',
  'Setting key is required.': 'کلید تنظیمات مشخص نشده است.',
};

/** Field names in validator messages ("'Title' must not be empty.") in Persian. */
const FIELD_NAMES: Record<string, string> = {
  Title: 'عنوان', 'Due Date': 'تاریخ موعد', Description: 'شرح', Name: 'نام', Text: 'متن', Color: 'رنگ',
  Password: 'رمز عبور', 'New Password': 'رمز عبور جدید', 'Current Password': 'رمز عبور فعلی',
  Identifier: 'نام کاربری یا شماره تلفن', Username: 'نام کاربری', 'First Name': 'نام', 'Last Name': 'نام خانوادگی',
  'Phone Number': 'شماره تلفن همراه', Email: 'ایمیل', 'Display Name': 'نام نمایشی', Content: 'متن',
  'Start Date': 'تاریخ شروع', 'End Date': 'تاریخ پایان', Priority: 'اولویت', Status: 'وضعیت', Action: 'شرح تغییر',
};

const PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/too large|maximum size is/i, () => FILE_TOO_LARGE_ERROR],
  // SMS templates (the key is shown as the panel shows it)
  [/^Unknown SMS template '(.+)'\.?$/i, () => 'این متن پیامک در این سامانه قابل ویرایش نیست.'],
  [/^The text of '(.+)' cannot be empty\.?$/i, (m) => `متن پیامک «${smsTitle(m[1])}» نمی‌تواند خالی باشد.`],
  [/^The text of '(.+)' is longer than (\d+) characters\.?$/i, (m) => `متن پیامک «${smsTitle(m[1])}» نباید بیشتر از ${toFa(m[2])} کاراکتر باشد.`],
  [/^The text of '(.+)' uses unknown placeholders: (.+?)\.?$/i, (m) => `متن پیامک «${smsTitle(m[1])}» عبارت ناشناخته دارد: ${m[2]}`],
  [/^The text of '(.+)' must contain (.+?)\.?$/i, (m) => `متن پیامک «${smsTitle(m[1])}» باید ${m[2]} را داشته باشد.`],
  [/^You can only grant permissions you have yourself/i, () => 'فقط مجوزهایی را می‌توانید اعطا کنید که خودتان دارید.'],
  [/^You can only assign roles whose permissions you have yourself/i, () => 'فقط نقش‌هایی را می‌توانید تخصیص دهید که همه مجوزهای آن را خودتان دارید.'],
  [/^'(.+)' must not be empty\.?$/i, (m) => `وارد کردن «${field(m[1])}» الزامی است.`],
  [/^'(.+)' must be (\d+) characters or fewer/i, (m) => `«${field(m[1])}» نباید بیشتر از ${toFa(m[2])} کاراکتر باشد.`],
  [/^The length of '(.+)' must be at least (\d+) characters/i, (m) => `«${field(m[1])}» باید حداقل ${toFa(m[2])} کاراکتر باشد.`],
  [/^The length of '(.+)' must be (\d+) characters or fewer/i, (m) => `«${field(m[1])}» نباید بیشتر از ${toFa(m[2])} کاراکتر باشد.`],
  [/^'(.+)' is not a valid email address\.?$/i, () => 'نشانی ایمیل معتبر نیست.'],
  [/^'(.+)' has a range of values which does not include/i, (m) => `مقدار «${field(m[1])}» معتبر نیست.`],
  [/^'(.+)' (must|is)/i, (m) => `مقدار «${field(m[1])}» معتبر نیست.`],
];

/** The Persian name of an SMS template the server names by its key. */
const SMS_TEMPLATE_TITLES: Record<string, string> = {
  password_reset: 'کد بازیابی رمز عبور',
  task_assigned: 'ارجاع فعالیت',
  recurring_task_reminder: 'یادآوری فعالیت تکرارشونده',
  task_due_changed: 'تغییر موعد فعالیت',
};

function smsTitle(key: string): string {
  return SMS_TEMPLATE_TITLES[key] || key;
}

function field(name: string): string {
  return FIELD_NAMES[name] || name;
}

function toFa(digits: string): string {
  return digits.replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

export function hasPersian(text: string | undefined | null): boolean {
  return !!text && /[؀-ۿ]/.test(text);
}

/** One server message in Persian, or null when it is not known. */
function translate(message: string): string | null {
  const text = message.trim();
  if (!text) return null;
  if (hasPersian(text)) return text;
  if (KNOWN_MESSAGES[text]) return KNOWN_MESSAGES[text];
  for (const [pattern, render] of PATTERNS) {
    const match = text.match(pattern);
    if (match) return render(match);
  }
  return null;
}

/**
 * The Persian message for a failed request. `detail` may join several validation messages with
 * "; " - all are shown when every one is understood, otherwise the code's general message.
 */
export function persianApiMessage(status: number, code: string | undefined, detail: string | undefined): string {
  if (status >= 500) return GENERIC_ERROR;
  if (detail) {
    const parts = detail.split(/;\s*/).filter((part) => part.trim());
    const translated = parts.map(translate);
    if (translated.length > 0 && translated.every((part): part is string => !!part)) {
      return Array.from(new Set(translated)).join(' ');
    }
  }
  return (code && CODE_MESSAGES[code]) || STATUS_MESSAGES[status] || GENERIC_ERROR;
}

/**
 * What to show for any caught error: messages from the API client are already Persian; other
 * errors (a bug, a browser failure) show the given fallback instead of their English text.
 */
export function userErrorMessage(err: unknown, fallback: string = GENERIC_ERROR): string {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  return hasPersian(message) ? message : fallback;
}
