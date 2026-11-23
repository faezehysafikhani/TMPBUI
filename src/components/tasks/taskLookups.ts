// The organization's task settings that many Track 1 screens read (custom statuses, work types,
// fields, templates). Kept in the lookup cache: one request shared by every card, refreshed after
// a change in the settings tab.
import { refreshLookup, useLookup } from '../../utils/lookupCache';
import { listCustomFields, listCustomStatuses, listTemplates, listWorkTypes } from '../../services/taskFeaturesApi';
import type { CustomField, CustomStatus, TaskTemplate, WorkType } from './types';

const KEYS = {
  statuses: 'tasks:custom-statuses',
  workTypes: 'tasks:work-types',
  fields: 'tasks:custom-fields',
  templates: 'tasks:templates',
} as const;

const EMPTY: never[] = [];

export const useCustomStatuses = () => useLookup<CustomStatus[]>(KEYS.statuses, listCustomStatuses, EMPTY).value;
export const useWorkTypes = () => useLookup<WorkType[]>(KEYS.workTypes, listWorkTypes, EMPTY).value;
export const useCustomFields = () => useLookup<CustomField[]>(KEYS.fields, listCustomFields, EMPTY).value;
/** Templates (null key: the user may not create tasks, so nothing is asked). */
export const useTemplates = (enabled = true) => useLookup<TaskTemplate[]>(enabled ? KEYS.templates : null, listTemplates, EMPTY).value;

export const refreshCustomStatuses = () => refreshLookup(KEYS.statuses, listCustomStatuses).catch(() => EMPTY);
export const refreshWorkTypes = () => refreshLookup(KEYS.workTypes, listWorkTypes).catch(() => EMPTY);
export const refreshCustomFields = () => refreshLookup(KEYS.fields, listCustomFields).catch(() => EMPTY);
export const refreshTemplates = () => refreshLookup(KEYS.templates, listTemplates).catch(() => EMPTY);

/** A colour from the settings (#rrggbb), or none when it is not a plain colour. */
export function safeColor(value: string | null | undefined): string | undefined {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
}
