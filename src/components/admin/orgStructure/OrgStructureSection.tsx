import React, { useState } from 'react';
import { UserRound, GitFork, Building2, Network, Briefcase, Workflow } from 'lucide-react';
import { PillTabs, TabItem } from '../AdminUi';
import { DESIGN_CHARTS_PERMISSION, ORG_STRUCTURE_PERMISSIONS as P, ORG_UNIT_PERMISSIONS as U } from '../../../services/orgStructureApi';
import { MyPlacementPanel } from './OrgViews';
import { OrgChartBoard } from './OrgChartBoard';
import { CompaniesPanel, PositionsPanel, UnitsPanel } from './OrgAdminPanels';
import { CustomChartsPanel } from './CustomChartsPanel';

type OrgTab = 'me' | 'chart' | 'designer' | 'companies' | 'units' | 'positions';

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
    // Saved charts are seen by readers of the structure; holders of the design permission make them.
    ...(reader || can(DESIGN_CHARTS_PERMISSION) ? [{ id: 'designer' as const, label: 'طراحی چارت دلخواه', icon: Workflow }] : []),
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
      {current === 'designer' && <CustomChartsPanel canDesign={can(DESIGN_CHARTS_PERMISSION)} />}
      {current === 'companies' && <CompaniesPanel canManage={can(P.manageCompanies)} canSeeUnits={can(U.view)} />}
      {current === 'units' && <UnitsPanel canCreate={can(U.create)} canUpdate={can(U.update)} canDeactivate={can(U.delete)} />}
      {current === 'positions' && <PositionsPanel canManage={can(P.managePositions)} />}
    </div>
  );
};
