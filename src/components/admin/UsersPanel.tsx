import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, ShieldCheck, UserX, UserCheck, UserPlus, Loader2, Lock } from 'lucide-react';
import {
  AdminUser, AdminUserInput, AdminRole, UserAccess, NexusApiError,
  listUsersPage, adminCreateUser, adminUpdateUser, setUserActive,
  listRoles, getUserAccess, setUserRoles, setUserDirectPermissions,
} from '../../services/nexusApi';
import { toPersianDigits, formatToJalali } from '../../utils/helpers';
import {
  AdminCard, SearchBox, StatusBadge, IconAction, Pagination, Field, inputClass, Notice,
  AdminDialog, PrimaryButton, SecondaryButton, toLatinDigits, useDebounced,
} from './AdminUi';

const PAGE_SIZE = 10;
const NATIONAL_CODE = /^[0-9]{10}$/;

/** Which user-administration actions the signed-in user may take (the server checks again). */
export interface UserAdminRights {
  create: boolean;
  update: boolean;
  changeStatus: boolean;
  assignRoles: boolean;
  assignPermissions: boolean;
}

const ROLE_TITLES: Record<string, string> = { Administrator: 'مدیر سیستم', Member: 'کاربر' };
const roleTitle = (name: string) => ROLE_TITLES[name] || name;

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export const UsersPanel: React.FC<{ currentUserId: string; rights: UserAdminRights }> = ({ currentUserId, rights }) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editing, setEditing] = useState<AdminUser | 'new' | null>(null);
  const [accessOf, setAccessOf] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listUsersPage({ page, pageSize: PAGE_SIZE, search: debouncedSearch });
      setRows(result.items);
      setTotal(result.totalCount);
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'دریافت فهرست کاربران ممکن نشد.') });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => { setPage(1); }, [debouncedSearch]);
  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (user: AdminUser) => {
    const enable = !user.isActive;
    if (!enable && !window.confirm(`حساب «${user.displayName}» غیرفعال شود؟ کاربر بلافاصله از سامانه خارج می‌شود.`)) return;
    try {
      await setUserActive(user.id, enable);
      setMessage({ type: 'success', text: `حساب «${user.displayName}» ${enable ? 'فعال' : 'غیرفعال'} شد.` });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: errorText(err, 'تغییر وضعیت کاربر انجام نشد.') });
    }
  };

  return (
    <AdminCard>
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 p-5">
        <SearchBox value={search} onChange={setSearch} placeholder="جستجو در نام، کد ملی، موبایل، ایمیل، نقش..." />
        {rights.create && (
          <PrimaryButton onClick={() => setEditing('new')}>
            <UserPlus className="w-4 h-4" />
            <span>کاربر جدید</span>
          </PrimaryButton>
        )}
      </div>

      {message && (
        <div className="px-5 pb-3">
          <Notice type={message.type} onClose={() => setMessage(null)}>{message.text}</Notice>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 text-xs">
              <th className="text-right font-bold px-5 py-3">کاربر</th>
              <th className="text-right font-bold px-3 py-3">نام کاربری (کد ملی)</th>
              <th className="text-right font-bold px-3 py-3">شماره موبایل</th>
              <th className="text-right font-bold px-3 py-3">نقش</th>
              <th className="text-right font-bold px-3 py-3">آخرین ورود</th>
              <th className="text-right font-bold px-3 py-3">وضعیت</th>
              <th className="text-right font-bold px-5 py-3">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading && rows.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-slate-500">کاربری یافت نشد.</td></tr>
            ) : rows.map((user) => {
              const isSelf = user.id === currentUserId;
              const lockedReason = user.isSystem ? 'مدیر اصلی سیستم از این بخش قابل تغییر نیست.' : isSelf ? 'این عملیات برای حساب خودتان مجاز نیست.' : undefined;
              return (
                <tr key={user.id} className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/30 ${loading ? 'opacity-60' : ''}`}>
                  <td className="px-5 py-3.5">
                    <div className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>{user.firstName || user.lastName ? `${user.firstName} ${user.lastName}`.trim() : user.displayName}</span>
                      {user.isSystem && (
                        <StatusBadge tone="indigo" title="ایجادشده توسط سیستم؛ قابل حذف، غیرفعال‌سازی یا تغییر دسترسی نیست">
                          <Lock className="w-3 h-3" /> مدیر اصلی
                        </StatusBadge>
                      )}
                    </div>
                    {user.email && <div className="text-xs text-slate-400 mt-0.5 dir-ltr text-right">{user.email}</div>}
                  </td>
                  <td className="px-3 py-3.5 font-mono text-slate-700 dark:text-slate-300 dir-ltr text-right">
                    {user.username ? toPersianDigits(user.username) : <span className="text-amber-600 font-sans text-xs">ثبت نشده</span>}
                  </td>
                  <td className="px-3 py-3.5 font-mono text-slate-700 dark:text-slate-300 dir-ltr text-right">{user.phoneNumber ? toPersianDigits(user.phoneNumber) : '—'}</td>
                  <td className="px-3 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length === 0 ? <span className="text-xs text-slate-400">بدون نقش</span> : user.roles.map((r) => (
                        <StatusBadge key={r} tone={r === 'Administrator' ? 'indigo' : 'slate'}>{roleTitle(r)}</StatusBadge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{user.lastLoginAtUtc ? formatToJalali(user.lastLoginAtUtc) : 'ثبت نشده'}</td>
                  <td className="px-3 py-3.5">
                    {user.isActive ? <StatusBadge tone="green">فعال</StatusBadge> : <StatusBadge tone="red">غیرفعال</StatusBadge>}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-0.5">
                      {rights.update && (
                        <IconAction icon={Pencil} label="ویرایش" onClick={() => setEditing(user)} disabled={user.isSystem} disabledReason="مشخصات مدیر اصلی سیستم از این بخش قابل تغییر نیست؛ رمز خود را از «تنظیمات عمومی» تغییر می‌دهد." />
                      )}
                      {(rights.assignRoles || rights.assignPermissions) && (
                        <IconAction icon={ShieldCheck} label="دسترسی‌ها" onClick={() => setAccessOf(user)} disabled={!!lockedReason} disabledReason={lockedReason} />
                      )}
                      {rights.changeStatus && (
                        user.isActive
                          ? <IconAction icon={UserX} label="غیرفعال‌سازی" tone="rose" onClick={() => toggleStatus(user)} disabled={!!lockedReason} disabledReason={lockedReason} />
                          : <IconAction icon={UserCheck} label="فعال‌سازی" tone="emerald" onClick={() => toggleStatus(user)} />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />

      {editing && (
        <UserFormDialog
          user={editing === 'new' ? null : editing}
          canAssignRoles={rights.assignRoles}
          onClose={() => setEditing(null)}
          onSaved={async (text) => { setEditing(null); setMessage({ type: 'success', text }); await load(); }}
        />
      )}
      {accessOf && (
        <UserAccessDialog
          user={accessOf}
          rights={rights}
          onClose={() => setAccessOf(null)}
          onSaved={async () => { setAccessOf(null); setMessage({ type: 'success', text: `دسترسی‌های «${accessOf.displayName}» ذخیره شد.` }); await load(); }}
        />
      )}
    </AdminCard>
  );
};

// ---------------------------------------------------------------- create / edit

const UserFormDialog: React.FC<{
  user: AdminUser | null;
  canAssignRoles: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}> = ({ user, canAssignRoles, onClose, onSaved }) => {
  const isNew = user === null;
  const [form, setForm] = useState<AdminUserInput>({
    firstName: user?.firstName || (user && !user.firstName && !user.lastName ? user.displayName : ''),
    lastName: user?.lastName || '',
    username: user?.username || '',
    phoneNumber: user?.phoneNumber || '',
    email: user?.email || '',
    password: '',
  });
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew || !canAssignRoles) return;
    listRoles().then((list) => {
      setRoles(list);
      const member = list.find((r) => r.name === 'Member');
      if (member) setRoleIds([member.id]);
    }).catch(() => setRoles([]));
  }, [isNew, canAssignRoles]);

  const set = (key: keyof AdminUserInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: key === 'username' || key === 'phoneNumber' ? toLatinDigits(e.target.value) : e.target.value }));

  const usernameChanged = isNew || form.username.trim() !== (user?.username || '');

  const validate = (): string | null => {
    if (!form.firstName.trim() || !form.lastName.trim()) return 'نام و نام خانوادگی را وارد کنید.';
    if (usernameChanged && !NATIONAL_CODE.test(form.username.trim())) return 'نام کاربری باید کد ملی ۱۰ رقمی باشد (فقط عدد).';
    if (!form.phoneNumber.trim()) return 'شماره موبایل را وارد کنید.';
    if (!/^(\+?[0-9]{8,15}|0?9[0-9]{9})$/.test(form.phoneNumber.replace(/[\s\-()]/g, ''))) return 'شماره موبایل معتبر نیست (مثال: 09121234567).';
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return 'ایمیل معتبر نیست.';
    if (isNew && (form.password || '').length < 8) return 'رمز عبور اولیه باید حداقل ۸ کاراکتر باشد.';
    if (!isNew && form.password && form.password.length < 8) return 'رمز عبور جدید باید حداقل ۸ کاراکتر باشد.';
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        await adminCreateUser(form, canAssignRoles ? roleIds : []);
        onSaved(`کاربر «${form.firstName} ${form.lastName}» ایجاد شد.`);
      } else {
        await adminUpdateUser(user!, form);
        onSaved(`مشخصات «${form.firstName} ${form.lastName}» ذخیره شد.`);
      }
    } catch (err) {
      setError(err instanceof NexusApiError && err.httpStatus === 409
        ? err.message.replace('تداخل اطلاعات: ', 'این مشخصات تکراری است: ')
        : errorText(err, 'ذخیره کاربر انجام نشد.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminDialog
      title={isNew ? 'ایجاد کاربر جدید' : `ویرایش «${user!.displayName}»`}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton>
          <PrimaryButton type="submit" form="user-form" disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isNew ? 'ایجاد کاربر' : 'ذخیره تغییرات'}</span>
          </PrimaryButton>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4" noValidate>
        {error && <Notice type="error">{error}</Notice>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="نام" required><input className={inputClass} value={form.firstName} onChange={set('firstName')} maxLength={80} autoFocus /></Field>
          <Field label="نام خانوادگی" required><input className={inputClass} value={form.lastName} onChange={set('lastName')} maxLength={80} /></Field>
          <Field label="نام کاربری (کد ملی)" required hint={!isNew && user?.username && !NATIONAL_CODE.test(user.username) ? 'نام کاربری فعلی پیش از قانون کد ملی ثبت شده؛ اگر تغییرش دهید باید کد ملی ۱۰ رقمی باشد.' : 'دقیقاً ۱۰ رقم، فقط عدد.'}>
            <input className={`${inputClass} dir-ltr text-right font-mono`} value={form.username} onChange={set('username')} inputMode="numeric" maxLength={usernameChanged ? 10 : 64} autoComplete="off" />
          </Field>
          <Field label="شماره موبایل" required hint="برای ورود و دریافت پیامک.">
            <input className={`${inputClass} dir-ltr text-right font-mono`} value={form.phoneNumber} onChange={set('phoneNumber')} inputMode="tel" placeholder="09121234567" autoComplete="off" />
          </Field>
          <Field label="ایمیل" hint="اختیاری؛ برای ارسال لینک بازیابی رمز عبور." className="sm:col-span-2">
            <input className={`${inputClass} dir-ltr text-right`} type="email" value={form.email} onChange={set('email')} autoComplete="off" />
          </Field>
          <Field label={isNew ? 'رمز عبور اولیه' : 'رمز عبور جدید'} required={isNew} hint={isNew ? 'حداقل ۸ کاراکتر. آن را به‌صورت امن به کاربر اعلام کنید.' : 'خالی بگذارید تا رمز فعلی بماند. تغییر رمز، همه نشست‌های کاربر را می‌بندد.'} className="sm:col-span-2">
            <input className={`${inputClass} dir-ltr text-right`} type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
          </Field>
        </div>
        {isNew && canAssignRoles && roles.length > 0 && (
          <div>
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">نقش‌ها</span>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <label key={role.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm cursor-pointer">
                  <input type="checkbox" checked={roleIds.includes(role.id)} onChange={(e) => setRoleIds((ids) => e.target.checked ? [...ids, role.id] : ids.filter((id) => id !== role.id))} />
                  <span>{roleTitle(role.name)}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </form>
    </AdminDialog>
  );
};

// ---------------------------------------------------------------- access

const UserAccessDialog: React.FC<{ user: AdminUser; rights: UserAdminRights; onClose: () => void; onSaved: () => void }> = ({ user, rights, onClose, onSaved }) => {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [access, setAccess] = useState<UserAccess | null>(null);
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [direct, setDirect] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listRoles(), getUserAccess(user.id)]).then(([roleList, userAccess]) => {
      setRoles(roleList);
      setAccess(userAccess);
      setRoleIds(roleList.filter((r) => userAccess.roles.includes(r.name)).map((r) => r.id));
      setDirect(userAccess.permissions.filter((p) => p.grantedDirectly).map((p) => p.permissionId));
    }).catch((err) => setError(errorText(err, 'دریافت دسترسی‌ها ممکن نشد.')));
  }, [user.id]);

  const modules = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const groups = new Map<string, UserAccess['permissions']>();
    for (const entry of access?.permissions || []) {
      if (term && !`${entry.name} ${entry.description} ${entry.module}`.toLowerCase().includes(term)) continue;
      groups.set(entry.module, [...(groups.get(entry.module) || []), entry]);
    }
    return [...groups.entries()];
  }, [access, filter]);

  const save = async () => {
    if (!access) return;
    setSaving(true);
    setError(null);
    try {
      const originalRoleIds = roles.filter((r) => access.roles.includes(r.name)).map((r) => r.id).sort().join(',');
      if (rights.assignRoles && [...roleIds].sort().join(',') !== originalRoleIds) {
        await setUserRoles(user.id, roleIds);
      }
      const originalDirect = access.permissions.filter((p) => p.grantedDirectly).map((p) => p.permissionId).sort().join(',');
      if (rights.assignPermissions && [...direct].sort().join(',') !== originalDirect) {
        await setUserDirectPermissions(user.id, direct);
      }
      onSaved();
    } catch (err) {
      setError(errorText(err, 'ذخیره دسترسی‌ها انجام نشد.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminDialog
      wide
      title={`دسترسی‌های «${user.displayName}»`}
      onClose={onClose}
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton>
          <PrimaryButton type="button" onClick={save} disabled={saving || !access}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>ذخیره دسترسی‌ها</span>
          </PrimaryButton>
        </>
      }
    >
      {error && <Notice type="error">{error}</Notice>}
      {!access ? (
        <div className="py-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : (
        <>
          <section>
            <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 mb-2">نقش‌ها</h4>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <label key={role.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${rights.assignRoles ? 'cursor-pointer' : 'opacity-60'} ${roleIds.includes(role.id) ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-700' : 'border-slate-200 dark:border-slate-700'}`}>
                  <input type="checkbox" disabled={!rights.assignRoles} checked={roleIds.includes(role.id)} onChange={(e) => setRoleIds((ids) => e.target.checked ? [...ids, role.id] : ids.filter((id) => id !== role.id))} />
                  <span className="font-bold">{roleTitle(role.name)}</span>
                  <span className="text-xs text-slate-400">({toPersianDigits(role.permissions.length)} مجوز)</span>
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">مجوزهای مستقیم</h4>
              <SearchBox value={filter} onChange={setFilter} placeholder="جستجوی مجوز..." />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              مجوزی که از نقش یا گروه سازمانی می‌آید اینجا فقط نمایش داده می‌شود و از همان نقش/گروه تغییر می‌کند. فقط مجوزهایی را می‌توانید اعطا کنید که خودتان دارید.
            </p>
            <div className="space-y-3">
              {modules.map(([module, entries]) => (
                <div key={module} className="rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-t-xl text-xs font-extrabold text-slate-600 dark:text-slate-300">{module}</div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {entries.map((entry) => (
                      <label key={entry.permissionId} className={`flex items-center justify-between gap-3 px-3 py-2 ${rights.assignPermissions ? 'cursor-pointer' : ''}`}>
                        <span className="flex items-center gap-2 min-w-0">
                          <input type="checkbox" disabled={!rights.assignPermissions} checked={direct.includes(entry.permissionId)} onChange={(e) => setDirect((ids) => e.target.checked ? [...ids, entry.permissionId] : ids.filter((id) => id !== entry.permissionId))} />
                          <span className="min-w-0">
                            <span className="block text-sm text-slate-800 dark:text-slate-100">{entry.description}</span>
                            <span className="block text-[11px] font-mono text-slate-400 dir-ltr text-right">{entry.name}</span>
                          </span>
                        </span>
                        <span className="flex flex-wrap gap-1 justify-end">
                          {entry.grantedByRole && <StatusBadge tone="indigo" title={entry.grantingRoles.map(roleTitle).join('، ')}>از نقش</StatusBadge>}
                          {entry.grantedByGroup && <StatusBadge tone="amber" title={entry.grantingGroups.join('، ')}>از گروه</StatusBadge>}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </AdminDialog>
  );
};
