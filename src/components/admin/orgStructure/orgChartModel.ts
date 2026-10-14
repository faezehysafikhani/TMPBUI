// What the interactive org chart shows and what is selected in it, built from GET /chart.
import type { ChartCompany, ChartMember, ChartTeam, ChartUnit } from '../../../services/orgStructureApi';

export type ChartSelection =
  | { kind: 'company'; companyId: string }
  /** The company's people in no deputy. */
  | { kind: 'direct'; companyId: string }
  | { kind: 'unit'; companyId: string; unitId: string }
  /** A deputy's people in none of its teams. */
  | { kind: 'noTeam'; companyId: string; unitId: string }
  | { kind: 'team'; companyId: string; unitId: string; teamId: string }
  | { kind: 'member'; userId: string }
  /** Someone with no place in the structure yet. */
  | { kind: 'unplaced'; userId: string };

/** Where a person sits in the chart. */
export interface MemberPlace {
  member: ChartMember;
  company: ChartCompany;
  unit: ChartUnit | null;
  team: ChartTeam | null;
}

export const teamsOf = (unit: ChartUnit): ChartTeam[] => unit.teams || [];

/** Everyone in a deputy: in its teams and in none. */
export const unitHeadcount = (unit: ChartUnit) =>
  unit.members.length + teamsOf(unit).reduce((sum, team) => sum + team.members.length, 0);

export const companyHeadcount = (company: ChartCompany) =>
  company.members.length + company.units.reduce((sum, unit) => sum + unitHeadcount(unit), 0);

export function findMember(chart: ChartCompany[], userId: string): MemberPlace | null {
  for (const company of chart) {
    const direct = company.members.find((m) => m.userId === userId);
    if (direct) return { member: direct, company, unit: null, team: null };
    for (const unit of company.units) {
      const loose = unit.members.find((m) => m.userId === userId);
      if (loose) return { member: loose, company, unit, team: null };
      for (const team of teamsOf(unit)) {
        const inTeam = team.members.find((m) => m.userId === userId);
        if (inTeam) return { member: inTeam, company, unit, team };
      }
    }
  }
  return null;
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
