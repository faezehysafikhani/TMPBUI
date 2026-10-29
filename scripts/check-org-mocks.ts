// Checks the org chart mocks (src/mocks/orgChart) and the chart model's nested-structure helpers:
// every mock is a consistent chart, the flat one is exactly today's shape, and the helpers give
// today's results on flat data. Run: npm run check:org-mocks
import assert from 'node:assert/strict';
import { ORG_CHART_MOCKS, type OrgChartMockName } from '../src/mocks/orgChart/charts';
import { allPositions, ancestorsOf, companyHeadcount, findMember, findUnit, isNested, linksOf, unitTree } from '../src/components/admin/orgStructure/orgChartModel';

const NEW_FIELDS = ['parentNodeId', 'children', 'nodeType', 'links'] as const;
const expectedNodes: Record<OrgChartMockName, number> = { flat: 3, nested: 5, postBank: 52, large40: 40, large400: 400 };

for (const name of Object.keys(ORG_CHART_MOCKS) as OrgChartMockName[]) {
  const chart = ORG_CHART_MOCKS[name]();
  assert.equal(chart.length, 1, `${name}: one company`);
  const company = chart[0];
  const ids = new Set(company.units.map((u) => u.unitId));
  assert.equal(ids.size, company.units.length, `${name}: unique node ids`);
  assert.equal(company.units.length, expectedNodes[name], `${name}: node count`);

  // Same mock, same chart.
  assert.deepEqual(ORG_CHART_MOCKS[name](), chart, `${name}: deterministic`);

  // Parents and children agree; links point at nodes of the company; dotted never counts as manager.
  for (const unit of company.units) {
    if (unit.parentNodeId) {
      assert.ok(ids.has(unit.parentNodeId), `${name}: parent of ${unit.name} exists`);
      assert.ok(findUnit(chart, unit.parentNodeId)!.unit.children?.includes(unit.unitId), `${name}: ${unit.name} listed in its parent's children`);
    }
    for (const childId of unit.children || []) {
      assert.equal(findUnit(chart, childId)?.unit.parentNodeId, unit.unitId, `${name}: child of ${unit.name} points back`);
    }
    for (const link of unit.links || []) {
      assert.ok(ids.has(link.targetNodeId) && link.targetNodeId !== unit.unitId, `${name}: link of ${unit.name} has a target`);
      if (link.lineStyle === 'dotted') assert.equal(link.countsAsManager, false, `${name}: dotted link counts as manager`);
    }
    assert.ok(ancestorsOf(company, unit.unitId).length < company.units.length, `${name}: ancestors end`);
  }

  // The tree shows every node once, parents before their children.
  const tree = unitTree(company);
  assert.equal(tree.length, company.units.length, `${name}: tree covers every node`);
  assert.equal(new Set(tree.map((t) => t.unit.unitId)).size, company.units.length, `${name}: tree has no repeats`);
  const at = new Map(tree.map((t, i) => [t.unit.unitId, i] as const));
  for (const { unit, depth } of tree) {
    if (unit.parentNodeId) assert.ok(at.get(unit.parentNodeId)! < at.get(unit.unitId)!, `${name}: parent before child`);
    assert.equal(depth, ancestorsOf(company, unit.unitId).length, `${name}: depth = number of ancestors`);
  }

  // One company head; today's helpers still work.
  const heads = allPositions(chart).filter((p) => p.position.isHead);
  assert.equal(heads.length, 1, `${name}: one company head`);
  assert.ok(companyHeadcount(company) > 0, `${name}: people counted`);
  assert.ok(findMember(chart, heads[0].position.holders[0].userId), `${name}: head found as a member`);

  if (name === 'flat') {
    // Exactly what an older backend / a flat company sends: none of the new fields.
    for (const unit of company.units) for (const field of NEW_FIELDS) assert.ok(!(field in unit), `flat: no ${field}`);
    assert.ok(!('uiLevel' in company), 'flat: no uiLevel');
    assert.equal(isNested(company), false);
    assert.deepEqual(tree.map((t) => [t.unit.unitId, t.depth]), company.units.map((u) => [u.unitId, 0]), 'flat: tree = list order, depth 0');
    assert.equal(linksOf(company).length, 0);
  } else {
    assert.equal(isNested(company), true, `${name}: nested`);
  }

  const depth = Math.max(...tree.map((t) => t.depth));
  console.log(`${name.padEnd(9)} nodes=${String(company.units.length).padStart(3)} posts=${String(allPositions(chart).length).padStart(4)} people=${String(companyHeadcount(company)).padStart(4)} depth=${depth} links=${linksOf(company).length}`);
}

// Post Bank: the five committees each have a dotted line to the board; the CEO is the only head.
const bank = ORG_CHART_MOCKS.postBank()[0];
const board = bank.units.find((u) => u.name === 'هیأت مدیره')!;
const committees = bank.units.filter((u) => u.nodeType?.nodeTypeId === 'type-committee');
assert.equal(committees.length, 5);
for (const committee of committees) {
  assert.equal(committee.parentNodeId, null);
  assert.ok(committee.links?.some((l) => l.targetNodeId === board.unitId && l.lineStyle === 'dotted'));
}
assert.deepEqual(ancestorsOf(bank, bank.units.find((u) => u.name === 'اداره کل اعتبارات')!.unitId).map((u) => u.name),
  ['معاونت اعتباری و بین‌الملل', 'مدیریت عامل', 'هیأت مدیره', 'مجمع عمومی']);

console.log('org chart mocks OK');
