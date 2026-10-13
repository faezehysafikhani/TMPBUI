import React, { useMemo } from 'react';
import { Field, inputClass } from '../AdminUi';
import {
  Company, CompanyUnitLink, OrgUnit, Position,
  buildUnitTree, flattenUnitTree, listCompanies, listCompanyUnits, listOrgUnits, listPositions, unitSubtreeIds,
} from '../../../services/orgStructureApi';
import { useLoad, UserPicker } from './orgShared';

export interface OrgPlacementDraft {
  companyId: string;
  unitId: string;
  positionId: string;
  managerUserId: string | null;
  managerName: string | null;
}

export const EMPTY_PLACEMENT_DRAFT: OrgPlacementDraft = {
  companyId: '', unitId: '', positionId: '', managerUserId: null, managerName: null,
};

export interface OrgPlacementData {
  companies: Company[];
  positions: Position[];
  links: CompanyUnitLink[];
  units: OrgUnit[];
}

const EMPTY_PLACEMENT_DATA: OrgPlacementData = { companies: [], positions: [], links: [], units: [] };

/**
 * Companies, positions and units needed to render the placement fields below.
 * `enabled=false` skips the network calls entirely (the caller doesn't have the permission, or
 * the «جایگاه سازمانی» tab isn't shown) while still respecting the rules of hooks.
 */
export function useOrgPlacementData(canSeeUnits: boolean, enabled: boolean) {
  return useLoad<OrgPlacementData>(async () => {
    if (!enabled) return EMPTY_PLACEMENT_DATA;
    const [companies, positions, links, units] = await Promise.all([
      listCompanies(), listPositions(), listCompanyUnits(),
      canSeeUnits ? listOrgUnits() : Promise.resolve([] as OrgUnit[]),
    ]);
    return { companies, positions, links, units };
  }, 'دریافت اطلاعات ساختار سازمانی ممکن نشد.');
}

/**
 * «شرکت / معاونت‌وواحد / سمت / مدیر مستقیم»: a user's place in the org structure. Shared by the
 * user-creation/edit dialog's «جایگاه سازمانی» tab (this module has no other caller left since
 * the organizational section's own assignment dialog was retired in favor of this one).
 */
export const OrgPlacementFields: React.FC<{
  draft: OrgPlacementDraft;
  onChange: (next: OrgPlacementDraft) => void;
  data: OrgPlacementData;
  excludeManagerIds?: string[];
}> = ({ draft, onChange, data, excludeManagerIds = [] }) => {
  /** Units of the chosen company: its linked deputies and everything below them. */
  const unitsOfCompany = useMemo(() => {
    if (!draft.companyId) return [];
    const ids = new Set<string>();
    data.links.filter((l) => l.companyId === draft.companyId)
      .forEach((l) => unitSubtreeIds(data.units, l.unitId).forEach((id) => ids.add(id)));
    return flattenUnitTree(buildUnitTree(data.units.filter((u) => ids.has(u.id) && u.isActive)));
  }, [data, draft.companyId]);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="شرکت">
          <select className={inputClass} value={draft.companyId} onChange={(e) => onChange({ ...draft, companyId: e.target.value, unitId: '' })}>
            <option value="">— بدون شرکت —</option>
            {data.companies.filter((c) => c.isActive || c.id === draft.companyId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="معاونت / واحد" hint={unitsOfCompany.length === 0 ? 'این شرکت هنوز معاونتی ندارد.' : undefined}>
          <select className={inputClass} value={draft.unitId} onChange={(e) => onChange({ ...draft, unitId: e.target.value })} disabled={unitsOfCompany.length === 0}>
            <option value="">— مستقیم زیر شرکت —</option>
            {unitsOfCompany.map((u) => <option key={u.id} value={u.id}>{' '.repeat(u.depth * 3)}{u.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="سمت">
        <select className={inputClass} value={draft.positionId} onChange={(e) => onChange({ ...draft, positionId: e.target.value })}>
          <option value="">— بدون سمت —</option>
          {data.positions.filter((p) => p.isActive || p.id === draft.positionId).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </Field>
      <Field label="مدیر مستقیم (اختیاری)" hint="خالی بگذارید تا مدیر از مدیر واحد یا مدیر ارشد شرکت گرفته شود.">
        <UserPicker
          value={draft.managerUserId}
          valueLabel={draft.managerName}
          onChange={(id, name) => onChange({ ...draft, managerUserId: id, managerName: name })}
          excludeIds={excludeManagerIds}
        />
      </Field>
    </>
  );
};
