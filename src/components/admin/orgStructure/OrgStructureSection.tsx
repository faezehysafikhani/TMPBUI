import React, { useState } from 'react';
import { AdminDialog, Notice, SecondaryButton } from '../AdminUi';
import { ORG_STRUCTURE_PERMISSIONS as P, ORG_UNIT_PERMISSIONS as U, canNode } from '../../../services/orgStructureApi';
import { OrgRulesPanel } from './OrgRulesPanel';
import { OrgLinksPanel } from './OrgLinksPanel';
import { OrgTemplatesPanel } from './OrgTemplatesPanel';
import { OrgPlacementForm } from './OrgPlacementForm';
import { OrgStructureChart, type ToolId } from './OrgStructureChart';
import { LoadingRow, useLoad } from './orgShared';
import { PlacementPick, loadPlacementBoard } from './orgPlacementData';

const TOOL_TITLES: Record<ToolId, string> = { templates: 'قالب‌ها', rules: 'قواعد ساختار', links: 'رابطه‌ها' };

/**
 * «ساختار سازمانی»: one page with two cards - the «ثبت جایگاه» form and the chart it fills in.
 * Templates, structure rules and links open from the chart's header. Shown only when the backend
 * has the organization-structure module (see SystemAdministration); the server checks every
 * permission again. «جایگاه من» is on the profile page.
 */
export const OrgStructureSection: React.FC<{ can: (permission: string) => boolean }> = ({ can }) => {
  const reader = Object.values(P).some(can);
  const board = useLoad(loadPlacementBoard, 'دریافت اطلاعات ساختار سازمانی ممکن نشد.');
  const [pick, setPick] = useState<PlacementPick | null>(null);
  const [tool, setTool] = useState<ToolId | null>(null);

  const tools: { id: ToolId; label: string }[] = [
    ...(canNode(can, 'manageTemplates') || canNode(can, 'view') ? [{ id: 'templates' as const, label: TOOL_TITLES.templates }] : []),
    ...(canNode(can, 'manageRules') ? [{ id: 'rules' as const, label: TOOL_TITLES.rules }] : []),
    ...(canNode(can, 'view') ? [{ id: 'links' as const, label: TOOL_TITLES.links }] : []),
  ];

  if (!reader) return <Notice type="info">دسترسی به ساختار سازمانی برای شما فعال نیست.</Notice>;
  if (board.loading && !board.data) return <LoadingRow />;
  if (!board.data) return <Notice type="error">{board.error ?? 'دریافت اطلاعات ساختار سازمانی ممکن نشد.'}</Notice>;

  const refresh = async () => { await board.reload(); };
  return (
    <div className="space-y-4">
      {board.error && <Notice type="error">{board.error}</Notice>}
      <OrgPlacementForm
        board={board.data}
        pick={pick}
        canAssign={can(P.manageAssignments)}
        canCreateUnits={canNode(can, 'create') || can(U.create)}
        canCreatePositions={can(P.managePositions)}
        onSaved={refresh}
      />
      <OrgStructureChart
        board={board.data}
        selected={pick}
        onPick={(next) => setPick({ ...next, at: Date.now() })}
        tools={tools}
        onTool={setTool}
      />
      {tool && (
        <AdminDialog wide title={TOOL_TITLES[tool]} onClose={() => { setTool(null); void refresh(); }} footer={<SecondaryButton onClick={() => { setTool(null); void refresh(); }}>بستن</SecondaryButton>}>
          {tool === 'templates' && <OrgTemplatesPanel canManageTemplates={canNode(can, 'manageTemplates')} canCreateCompany={can(P.manageCompanies)} />}
          {tool === 'rules' && <OrgRulesPanel canApplyPosts={can(P.managePositions)} />}
          {tool === 'links' && <OrgLinksPanel canEditLinks={canNode(can, 'update')} canManageTypes={canNode(can, 'manageRules')} />}
        </AdminDialog>
      )}
    </div>
  );
};
