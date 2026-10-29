// Development only: answers the org-structure requests of the chart board from a mock chart, in
// memory, so the board can be driven (and checked) without an API. Changes it accepts change the
// chart it answers with next, as the real server would. Not part of the app.
import type { ChartCompany, ChartNodeType, ChartUnit, ImpactChange, NodeType, NodeTypeRule, OrgNode } from '../services/orgStructureApi';
import { allUnitsOf } from '../components/admin/orgStructure/orgChartModel';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const problem = (status: number, message: string, code = 'validation.error') =>
  new Response(JSON.stringify({ title: code, detail: message, status }), { status, headers: { 'Content-Type': 'application/problem+json' } });

export interface MockServer {
  chart: () => ChartCompany[];
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export function createMockServer(initial: ChartCompany[]): MockServer {
  let chart: ChartCompany[] = structuredClone(initial);
  const versions = new Map<string, number>();
  let rules: NodeTypeRule[] | null = null;
  const typeOverrides = new Map<string, Partial<NodeType>>();

  const typesOf = (): NodeType[] => {
    const seen = new Map<string, ChartNodeType>();
    chart.forEach((c) => allUnitsOf(c).forEach((u) => u.nodeType && seen.set(u.nodeType.nodeTypeId, u.nodeType)));
    return [...seen.values()].map((t, i) => ({
      id: t.nodeTypeId, code: t.nodeTypeId, name: t.name, color: t.color, icon: t.icon, isDomainBoundary: t.isDomainBoundary, sortOrder: i, isActive: true,
      nodeCount: chart.flatMap((c) => allUnitsOf(c)).filter((u) => u.nodeType?.nodeTypeId === t.nodeTypeId).length,
      ...typeOverrides.get(t.nodeTypeId),
    }));
  };

  const currentRules = (): NodeTypeRule[] => {
    if (rules) return rules;
    const found = new Map<string, NodeTypeRule>();
    chart.forEach((c) => allUnitsOf(c).forEach((u) => {
      const parent = u.parentNodeId ? allUnitsOf(c).find((x) => x.unitId === u.parentNodeId) : null;
      if (!u.nodeType) return;
      const rule = { parentNodeTypeId: parent?.nodeType?.nodeTypeId ?? null, childNodeTypeId: u.nodeType.nodeTypeId };
      found.set(`${rule.parentNodeTypeId}>${rule.childNodeTypeId}`, rule);
    }));
    return [...found.values()];
  };

  const find = (unitId: string) => {
    for (const company of chart) {
      for (const unit of allUnitsOf(company)) if (unit.unitId === unitId) return { company, unit };
    }
    return null;
  };
  const siblingsOf = (company: ChartCompany, unit: ChartUnit) =>
    unit.parentNodeId ? find(unit.parentNodeId)!.unit.children! : company.units;
  const versionOf = (id: string) => String(versions.get(id) ?? 0);
  const bump = (id: string) => versions.set(id, (versions.get(id) ?? 0) + 1);

  const nodeOf = (company: ChartCompany, unit: ChartUnit): OrgNode => ({
    id: unit.unitId, name: unit.name, parentNodeId: unit.parentNodeId ?? null, nodeTypeId: unit.nodeType?.nodeTypeId ?? null,
    nodeTypeName: unit.nodeType?.name ?? null, companyId: company.companyId, managerUserId: unit.manager?.userId ?? null,
    isActive: unit.isActive !== false, sortOrder: siblingsOf(company, unit).indexOf(unit), childCount: unit.children?.length ?? 0, rowVersion: versionOf(unit.unitId),
  });

  const subtreeIds = (unit: ChartUnit): string[] => [unit.unitId, ...(unit.children || []).flatMap(subtreeIds)];

  /** Who would have a different manager if `moves` happened: everyone under the moved nodes. */
  const preview = (changes: ImpactChange[]) => {
    const people = new Map<string, { displayName: string }>();
    for (const change of changes) {
      const found = change.nodeId ? find(change.nodeId) : null;
      if (!found) continue;
      for (const id of subtreeIds(found.unit)) {
        const unit = find(id)!.unit;
        [...unit.members, ...(unit.positions || []).flatMap((p) => p.holders)].forEach((m) => people.set(m.userId, { displayName: m.displayName }));
      }
    }
    const ref = (userId: string, displayName: string) => ({ userId, displayName, isActive: true });
    const result = [...people.entries()].map(([userId, p]) => ({
      person: ref(userId, p.displayName), managerChanged: true,
      managerBefore: ref('before', 'مدیر فعلی'), managerAfter: ref('after', 'مدیر جدید'),
      subordinatesAdded: [], subordinatesRemoved: [], cannotAssignAdded: [], cannotAssignRemoved: [],
      substitutionAdded: [], substitutionRemoved: [], teamAdded: [], teamRemoved: [],
    }));
    return { peopleAffected: result.length, people: result, taskLimitOn: true };
  };

  const wouldLoop = (unit: ChartUnit, parentId: string) => subtreeIds(unit).includes(parentId);

  const handle = async (method: string, path: string, query: URLSearchParams, body: any): Promise<Response> => {
    if (method === 'GET' && path === '/chart') return json(chart);
    if (method === 'GET' && path === '/nodes') return json(chart.flatMap((c) => allUnitsOf(c).map((u) => nodeOf(c, u))));
    if (method === 'GET' && path === '/node-types') return json(typesOf());
    if (method === 'GET' && path === '/node-type-rules') return json({ rules: currentRules(), conflicts: [] });
    if (method === 'PUT' && path === '/node-type-rules') {
      rules = body.rules;
      const allowed = new Set(rules!.map((r) => `${r.parentNodeTypeId}>${r.childNodeTypeId}`));
      const conflicts = chart.flatMap((c) => allUnitsOf(c)).filter((u) => {
        const parent = u.parentNodeId ? find(u.parentNodeId)?.unit : null;
        return u.nodeType && !allowed.has(`${parent?.nodeType?.nodeTypeId ?? null}>${u.nodeType.nodeTypeId}`);
      }).map((u) => {
        const parent = u.parentNodeId ? find(u.parentNodeId)?.unit : null;
        return { nodeId: u.unitId, nodeName: u.name, nodeTypeName: u.nodeType?.name ?? null, parentNodeId: parent?.unitId ?? null, parentName: parent?.name ?? null, parentTypeName: parent?.nodeType?.name ?? null };
      });
      return json({ rules, conflicts });
    }
    if (method === 'PUT' && path.startsWith('/node-types/')) {
      const id = path.split('/')[2];
      typeOverrides.set(id, { ...typeOverrides.get(id), ...body });
      return json(typesOf().find((t) => t.id === id));
    }
    if (method === 'POST' && path === '/impact-preview') return json(preview(body.changes));

    const node = path.match(/^\/nodes\/([^/]+)(?:\/(\w+))?$/);
    if (node && method === 'POST') {
      const found = find(node[1]);
      if (!found) return problem(404, 'گره پیدا نشد.', 'not_found');
      if (body?.rowVersion != null && body.rowVersion !== versionOf(node[1])) return problem(409, 'این گره را کس دیگری همین حالا تغییر داده است؛ صفحه را تازه کنید و دوباره امتحان کنید.', 'conflict');
      const { company, unit } = found;
      if (node[2] === 'move') {
        const parentId: string | null = body.parentNodeId;
        if (parentId && wouldLoop(unit, parentId)) return problem(400, 'گره را نمی‌شود زیر خودش یا زیرمجموعه‌اش گذاشت.');
        const list = siblingsOf(company, unit);
        list.splice(list.indexOf(unit), 1);
        unit.parentNodeId = parentId;
        (parentId ? find(parentId)!.unit.children! : company.units).push(unit);
        bump(unit.unitId);
        return json(nodeOf(company, unit));
      }
      if (node[2] === 'reorder') {
        const list = siblingsOf(company, unit);
        list.splice(list.indexOf(unit), 1);
        list.splice(Math.max(0, Math.min(body.position, list.length)), 0, unit);
        bump(unit.unitId);
        return json(nodeOf(company, unit));
      }
      if (node[2] === 'deactivate' || node[2] === 'activate') {
        unit.isActive = node[2] === 'activate';
        bump(unit.unitId);
        return json(nodeOf(company, unit));
      }
    }
    if (method === 'POST' && path === '/nodes') {
      const company = body.companyId ? chart.find((c) => c.companyId === body.companyId) : body.parentNodeId ? find(body.parentNodeId)?.company : chart[0];
      if (!company) return problem(404, 'شرکت پیدا نشد.', 'not_found');
      const type = typesOf().find((t) => t.id === body.nodeTypeId);
      const unit: ChartUnit = {
        unitId: crypto.randomUUID(), name: body.name, manager: null, members: [], positions: [], children: [], isActive: true, peopleCount: 0,
        parentNodeId: body.parentNodeId ?? null,
        nodeType: type ? { nodeTypeId: type.id, name: type.name, color: type.color, icon: type.icon, isDomainBoundary: type.isDomainBoundary } : null,
      };
      (body.parentNodeId ? find(body.parentNodeId)!.unit.children! : company.units).push(unit);
      return json(nodeOf(company, unit), 201);
    }
    const put = path.match(/^\/nodes\/([^/]+)$/);
    if (put && method === 'PUT') {
      const found = find(put[1]);
      if (!found) return problem(404, 'گره پیدا نشد.', 'not_found');
      if (body?.rowVersion != null && body.rowVersion !== versionOf(put[1])) return problem(409, 'این گره را کس دیگری همین حالا تغییر داده است؛ صفحه را تازه کنید و دوباره امتحان کنید.', 'conflict');
      found.unit.name = body.name;
      const type = typesOf().find((t) => t.id === body.nodeTypeId);
      found.unit.nodeType = type ? { nodeTypeId: type.id, name: type.name, color: type.color, icon: type.icon, isDomainBoundary: type.isDomainBoundary } : found.unit.nodeType;
      bump(put[1]);
      return json(nodeOf(found.company, found.unit));
    }
    return json([]);
  };

  return {
    chart: () => chart,
    fetch: async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
      const marker = '/api/org-structure';
      if (!url.pathname.includes(marker)) return json([]);
      const path = url.pathname.slice(url.pathname.indexOf(marker) + marker.length) || '/';
      let body: any = null;
      try { body = init?.body ? JSON.parse(String(init.body)) : null; } catch { /* not JSON */ }
      if (path === '/chart') performance.mark('org-chart-response'); // scripts/measure-org-chart.mjs measures drawing from here
      return handle((init?.method || 'GET').toUpperCase(), path, url.searchParams, body);
    },
  };
}
