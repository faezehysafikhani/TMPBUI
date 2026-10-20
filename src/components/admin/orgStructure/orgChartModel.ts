// What the interactive org chart shows and what is selected in it, built from GET /chart:
// the company, its head, its deputies, each deputy's positions (vacant ones too) and who holds them.
import type { ChartCompany, ChartMember, ChartPosition, ChartUnit } from '../../../services/orgStructureApi';

export type ChartSelection =
  | { kind: 'company'; companyId: string }
  /** The company's people in no deputy. */
  | { kind: 'direct'; companyId: string }
  | { kind: 'unit'; companyId: string; unitId: string }
  /** A deputy's people who hold none of its positions. */
  | { kind: 'noPosition'; companyId: string; unitId: string }
  /** One of a deputy's positions, with whoever holds it. */
  | { kind: 'position'; companyId: string; unitId: string; unitPositionId: string }
  | { kind: 'member'; userId: string }
  /** Someone with no place in the structure yet. */
  | { kind: 'unplaced'; userId: string };

/** A deputy position and where it is. */
export interface PositionPlace { company: ChartCompany; unit: ChartUnit; position: ChartPosition }

export const positionsOf = (unit: ChartUnit): ChartPosition[] => unit.positions || [];

/** The people of a deputy: its own and those holding one of its positions. */
export const unitHeadcount = (unit: ChartUnit) => unit.peopleCount ?? unit.members.length;

export const companyHeadcount = (company: ChartCompany) =>
  company.peopleCount ?? company.members.length + company.units.reduce((sum, unit) => sum + unitHeadcount(unit), 0);

export const vacantCount = (unit: ChartUnit) => positionsOf(unit).filter((p) => p.holders.length === 0).length;

/** Every deputy position of the chart, with where it is. */
export function allPositions(chart: ChartCompany[]): PositionPlace[] {
  return chart.flatMap((company) => company.units.flatMap((unit) => positionsOf(unit).map((position) => ({ company, unit, position }))));
}

export function findPosition(chart: ChartCompany[], unitPositionId: string): PositionPlace | null {
  return allPositions(chart).find((p) => p.position.unitPositionId === unitPositionId) || null;
}

/** A person as the chart shows them (from wherever they appear), and the positions they hold. */
export function findMember(chart: ChartCompany[], userId: string): { member: ChartMember; positions: PositionPlace[] } | null {
  const positions = allPositions(chart).filter((p) => p.position.holders.some((m) => m.userId === userId));
  const member =
    chart.flatMap((c) => [...c.members, ...c.units.flatMap((u) => u.members)]).find((m) => m.userId === userId)
    || positions[0]?.position.holders.find((m) => m.userId === userId)
    || headAsMember(chart, userId);
  return member ? { member, positions } : null;
}

/** A company's head who has no place in the structure: shown from the company. */
function headAsMember(chart: ChartCompany[], userId: string): ChartMember | undefined {
  const head = chart.map((c) => c.manager).find((m) => m?.userId === userId);
  return head ? { userId: head.userId, displayName: head.displayName, isActive: head.isActive, positionTitle: null, managerUserId: null, avatarUrl: head.avatarUrl } : undefined;
}

export function findUnit(chart: ChartCompany[], unitId: string): { company: ChartCompany; unit: ChartUnit } | null {
  for (const company of chart) {
    const unit = company.units.find((u) => u.unitId === unitId);
    if (unit) return { company, unit };
  }
  return null;
}

/** Initials for a person without a picture: of the last two words, so a title before the name does not count. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(-2);
  return words.map((w) => w[0]).join('') || '؟';
}
