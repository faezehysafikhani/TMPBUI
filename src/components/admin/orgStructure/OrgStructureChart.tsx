import React, { useMemo, useState } from 'react';
import { Building2, Briefcase, ChevronDown, ChevronLeft, Link2, ListChecks, LayoutTemplate, Network, UserRound } from 'lucide-react';
import { AdminCard } from '../AdminUi';
import { EmptyRow as EmptyHint } from './orgShared';
import { OrgPlacementBoard, PlacementPick } from './orgPlacementData';
import type { Company, OrgNode, UnitPosition } from '../../../services/orgStructureApi';

export type ToolId = 'templates' | 'rules' | 'links';

const Card: React.FC<{ icon: React.ComponentType<{ className?: string }>; tone: string; title: string; note?: string; onClick: () => void; selected?: boolean }> = ({ icon: Icon, tone, title, note, onClick, selected }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-start transition-colors cursor-pointer min-w-0 ${selected ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300'}`}
  >
    <Icon className={`w-4 h-4 shrink-0 ${tone}`} />
    <span className="min-w-0">
      <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{title}</span>
      {note && <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">{note}</span>}
    </span>
  </button>
);

const PostCard: React.FC<{ post: UnitPosition; onPick: (holder: { userId: string; displayName: string } | null) => void }> = ({ post, onPick }) => {
  const holders = post.holders;
  return (
    <div className="flex flex-wrap gap-1.5">
      {holders.length === 0 ? (
        <Card icon={Briefcase} tone="text-slate-400" title={post.title} note="خالی" onClick={() => onPick(null)} />
      ) : holders.map((h) => (
        <Card key={h.userId} icon={UserRound} tone="text-emerald-600" title={post.title} note={h.displayName} onClick={() => onPick(h)} />
      ))}
    </div>
  );
};

/** A node, its posts and the nodes under it. */
const NodeBranch: React.FC<{
  node: OrgNode;
  childrenOf: Map<string, OrgNode[]>;
  postsOf: Map<string, UnitPosition[]>;
  onPick: (pick: Omit<PlacementPick, 'at'>) => void;
  depth: number;
  selectedUnitId?: string;
}> = ({ node, childrenOf, postsOf, onPick, depth, selectedUnitId }) => {
  const [open, setOpen] = useState(depth < 1);
  const kids = childrenOf.get(node.id) ?? [];
  const posts = postsOf.get(node.id) ?? [];
  const hasInside = kids.length + posts.length > 0;
  return (
    <li className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => setOpen((v) => !v)} disabled={!hasInside} aria-expanded={open} aria-label={`${open ? 'بستن' : 'باز کردن'} ${node.name}`} className="w-6 h-6 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 disabled:opacity-30 cursor-pointer">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
        <Card icon={Network} tone={node.isActive ? 'text-indigo-600' : 'text-slate-400'} title={node.name} note={node.isActive ? node.nodeTypeName ?? undefined : 'غیرفعال'} selected={selectedUnitId === node.id} onClick={() => onPick({ companyId: node.companyId!, unitId: node.id })} />
      </div>
      {open && hasInside && (
        <div className="ms-3 ps-4 border-s-2 border-slate-100 dark:border-slate-800 space-y-1.5">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} onPick={(holder) => onPick({ companyId: node.companyId!, unitId: node.id, positionId: p.positionId, userId: holder?.userId, userName: holder?.displayName })} />
          ))}
          {kids.length > 0 && (
            <ul className="space-y-1.5">
              {kids.map((k) => <NodeBranch key={k.id} node={k} childrenOf={childrenOf} postsOf={postsOf} onPick={onPick} depth={depth + 1} selectedUnitId={selectedUnitId} />)}
            </ul>
          )}
        </div>
      )}
    </li>
  );
};

const CompanyBranch: React.FC<{
  company: Company;
  board: OrgPlacementBoard;
  onPick: (pick: Omit<PlacementPick, 'at'>) => void;
  selected: PlacementPick | null;
}> = ({ company, board, onPick, selected }) => {
  const [open, setOpen] = useState(true);
  const { tops, childrenOf, postsOf, companyPosts } = useMemo(() => {
    const mine = board.nodes.filter((n) => n.companyId === company.id);
    const ids = new Set(mine.map((n) => n.id));
    const childrenOf = new Map<string, OrgNode[]>();
    const tops: OrgNode[] = [];
    for (const n of [...mine].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'fa'))) {
      if (n.parentNodeId && ids.has(n.parentNodeId)) childrenOf.set(n.parentNodeId, [...(childrenOf.get(n.parentNodeId) ?? []), n]);
      else tops.push(n);
    }
    const postsOf = new Map<string, UnitPosition[]>();
    const companyPosts: UnitPosition[] = [];
    for (const p of board.posts) {
      if (p.companyId && p.companyId !== company.id) continue;
      if (p.unitId && ids.has(p.unitId)) postsOf.set(p.unitId, [...(postsOf.get(p.unitId) ?? []), p]);
      else if (!p.unitId && p.companyId === company.id) companyPosts.push(p);
    }
    return { tops, childrenOf, postsOf, companyPosts };
  }, [board, company.id]);

  return (
    <li className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={`${open ? 'بستن' : 'باز کردن'} ${company.name}`} className="w-6 h-6 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 cursor-pointer">
          {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
        <Card icon={Building2} tone="text-indigo-700 dark:text-indigo-300" title={company.name} note={company.isActive ? undefined : 'غیرفعال'} selected={selected?.companyId === company.id && !selected.unitId} onClick={() => onPick({ companyId: company.id })} />
      </div>
      {open && (
        <div className="ms-3 ps-4 border-s-2 border-slate-100 dark:border-slate-800 space-y-1.5">
          {companyPosts.map((p) => (
            <PostCard key={p.id} post={p} onPick={(holder) => onPick({ companyId: company.id, positionId: p.positionId, userId: holder?.userId, userName: holder?.displayName })} />
          ))}
          {tops.length > 0 && (
            <ul className="space-y-1.5">
              {tops.map((n) => <NodeBranch key={n.id} node={n} childrenOf={childrenOf} postsOf={postsOf} onPick={onPick} depth={0} selectedUnitId={selected?.unitId} />)}
            </ul>
          )}
          {tops.length === 0 && companyPosts.length === 0 && <EmptyHint>هنوز واحد یا سمتی ندارد.</EmptyHint>}
        </div>
      )}
    </li>
  );
};

/** «چارت سازمانی»: company › deputies/units › posts, refreshed after every save; a click fills the form above. */
export const OrgStructureChart: React.FC<{
  board: OrgPlacementBoard;
  selected: PlacementPick | null;
  onPick: (pick: Omit<PlacementPick, 'at'>) => void;
  tools: { id: ToolId; label: string }[];
  onTool: (tool: ToolId) => void;
}> = ({ board, selected, onPick, tools, onTool }) => {
  const icons = { templates: LayoutTemplate, rules: ListChecks, links: Link2 } as const;
  return (
    <AdminCard className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">چارت سازمانی</h3>
        <div className="flex flex-wrap gap-1.5">
          {tools.map((t) => {
            const Icon = icons[t.id];
            return (
              <button key={t.id} type="button" onClick={() => onTool(t.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>
      {board.companies.length === 0 ? (
        <EmptyHint>هنوز شرکتی ثبت نشده است.</EmptyHint>
      ) : (
        <ul className="space-y-3" data-testid="structure-tree">
          {board.companies.map((c) => <CompanyBranch key={c.id} company={c} board={board} onPick={onPick} selected={selected} />)}
        </ul>
      )}
    </AdminCard>
  );
};
