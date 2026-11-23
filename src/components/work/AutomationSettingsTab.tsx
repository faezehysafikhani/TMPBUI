import React, { useCallback, useEffect, useState } from 'react';
import { FolderInput, History, Pencil, Plus, Trash2, Workflow, X } from 'lucide-react';
import type { User, WorkTeam } from '../../types';
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
import { getSessionUser } from '../../services/nexusApi';
import { fetchAllUsersPB, fetchUserTeamsAsyncPB } from '../../services/dataService';
import {
  createAutomationRule,
  createRequestCategory,
  deleteAutomationRule,
  listAutomationLog,
  listAutomationRules,
  listRequestCategories,
  listWorkTypes,
  updateAutomationRule,
  updateRequestCategory,
  WORK_PERMISSIONS,
} from '../../services/workApi';
import type {
  AutomationAction,
  AutomationActionType,
  AutomationConditions,
  AutomationLogEntry,
  AutomationRule,
  AutomationTrigger,
  RequestCategory,
  ServerPriority,
  ServerTaskStatus,
} from './types';

/**
 * Settings tab «اتوماسیون و گزارش» (automation rules and their log, request categories). Track 2 owns this
 * file: who sees the tab (canSeeAutomationSettings) and what is in it. SystemAdministration only asks these
 * two exports (docs/UI-WORKSTREAMS.md). Each user's own report digests are on the reports page.
 */
export function canSeeAutomationSettings(can: (permission: string) => boolean): boolean {
  return can(WORK_PERMISSIONS.manageAutomation) || can(WORK_PERMISSIONS.manageRequests);
}

type Section = 'rules' | 'log' | 'categories';

export const AutomationSettingsTab: React.FC<{ can: (permission: string) => boolean }> = ({ can }) => {
  const automation = can(WORK_PERMISSIONS.manageAutomation);
  const requests = can(WORK_PERMISSIONS.manageRequests);
  const tabs: TabItem<Section>[] = [
    ...(automation ? ([{ id: 'rules', label: 'قواعد خودکار', icon: Workflow }, { id: 'log', label: 'گزارش اجرا', icon: History }] as TabItem<Section>[]) : []),
    ...(requests ? ([{ id: 'categories', label: 'دسته‌های درخواست', icon: FolderInput }] as TabItem<Section>[]) : []),
  ];
  const [active, setActive] = useState<Section>(tabs[0]?.id ?? 'categories');
  const current = tabs.some((t) => t.id === active) ? active : tabs[0]?.id;
  return (
    <div className="space-y-4">
      {tabs.length > 1 && <PillTabs tabs={tabs} active={current ?? 'rules'} onChange={setActive} />}
      {current === 'rules' && <RulesSection />}
      {current === 'log' && <LogSection />}
      {current === 'categories' && <CategoriesSection />}
    </div>
  );
};

// ------------------------------------------------------------------ labels

const TRIGGERS: Record<AutomationTrigger, string> = {
  TaskCreated: 'وقتی فعالیتی ساخته شد',
  StatusChanged: 'وقتی وضعیت فعالیت تغییر کرد',
  SlaBreached: 'وقتی مهلت پاسخ (SLA) گذشت',
  Overdue: 'وقتی موعد فعالیت گذشت و تمام نشده بود',
};
const ACTIONS: Record<AutomationActionType, string> = {
  SetPriority: 'تغییر اولویت',
  SetStatus: 'تغییر وضعیت',
  AssignUser: 'سپردن به یک نفر',
  AssignManager: 'سپردن به مدیر مسئول فعلی',
  EscalateUp: 'ارجاع به مدیران بالاتر',
  AssignGroup: 'سپردن به یک تیم',
  AddTag: 'افزودن برچسب',
  StartSla: 'شروع مهلت پاسخ (SLA)',
  Notify: 'اعلان به یک نفر',
};
const PRIORITY: Record<ServerPriority, string> = { Low: 'کم', Medium: 'متوسط', High: 'زیاد' };
const STATUS: Record<ServerTaskStatus, string> = { Todo: 'شروع نشده', InProgress: 'در حال انجام', Paused: 'متوقف', Completed: 'خاتمه یافته' };

