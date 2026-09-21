import React, { useState, useEffect } from 'react';
import { User, SystemNotificationSettings } from '../types';
import { formatToJalali } from '../utils/helpers';
import {
  fetchAllUsersPB,
  adminCreateUserPB,
  adminUpdateUserPB,
  adminDeleteUserPB,
  getSystemNotificationSettingsPB,
  fetchSystemNotificationSettingsPB,
  saveSystemNotificationSettingsPB,
  testSmsNotificationPB,
  testTelegramNotificationPB
} from '../services/pocketbase';
import {
  ShieldCheck,
  UserPlus,
  Search,
  Edit2,
  Trash2,
  Ban,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  User as UserIcon,
  Lock,
  Mail,
  UserCheck,
  Clock,
  Bell,
  MessageSquare,
  Send,
  Smartphone,
  Save,
  SendHorizontal,
} from 'lucide-react';

interface AdminUserManagementProps {
  currentUser: User;
}

export const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ currentUser }) => {
  const [adminTab, setAdminTab] = useState<'users' | 'notifications'>('users');

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal / Form States for Create or Edit
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  
  const [formName, setFormName] = useState<string>('');
  const [formUsername, setFormUsername] = useState<string>('');
  const [formEmail, setFormEmail] = useState<string>('');
  const [formPassword, setFormPassword] = useState<string>('');
  const [formRole, setFormRole] = useState<string>('user');
  const [formDisabled, setFormDisabled] = useState<boolean>(false);
  const [formPhoneNumber, setFormPhoneNumber] = useState<string>('');
  const [formTelegramChatId, setFormTelegramChatId] = useState<string>('');
  const [formNotifySms, setFormNotifySms] = useState<boolean>(true);
  const [formNotifyTelegram, setFormNotifyTelegram] = useState<boolean>(true);

  const [submitting, setSubmitting] = useState<boolean>(false);

  // Parametric Notification Settings State
  const [sysNotifySettings, setSysNotifySettings] = useState<SystemNotificationSettings>(getSystemNotificationSettingsPB());
  const [savingNotifySettings, setSavingNotifySettings] = useState<boolean>(false);
  
  // Test states
  const [testSmsPhone, setTestSmsPhone] = useState<string>('');
  const [testingSms, setTestingSms] = useState<boolean>(false);
  
  const [testTelegramChatId, setTestTelegramChatId] = useState<string>('');
  const [testingTelegram, setTestingTelegram] = useState<boolean>(false);

  // Load user list
  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await fetchAllUsersPB();
      setUsers(list);
    } catch (err) {
      console.error('Error loading user list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    fetchSystemNotificationSettingsPB().then((s) => {
      setSysNotifySettings(s);
    });
  }, []);

  const openCreateForm = () => {
    setEditingUserId(null);
    setFormName('');
    setFormUsername('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('user');
    setFormDisabled(false);
    setFormPhoneNumber('');
    setFormTelegramChatId('');
    setFormNotifySms(true);
    setFormNotifyTelegram(true);
    setIsFormOpen(true);
  };

  const openEditForm = (user: User) => {
    setEditingUserId(user.id);
    setFormName(user.name || '');
    setFormUsername(user.username || '');
    setFormEmail(user.email || '');
    setFormPassword(''); // blank unless changing
    setFormRole(user.role || (user.username.toLowerCase() === 'admin' ? 'admin' : 'user'));
    setFormDisabled(!!user.disabled);
    setFormPhoneNumber(user.phoneNumber || '');
    setFormTelegramChatId(user.telegramChatId || '');
    setFormNotifySms(user.notifySms !== undefined ? !!user.notifySms : true);
    setFormNotifyTelegram(user.notifyTelegram !== undefined ? !!user.notifyTelegram : true);
    setIsFormOpen(true);
  };

  const handleToggleDisable = async (user: User) => {
    if (user.username.toLowerCase() === 'admin' && currentUser.id === user.id) {
      setActionMsg({ type: 'error', text: 'غیرفعال‌سازی حساب مدیر جاری امکان‌پذیر نیست.' });
      return;
    }
    const newDisabled = !user.disabled;
    try {
      await adminUpdateUserPB(user.id, { disabled: newDisabled });
      setActionMsg({
        type: 'success',
        text: `وضعیت کاربر ${user.name || user.username} به ${newDisabled ? 'غیرفعال' : 'فعال'} تغییر یافت.`,
      });
      await loadUsers();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'خطا در تغییر وضعیت کاربر.' });
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.username.toLowerCase() === 'admin' || user.id === currentUser.id) {
      setActionMsg({ type: 'error', text: 'امکان حذف حساب مدیر کل سیستم وجود ندارد.' });
      return;
    }

    if (!window.confirm(`آیا از حذف کامل کاربر "${user.name || user.username}" اطمینان دارید؟`)) {
      return;
    }

    try {
      await adminDeleteUserPB(user.id);
      setActionMsg({ type: 'success', text: `کاربر ${user.name || user.username} با موفقیت حذف گردید.` });
      await loadUsers();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'خطا در حذف کاربر.' });
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim()) {
      setActionMsg({ type: 'error', text: 'لطفاً نام کاربری را وارد نمایید.' });
      return;
    }

    setSubmitting(true);
    setActionMsg(null);

    try {
      if (editingUserId) {
        // Edit User
        await adminUpdateUserPB(editingUserId, {
          name: formName.trim(),
          username: formUsername.trim(),
          email: formEmail.trim(),
          password: formPassword.trim() || undefined,
          role: formRole,
          disabled: formDisabled,
          phoneNumber: formPhoneNumber.trim(),
          telegramChatId: formTelegramChatId.trim(),
          notifySms: formNotifySms,
          notifyTelegram: formNotifyTelegram,
        });
        setActionMsg({ type: 'success', text: 'مشخصات و تنظیمات اطلاع‌رسانی کاربر با موفقیت به‌روزرسانی شد.' });
      } else {
        // Create User
        if (!formPassword || formPassword.length < 8) {
          setActionMsg({ type: 'error', text: 'رمز عبور باید حداقل ۸ کاراکتر باشد.' });
          setSubmitting(false);
          return;
        }
        await adminCreateUserPB({
          name: formName.trim() || formUsername.trim(),
          username: formUsername.trim(),
          email: formEmail.trim() || `${formUsername.trim()}@example.com`,
          password: formPassword.trim(),
          role: formRole,
          disabled: formDisabled,
          phoneNumber: formPhoneNumber.trim(),
          telegramChatId: formTelegramChatId.trim(),
          notifySms: formNotifySms,
          notifyTelegram: formNotifyTelegram,
        });
        setActionMsg({ type: 'success', text: 'کاربر جدید با موفقیت ایجاد گردید 🎉' });
      }
      setIsFormOpen(false);
      await loadUsers();
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'خطا در ثبت اطلاعات کاربر.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveNotificationSettings = async () => {
    setSavingNotifySettings(true);
    setActionMsg(null);
    try {
      await saveSystemNotificationSettingsPB(sysNotifySettings);
      setActionMsg({ type: 'success', text: 'تنظیمات اطلاع‌رسانی پیامک و تلگرام در سیستم با موفقیت ذخیره گردید 🎉' });
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'خطا در ذخیره‌سازی تنظیمات اطلاع‌رسانی.' });
    } finally {
      setSavingNotifySettings(false);
    }
  };

  const handleTestSms = async () => {
    if (!testSmsPhone.trim()) {
      setActionMsg({ type: 'error', text: 'لطفاً شماره تلفن همراه جهت تست پیامک را وارد نمایید.' });
      return;
    }
    setTestingSms(true);
    setActionMsg(null);
    try {
      const res = await testSmsNotificationPB(testSmsPhone.trim(), 'پیامک آزمایشی سیستم مدیریت فعالیت‌های پارس‌تسک');
      setActionMsg({ type: res.success ? 'success' : 'error', text: res.message });
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'خطا در تست پیامک.' });
    } finally {
      setTestingSms(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!testTelegramChatId.trim()) {
      setActionMsg({ type: 'error', text: 'لطفاً شناسه چت تلگرام (Chat ID) را جهت تست وارد نمایید.' });
      return;
    }
    setTestingTelegram(true);
    setActionMsg(null);
    try {
      const res = await testTelegramNotificationPB(testTelegramChatId.trim());
      setActionMsg({ type: res.success ? 'success' : 'error', text: res.message });
    } catch (err: any) {
      setActionMsg({ type: 'error', text: err.message || 'خطا در ارتباط با ربات تلگرام.' });
    } finally {
      setTestingTelegram(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Admin Tab Navigation Header */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setAdminTab('users')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            adminTab === 'users'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          <span>مدیریت کاربران و دسترسی‌ها ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('notifications')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            adminTab === 'notifications'
              ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>تنظیمات SMS و تلگرام</span>
        </button>
      </div>

      {/* Alert Banner */}
      {actionMsg && (
        <div
          className={`p-3 rounded-2xl text-xs font-semibold flex items-center justify-between ${
            actionMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{actionMsg.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMsg(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TAB 1: USERS MANAGEMENT */}
      {adminTab === 'users' && (
        <div className="space-y-4">
          {/* Top Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-800/80 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="جستجو نام، نام کاربری یا ایمیل کاربر..."
                className="w-full pr-9 pl-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:border-indigo-500 text-slate-800 dark:text-slate-100"
              />
            </div>

            <button
              type="button"
              onClick={openCreateForm}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>تعریف کاربر جدید</span>
            </button>
          </div>

          {/* Create / Edit User Modal Dialog */}
          {isFormOpen && (
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-200 dark:border-indigo-800 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between font-bold text-xs text-indigo-900 dark:text-indigo-200 pb-2 border-b border-indigo-200/60 dark:border-indigo-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{editingUserId ? 'ویرایش مشخصات کاربر' : 'تعریف کاربر جدید'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-lg text-slate-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitForm} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      نام و نام خانوادگی
                    </label>
                    <div className="relative">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="مانند: علی محمدی"
                        className="w-full pr-8 pl-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      نام کاربری (شناسه ورود) *
                    </label>
                    <div className="relative">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value)}
                        placeholder="مانند: alimohammadi"
                        className="w-full pr-8 pl-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      پست الکترونیکی (ایمیل)
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="ali@example.com"
                        className="w-full pr-8 pl-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {editingUserId ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور (حداقل ۸ کاراکتر)'}
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder={editingUserId ? 'در صورت عدم تغییر، خالی بگذارید' : '••••••••'}
                        className="w-full pr-8 pl-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      شماره تلفن همراه (پیامک)
                    </label>
                    <div className="relative">
                      <Smartphone className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        value={formPhoneNumber}
                        onChange={(e) => setFormPhoneNumber(e.target.value)}
                        placeholder="09121234567"
                        className="w-full pr-8 pl-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 dir-ltr text-right"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      شناسه چت تلگرام (Telegram Chat ID)
                    </label>
                    <div className="relative">
                      <Send className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={formTelegramChatId}
                        onChange={(e) => setFormTelegramChatId(e.target.value)}
                        placeholder="123456789"
                        className="w-full pr-8 pl-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 dir-ltr text-right"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      نقش دسترسی کاربر
                    </label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                    >
                      <option value="user">کاربر عادی (User)</option>
                      <option value="admin">مدیر سیستم (Admin)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      وضعیت فعالیت حساب
                    </label>
                    <select
                      value={formDisabled ? 'disabled' : 'active'}
                      onChange={(e) => setFormDisabled(e.target.value === 'disabled')}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                    >
                      <option value="active">🟢 فعال و مجاز به ورود</option>
                      <option value="disabled">🔴 غیرفعال (مسدود شده)</option>
                    </select>
                  </div>
                </div>

                {/* User Level Notification Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-indigo-200/60 dark:border-indigo-800">
                  <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">دریافت اطلاع‌رسانی با پیامک (SMS)</span>
                    <input
                      type="checkbox"
                      checked={formNotifySms}
                      onChange={(e) => setFormNotifySms(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">دریافت اطلاع‌رسانی با تلگرام</span>
                    <input
                      type="checkbox"
                      checked={formNotifyTelegram}
                      onChange={(e) => setFormNotifyTelegram(e.target.checked)}
                      className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-200/60 dark:border-indigo-800">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{editingUserId ? 'ذخیره تغییرات کاربر' : 'ثبت کاربر جدید'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* User Cards / List */}
          {loading ? (
            <div className="flex items-center justify-center p-8 text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              <span className="text-xs">در حال دریافت لیست کاربران سیستم...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              هیچ کاربری با مشخصات جستجو شده یافت نشد.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {filteredUsers.map((user) => {
                const isAdmin = user.role === 'admin' || user.username.toLowerCase() === 'admin';
                return (
                  <div
                    key={user.id}
                    className="p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name || user.username}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 shrink-0 font-bold text-sm">
                          {(user.name || user.username)[0]}
                        </div>
                      )}

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {user.name || user.username}
                          </span>
                          {isAdmin ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                              مدیر سیستم
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                              کاربر عادی
                            </span>
                          )}

                          {user.disabled && (
                            <span className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold">
                              غیرفعال
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>نام کاربری: {user.username}</span>
                          {user.email && <span className="hidden sm:inline">| {user.email}</span>}
                          {user.phoneNumber && <span className="text-indigo-600 dark:text-indigo-400">| 📱 {user.phoneNumber}</span>}
                          {user.telegramChatId && <span className="text-sky-600 dark:text-sky-400">| ✈️ {user.telegramChatId}</span>}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                            user.notifySms !== false
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}>
                            پیامک: {user.notifySms !== false ? 'فعال' : 'غیرفعال'}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                            user.notifyTelegram !== false
                              ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}>
                            تلگرام: {user.notifyTelegram !== false ? 'فعال' : 'غیرفعال'}
                          </span>
                          <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50/80 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900/60">
                            <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span>آخرین ورود: {user.lastLogin ? formatToJalali(user.lastLogin) : 'ثبت نشده'}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => openEditForm(user)}
                        title="ویرایش مشخصات"
                        className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleDisable(user)}
                        title={user.disabled ? 'فعال‌سازی حساب' : 'غیرفعال‌سازی حساب'}
                        className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                          user.disabled
                            ? 'text-emerald-600 hover:bg-emerald-100/60 dark:hover:bg-emerald-950/60'
                            : 'text-amber-600 hover:bg-amber-100/60 dark:hover:bg-amber-950/60'
                        }`}
                      >
                        {user.disabled ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </button>

                      {!isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user)}
                          title="حذف کاربر"
                          className="p-1.5 text-rose-600 hover:bg-rose-100/60 dark:hover:bg-rose-950/60 rounded-xl transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PARAMETRIC NOTIFICATION SETTINGS (SMS & TELEGRAM) */}
      {adminTab === 'notifications' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* SMS Gateway Settings Card */}
          <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">تنظیمات درگاه پیامک (SMS Gateway)</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">تنظیمات سرویس‌دهنده پیامکی جهت ارسال اطلاع‌رسانی به کاربران</p>
                </div>
              </div>

              {/* SMS Enable Switch */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {sysNotifySettings.sms.enabled ? '🟢 فعال' : '🔴 غیرفعال'}
                </span>
                <input
                  type="checkbox"
                  checked={sysNotifySettings.sms.enabled}
                  onChange={(e) => setSysNotifySettings({
                    ...sysNotifySettings,
                    sms: { ...sysNotifySettings.sms, enabled: e.target.checked }
                  })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  سامانه / ارائه‌دهنده پیامک
                </label>
                <select
                  value={sysNotifySettings.sms.provider}
                  onChange={(e: any) => setSysNotifySettings({
                    ...sysNotifySettings,
                    sms: { ...sysNotifySettings.sms, provider: e.target.value }
                  })}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100"
                >
                  <option value="kavenegar">کاوه نگار (Kavenegar)</option>
                  <option value="farazsms">فراز اس‌ام‌اس (FarazSMS / IPPanel)</option>
                  <option value="melipayamak">ملی پیامک (Melipayamak)</option>
                  <option value="custom">وب‌هووک اختصاصی (Custom Webhook API)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  کلید API (API Key / Token)
                </label>
                <input
                  type="password"
                  value={sysNotifySettings.sms.apiKey}
                  onChange={(e) => setSysNotifySettings({
                    ...sysNotifySettings,
                    sms: { ...sysNotifySettings.sms, apiKey: e.target.value }
                  })}
                  placeholder="API Key سامانه پیامک..."
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 dir-ltr text-right"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  شماره خط اختصاصی ارسال
                </label>
                <input
                  type="text"
                  value={sysNotifySettings.sms.lineNumber}
                  onChange={(e) => setSysNotifySettings({
                    ...sysNotifySettings,
                    sms: { ...sysNotifySettings.sms, lineNumber: e.target.value }
                  })}
                  placeholder="مثلاً: 10008000..."
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 dir-ltr text-right"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  شناسه قالب / کد پترن (Pattern Code)
                </label>
                <input
                  type="text"
                  value={sysNotifySettings.sms.patternCode || ''}
                  onChange={(e) => setSysNotifySettings({
                    ...sysNotifySettings,
                    sms: { ...sysNotifySettings.sms, patternCode: e.target.value }
                  })}
                  placeholder="اختیاری جهت ارسال خدماتی پترن"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 dir-ltr text-right"
                />
              </div>
            </div>

            {/* Test SMS Box */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row items-center gap-2">
              <input
                type="tel"
                value={testSmsPhone}
                onChange={(e) => setTestSmsPhone(e.target.value)}
                placeholder="شماره موبایل جهت تست (0912...)"
                className="w-full sm:w-64 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 dir-ltr text-right"
              />
              <button
                type="button"
                onClick={handleTestSms}
                disabled={testingSms}
                className="w-full sm:w-auto px-4 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {testingSms ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SendHorizontal className="w-3.5 h-3.5" />}
                <span>ارسال پیامک آزمایشی</span>
              </button>
            </div>
          </div>

          {/* Telegram Bot Settings Card */}
          <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">تنظیمات ربات تلگرام (Telegram Bot)</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">ارسال پیام‌های سیستمی و هشدار فعالیت‌ها به تلگرام کاربر</p>
                </div>
              </div>

              {/* Telegram Enable Switch */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {sysNotifySettings.telegram.enabled ? '🟢 فعال' : '🔴 غیرفعال'}
                </span>
                <input
                  type="checkbox"
                  checked={sysNotifySettings.telegram.enabled}
                  onChange={(e) => setSysNotifySettings({
                    ...sysNotifySettings,
                    telegram: { ...sysNotifySettings.telegram, enabled: e.target.checked }
                  })}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  توکن ربات تلگرام (Bot Token)
                </label>
                <input
                  type="password"
                  value={sysNotifySettings.telegram.botToken}
                  onChange={(e) => setSysNotifySettings({
                    ...sysNotifySettings,
                    telegram: { ...sysNotifySettings.telegram, botToken: e.target.value }
                  })}
                  placeholder="123456789:ABCdefGhIJK..."
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 dir-ltr text-right"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  آیدی ربات تلگرام (Bot Username)
                </label>
                <input
                  type="text"
                  value={sysNotifySettings.telegram.botUsername}
                  onChange={(e) => setSysNotifySettings({
                    ...sysNotifySettings,
                    telegram: { ...sysNotifySettings.telegram, botUsername: e.target.value }
                  })}
                  placeholder="@ParsTaskBot"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 dir-ltr text-right"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  شناسه چت مدیر (Admin Chat ID)
                </label>
                <input
                  type="text"
                  value={sysNotifySettings.telegram.adminChatId || ''}
                  onChange={(e) => setSysNotifySettings({
                    ...sysNotifySettings,
                    telegram: { ...sysNotifySettings.telegram, adminChatId: e.target.value }
                  })}
                  placeholder="12345678"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 dir-ltr text-right"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  آدرس API تلگرام (پیش‌فرض Telegram API)
                </label>
                <input
                  type="text"
                  value={sysNotifySettings.telegram.apiUrl || 'https://api.telegram.org'}
                  onChange={(e) => setSysNotifySettings({
                    ...sysNotifySettings,
                    telegram: { ...sysNotifySettings.telegram, apiUrl: e.target.value }
                  })}
                  placeholder="https://api.telegram.org"
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 dir-ltr text-right"
                />
              </div>
            </div>

            {/* Test Telegram Box */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                value={testTelegramChatId}
                onChange={(e) => setTestTelegramChatId(e.target.value)}
                placeholder="Chat ID جهت تست پیام تلگرام..."
                className="w-full sm:w-64 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 dir-ltr text-right"
              />
              <button
                type="button"
                onClick={handleTestTelegram}
                disabled={testingTelegram}
                className="w-full sm:w-auto px-4 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950 dark:hover:bg-sky-900 text-sky-300 border border-sky-200 dark:border-sky-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {testingTelegram ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SendHorizontal className="w-3.5 h-3.5" />}
                <span>تست ارسال پیام تلگرام</span>
              </button>
            </div>
          </div>

          {/* Submit Save System Notification Settings Button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSaveNotificationSettings}
              disabled={savingNotifySettings}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {savingNotifySettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>ذخیره تنظیمات اطلاع‌رسانی در سیستم</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
