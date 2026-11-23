import React, { useEffect, useState } from 'react';
import { Gauge, LayoutTemplate, ListChecks, Pencil, Plus, Shapes, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { Priority, TaskStatus } from '../../types';
import { PRIORITIES, STATUSES } from '../../types';
import {
  AdminCard,
  AdminDialog,
  Field,
  IconAction,
  inputClass,
  Notice,
  PillTabs,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  TabItem,
  toLatinDigits,
  Toggle,
} from '../admin/AdminUi';
import { appConfirm } from '../../utils/appDialog';
import { showToast } from '../../utils/toast';
import { userErrorMessage } from '../../utils/errorMessages';
import { toPersianDigits } from '../../utils/helpers';
import {
  createCustomField,
  createCustomStatus,
  createTemplate,
  createWorkType,
  deleteCustomField,
  deleteCustomStatus,
  deleteTemplate,
  deleteWorkType,
  getWipLimit,
  PRIORITY_FROM_SERVER,
  PRIORITY_TO_SERVER,
  setWipLimit,
  STATUS_FROM_SERVER,
  STATUS_TO_SERVER,
  TASK_FEATURE_PERMISSIONS,
  updateCustomField,
  updateCustomStatus,
  updateTemplate,
  updateWorkType,
} from '../../services/taskFeaturesApi';
import {
  refreshCustomFields,
  refreshCustomStatuses,
  refreshTemplates,
  refreshWorkTypes,
  safeColor,
  useCustomFields,
  useCustomStatuses,
  useTemplates,
  useWorkTypes,
} from './taskLookups';
import type { CustomField, CustomFieldKind, CustomStatus, TaskTemplate, TemplateBody, WorkType } from './types';

/**
 * Settings tab «تنظیمات فعالیت» (statuses, work types, custom fields, WIP limits, templates). Track 1 owns
 * this file: who sees the tab (canSeeTaskSettings) and what is in it. SystemAdministration only asks these
 * two exports (docs/UI-WORKSTREAMS.md).
 */
export function canSeeTaskSettings(can: (permission: string) => boolean): boolean {
  return can(TASK_FEATURE_PERMISSIONS.manageStatuses) || can(TASK_FEATURE_PERMISSIONS.manageTemplates);
}

type Section = 'statuses' | 'work-types' | 'fields' | 'wip' | 'templates';

export const TaskSettingsTab: React.FC<{ can: (permission: string) => boolean }> = ({ can }) => {
  const manageStatuses = can(TASK_FEATURE_PERMISSIONS.manageStatuses);
  const manageTemplates = can(TASK_FEATURE_PERMISSIONS.manageTemplates);
  const tabs: TabItem<Section>[] = [
    ...(manageStatuses
      ? ([
          { id: 'statuses', label: 'وضعیت‌های سفارشی', icon: ListChecks },
          { id: 'work-types', label: 'انواع فعالیت', icon: Shapes },
          { id: 'fields', label: 'فیلدهای سفارشی', icon: SlidersHorizontal },
          { id: 'wip', label: 'سقف کار در جریان', icon: Gauge },
        ] as TabItem<Section>[])
      : []),
    ...(manageTemplates ? ([{ id: 'templates', label: 'قالب‌ها', icon: LayoutTemplate }] as TabItem<Section>[]) : []),
  ];
  const [active, setActive] = useState<Section>(tabs[0]?.id ?? 'templates');
  const current = tabs.some((t) => t.id === active) ? active : tabs[0]?.id;

  return (
    <div className="space-y-4">
      {tabs.length > 1 && <PillTabs tabs={tabs} active={current ?? 'templates'} onChange={setActive} />}
      {current === 'statuses' && <StatusesSection />}
      {current === 'work-types' && <WorkTypesSection />}
      {current === 'fields' && <FieldsSection />}
      {current === 'wip' && <WipSection />}
      {current === 'templates' && <TemplatesSection />}
    </div>
  );
};

// ------------------------------------------------------------------ shared bits

const SectionCard: React.FC<{ title: string; description: string; onAdd?: () => void; addLabel?: string; children: React.ReactNode }> = ({ title, description, onAdd, addLabel, children }) => (
  <AdminCard className="p-5 sm:p-6 space-y-4">
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-2xl">{description}</p>
      </div>
      {onAdd && <PrimaryButton type="button" onClick={onAdd} className="shrink-0"><Plus className="w-4 h-4" />{addLabel}</PrimaryButton>}
    </div>
    {children}
  </AdminCard>
);

const EmptyRow: React.FC<{ text: string }> = ({ text }) => (
  <p className="p-6 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">{text}</p>
);

const ColorDot: React.FC<{ color: string | null }> = ({ color }) => (
  <span className="w-3 h-3 rounded-full shrink-0 border border-black/10" style={{ background: safeColor(color) || '#94a3b8' }} />
);

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#64748b'];
const ColorPicker: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="رنگ">
    {PALETTE.map((c) => (
      <button
        key={c}
        type="button"
        role="radio"
        aria-checked={value === c}
        aria-label={c}
        onClick={() => onChange(c)}
        className={`w-7 h-7 rounded-full cursor-pointer border-2 ${value === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'}`}
        style={{ background: c }}
      />
    ))}
  </div>
);