/** One line for an action, as shown in the list. */
function describeAction(a: AutomationAction, people: User[], teams: WorkTeam[]): string {
  const who = (id?: string | null) => people.find((p) => p.id === id)?.name || 'یک نفر';
  switch (a.type) {
    case 'SetPriority': return `اولویت ← ${a.priority ? PRIORITY[a.priority] : '?'}`;
    case 'SetStatus': return `وضعیت ← ${a.status ? STATUS[a.status] : '?'}`;
    case 'AssignUser': return `سپردن به ${who(a.userId)}`;
    case 'AssignManager': return 'سپردن به مدیر مسئول';
    case 'EscalateUp': return `ارجاع ${toPersianDigits(a.levels || 1)} سطح بالاتر`;
    case 'AssignGroup': return `سپردن به تیم ${teams.find((t) => t.id === a.groupId)?.name || ''}`.trim();
    case 'AddTag': return `برچسب «${a.tag || ''}»`;
    case 'StartSla': return `SLA ${toPersianDigits(a.hours || 0)} ساعت${a.businessDaysOnly ? ' (روزهای کاری)' : ''}`;
    case 'Notify': return `اعلان به ${a.userId ? who(a.userId) : 'مالک فعالیت'}`;
    default: return a.type;
  }
}

function usePeopleAndTeams() {
  const [people, setPeople] = useState<User[]>([]);
  const [teams, setTeams] = useState<WorkTeam[]>([]);
  useEffect(() => {
    fetchAllUsersPB().then(setPeople).catch(() => setPeople([]));
    const me = getSessionUser();
    if (me) fetchUserTeamsAsyncPB(me.id).then(setTeams).catch(() => setTeams([]));
  }, []);
  return { people, teams };
}

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

// ------------------------------------------------------------------ rules (CAT-213, CAT-112, CAT-122, CAT-119)

