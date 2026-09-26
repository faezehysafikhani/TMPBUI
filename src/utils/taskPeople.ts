// Who a task is for. A task has zero or one team (its context), one or more responsible people
// (responsibleUserIds - the first is also assignedUserId) and an access list (teamMemberIds).
// Everything that asks "is this user responsible?" uses these helpers, never only the first one.
import type { Task, User } from '../types';

/** Everyone responsible for the task, each once; tasks from before hold only assignedUserId. */
export function responsibleIdsOf(task: Pick<Task, 'responsibleUserIds' | 'assignedUserId'>): string[] {
  const ids = task.responsibleUserIds && task.responsibleUserIds.length > 0
    ? task.responsibleUserIds
    : task.assignedUserId ? [task.assignedUserId] : [];
  return Array.from(new Set(ids.filter(Boolean)));
}

/** The responsible people's names, for display ("علی، مریم"). Empty when nobody is responsible. */
export function responsibleNamesOf(task: Pick<Task, 'responsibleUserNames' | 'assignedUserName'>): string {
  const names = task.responsibleUserNames && task.responsibleUserNames.length > 0
    ? task.responsibleUserNames
    : task.assignedUserName ? [task.assignedUserName] : [];
  return names.filter(Boolean).join('، ');
}

/** Whether the user is one of the task's responsible people. */
export function isResponsibleFor(
  task: Pick<Task, 'responsibleUserIds' | 'assignedUserId' | 'assignedUserName'>,
  user: Pick<User, 'id' | 'name' | 'username'> | null | undefined,
): boolean {
  if (!user) return false;
  const ids = responsibleIdsOf(task);
  if (ids.length > 0) return ids.includes(user.id);
  // A task saved without ids (very old local data) is matched by name, as before.
  const name = (task.assignedUserName || '').trim().toLowerCase();
  return !!name && (name === (user.name || '').trim().toLowerCase() || name === (user.username || '').trim().toLowerCase());
}

/**
 * The dashboard's rule, and the only one the rest of the app (chat included) uses: a task is
 * shown to its owner, its responsible people and those on its access list. The server applies
 * the same rule to what it returns; a task's team alone gives nobody the task.
 */
export function isTaskVisibleTo(task: Task, user: User | null | undefined): boolean {
  if (!user) return false;
  if (!task.user || task.user === user.id) return true;
  if (isResponsibleFor(task, user)) return true;
  return !!task.teamMemberIds && task.teamMemberIds.includes(user.id);
}
