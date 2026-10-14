// What the interactive org chart shows and what is selected in it, built from GET /chart.
import type { ChartCompany, ChartMember, ChartTeam, ChartUnit } from '../../../services/orgStructureApi';

export type ChartSelection =
  | { kind: 'company'; companyId: string }
  /** The company's people in no deputy. */
  | { kind: 'direct'; companyId: string }
  | { kind: 'unit'; companyId: string; unitId: string }
  /** A deputy's people in no work team. */
  | { kind: 'noTeam'; companyId: string; unitId: string }
  /** A work team, under its builder's deputy or among the teams outside the deputies. */
  | { kind: 'team'; teamId: string }
  | { kind: 'member'; userId: string }
  /** Someone with no place in the structure yet. */
  | { kind: 'unplaced'; userId: string };

/** A work team and where the chart shows it (no unit: among the teams outside the deputies). */
export interface TeamPlace { team: ChartTeam; company: ChartCompany | null; unit: ChartUnit | null }

export const teamsOf = (unit: ChartUnit): ChartTeam[] => unit.teams || [];

/** The people of a deputy (its teams can also hold people of other deputies, so they are not counted). */
export const unitHeadcount = (unit: ChartUnit) => unit.peopleCount ?? unit.members.length;

export const companyHeadcount = (company: ChartCompany) =>
  company.peopleCount ?? company.members.length + company.units.reduce((sum, unit) => sum + unitHeadcount(unit), 0);

/** Every work team of the chart, with where it is shown. */
export function allTeams(chart: ChartCompany[], outside: ChartTeam[]): TeamPlace[] {
  return [
    ...chart.flatMap((company) => company.units.flatMap((unit) => teamsOf(unit).map((team) => ({ team, company, unit })))),
    ...outside.map((team) => ({ team, company: null, unit: null })),
  ];
}

/** A person as the chart shows them (from wherever they appear), and the work teams they are in. */
export function findMember(chart: ChartCompany[], outside: ChartTeam[], userId: string): { member: ChartMember; teams: TeamPlace[] } | null {
  const teams = allTeams(chart, outside).filter((p) => p.team.members.some((m) => m.userId === userId));
  const member =
    chart.flatMap((c) => [...c.members, ...c.units.flatMap((u) => u.members)]).find((m) => m.userId === userId)
    || teams[0]?.team.members.find((m) => m.userId === userId);
  return member ? { member, teams } : null;
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