const RulesSection: React.FC = () => {
  const [rules, setRules] = useState<AutomationRule[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<AutomationRule | 'new' | null>(null);
  const { people, teams } = usePeopleAndTeams();
  const load = useCallback(() => {
    listAutomationRules().then((r) => { setRules(r); setError(''); }).catch((err) => setError(userErrorMessage(err, 'قواعد خوانده نشد.')));
  }, []);
  useEffect(load, [load]);

  const remove = async (rule: AutomationRule) => {
    if (!(await appConfirm(`قاعدهٔ «${rule.name}» حذف شود؟`, { confirmLabel: 'حذف', danger: true }))) return;
    try { await deleteAutomationRule(rule.id); load(); showToast('قاعده حذف شد.', 'ok'); } catch (err) { showToast(userErrorMessage(err, 'حذف انجام نشد.'), 'error'); }
  };

  const sorted = [...(rules || [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'fa'));
  return (
    <SectionCard
      title="قواعد خودکار"
      description="«وقتی … و اگر … آنگاه …». مثلاً: وقتی فعالیتی با اولویت زیاد ساخته شد، مهلت پاسخ ۸ ساعت کاری شروع شود؛ یا وقتی موعد گذشت، به مدیر مسئول ارجاع شود. ارجاع به مدیر از چارت سازمانی پیدا می‌شود."
      onAdd={() => setEditing('new')}
      addLabel="قاعدهٔ جدید"
    >
      {error && <Notice type="error">{error}</Notice>}
      {rules && sorted.length === 0 && <p className="p-6 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">هنوز قاعده‌ای تعریف نشده است.</p>}
      <ul className="space-y-2.5">
        {sorted.map((r) => (
          <li key={r.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-sm text-slate-800 dark:text-slate-100 flex-1 min-w-0">{r.name}</span>
              {!r.isActive && <StatusBadge tone="amber">غیرفعال</StatusBadge>}
              <IconAction icon={Pencil} label="ویرایش" onClick={() => setEditing(r)} />
              <IconAction icon={Trash2} label="حذف" tone="rose" onClick={() => remove(r)} />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              <b>{TRIGGERS[r.trigger]}</b>
              {conditionText(r.conditions) && <> · اگر {conditionText(r.conditions)}</>}
              {' ← '}
              {r.actions.map((a) => describeAction(a, people, teams)).join('، ')}
            </p>
          </li>
        ))}
      </ul>
      {editing && <RuleDialog rule={editing === 'new' ? null : editing} people={people} teams={teams} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </SectionCard>
  );
};

function conditionText(c: AutomationConditions | null | undefined): string {
  if (!c) return '';
  const parts: string[] = [];
  if (c.priority) parts.push(`اولویت ${PRIORITY[c.priority]}`);
  if (c.status) parts.push(`وضعیت ${STATUS[c.status]}`);
  if (c.isProject === true) parts.push('پروژه باشد');
  if (c.isProject === false) parts.push('پروژه نباشد');
  if (c.titleContains) parts.push(`عنوان شامل «${c.titleContains}»`);
  if (c.workTypeId) parts.push('نوع فعالیت مشخص');
  return parts.join(' و ');
}

const RuleDialog: React.FC<{ rule: AutomationRule | null; people: User[]; teams: WorkTeam[]; onClose: () => void; onSaved: () => void }> = ({ rule, people, teams, onClose, onSaved }) => {
  const [name, setName] = useState(rule?.name || '');
  const [trigger, setTrigger] = useState<AutomationTrigger>(rule?.trigger || 'TaskCreated');
  const [conditions, setConditions] = useState<AutomationConditions>(rule?.conditions || {});
  const [actions, setActions] = useState<AutomationAction[]>(rule?.actions?.length ? rule.actions : [{ type: 'SetPriority', priority: 'High' }]);
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);
  const [workTypes, setWorkTypes] = useState<{ id: string; name: string; isActive: boolean }[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { listWorkTypes().then(setWorkTypes); }, []);

  const setCond = (patch: Partial<AutomationConditions>) => setConditions((c) => ({ ...c, ...patch }));
  const setAction = (i: number, patch: Partial<AutomationAction>) => setActions((list) => list.map((a, n) => (n === i ? { ...a, ...patch } : a)));

  const save = async () => {
    if (!name.trim()) { setError('نام قاعده را بنویسید.'); return; }
    if (actions.length === 0 || actions.length > 10) { setError('هر قاعده بین ۱ تا ۱۰ عمل لازم دارد.'); return; }
    for (const a of actions) {
      if (a.type === 'AssignUser' && !a.userId) { setError('برای «سپردن به یک نفر» شخص را انتخاب کنید.'); return; }
      if (a.type === 'AssignGroup' && !a.groupId) { setError('برای «سپردن به یک تیم» تیم را انتخاب کنید.'); return; }
      if (a.type === 'AddTag' && !a.tag?.trim()) { setError('برچسب را بنویسید.'); return; }
      if (a.type === 'StartSla' && !(a.hours && a.hours > 0)) { setError('مهلت SLA را به ساعت بنویسید.'); return; }
    }
    const clean: AutomationConditions = {
      priority: conditions.priority || null,
      status: conditions.status || null,
      isProject: conditions.isProject ?? null,
      titleContains: conditions.titleContains?.trim() || null,
      workTypeId: conditions.workTypeId || null,
    };
    setSaving(true);
    try {
      const input = { name: name.trim(), trigger, conditions: clean, actions, sortOrder: rule?.sortOrder ?? 0, isActive };
      if (rule) await updateAutomationRule(rule.id, input); else await createAutomationRule(input);
      showToast('قاعده ذخیره شد.', 'ok');
      onSaved();
    } catch (err) {
      setError(userErrorMessage(err, 'قاعده ذخیره نشد.'));
    } finally {
      setSaving(false);
    }
  };

  const personSelect = (id: string, value: string | null | undefined, onChange: (v: string | null) => void, emptyLabel: string) => (
    <select id={id} className={inputClass} value={value || ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{emptyLabel}</option>
      {people.map((p) => <option key={p.id} value={p.id}>{p.name || p.username}</option>)}
    </select>
  );

  return (
    <AdminDialog title={rule ? 'ویرایش قاعده' : 'قاعدهٔ جدید'} wide onClose={onClose} footer={<><SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving} onClick={save}>ذخیره</PrimaryButton></>}>
      {error && <Notice type="error">{error}</Notice>}
      <Field label="نام قاعده" required><input id="rule-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={150} placeholder="مثلاً «ارجاع کارهای دیرکرده به مدیر»" /></Field>
      <Field label="وقتی" required>
        <select id="rule-trigger" className={inputClass} value={trigger} onChange={(e) => setTrigger(e.target.value as AutomationTrigger)}>
          {(Object.keys(TRIGGERS) as AutomationTrigger[]).map((t) => <option key={t} value={t}>{TRIGGERS[t]}</option>)}
        </select>
      </Field>

      <fieldset className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
        <legend className="px-1 text-xs font-bold text-slate-600 dark:text-slate-300">اگر (اختیاری؛ همهٔ شرط‌های پرشده باید برقرار باشند)</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="اولویت">
            <select id="cond-priority" className={inputClass} value={conditions.priority || ''} onChange={(e) => setCond({ priority: (e.target.value || null) as ServerPriority | null })}>
              <option value="">هر اولویتی</option>
              {(Object.keys(PRIORITY) as ServerPriority[]).map((p) => <option key={p} value={p}>{PRIORITY[p]}</option>)}
            </select>
          </Field>
          <Field label="وضعیت">
            <select id="cond-status" className={inputClass} value={conditions.status || ''} onChange={(e) => setCond({ status: (e.target.value || null) as ServerTaskStatus | null })}>
              <option value="">هر وضعیتی</option>
              {(Object.keys(STATUS) as ServerTaskStatus[]).map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}
            </select>
          </Field>
          <Field label="پروژه">
            <select id="cond-project" className={inputClass} value={conditions.isProject === true ? 'yes' : conditions.isProject === false ? 'no' : ''} onChange={(e) => setCond({ isProject: e.target.value === 'yes' ? true : e.target.value === 'no' ? false : null })}>
              <option value="">فرقی نمی‌کند</option><option value="yes">فقط پروژه‌ها</option><option value="no">فقط غیرپروژه‌ها</option>
            </select>
          </Field>
          {workTypes.length > 0 && (
            <Field label="نوع فعالیت">
              <select id="cond-work-type" className={inputClass} value={conditions.workTypeId || ''} onChange={(e) => setCond({ workTypeId: e.target.value || null })}>
                <option value="">هر نوعی</option>
                {workTypes.filter((w) => w.isActive || w.id === conditions.workTypeId).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="عنوان شامل" className="sm:col-span-2"><input id="cond-title" className={inputClass} value={conditions.titleContains || ''} onChange={(e) => setCond({ titleContains: e.target.value })} maxLength={100} /></Field>
        </div>
      </fieldset>

      <fieldset className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
        <legend className="px-1 text-xs font-bold text-slate-600 dark:text-slate-300">آنگاه (به ترتیب اجرا می‌شوند)</legend>
        {actions.map((a, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] gap-2 items-start p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
            <select id={`action-type-${i}`} aria-label="نوع عمل" className={inputClass} value={a.type} onChange={(e) => setAction(i, { type: e.target.value as AutomationActionType })}>
              {(Object.keys(ACTIONS) as AutomationActionType[]).map((t) => <option key={t} value={t}>{ACTIONS[t]}</option>)}
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
              {a.type === 'SetPriority' && (
                <select id={`action-priority-${i}`} aria-label="اولویت" className={inputClass} value={a.priority || 'High'} onChange={(e) => setAction(i, { priority: e.target.value as ServerPriority })}>
                  {(Object.keys(PRIORITY) as ServerPriority[]).map((p) => <option key={p} value={p}>{PRIORITY[p]}</option>)}
                </select>
              )}
              {a.type === 'SetStatus' && (
                <select id={`action-status-${i}`} aria-label="وضعیت" className={inputClass} value={a.status || 'InProgress'} onChange={(e) => setAction(i, { status: e.target.value as ServerTaskStatus })}>
                  {(Object.keys(STATUS) as ServerTaskStatus[]).map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}
                </select>
              )}
              {a.type === 'AssignUser' && personSelect(`action-user-${i}`, a.userId, (v) => setAction(i, { userId: v }), 'انتخاب شخص')}
              {a.type === 'AssignGroup' && (
                <select id={`action-group-${i}`} aria-label="تیم" className={inputClass} value={a.groupId || ''} onChange={(e) => setAction(i, { groupId: e.target.value || null })}>
                  <option value="">انتخاب تیم</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
              {a.type === 'EscalateUp' && (
                <input id={`action-levels-${i}`} aria-label="چند سطح بالاتر" className={inputClass} inputMode="numeric" dir="ltr" value={a.levels ?? 1} onChange={(e) => setAction(i, { levels: Math.max(1, Math.min(5, Number(toLatinDigits(e.target.value)) || 1)) })} />
              )}
              {a.type === 'AddTag' && <input id={`action-tag-${i}`} aria-label="برچسب" className={inputClass} value={a.tag || ''} onChange={(e) => setAction(i, { tag: e.target.value })} maxLength={50} placeholder="برچسب" />}
              {a.type === 'StartSla' && (
                <>
                  <input id={`action-hours-${i}`} aria-label="مهلت (ساعت)" className={inputClass} inputMode="numeric" dir="ltr" value={a.hours ?? ''} onChange={(e) => setAction(i, { hours: Number(toLatinDigits(e.target.value)) || null })} placeholder="ساعت" />
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200"><input type="checkbox" checked={!!a.businessDaysOnly} onChange={(e) => setAction(i, { businessDaysOnly: e.target.checked })} /> فقط روزهای کاری</label>
                </>
              )}
              {a.type === 'Notify' && (
                <>
                  {personSelect(`action-notify-${i}`, a.userId, (v) => setAction(i, { userId: v }), 'مالک فعالیت')}
                  <input id={`action-message-${i}`} aria-label="متن اعلان" className={inputClass} value={a.message || ''} onChange={(e) => setAction(i, { message: e.target.value })} maxLength={300} placeholder="متن اعلان (اختیاری)" />
                </>
              )}
              {a.type === 'EscalateUp' && <span className="text-[11px] text-slate-500 self-center">۱ یعنی مدیر مستقیم مسئول فعلی</span>}
            </div>
            <button type="button" onClick={() => setActions((list) => list.filter((_, n) => n !== i))} disabled={actions.length === 1} className="p-2 text-slate-400 hover:text-rose-500 disabled:opacity-30 cursor-pointer" aria-label="حذف عمل"><X className="w-4 h-4" /></button>
          </div>
        ))}
        {actions.length < 10 && (
          <button type="button" onClick={() => setActions((list) => [...list, { type: 'Notify' }])} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"><Plus className="w-3.5 h-3.5" /> افزودن عمل</button>
        )}
      </fieldset>
      <Toggle checked={isActive} onChange={setIsActive} label="فعال" />
    </AdminDialog>
  );
};

// ------------------------------------------------------------------ log

const LogSection: React.FC = () => {
  const [log, setLog] = useState<AutomationLogEntry[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { listAutomationLog().then(setLog).catch((err) => setError(userErrorMessage(err, 'گزارش اجرا خوانده نشد.'))); }, []);
  return (
    <SectionCard title="گزارش اجرای قواعد" description="آخرین بارهایی که قاعده‌ها روی فعالیت‌ها اجرا شدند، و اگر کاری انجام نشد، چرا.">
      {error && <Notice type="error">{error}</Notice>}
      {log && log.length === 0 && <p className="p-6 text-center text-sm text-slate-400">هنوز قاعده‌ای اجرا نشده است.</p>}
      {log && log.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700">
              <tr className="text-right text-[11px] font-bold text-slate-500 dark:text-slate-400"><th className="px-3 py-2.5">زمان</th><th className="px-3 py-2.5">قاعده</th><th className="px-3 py-2.5">رویداد</th><th className="px-3 py-2.5">نتیجه</th><th className="px-3 py-2.5">جزئیات</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...log].sort((a, b) => b.atUtc.localeCompare(a.atUtc)).slice(0, 200).map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2.5 whitespace-nowrap text-slate-600 dark:text-slate-300">{new Date(e.atUtc).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })}</td>
                  <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-slate-100">{e.ruleName}</td>
                  <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{TRIGGERS[e.trigger]}</td>
                  <td className="px-3 py-2.5">{e.outcome === 'Applied' ? <StatusBadge tone="green">انجام شد</StatusBadge> : <StatusBadge tone="red">انجام نشد</StatusBadge>}</td>
                  <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300" dir="auto">{e.detail || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
};

// ------------------------------------------------------------------ request categories (CAT-16)

const CategoriesSection: React.FC = () => {
  const [items, setItems] = useState<RequestCategory[] | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<RequestCategory | 'new' | null>(null);
  const { people } = usePeopleAndTeams();
  const load = useCallback(() => {
    listRequestCategories().then((c) => { setItems(c); setError(''); }).catch((err) => setError(userErrorMessage(err, 'دسته‌ها خوانده نشد.')));
  }, []);
  useEffect(load, [load]);
  const nameOf = (id: string | null) => (id ? people.find((p) => p.id === id)?.name || '—' : '—');
  return (
    <SectionCard
      title="دسته‌های درخواست"
      description="هر دسته می‌گوید درخواست به چه کسی برسد؛ برای درخواست‌های فوری می‌توان شخص دیگری تعیین کرد. دسته غیرفعال در فرم درخواست دیده نمی‌شود."
      onAdd={() => setEditing('new')}
      addLabel="دستهٔ جدید"
    >
      {error && <Notice type="error">{error}</Notice>}
      {items && items.length === 0 && <p className="p-6 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">هنوز دسته‌ای تعریف نشده است.</p>}
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {(items || []).map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <span className="font-bold text-sm text-slate-800 dark:text-slate-100 flex-1 min-w-0">{c.name}</span>
            <span className="text-xs text-slate-500">ارجاع به: {nameOf(c.routeToUserId)}</span>
            {c.urgentRouteToUserId && <span className="text-xs text-slate-500">فوری: {nameOf(c.urgentRouteToUserId)}</span>}
            {!c.isActive && <StatusBadge tone="amber">غیرفعال</StatusBadge>}
            <IconAction icon={Pencil} label="ویرایش" onClick={() => setEditing(c)} />
          </li>
        ))}
      </ul>
      {editing && <CategoryDialog category={editing === 'new' ? null : editing} people={people} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </SectionCard>
  );
};

const CategoryDialog: React.FC<{ category: RequestCategory | null; people: User[]; onClose: () => void; onSaved: () => void }> = ({ category, people, onClose, onSaved }) => {
  const [name, setName] = useState(category?.name || '');
  const [routeTo, setRouteTo] = useState(category?.routeToUserId || '');
  const [urgentRouteTo, setUrgentRouteTo] = useState(category?.urgentRouteToUserId || '');
  const [priority, setPriority] = useState<ServerPriority>(category?.defaultPriority || 'Medium');
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!name.trim()) { setError('نام دسته را بنویسید.'); return; }
    setSaving(true);
    try {
      const input = { name: name.trim(), routeToUserId: routeTo || null, urgentRouteToUserId: urgentRouteTo || null, defaultPriority: priority, isActive };
      if (category) await updateRequestCategory(category.id, input); else await createRequestCategory(input);
      showToast('دسته ذخیره شد.', 'ok');
      onSaved();
    } catch (err) {
      setError(userErrorMessage(err, 'دسته ذخیره نشد.'));
    } finally {
      setSaving(false);
    }
  };
  const select = (id: string, value: string, onChange: (v: string) => void, empty: string) => (
    <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{empty}</option>
      {people.map((p) => <option key={p.id} value={p.id}>{p.name || p.username}</option>)}
    </select>
  );
  return (
    <AdminDialog title={category ? 'ویرایش دسته' : 'دستهٔ جدید'} onClose={onClose} footer={<><SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton><PrimaryButton type="button" disabled={saving} onClick={save}>ذخیره</PrimaryButton></>}>
      {error && <Notice type="error">{error}</Notice>}
      <Field label="نام" required><input id="category-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder="مثلاً «پشتیبانی فنی»" /></Field>
      <Field label="ارجاع به" hint="خالی: در صف همهٔ رسیدگی‌کنندگان می‌ماند.">{select('category-route', routeTo, setRouteTo, 'بدون ارجاع')}</Field>
      <Field label="ارجاع درخواست‌های فوری به" hint="خالی: همان شخص بالا.">{select('category-urgent', urgentRouteTo, setUrgentRouteTo, 'همان شخص')}</Field>
      <Field label="اولویت پیش‌فرض">
        <select id="category-priority" className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value as ServerPriority)}>
          {(Object.keys(PRIORITY) as ServerPriority[]).map((p) => <option key={p} value={p}>{PRIORITY[p]}</option>)}
        </select>
      </Field>
      {category && <Toggle checked={isActive} onChange={setIsActive} label="فعال" />}
    </AdminDialog>
  );
};
