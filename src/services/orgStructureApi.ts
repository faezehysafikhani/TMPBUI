// Organization structure: companies, the units (deputies) each owns, positions, and every
// user's company / unit / position / manager. Backed by NexusCore's optional Nexus.OrgStructure
// module and Nexus.Organization's units. A backend without the module answers 404, and the
// whole section stays hidden (see isOrgStructureAvailable).
import { apiRequest, getSessionTenantId, NexusApiError } from './nexusApi';

export interface PersonRef { userId: string; displayName: string; isActive: boolean }

export interface Company {
  id: string;
  name: string;
  code: string;
  description: string | null;
  manager: PersonRef | null;
  isActive: boolean;
  linkedUnitIds: string[];
}

export interface CompanyInput { name: string; code: string; description?: string | null; managerUserId?: string | null }

export interface CompanyUnitLink { unitId: string; unitName: string; companyId: string; companyName: string }

export interface Position { id: string; title: string; parentPositionId: string | null; isActive: boolean }

export type ManagerSource = 'Explicit' | 'UnitManager' | 'CompanyManager';

export interface Manager { userId: string; displayName: string; isActive: boolean; source: ManagerSource }

export interface UserAssignment {
  userId: string;
  displayName: string;
  isUserActive: boolean;
  companyId: string;
  companyName: string;
  unitId: string | null;
  unitName: string | null;
  positionId: string | null;
  positionTitle: string | null;
  explicitManagerUserId: string | null;
  manager: Manager | null;
}

export interface AssignmentInput { companyId: string; unitId: string | null; positionId: string | null; managerUserId: string | null }

export interface Subordinate {
  userId: string;
  displayName: string;
  isActive: boolean;
  depth: number;
  managerUserId: string;
  companyName: string;
  unitName: string | null;
  positionTitle: string | null;
}

export interface MyPlacement { assignment: UserAssignment | null; managementChain: PersonRef[] }

export interface ChartMember { userId: string; displayName: string; isActive: boolean; positionTitle: string | null; managerUserId: string | null }

export interface ChartUnit { unitId: string; name: string; manager: PersonRef | null; members: ChartMember[] }

export interface ChartCompany {
  companyId: string;
  name: string;
  code: string;
  isActive: boolean;
  manager: PersonRef | null;
  members: ChartMember[];
  units: ChartUnit[];
}

/** An organization unit (a deputy, a department...) from Nexus.Organization. */
export interface OrgUnit { id: string; name: string; managerUserId: string | null; isActive: boolean }

export interface OrgUnitInput { name: string; managerUserId: string | null; isActive: boolean }

const BASE = '/api/org-structure';

export const MANAGER_SOURCE_TITLES: Record<ManagerSource, string> = {
  Explicit: 'تعیین‌شده مستقیم',
  UnitManager: 'مدیر واحد',
  CompanyManager: 'مدیر ارشد شرکت',
};

export const ORG_STRUCTURE_PERMISSIONS = {
  view: 'org_structure.view',
  manageCompanies: 'org_structure.manage_companies',
  managePositions: 'org_structure.manage_positions',
  manageAssignments: 'org_structure.manage_assignments',
} as const;

export const ORG_UNIT_PERMISSIONS = {
  view: 'organization_units.view',
  create: 'organization_units.create',
  update: 'organization_units.update',
  delete: 'organization_units.delete',
} as const;

/** The signed-in user's place; also tells whether the backend has the module (null = it does not). */
export async function getMyPlacement(): Promise<MyPlacement | null> {
  try {
    return await apiRequest<MyPlacement>('GET', `${BASE}/me`);
  } catch (err) {
    if (err instanceof NexusApiError && err.httpStatus === 404) return null;
    throw err;
  }
}

export const getMySubordinates = (all: boolean) => apiRequest<Subordinate[]>('GET', `${BASE}/me/subordinates`, { query: { all } });

export const getChart = (companyId?: string) => apiRequest<ChartCompany[]>('GET', `${BASE}/chart`, { query: { companyId } });

export const listCompanies = () => apiRequest<Company[]>('GET', `${BASE}/companies`);
export const createCompany = (input: CompanyInput) => apiRequest<Company>('POST', `${BASE}/companies`, { body: input });
export const updateCompany = (id: string, input: CompanyInput & { isActive: boolean }) =>
  apiRequest<Company>('PUT', `${BASE}/companies/${id}`, { body: input });
export const deleteCompany = (id: string) => apiRequest<void>('DELETE', `${BASE}/companies/${id}`);

export const listCompanyUnits = () => apiRequest<CompanyUnitLink[]>('GET', `${BASE}/company-units`);
export const linkUnitToCompany = (unitId: string, companyId: string) =>
  apiRequest<CompanyUnitLink>('PUT', `${BASE}/company-units/${unitId}`, { body: { companyId } });
export const unlinkUnit = (unitId: string) => apiRequest<void>('DELETE', `${BASE}/company-units/${unitId}`);

export const listPositions = () => apiRequest<Position[]>('GET', `${BASE}/positions`);
export const createPosition = (title: string, parentPositionId: string | null) =>
  apiRequest<Position>('POST', `${BASE}/positions`, { body: { title, parentPositionId } });
export const updatePosition = (id: string, title: string, parentPositionId: string | null, isActive: boolean) =>
  apiRequest<Position>('PUT', `${BASE}/positions/${id}`, { body: { title, parentPositionId, isActive } });
export const deletePosition = (id: string) => apiRequest<void>('DELETE', `${BASE}/positions/${id}`);

export const listAssignments = (filter: { companyId?: string; unitId?: string } = {}) =>
  apiRequest<UserAssignment[]>('GET', `${BASE}/assignments`, { query: filter });

/** A single user's current placement; null when none has been set yet. */
export async function getAssignment(userId: string): Promise<UserAssignment | null> {
  try {
    return await apiRequest<UserAssignment>('GET', `${BASE}/assignments/${userId}`);
  } catch (err) {
    if (err instanceof NexusApiError && err.httpStatus === 404) return null;
    throw err;
  }
}

export const setAssignment = (userId: string, input: AssignmentInput) =>
  apiRequest<UserAssignment>('PUT', `${BASE}/assignments/${userId}`, { body: input });
export const removeAssignment = (userId: string) => apiRequest<void>('DELETE', `${BASE}/assignments/${userId}`);

export const getSubordinatesOf = (userId: string, all: boolean) =>
  apiRequest<Subordinate[]>('GET', `${BASE}/users/${userId}/subordinates`, { query: { all } });

export const listOrgUnits = () => apiRequest<OrgUnit[]>('GET', '/api/organization/units');
export const createOrgUnit = (input: { name: string }) =>
  apiRequest<OrgUnit>('POST', '/api/organization/units', { body: { ...input, tenantId: getSessionTenantId() } });
export const updateOrgUnit = (id: string, input: OrgUnitInput) => apiRequest<OrgUnit>('PUT', `/api/organization/units/${id}`, { body: input });
export const deactivateOrgUnit = (id: string) => apiRequest<void>('DELETE', `/api/organization/units/${id}`);

/** Units are independent entries, ordered alphabetically for selectors and lists. */
export function sortOrgUnits(units: OrgUnit[]): OrgUnit[] {
  return [...units].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
}
