// The history entry (and so the bell notification) written when a task is edited: one plain
// sentence per change - who was added or removed, what a date or status changed from and to -
// instead of "ویرایش ۲ فیلد" with counts.
import { PRIORITIES, STATUSES, Task, User, WorkTeam } from '../types';
import { formatToJalali, toPersianDigits } from './helpers';
import { responsibleIdsOf } from './taskPeople';

export interface TaskChange {
  /** Short title of this kind of change, used as the entry's title when it is the only one. */
  title: string;
  /** The change as a sentence. */
  text: string;
}

/** Joins entries of a history entry's details; the bell shows each on its own line. */
export const CHANGE_SEPARATOR = ' | ';

type NameOf = (userId: string) => string | undefined;

const quote = (value: string) => `«${value}»`;

/** «علی»، «مریم» و «رضا» */
function nameList(names: string[]): string {
  const quoted = names.map(quote);
  return quoted.length <= 1 ? quoted.join('') : `${quoted.slice(0, -1).join('، ')} و ${quoted[quoted.length - 1]}`;
}

/** Added and removed ids as names; people whose name is not known are counted instead. */
function people(ids: string[], nameOf: NameOf): { text: string; plural: boolean } {
  const names = ids.map(nameOf).filter((n): n is string => !!n);
  const unknown = ids.length - names.length;
  const parts = [...(names.length ? [nameList(names)] : []), ...(unknown ? [`${unknown} نفر دیگر`] : [])];
  return { text: parts.join(' و '), plural: ids.length > 1 };
}

function setChange(oldIds: string[], newIds: string[]) {
  const before = new Set(oldIds);
  const after = new Set(newIds);
  return { added: newIds.filter((id) => !before.has(id)), removed: oldIds.filter((id) => !after.has(id)) };
}

function membersChange(oldIds: string[], newIds: string[], nameOf: NameOf): string | null {
  const { added, removed } = setChange(oldIds, newIds);
  const parts: string[] = [];
  if (added.length) {
    const who = people(added, nameOf);
    parts.push(`${who.text} به اعضای تیم کاری این فعالیت اضافه ${who.plural ? 'شدند' : 'شد'}`);
  }
  if (removed.length) {
    const who = people(removed, nameOf);
    parts.push(`${who.text} از اعضای تیم کاری این فعالیت حذف ${who.plural ? 'شدند' : 'شد'}`);
  }
  return parts.length ? `${parts.join('؛ ')}.` : null;
}

function itemsChange(label: string, oldItems: string[], newItems: string[]): string | null {
  const { added, removed } = setChange(oldItems, newItems);
  const parts: string[] = [];
  if (added.length) parts.push(`${label} ${nameList(added)} اضافه ${added.length > 1 ? 'شدند' : 'شد'}`);
  if (removed.length) parts.push(`${label} ${nameList(removed)} حذف ${removed.length > 1 ? 'شدند' : 'شد'}`);
  return parts.length ? `${parts.join('؛ ')}.` : null;
}

const fromTo = (what: string, from: string, to: string) => `${what} از ${quote(from)} به ${quote(to)} تغییر کرد.`;
const kindOf = (t: Pick<Task, 'isProject' | 'isRecurring'>) => (t.isProject ? 'پروژه' : t.isRecurring ? 'تکرارشونده' : 'عادی');

/**
 * What an edit changed, in the order the form shows the fields. `nameOf` names a user id (the
 * responsible people and team members); `next` is the task as saved.
 */
