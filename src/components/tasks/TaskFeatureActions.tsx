import React, { useEffect, useMemo, useState } from 'react';
import { Archive, BookmarkPlus, ListPlus, Send } from 'lucide-react';
import type { Task, User, WorkTeam } from '../../types';
import { AdminDialog, Field, inputClass, Notice, PrimaryButton, SecondaryButton } from '../admin/AdminUi';
import { appConfirm } from '../../utils/appDialog';
import { showToast } from '../../utils/toast';
import { userErrorMessage } from '../../utils/errorMessages';
import { toPersianDigits } from '../../utils/helpers';
import { can } from '../../utils/permissions';
import { fetchAllUsersPB, fetchUserTeamsAsyncPB } from '../../services/dataService';
import { addSubTasksInBulk, archiveTask, handOffTask, saveTaskAsTemplate, TASK_FEATURE_PERMISSIONS } from '../../services/taskFeaturesApi';
import { refreshTemplates } from './taskLookups';

type DialogKind = 'template' | 'handoff' | 'subtasks' | null;

/**
 * The task detail's Track 1 actions: archive (CAT-210), save as template (CAT-254), hand off to a person
 * or team (CAT-110) and add many subtasks at once (CAT-62). Each shows only when the user may do it;
 * the server checks again (archive and subtasks: the owner or a task manager).
 */
export const TaskFeatureActions: React.FC<{
  task: Task;
  currentUser: User;
  /** The owner or a task manager: may archive and change the task's structure. */
  isManager: boolean;
  /** Responsible people may hand a task on too. */
  isResponsible: boolean;
  onArchived: () => void;
}> = ({ task, currentUser, isManager, isResponsible, onArchived }) => {
  const [dialog, setDialog] = useState<DialogKind>(null);
  const canEdit = can(currentUser, TASK_FEATURE_PERMISSIONS.edit);
  const canTemplate = can(currentUser, TASK_FEATURE_PERMISSIONS.manageTemplates);
  const finished = task.status === 'completed';

  const archive = async () => {
    const ok = await appConfirm(`«${task.title}» به بایگانی برود؟ از بورد و گزارش‌ها پنهان می‌شود ولی چیزی حذف نمی‌شود و از صفحهٔ «بایگانی» قابل بازگرداندن است.`, { confirmLabel: 'بایگانی' });
    if (!ok) return;
    try {
      await archiveTask(task.id);
      showToast('فعالیت بایگانی شد.', 'ok');
      onArchived();
    } catch (err) {
      showToast(userErrorMessage(err, 'فعالیت بایگانی نشد.'), 'error');
    }
  };

  const buttons: React.ReactNode[] = [];
  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer';
  if (canEdit && (isManager || isResponsible) && !finished) {
    buttons.push(<button key="handoff" type="button" className={btn} onClick={() => setDialog('handoff')}><Send className="w-3.5 h-3.5" />تحویل به دیگری</button>);
  }
  if (canEdit && isManager && task.isProject) {
    buttons.push(<button key="subtasks" type="button" className={btn} onClick={() => setDialog('subtasks')}><ListPlus className="w-3.5 h-3.5" />افزودن چند زیرکار</button>);
  }
  if (canTemplate) {
    buttons.push(<button key="template" type="button" className={btn} onClick={() => setDialog('template')}><BookmarkPlus className="w-3.5 h-3.5" />ذخیره به‌عنوان قالب</button>);
  }
  if (canEdit && isManager) {
    buttons.push(<button key="archive" type="button" className={btn} onClick={archive}><Archive className="w-3.5 h-3.5" />بایگانی</button>);
  }
  if (buttons.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2" aria-label="کارهای بیشتر روی فعالیت">{buttons}</div>
      {dialog === 'template' && <SaveTemplateDialog task={task} onClose={() => setDialog(null)} />}
      {dialog === 'handoff' && <HandoffDialog task={task} currentUser={currentUser} onClose={() => setDialog(null)} />}
      {dialog === 'subtasks' && <BulkSubtasksDialog task={task} onClose={() => setDialog(null)} />}
    </>
  );
};

