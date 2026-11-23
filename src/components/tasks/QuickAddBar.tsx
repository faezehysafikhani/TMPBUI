import React, { useState } from 'react';
import { LayoutTemplate, Loader2, Plus } from 'lucide-react';
import type { Priority, User } from '../../types';
import { PRIORITIES } from '../../types';
import { AdminDialog, Field, inputClass, Notice, PrimaryButton, SecondaryButton } from '../admin/AdminUi';
import { JalaliDatePicker } from '../JalaliDatePicker';
import { showToast } from '../../utils/toast';
import { userErrorMessage } from '../../utils/errorMessages';
import { toPersianDigits } from '../../utils/helpers';
import { can } from '../../utils/permissions';
import { instantiateTemplate, quickAddTask, TASK_FEATURE_PERMISSIONS } from '../../services/taskFeaturesApi';
import { useTemplates } from './taskLookups';
import type { TaskTemplate } from './types';

/**
 * «ثبت سریع» above the board (CAT-68): a title and Enter is enough - due today, given to the person
 * adding it. «از قالب» makes a task or project from a template (CAT-254). The new task reaches the
 * board through the live update.
 */
export const QuickAddBar: React.FC<{ currentUser?: User | null }> = ({ currentUser }) => {
  const allowed = can(currentUser, TASK_FEATURE_PERMISSIONS.create);
  const templates = useTemplates(allowed);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  if (!allowed) return null;

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await quickAddTask(title, priority);
      showToast(`«${title.trim()}» برای امروز ثبت شد.`, 'ok', 4000);
      setTitle('');
    } catch (err) {
      showToast(userErrorMessage(err, 'فعالیت ثبت نشد.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form onSubmit={add} className="flex flex-wrap items-center gap-2 p-2 pr-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-shadow" aria-label="ثبت سریع فعالیت">
        <Plus className="w-5 h-5 text-indigo-500 shrink-0" aria-hidden />
        <input
          id="quick-add-title"
          className="flex-1 min-w-[180px] bg-transparent px-2 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="ثبت سریع: عنوان فعالیت را بنویسید و Enter بزنید (موعد امروز، مسئول خودتان)…"
        />
        <select
          id="quick-add-priority"
          aria-label="اولویت"
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className="h-9 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200"
        >
          {(Object.keys(PRIORITIES) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITIES[p].title}</option>)}
        </select>
        <button type="submit" disabled={saving || !title.trim()} className="inline-flex items-center gap-1 h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold cursor-pointer disabled:opacity-40">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          ثبت
        </button>
        {templates.length > 0 && (
          <button type="button" onClick={() => setPicking(true)} className="inline-flex items-center gap-1 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
            <LayoutTemplate className="w-3.5 h-3.5" /> از قالب
          </button>
        )}
      </form>
      {picking && <UseTemplateDialog templates={templates} onClose={() => setPicking(false)} />}
    </>
  );
};

export const UseTemplateDialog: React.FC<{ templates: TaskTemplate[]; initialId?: string; onClose: () => void }> = ({ templates, initialId, onClose }) => {
  const [templateId, setTemplateId] = useState(initialId || templates[0]?.id || '');
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const template = templates.find((t) => t.id === templateId);

  const save = async () => {
    if (!template) { setError('قالب را انتخاب کنید.'); return; }
    setSaving(true);
    try {
      await instantiateTemplate(template.id, { title, dueDate });
      showToast(`${template.isProject ? 'پروژه' : 'فعالیت'} از قالب «${template.name}» ساخته شد.`, 'ok');
      onClose();
    } catch (err) {
      setError(userErrorMessage(err, 'فعالیت از قالب ساخته نشد.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminDialog
      title="ساخت فعالیت از قالب"
      onClose={onClose}
      footer={<><SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving || !template} onClick={save}>ساخت</PrimaryButton></>}
    >
      {error && <Notice type="error">{error}</Notice>}
      <Field label="قالب" required>
        <select id="use-template" className={inputClass} value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.isProject ? ' (پروژه)' : ''}</option>)}
        </select>
      </Field>
      {template && (
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {template.body.subTasks.length > 0 && <>{toPersianDigits(template.body.subTasks.length)} زیرکار · </>}
          {template.body.criteria.length > 0 && <>{toPersianDigits(template.body.criteria.length)} معیار پذیرش · </>}
          موعد پیش‌فرض: {template.body.dueInDays === 0 ? 'همان روز' : `${toPersianDigits(template.body.dueInDays)} روز بعد`}
        </p>
      )}
      <Field label="عنوان" hint="خالی بماند، عنوان قالب استفاده می‌شود.">
        <input id="use-template-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={template?.body.title} />
      </Field>
      <Field label="موعد انجام" hint="خالی بماند، موعد پیش‌فرض قالب استفاده می‌شود.">
        <JalaliDatePicker value={dueDate} onChange={setDueDate} ariaLabel="موعد انجام" blockOffDays />
      </Field>
    </AdminDialog>
  );
};