export function describeTaskChanges(previous: Task, next: Task, nameOf: NameOf): TaskChange[] {
  const changes: TaskChange[] = [];
  const add = (title: string, text: string | null) => { if (text) changes.push({ title, text }); };

  if (next.title !== previous.title) add('تغییر عنوان', fromTo('عنوان فعالیت', previous.title, next.title));
  if (next.status !== previous.status) {
    add('تغییر وضعیت', fromTo('وضعیت', STATUSES[previous.status]?.title || previous.status, STATUSES[next.status]?.title || next.status));
  }
  if (next.priority !== previous.priority) {
    add('تغییر اولویت', fromTo('اولویت', PRIORITIES[previous.priority]?.title || previous.priority, PRIORITIES[next.priority]?.title || next.priority));
  }
  if ((next.dueDate || '') !== (previous.dueDate || '')) {
    const when = (d?: string) => (d ? formatToJalali(d) : 'بدون موعد');
    add('تغییر موعد انجام', fromTo('موعد انجام', when(previous.dueDate), when(next.dueDate)));
  }

  const oldResponsible = responsibleIdsOf(previous);
  const newResponsible = responsibleIdsOf(next);
  const responsibleMoved = setChange(oldResponsible, newResponsible);
  if (responsibleMoved.added.length || responsibleMoved.removed.length) {
    const names = (ids: string[]) => (ids.length ? people(ids, nameOf).text : 'بدون مسئول');
    add('تغییر مسئول انجام', `مسئول انجام از ${names(oldResponsible)} به ${names(newResponsible)} تغییر کرد.`);
  }

  if ((next.assignedTeamName || '') !== (previous.assignedTeamName || '')) {
    add('تغییر تیم کاری', fromTo('تیم کاری', previous.assignedTeamName || 'بدون تیم', next.assignedTeamName || 'بدون تیم'));
  }

  // The responsible people are on the access list too; their change is told above.
  const members = (t: Task, responsible: string[]) => (t.teamMemberIds || []).filter((id) => !responsible.includes(id));
  add('تغییر اعضای تیم کاری', membersChange(
    members(previous, [...oldResponsible, ...newResponsible]),
    members(next, [...oldResponsible, ...newResponsible]),
    nameOf,
  ));

  add('تغییر برچسب‌ها', itemsChange('برچسب', previous.tags || [], next.tags || []));

  if (next.ownerName && previous.ownerName && next.ownerName !== previous.ownerName) {
    add('تغییر مالک فعالیت', fromTo('مالک فعالیت', previous.ownerName, next.ownerName));
  }
  if (kindOf(next) !== kindOf(previous)) add('تغییر نوع فعالیت', fromTo('نوع فعالیت', kindOf(previous), kindOf(next)));
  if ((next.description || '') !== (previous.description || '')) add('ویرایش شرح فعالیت', 'شرح فعالیت ویرایش شد.');

  const fileNames = (t: Task) => (t.attachments || []).map((a) => a.name);
  add('تغییر پیوست‌ها', itemsChange('پیوست', fileNames(previous), fileNames(next)));

  return changes;
}

/** The history entry for an edit: its title and details. */
export function summarizeTaskChanges(changes: TaskChange[]): { action: string; details: string } {
  if (changes.length === 0) return { action: 'ویرایش فعالیت', details: 'مشخصات فعالیت به‌روزرسانی شد.' };
  if (changes.length === 1) return { action: changes[0].title, details: changes[0].text };
  return { action: `ویرایش فعالیت (${toPersianDigits(changes.length)} تغییر)`, details: changes.map((c) => c.text).join(CHANGE_SEPARATOR) };
}

/** Names of user ids from what the page already has: the tasks' people, the user list and the teams. */
export function userNameLookup(tasks: Task[], users: User[], teams: WorkTeam[]): (userId: string) => string | undefined {
  const names = new Map<string, string>();
  const put = (id: string | undefined, name: string | undefined) => { if (id && name && !names.has(id)) names.set(id, name); };
  for (const t of tasks) {
    (t.responsibleUserIds || []).forEach((id, i) => put(id, t.responsibleUserNames?.[i]));
    put(t.assignedUserId, t.assignedUserName);
    (t.teamMemberIds || []).forEach((id, i) => put(id, t.teamMemberNames?.[i]));
  }
  for (const u of users) put(u.id, u.name || u.username);
  for (const team of teams) for (const m of team.members) put(m.userId, m.name || m.username);
  return (userId) => names.get(userId);
}
