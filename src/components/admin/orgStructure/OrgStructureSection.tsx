import React, { useEffect, useState } from 'react';
import { UserRound, GitFork, Building2, Network, Briefcase, ListChecks, Link2, LayoutTemplate, FileSpreadsheet, Layers } from 'lucide-react';
import { PillTabs, TabItem } from '../AdminUi';
import { ORG_STRUCTURE_PERMISSIONS as P, ORG_UNIT_PERMISSIONS as U, type OrgUiLevel, canNode, getChart } from '../../../services/orgStructureApi';
import { MyPlacementPanel } from './OrgViews';
import { OrgChartBoard } from './OrgChartBoard';
import { CompaniesPanel, PositionsPanel, UnitsPanel } from './OrgAdminPanels';
import { OrgRulesPanel } from './OrgRulesPanel';
import { OrgLinksPanel } from './OrgLinksPanel';
import { OrgTemplatesPanel } from './OrgTemplatesPanel';
import { OrgImportPanel } from './OrgImportPanel';
import { OrgGroupPanel } from './OrgGroupPanel';
import { atLeast, highestLevel } from './orgUiLevel';

type OrgTab = 'me' | 'chart' | 'companies' | 'units' | 'positions' | 'group' | 'links' | 'templates' | 'import' | 'rules';

/**
 * «ساختار سازمانی»: companies, deputies/units, positions and who reports to whom. Shown only
 * when the backend has the organization-structure module (see SystemAdministration). Everyone
 * sees their own place; the rest follows the user's permissions (the server checks again).
 */
export const OrgStructureSection: React.FC<{ can: (permission: string) => boolean }> = ({ can }) => {
  const reader = Object.values(P).some(can);
  // The display level (hiding only): simple shows posts and people, normal adds the nodes, advanced adds the rest.
  const [level, setLevel] = useState<OrgUiLevel>('normal');
  useEffect(() => {
    if (!reader) return;
    let alive = true;
    getChart().then((chart) => alive && setLevel(highestLevel(chart))).catch(() => {});
    return () => { alive = false; };
  }, [reader]);
  const advanced = atLeast(level, 'advanced');
  const tabs: TabItem<OrgTab>[] = [
    { id: 'me', label: 'جایگاه من', icon: UserRound },
    ...(reader ? [{ id: 'chart' as const, label: 'چارت سازمانی', icon: GitFork }] : []),
    ...(reader ? [{ id: 'companies' as const, label: 'شرکت‌ها', icon: Building2 }] : []),
    ...(can(U.view) && atLeast(level, 'normal') ? [{ id: 'units' as const, label: 'معاونت‌ها و واحدها', icon: Network }] : []),
    ...(reader ? [{ id: 'positions' as const, label: 'سمت‌ها', icon: Briefcase }] : []),
    ...(advanced && reader ? [{ id: 'group' as const, label: 'چارت گروه', icon: Layers }] : []),
    ...(advanced && canNode(can, 'view') ? [{ id: 'links' as const, label: 'رابطه‌ها', icon: Link2 }] : []),
    ...(advanced && canNode(can, 'view') ? [{ id: 'templates' as const, label: 'قالب‌ها', icon: LayoutTemplate }] : []),
    ...(advanced && canNode(can, 'create') ? [{ id: 'import' as const, label: 'ورود از اکسل', icon: FileSpreadsheet }] : []),
    // Only with its own permission (the rules change what everyone may do with the structure).
    ...(advanced && canNode(can, 'manageRules') ? [{ id: 'rules' as const, label: 'قواعد ساختار', icon: ListChecks }] : []),
  ];
  const [active, setActive] = useState<OrgTab>('me');
  /** A company asked for from the group chart: its chart opens on it. */
  const [chartCompanyId, setChartCompanyId] = useState<string | undefined>(undefined);
  const current = tabs.some((t) => t.id === active) ? active : 'me';

  return (
    <div className="space-y-4">
      {tabs.length > 1 && <PillTabs tabs={tabs} active={current} onChange={setActive} />}
      {current === 'me' && <MyPlacementPanel />}
      {current === 'chart' && <OrgChartBoard can={can} onLevelChange={setLevel} initialCompanyId={chartCompanyId} />}
      {current === 'group' && <OrgGroupPanel canEdit={can(P.manageCompanies)} onOpenCompany={(id) => { setChartCompanyId(id); setActive('chart'); }} />}
      {current === 'companies' && <CompaniesPanel canManage={can(P.manageCompanies)} canSeeUnits={can(U.view)} advanced={advanced} />}
      {current === 'units' && <UnitsPanel canCreate={can(U.create)} canUpdate={can(U.update)} canDeactivate={can(U.delete)} />}
      {current === 'positions' && <PositionsPanel canManage={can(P.managePositions)} />}
      {current === 'links' && <OrgLinksPanel canEditLinks={canNode(can, 'update')} canManageTypes={canNode(can, 'manageRules')} />}
      {current === 'templates' && <OrgTemplatesPanel canManageTemplates={canNode(can, 'manageTemplates')} canCreateCompany={can(P.manageCompanies)} />}
      {current === 'import' && <OrgImportPanel />}
      {current === 'rules' && <OrgRulesPanel canApplyPosts={can(P.managePositions)} />}
    </div>
  );
};