/** Runs a delete after asking, then refreshes the list it belongs to. */
async function confirmDelete(message: string, action: () => Promise<unknown>, refresh: () => unknown, done: string) {
  if (!(await appConfirm(message, { confirmLabel: 'حذف', danger: true }))) return;
  try {
    await action();
    await refresh();
    showToast(done, 'ok');
  } catch (err) {
    showToast(userErrorMessage(err, 'حذف انجام نشد.'), 'error');
  }
}

// ------------------------------------------------------------------ custom statuses (CAT-253)

const StatusesSection: React.FC = () => {
  const statuses = useCustomStatuses();
  const [editing, setEditing] = useState<CustomStatus | 'new' | null>(null);
  const sorted = [...statuses].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'fa'));
  return (
    <SectionCard
      title="وضعیت‌های سفارشی"
      description="برچسب‌های دلخواه مثل «در انتظار مشتری» یا «در بازبینی». هر وضعیت سفارشی زیرمجموعهٔ یکی از چهار وضعیت اصلی است؛ گزارش‌ها و قواعد سامانه همان وضعیت اصلی را می‌شمارند."
      onAdd={() => setEditing('new')}
      addLabel="وضعیت جدید"
    >
      {sorted.length === 0 ? <EmptyRow text="هنوز وضعیت سفارشی تعریف نشده است." /> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {sorted.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5">
              <ColorDot color={s.color} />
              <span className="font-bold text-sm text-slate-800 dark:text-slate-100 flex-1">{s.name}</span>
              <StatusBadge tone="slate">{STATUSES[STATUS_FROM_SERVER[s.category]]?.title}</StatusBadge>
              {!s.isActive && <StatusBadge tone="amber">غیرفعال</StatusBadge>}
              <IconAction icon={Pencil} label="ویرایش" onClick={() => setEditing(s)} />
              <IconAction icon={Trash2} label="حذف" tone="rose" onClick={() => confirmDelete(`وضعیت «${s.name}» حذف شود؟ فعالیت‌هایش وضعیت اصلی خود را نگه می‌دارند.`, () => deleteCustomStatus(s.id), refreshCustomStatuses, 'وضعیت حذف شد.')} />
            </li>
          ))}
        </ul>
      )}
      {editing && <StatusDialog status={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </SectionCard>
  );
};

