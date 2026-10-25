import React, { useState } from 'react';
import { UserRound, GitFork, Building2, Network, Briefcase } from 'lucide-react';
import { PillTabs, TabItem } from '../AdminUi';
import { ORG_STRUCTURE_PERMISSIONS as P, ORG_UNIT_PERMISSIONS as U } from '../../../services/orgStructureApi';
import { MyPlacementPanel } from './OrgViews';
import { OrgChartBoard } from './OrgChartBoard';
import { CompaniesPanel, PositionsPanel, UnitsPanel } from './OrgAdminPanels';

type OrgTab = 'me' | 'chart' | 'companies' | 'units' | 'positions';

/**
 * «ساختار سازمانی»: companies, deputies/units, positions and who reports to whom. Shown only
 * when the backend has the organization-structure module (see SystemAdministration). Everyone
 * sees their own place; the rest follows the user's permissions (the server checks again).
 */
export const OrgStructureSection: React.FC<{ can: (permission: string) => boolean }> = ({ can }) => {
  const reader = Object.values(P).some(can);
  const tabs: TabItem<OrgTab>[] = [
    { id: 'me', label: 'جایگاه من', icon: UserRound },
    ...(reader ? [{ id: 'chart' as const, label: 'چارت سازمانی', icon: GitFork }] : []),
    ...(reader ? [{ id: 'companies' as const, label: 'شرکت‌ها', icon: Building2 }] : []),
    ...(can(U.view) ? [{ id: 'units' as const, label: 'معاونت‌ها و واحدها', icon: Network }] : []),
    ...(reader ? [{ id: 'positions' as const, label: 'سمت‌ها', icon: Briefcase }] : []),
  ];
  const [active, setActive] = useState<OrgTab>('me');
  const current = tabs.some((t) => t.id === active) ? active : 'me';

  return (
    <div className="space-y-4">
      {tabs.length > 1 && <PillTabs tabs={tabs} active={current} onChange={setActive} />}
      {current === 'me' && <MyPlacementPanel />}
      {current === 'chart' && <OrgChartBoard can={can} />}
      {current === 'companies' && <CompaniesPanel canManage={can(P.manageCompanies)} canSeeUnits={can(U.view)} />}
      {current === 'units' && <UnitsPanel canCreate={can(U.create)} canUpdate={can(U.update)} canDeactivate={can(U.delete)} />}
      {current === 'positions' && <PositionsPanel canManage={can(P.managePositions)} />}
    </div>
  );
};
