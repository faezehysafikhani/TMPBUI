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
  /** A post (of a deputy, or directly in the company: unitId ''), with whoever holds it. */
  | { kind: 'position'; companyId: string; unitId: string; unitPositionId: string }
  | { kind: 'member'; userId: string }
  /** Someone with no place in the structure yet. */
  | { kind: 'unplaced'; userId: string };

/** A post and where it is: in a deputy, or directly in the company (unit null). */
export interface PositionPlace { company: ChartCompany; unit: ChartUnit | null; position: ChartPosition }

export const positionsOf = (unit: ChartUnit): ChartPosition[] => unit.positions || [];

/**
 * Posts as a tree: each post followed by the posts under it (parentPostId), at any depth, keeping
 * the given order among siblings. A post whose parent is not in the list is a root.
 */
export function postTree<T extends { unitPositionId: string; parentPostId?: string | null }>(posts: T[]): { position: T; depth: number }[] {
  const ids = new Set(posts.map((p) => p.unitPositionId));
  const out: { position: T; depth: number }[] = [];
  const seen = new Set<string>();
  const visit = (post: T, depth: number) => {
    if (seen.has(post.unitPositionId)) return;
    seen.add(post.unitPositionId);
    out.push({ position: post, depth });
    posts.filter((p) => p.parentPostId === post.unitPositionId).forEach((child) => visit(child, depth + 1));
  };
  posts.filter((p) => !p.parentPostId || !ids.has(p.parentPostId)).forEach((root) => visit(root, 0));
  posts.forEach((p) => visit(p, 0)); // anything left (a loop): flat
  return out;
}

/** The posts directly in the company (the head's first). */
export const companyPostsOf = (company: ChartCompany): ChartPosition[] => company.positions || [];

/** The company head's post, if it has one. */
export const headPostOf = (company: ChartCompany): ChartPosition | undefined => companyPostsOf(company).find((p) => p.isHead);

/** The people of a deputy: its own and those holding one of its positions. */
export const unitHeadcount = (unit: ChartUnit) => unit.peopleCount ?? unit.members.length;

export const companyHeadcount = (company: ChartCompany) =>
  company.peopleCount ?? company.members.length + company.units.reduce((sum, unit) => sum + unitHeadcount(unit), 0);

export const vacantCount = (unit: ChartUnit) => positionsOf(unit).filter((p) => p.holders.length === 0).length;

/** Every post of the chart (the companies' own too), with where it is. */
export function allPositions(chart: ChartCompany[]): PositionPlace[] {
  return chart.flatMap((company) => [
    ...companyPostsOf(company).map((position) => ({ company, unit: null, position })),
    ...company.units.flatMap((unit) => positionsOf(unit).map((position) => ({ company, unit, position }))),
  ]);
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