const SaveTemplateDialog: React.FC<{ task: Task; onClose: () => void }> = ({ task, onClose }) => {
  const [name, setName] = useState(task.title);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) { setError('نام قالب را وارد کنید.'); return; }
    setSaving(true);
    try {
      await saveTaskAsTemplate(task.id, name);
      refreshTemplates();
      showToast('قالب ذخیره شد. از دکمهٔ «از قالب» در ثبت سریع قابل استفاده است.', 'ok');
      onClose();
    } catch (err) {
      setError(userErrorMessage(err, 'قالب ذخیره نشد.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AdminDialog
      title="ذخیره به‌عنوان قالب"
      onClose={onClose}
      footer={<><SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving} onClick={save}>ذخیره قالب</PrimaryButton></>}
    >
      {error && <Notice type="error">{error}</Notice>}
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">عنوان، توضیحات، اولویت، زیرکارها، معیارهای پذیرش و برچسب‌های این فعالیت در قالب ذخیره می‌شود. موعد به‌صورت «چند روز بعد از ساخت» نگه داشته می‌شود؛ مسئول ذخیره نمی‌شود.</p>
      <Field label="نام قالب" required>
        <input id="template-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoFocus />
      </Field>
    </AdminDialog>
  );
};

const HandoffDialog: React.FC<{ task: Task; currentUser: User; onClose: () => void }> = ({ task, currentUser, onClose }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<WorkTeam[]>([]);
  const [toUserId, setToUserId] = useState('');
  const [toGroupId, setToGroupId] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAllUsersPB().then((list) => setUsers(list.filter((u) => u.id !== currentUser.id))).catch(() => setUsers([]));
    fetchUserTeamsAsyncPB(currentUser.id).then(setTeams).catch(() => setTeams([]));
  }, [currentUser.id]);

  const sortedUsers = useMemo(() => [...users].sort((a, b) => (a.name || a.username).localeCompare(b.name || b.username, 'fa')), [users]);

  const save = async () => {
    if (!toUserId && !toGroupId) { setError('گیرندهٔ تحویل (فرد یا تیم) را مشخص کنید.'); return; }
    if (!note.trim()) { setError('توضیح تحویل را بنویسید.'); return; }
    setSaving(true);
    try {
      await handOffTask(task.id, { toUserId, toGroupId, note });
      showToast('فعالیت تحویل داده شد.', 'ok');
      onClose();
    } catch (err) {
      setError(userErrorMessage(err, 'فعالیت تحویل داده نشد.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminDialog
      title={`تحویل «${task.title}»`}
      onClose={onClose}
      footer={<><SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving} onClick={save}>تحویل</PrimaryButton></>}
    >
      {error && <Notice type="error">{error}</Notice>}
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">فعالیت به فرد یا تیم دیگری سپرده می‌شود و توضیح شما در تاریخچهٔ فعالیت می‌ماند.</p>
      <Field label="فرد گیرنده">
        <select id="handoff-user" className={inputClass} value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
          <option value="">بدون تغییر مسئول</option>
          {sortedUsers.map((u) => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
        </select>
      </Field>
      {teams.length > 0 && (
        <Field label="تیم گیرنده">
          <select id="handoff-team" className={inputClass} value={toGroupId} onChange={(e) => setToGroupId(e.target.value)}>
            <option value="">بدون تغییر تیم</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="توضیح تحویل" required hint="مثلاً چه کاری انجام شده و چه چیزی مانده است.">
        <textarea id="handoff-note" className={`${inputClass} min-h-24`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      </Field>
    </AdminDialog>
  );
};

const BulkSubtasksDialog: React.FC<{ task: Task; onClose: () => void }> = ({ task, onClose }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const titles = text.split('\n').map((t) => t.trim()).filter(Boolean);
  const save = async () => {
    if (titles.length === 0) { setError('دست‌کم یک عنوان بنویسید.'); return; }
    if (titles.length > 100) { setError('در هر بار حداکثر ۱۰۰ زیرکار می‌توان افزود.'); return; }
    setSaving(true);
    try {
      await addSubTasksInBulk(task.id, titles);
      showToast(`${toPersianDigits(titles.length)} زیرکار اضافه شد.`, 'ok');
      onClose();
    } catch (err) {
      setError(userErrorMessage(err, 'زیرکارها اضافه نشد.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AdminDialog
      title="افزودن چند زیرکار"
      onClose={onClose}
      footer={<><SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving || titles.length === 0} onClick={save}>افزودن {titles.length > 0 ? toPersianDigits(titles.length) : ''} زیرکار</PrimaryButton></>}
    >
      {error && <Notice type="error">{error}</Notice>}
      <Field label="عنوان زیرکارها" hint="هر خط یک زیرکار. زیرکارها با اهمیت متوسط و بدون مسئول ساخته می‌شوند و بعداً قابل ویرایش‌اند.">
        <textarea id="bulk-subtasks" className={`${inputClass} min-h-48`} value={text} onChange={(e) => setText(e.target.value)} placeholder={'بررسی اسناد\nتهیه گزارش\nارسال برای تأیید'} autoFocus />
      </Field>
    </AdminDialog>
  );
};