const StatusDialog: React.FC<{ status: CustomStatus | null; onClose: () => void }> = ({ status, onClose }) => {
  const [name, setName] = useState(status?.name || '');
  const [category, setCategory] = useState<TaskStatus>(status ? STATUS_FROM_SERVER[status.category] : 'in_progress');
  const [color, setColor] = useState(safeColor(status?.color) || PALETTE[0]);
  const [sortOrder, setSortOrder] = useState(String(status?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(status?.isActive ?? true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) { setError('نام وضعیت را وارد کنید.'); return; }
    setSaving(true);
    try {
      const input = { name: name.trim(), category: STATUS_TO_SERVER[category], color, sortOrder: Number(sortOrder) || 0, isActive };
      if (status) await updateCustomStatus(status.id, input); else await createCustomStatus(input);
      await refreshCustomStatuses();
      showToast('وضعیت ذخیره شد.', 'ok');
      onClose();
    } catch (err) {
      setError(userErrorMessage(err, 'وضعیت ذخیره نشد.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AdminDialog title={status ? 'ویرایش وضعیت' : 'وضعیت جدید'} onClose={onClose} footer={<><SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving} onClick={save}>ذخیره</PrimaryButton></>}>
      {error && <Notice type="error">{error}</Notice>}
      <Field label="نام" required><input id="status-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
      <Field label="زیرمجموعهٔ وضعیت اصلی" required>
        <select id="status-category" className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as TaskStatus)}>
          {(Object.keys(STATUSES) as TaskStatus[]).map((s) => <option key={s} value={s}>{STATUSES[s].title}</option>)}
        </select>
      </Field>
      <Field label="رنگ"><ColorPicker value={color} onChange={setColor} /></Field>
      <Field label="ترتیب نمایش" hint="عدد کوچک‌تر بالاتر می‌آید."><input id="status-order" className={inputClass} inputMode="numeric" dir="ltr" value={sortOrder} onChange={(e) => setSortOrder(toLatinDigits(e.target.value))} /></Field>
      {status && <Toggle checked={isActive} onChange={setIsActive} label="فعال" description="وضعیت غیرفعال برای فعالیت‌های جدید قابل انتخاب نیست." />}
    </AdminDialog>
  );
};

// ------------------------------------------------------------------ work types (CAT-251)

const WorkTypesSection: React.FC = () => {
  const types = useWorkTypes();
  const [editing, setEditing] = useState<WorkType | 'new' | null>(null);
  const sorted = [...types].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'fa'));
  return (
    <SectionCard
      title="انواع فعالیت"
      description="دسته‌بندی کارها مثل «درخواست»، «اشکال» یا «کار روزمره». نوع هر فعالیت از جزئیات آن تعیین می‌شود و قواعد مسیردهی می‌توانند بر اساس آن کار کنند."
      onAdd={() => setEditing('new')}
      addLabel="نوع جدید"
    >
      {sorted.length === 0 ? <EmptyRow text="هنوز نوع فعالیتی تعریف نشده است." /> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {sorted.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2.5">
              <ColorDot color={t.color} />
              <span className="font-bold text-sm text-slate-800 dark:text-slate-100 flex-1">{t.name}</span>
              {!t.isActive && <StatusBadge tone="amber">غیرفعال</StatusBadge>}
              <IconAction icon={Pencil} label="ویرایش" onClick={() => setEditing(t)} />
              <IconAction icon={Trash2} label="حذف" tone="rose" onClick={() => confirmDelete(`نوع «${t.name}» حذف شود؟ فعالیت‌های این نوع فقط برچسب نوع را از دست می‌دهند.`, () => deleteWorkType(t.id), refreshWorkTypes, 'نوع فعالیت حذف شد.')} />
            </li>
          ))}
        </ul>
      )}
      {editing && <WorkTypeDialog type={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </SectionCard>
  );
};

const WorkTypeDialog: React.FC<{ type: WorkType | null; onClose: () => void }> = ({ type, onClose }) => {
  const [name, setName] = useState(type?.name || '');
  const [color, setColor] = useState(safeColor(type?.color) || PALETTE[1]);
  const [sortOrder, setSortOrder] = useState(String(type?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(type?.isActive ?? true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) { setError('نام نوع فعالیت را وارد کنید.'); return; }
    setSaving(true);
    try {
      const input = { name: name.trim(), color, sortOrder: Number(sortOrder) || 0, isActive };
      if (type) await updateWorkType(type.id, input); else await createWorkType(input);
      await refreshWorkTypes();
      showToast('نوع فعالیت ذخیره شد.', 'ok');
      onClose();
    } catch (err) {
      setError(userErrorMessage(err, 'نوع فعالیت ذخیره نشد.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AdminDialog title={type ? 'ویرایش نوع فعالیت' : 'نوع فعالیت جدید'} onClose={onClose} footer={<><SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving} onClick={save}>ذخیره</PrimaryButton></>}>
      {error && <Notice type="error">{error}</Notice>}
      <Field label="نام" required><input id="work-type-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></Field>
      <Field label="رنگ"><ColorPicker value={color} onChange={setColor} /></Field>
      <Field label="ترتیب نمایش"><input id="work-type-order" className={inputClass} inputMode="numeric" dir="ltr" value={sortOrder} onChange={(e) => setSortOrder(toLatinDigits(e.target.value))} /></Field>
      {type && <Toggle checked={isActive} onChange={setIsActive} label="فعال" />}
    </AdminDialog>
  );
};

// ------------------------------------------------------------------ custom fields (CAT-252)

const KIND_LABELS: Record<CustomFieldKind, string> = { Text: 'متن', Number: 'عدد', Date: 'تاریخ', Choice: 'انتخابی', Boolean: 'بله / خیر' };

const FieldsSection: React.FC = () => {
  const fields = useCustomFields();
  const [editing, setEditing] = useState<CustomField | 'new' | null>(null);
  const sorted = [...fields].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'fa'));
  return (
    <SectionCard
      title="فیلدهای سفارشی"
      description="اطلاعات اضافه‌ای که سازمان روی هر فعالیت لازم دارد، مثل «شماره قرارداد» یا «مشتری». مقدار هر فیلد از جزئیات فعالیت ثبت می‌شود؛ فیلد اجباری بدون مقدار ذخیره نمی‌شود."
      onAdd={() => setEditing('new')}
      addLabel="فیلد جدید"
    >
      {sorted.length === 0 ? <EmptyRow text="هنوز فیلد سفارشی تعریف نشده است." /> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {sorted.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="font-bold text-sm text-slate-800 dark:text-slate-100 flex-1 min-w-0">{f.name}</span>
              <StatusBadge tone="indigo">{KIND_LABELS[f.kind]}</StatusBadge>
              {f.isRequired && <StatusBadge tone="red">اجباری</StatusBadge>}
              {!f.isActive && <StatusBadge tone="amber">غیرفعال</StatusBadge>}
              <IconAction icon={Pencil} label="ویرایش" onClick={() => setEditing(f)} />
              <IconAction icon={Trash2} label="حذف" tone="rose" onClick={() => confirmDelete(`فیلد «${f.name}» حذف شود؟ مقدارهای ثبت‌شدهٔ آن روی همهٔ فعالیت‌ها هم پاک می‌شود.`, () => deleteCustomField(f.id), refreshCustomFields, 'فیلد حذف شد.')} />
            </li>
          ))}
        </ul>
      )}
      {editing && <FieldDialog field={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </SectionCard>
  );
};

const FieldDialog: React.FC<{ field: CustomField | null; onClose: () => void }> = ({ field, onClose }) => {
  const [name, setName] = useState(field?.name || '');
  const [kind, setKind] = useState<CustomFieldKind>(field?.kind || 'Text');
  const [options, setOptions] = useState((field?.options || []).join('\n'));
  const [isRequired, setIsRequired] = useState(field?.isRequired ?? false);
  const [sortOrder, setSortOrder] = useState(String(field?.sortOrder ?? 0));
  const [isActive, setIsActive] = useState(field?.isActive ?? true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const optionList = options.split('\n').map((o) => o.trim()).filter(Boolean);
  const save = async () => {
    if (!name.trim()) { setError('نام فیلد را وارد کنید.'); return; }
    if (kind === 'Choice' && optionList.length < 2) { setError('برای فیلد انتخابی دست‌کم دو گزینه لازم است.'); return; }
    setSaving(true);
    try {
      const input = { name: name.trim(), kind, options: kind === 'Choice' ? optionList : null, isRequired, sortOrder: Number(sortOrder) || 0, isActive };
      if (field) await updateCustomField(field.id, input); else await createCustomField(input);
      await refreshCustomFields();
      showToast('فیلد ذخیره شد.', 'ok');
      onClose();
    } catch (err) {
      setError(userErrorMessage(err, 'فیلد ذخیره نشد.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <AdminDialog title={field ? 'ویرایش فیلد' : 'فیلد جدید'} onClose={onClose} footer={<><SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving} onClick={save}>ذخیره</PrimaryButton></>}>
      {error && <Notice type="error">{error}</Notice>}
      <Field label="نام" required><input id="field-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
      <Field label="نوع مقدار" required>
        <select id="field-kind" className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as CustomFieldKind)}>
          {(Object.keys(KIND_LABELS) as CustomFieldKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </select>
      </Field>
      {kind === 'Choice' && (
        <Field label="گزینه‌ها" required hint="هر خط یک گزینه.">
          <textarea id="field-options" className={`${inputClass} min-h-28`} value={options} onChange={(e) => setOptions(e.target.value)} />
        </Field>
      )}
      <Field label="ترتیب نمایش"><input id="field-order" className={inputClass} inputMode="numeric" dir="ltr" value={sortOrder} onChange={(e) => setSortOrder(toLatinDigits(e.target.value))} /></Field>
      <Toggle checked={isRequired} onChange={setIsRequired} label="اجباری" description="فعالیت بدون مقدار این فیلد ذخیره نمی‌شود." />
      {field && <Toggle checked={isActive} onChange={setIsActive} label="فعال" />}
    </AdminDialog>
  );
};

// ------------------------------------------------------------------ WIP limit (CAT-100)

const WipSection: React.FC = () => {
  const [value, setValue] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    getWipLimit()
      .then((r) => { setValue(r.limitPerUser ? String(r.limitPerUser) : ''); setLoaded(true); })
      .catch((err) => setError(userErrorMessage(err, 'سقف کار در جریان خوانده نشد.')));
  }, []);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = value.trim() ? Number(value) : null;
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 1000)) { setError('سقف باید عددی بین ۱ تا ۱۰۰۰ باشد، یا برای «بدون سقف» خالی بماند.'); return; }
    setSaving(true);
    try {
      await setWipLimit(n);
      setError('');
      showToast(n ? `سقف ${toPersianDigits(n)} فعالیت در حال انجام برای هر نفر ذخیره شد.` : 'سقف کار در جریان برداشته شد.', 'ok');
    } catch (err) {
      setError(userErrorMessage(err, 'سقف ذخیره نشد.'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <SectionCard
      title="سقف کار در جریان (WIP)"
      description="بیشترین تعداد فعالیت «در حال انجام» که هر نفر هم‌زمان می‌تواند داشته باشد. وقتی سقف پر است، شروع فعالیت تازه رد می‌شود تا یکی تمام یا متوقف شود."
    >
      {error && <Notice type="error">{error}</Notice>}
      <form onSubmit={save} className="flex flex-col sm:flex-row sm:items-end gap-3 max-w-md">
        <Field label="سقف برای هر نفر" hint="خالی: بدون سقف" className="flex-1">
          <input id="wip-limit" className={inputClass} inputMode="numeric" dir="ltr" value={value} disabled={!loaded} onChange={(e) => setValue(toLatinDigits(e.target.value))} placeholder="بدون سقف" />
        </Field>
        <PrimaryButton type="submit" disabled={saving || !loaded}>ذخیره</PrimaryButton>
      </form>
    </SectionCard>
  );
};

// ------------------------------------------------------------------ templates (CAT-254)

const TemplatesSection: React.FC = () => {
  const templates = useTemplates();
  const [editing, setEditing] = useState<TaskTemplate | 'new' | null>(null);
  const sorted = [...templates].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  return (
    <SectionCard
      title="قالب‌های فعالیت"
      description="فعالیت یا پروژهٔ آماده با زیرکار، معیار پذیرش و برچسب، برای کارهایی که تکرار می‌شوند. از «ثبت سریع» بالای بورد با دکمهٔ «از قالب» استفاده می‌شوند؛ از جزئیات هر فعالیت هم می‌توان قالب ساخت."
      onAdd={() => setEditing('new')}
      addLabel="قالب جدید"
    >
      {sorted.length === 0 ? <EmptyRow text="هنوز قالبی ساخته نشده است." /> : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {sorted.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="font-bold text-sm text-slate-800 dark:text-slate-100 flex-1 min-w-0">{t.name}</span>
              <StatusBadge tone={t.isProject ? 'green' : 'slate'}>{t.isProject ? 'پروژه' : 'فعالیت'}</StatusBadge>
              {t.body.subTasks.length > 0 && <span className="text-xs text-slate-500">{toPersianDigits(t.body.subTasks.length)} زیرکار</span>}
              <IconAction icon={Pencil} label="ویرایش" onClick={() => setEditing(t)} />
              <IconAction icon={Trash2} label="حذف" tone="rose" onClick={() => confirmDelete(`قالب «${t.name}» حذف شود؟ فعالیت‌هایی که با آن ساخته شده‌اند تغییری نمی‌کنند.`, () => deleteTemplate(t.id), refreshTemplates, 'قالب حذف شد.')} />
            </li>
          ))}
        </ul>
      )}
      {editing && <TemplateDialog template={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </SectionCard>
  );
};

const lines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);

const TemplateDialog: React.FC<{ template: TaskTemplate | null; onClose: () => void }> = ({ template, onClose }) => {
  const body = template?.body;
  const [name, setName] = useState(template?.name || '');
  const [title, setTitle] = useState(body?.title || '');
  const [description, setDescription] = useState(body?.description || '');
  const [priority, setPriority] = useState<Priority>(body ? PRIORITY_FROM_SERVER[body.priority] : 'medium');
  const [isProject, setIsProject] = useState(body?.isProject ?? false);
  const [dueInDays, setDueInDays] = useState(String(body?.dueInDays ?? 7));
  const [subTasks, setSubTasks] = useState((body?.subTasks || []).join('\n'));
  const [criteria, setCriteria] = useState((body?.criteria || []).join('\n'));
  const [tags, setTags] = useState((body?.tags || []).join('، '));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) { setError('نام قالب را وارد کنید.'); return; }
    if (!title.trim()) { setError('عنوان فعالیت را وارد کنید.'); return; }
    if (isProject && lines(subTasks).length === 0) { setError('پروژه دست‌کم یک زیرکار لازم دارد.'); return; }
    const days = Number(dueInDays);
    if (!Number.isInteger(days) || days < 0 || days > 3650) { setError('موعد باید عددی بین ۰ تا ۳۶۵۰ روز باشد.'); return; }
    const next: TemplateBody = {
      title: title.trim(),
      description: description.trim() || null,
      priority: PRIORITY_TO_SERVER[priority],
      isProject,
      dueInDays: days,
      subTasks: lines(subTasks),
      criteria: lines(criteria),
      tags: tags.split(/[،,]/).map((t) => t.trim()).filter(Boolean),
    };
    setSaving(true);
    try {
      if (template) await updateTemplate(template.id, name, next); else await createTemplate(name, next);
      await refreshTemplates();
      showToast('قالب ذخیره شد.', 'ok');
      onClose();
    } catch (err) {
      setError(userErrorMessage(err, 'قالب ذخیره نشد.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminDialog title={template ? 'ویرایش قالب' : 'قالب جدید'} wide onClose={onClose} footer={<><SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving} onClick={save}>ذخیره</PrimaryButton></>}>
      {error && <Notice type="error">{error}</Notice>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="نام قالب" required><input id="tpl-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></Field>
        <Field label="عنوان فعالیت" required><input id="tpl-title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} /></Field>
        <Field label="اولویت">
          <select id="tpl-priority" className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {(Object.keys(PRIORITIES) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITIES[p].title}</option>)}
          </select>
        </Field>
        <Field label="موعد (روز بعد از ساخت)" hint="۰ یعنی همان روز."><input id="tpl-due" className={inputClass} inputMode="numeric" dir="ltr" value={dueInDays} onChange={(e) => setDueInDays(toLatinDigits(e.target.value))} /></Field>
      </div>
      <Field label="توضیحات"><textarea id="tpl-description" className={`${inputClass} min-h-20`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} /></Field>
      <Toggle checked={isProject} onChange={setIsProject} label="پروژه" description="پروژه زیرکار دارد و پیشرفتش از زیرکارها حساب می‌شود." />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="زیرکارها" hint="هر خط یک زیرکار."><textarea id="tpl-subtasks" className={`${inputClass} min-h-28`} value={subTasks} onChange={(e) => setSubTasks(e.target.value)} /></Field>
        <Field label="معیارهای پذیرش" hint="هر خط یک معیار."><textarea id="tpl-criteria" className={`${inputClass} min-h-28`} value={criteria} onChange={(e) => setCriteria(e.target.value)} /></Field>
      </div>
      <Field label="برچسب‌ها" hint="با ویرگول جدا کنید."><input id="tpl-tags" className={inputClass} value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
    </AdminDialog>
  );
};
