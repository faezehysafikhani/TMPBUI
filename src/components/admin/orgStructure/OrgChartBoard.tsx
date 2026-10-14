import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Network, Users, UserRound, ChevronDown, ChevronUp, GitFork, Maximize2, Minimize2, ChevronsDownUp, ChevronsUpDown, UserX } from 'lucide-react';
import { AdminCard, Notice } from '../AdminUi';
import { toPersianDigits } from '../../../utils/helpers';
import { ChartCompany, ChartMember, ChartTeam, ChartUnit, PersonRef, getChart, listPositions, listTeamsOutsideUnits, listUnplacedUsers } from '../../../services/orgStructureApi';
import { EmptyRow, LoadingRow, useLoad } from './orgShared';
import { ChartSelection, companyHeadcount, teamsOf, unitHeadcount } from './orgChartModel';
import { PersonAvatar } from './PersonAvatar';
import { OrgChartDetails } from './OrgChartDetails';

const PersonLine: React.FC<{ person: PersonRef | null; empty: string }> = ({ person, empty }) => (
  person ? (
    <span className="flex items-center gap-1.5 min-w-0">
      <PersonAvatar name={person.displayName} url={person.avatarUrl} />
      <span className="text-xs text-slate-600 dark:text-slate-300 truncate">{person.displayName}</span>
    </span>
  ) : <span className="text-xs text-slate-400">{empty}</span>
);

const Toggle: React.FC<{ open: boolean; onClick: () => void; label: string }> = ({ open, onClick, label }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    aria-expanded={open}
    aria-label={`${open ? 'بستن' : 'باز کردن'} ${label}`}
    className="w-8 h-8 shrink-0 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 flex items-center justify-center cursor-pointer"
  >
    {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
  </button>
);

/** A card of the chart; the selected one is outlined. */
const NodeCard: React.FC<{
  selected: boolean;
  onSelect: () => void;
  className?: string;
  children: React.ReactNode;
}> = ({ selected, onSelect, className = '', children }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
    aria-pressed={selected}
    className={`relative rounded-2xl border bg-white dark:bg-slate-900 cursor-pointer transition-all focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400 ${
      selected
        ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900 shadow-lg shadow-indigo-500/10'
        : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:shadow-md'
    } ${className}`}
  >
    {children}
  </div>
);

const MemberRow: React.FC<{ member: ChartMember; selected: boolean; onSelect: () => void }> = ({ member, selected, onSelect }) => (
  <button
    type="button"
    onClick={(e) => { e.stopPropagation(); onSelect(); }}
    className={`w-full flex items-center gap-2 rounded-xl px-2 py-1.5 text-right cursor-pointer ${selected ? 'bg-indigo-50 dark:bg-indigo-950/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
  >
    <PersonAvatar name={member.displayName} url={member.avatarUrl} />
    <span className="min-w-0">
      <span className={`block text-xs font-bold truncate ${member.isActive ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 line-through'}`}>{member.displayName}</span>
      {member.positionTitle && <span className="block text-[10px] text-slate-500 truncate">{member.positionTitle}</span>}
    </span>
  </button>
);

/** A work team (or the deputy's people in no team) under a deputy, with a branch line to it. */
const BranchCard: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  title: string;
  subtitle?: string;
  count: number;
  members: ChartMember[];
  open: boolean;
  onToggle: () => void;
  selected: boolean;
  onSelect: () => void;
  selectedUserId: string | null;
  onSelectMember: (userId: string) => void;
  muted?: boolean;
  /** Drawn on a deputy's branch line (not in the list of teams outside the deputies). */
  onBranch?: boolean;
}> = ({ icon: Icon, tone, title, subtitle, count, members, open, onToggle, selected, onSelect, selectedUserId, onSelectMember, muted, onBranch = true }) => (
  <div className="relative">
    {onBranch && <span className="absolute -start-4 top-7 w-4 h-0.5 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />}
    <NodeCard selected={selected} onSelect={onSelect} className={`w-60 ${muted ? 'opacity-70' : ''}`}>
      <div className="flex items-center gap-2.5 p-3">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-[18px] h-[18px]" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate">{title}</span>
          <span className="flex items-center gap-1 text-[11px] text-slate-500 min-w-0"><Users className="w-3 h-3 shrink-0" /> <span className="truncate">{toPersianDigits(count)} نفر{subtitle ? ` · ${subtitle}` : ''}</span></span>
        </span>
        {count > 0 && <Toggle open={open} onClick={onToggle} label={title} />}
      </div>
      {open && members.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-1.5 space-y-0.5 max-h-60 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          {members.map((m) => <MemberRow key={m.userId} member={m} selected={selectedUserId === m.userId} onSelect={() => onSelectMember(m.userId)} />)}
        </div>
      )}
    </NodeCard>
  </div>
);

/**
 * «چارت سازمانی»: the company at the top, its deputies under it, under each deputy the work teams
 * its people built and everyone in them (from any deputy; a person in several teams shows in each)
 * - and the deputy's people in no team, the teams whose builder is in no deputy, the company's people in
 * no deputy, and people with no place at all. Clicking any of them shows it in the side panel,
 * where it can be changed right away (as the user's permissions allow; the server checks again).
 */
export const OrgChartBoard: React.FC<{ can: (permission: string) => boolean }> = ({ can }) => {
  const data = useLoad(async () => {
    const [chart, positions, unplaced, outsideTeams] = await Promise.all([
      getChart(),
      listPositions().catch(() => []),
      listUnplacedUsers().catch(() => []),
      listTeamsOutsideUnits().catch(() => [] as ChartTeam[]),
    ]);
    return { chart, positions, unplaced, outsideTeams };
  }, 'دریافت چارت سازمانی ممکن نشد.');

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [selection, setSelection] = useState<ChartSelection | null>(null);
  const [collapsedUnits, setCollapsedUnits] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [fullscreen, setFullscreen] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);

  const chart = data.data?.chart || [];
  const company: ChartCompany | undefined = chart.find((c) => c.companyId === companyId) || chart[0];

  // The company first shown is selected, so the side panel is never empty.
  useEffect(() => {
    if (company && !selection) setSelection({ kind: 'company', companyId: company.companyId });
  }, [company?.companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  // A tree wider than the screen opens at its middle, where the company is - not at one edge.
  useEffect(() => {
    const el = canvas.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const middle = (el.scrollWidth - el.clientWidth) / 2;
    el.scrollLeft = getComputedStyle(el).direction === 'rtl' ? -middle : middle;
  }, [company?.companyId, !!data.data, fullscreen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!fullscreen) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [fullscreen]);

  const toggleIn = (set: React.Dispatch<React.SetStateAction<Set<string>>>, key: string) => set((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const allGroupKeys = useMemo(() => (company ? company.units.flatMap((u) => [`none:${u.unitId}`, ...teamsOf(u).map((t) => `team:${t.teamId}`)]) : []), [company]);
  const allOpen = !!company && collapsedUnits.size === 0 && allGroupKeys.every((k) => openGroups.has(k));
  const expandAll = () => { setCollapsedUnits(new Set()); setOpenGroups(new Set(allGroupKeys)); };
  const collapseAll = () => { setOpenGroups(new Set()); };

  const selectedUserId = selection && (selection.kind === 'member' || selection.kind === 'unplaced') ? selection.userId : null;
  const isSelected = (s: ChartSelection) => JSON.stringify(s) === JSON.stringify(selection);
  const selectMember = (userId: string) => setSelection({ kind: 'member', userId });

  if (data.loading && !data.data) return <AdminCard><LoadingRow /></AdminCard>;
  if (data.error) return <Notice type="error">{data.error}</Notice>;
  if (!company) return <AdminCard><EmptyRow>هنوز شرکتی تعریف نشده است. ابتدا در بخش «شرکت‌ها» یک شرکت بسازید.</EmptyRow></AdminCard>;

  const unitTree = (unit: ChartUnit) => {
    const open = !collapsedUnits.has(unit.unitId);
    const teams = teamsOf(unit);
    return (
      <div className="flex flex-col items-center">
        <NodeCard
          selected={isSelected({ kind: 'unit', companyId: company.companyId, unitId: unit.unitId })}
          onSelect={() => setSelection({ kind: 'unit', companyId: company.companyId, unitId: unit.unitId })}
          className={`w-64 ${unit.isActive === false ? 'opacity-60' : ''}`}
        >
          <div className="flex items-center gap-2.5 p-3.5">
            <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center justify-center shrink-0"><Network className="w-5 h-5" /></span>
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block text-sm font-extrabold text-slate-900 dark:text-white truncate">{unit.name}</span>
              <PersonLine person={unit.manager} empty="بدون مدیر" />
            </span>
            {(teams.length > 0 || unit.members.length > 0) && (
              <Toggle open={open} onClick={() => toggleIn(setCollapsedUnits, unit.unitId)} label={unit.name} />
            )}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-3.5 py-1.5 text-[11px] text-slate-500">
            <span>{toPersianDigits(teams.length)} تیم</span>
            <span>{toPersianDigits(unitHeadcount(unit))} نفر</span>
          </div>
        </NodeCard>

        {open && (teams.length > 0 || unit.members.length > 0) && (
          <div className="self-stretch flex justify-center">
            <div className="relative mt-0 ms-8 ps-4 pt-4 space-y-3 border-s-2 border-slate-200 dark:border-slate-700">
              {teams.map((team: ChartTeam) => (
                <BranchCard
                  key={team.teamId}
                  icon={Users}
                  tone="bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300"
                  title={team.name}
                  subtitle={`سازنده: ${team.owner.displayName}`}
                  count={team.members.length}
                  members={team.members}
                  open={openGroups.has(`team:${team.teamId}`)}
                  onToggle={() => toggleIn(setOpenGroups, `team:${team.teamId}`)}
                  selected={isSelected({ kind: 'team', teamId: team.teamId })}
                  onSelect={() => setSelection({ kind: 'team', teamId: team.teamId })}
                  selectedUserId={selectedUserId}
                  onSelectMember={selectMember}
                />
              ))}
              {unit.members.length > 0 && (
                <BranchCard
                  icon={UserRound}
                  tone="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  title="بدون تیم"
                  count={unit.members.length}
                  members={unit.members}
                  open={openGroups.has(`none:${unit.unitId}`)}
                  onToggle={() => toggleIn(setOpenGroups, `none:${unit.unitId}`)}
                  selected={isSelected({ kind: 'noTeam', companyId: company.companyId, unitId: unit.unitId })}
                  onSelect={() => setSelection({ kind: 'noTeam', companyId: company.companyId, unitId: unit.unitId })}
                  selectedUserId={selectedUserId}
                  onSelectMember={selectMember}
                />
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const units = company.units;
  const board = (
    <AdminCard className={fullscreen ? 'overflow-hidden flex flex-col h-full' : 'overflow-hidden'}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white"><GitFork className="w-5 h-5 text-indigo-600" /> چارت سازمانی</h3>
          <p className="text-xs text-slate-500 mt-0.5">روی هر بخش بزنید تا جزئیاتش را ببینید و همان‌جا تغییرش دهید.</p>
        </div>
        <div className="flex items-center gap-2">
          {chart.length > 1 && (
            <select
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold"
              value={company.companyId}
              onChange={(e) => { setCompanyId(e.target.value); setSelection({ kind: 'company', companyId: e.target.value }); }}
              aria-label="شرکت"
            >
              {chart.map((c) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
            </select>
          )}
          <button type="button" onClick={allOpen ? collapseAll : expandAll} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 flex items-center justify-center cursor-pointer" title={allOpen ? 'بستن همه' : 'باز کردن همه'} aria-label={allOpen ? 'بستن همه' : 'باز کردن همه'}>
            {allOpen ? <ChevronsDownUp className="w-4 h-4" /> : <ChevronsUpDown className="w-4 h-4" />}
          </button>
          <button type="button" onClick={() => setFullscreen(!fullscreen)} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 flex items-center justify-center cursor-pointer" title={fullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'} aria-label={fullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}>
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div ref={canvas} className={`overflow-auto ${fullscreen ? 'flex-1' : 'max-h-[70vh]'}`}>
        <div className="min-w-max px-6 py-8 flex flex-col items-center">
          {/* the company */}
          <NodeCard
            selected={isSelected({ kind: 'company', companyId: company.companyId })}
            onSelect={() => setSelection({ kind: 'company', companyId: company.companyId })}
            className="w-72 bg-gradient-to-br from-indigo-50/80 to-white dark:from-indigo-950/40 dark:to-slate-900"
          >
            <div className="flex items-center gap-3 p-4">
              <span className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/30"><Building2 className="w-5 h-5" /></span>
              <span className="min-w-0 flex-1 space-y-1">
                <span className="block text-base font-extrabold text-slate-900 dark:text-white truncate">{company.name}</span>
                <PersonLine person={company.manager} empty="بدون مدیر ارشد" />
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-indigo-100/70 dark:border-slate-800 px-4 py-1.5 text-[11px] text-slate-500">
              <span>{toPersianDigits(units.length)} معاونت</span>
              <span>{toPersianDigits(companyHeadcount(company))} نفر</span>
            </div>
          </NodeCard>

          {company.members.length > 0 && (
            <button
              type="button"
              onClick={() => setSelection({ kind: 'direct', companyId: company.companyId })}
              className={`mt-2 px-3 py-1 rounded-full border text-[11px] font-bold cursor-pointer ${isSelected({ kind: 'direct', companyId: company.companyId }) ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-indigo-300'}`}
            >
              مستقیم زیر شرکت · {toPersianDigits(company.members.length)} نفر
            </button>
          )}

          {units.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">این شرکت هنوز معاونتی ندارد. از پنل کنار، «افزودن معاونت» را بزنید.</p>
          ) : (
            <>
              <span className="w-0.5 h-8 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
              <div className="flex items-start">
                {units.map((unit, i) => (
                  <div key={unit.unitId} className="relative px-4 pt-8 flex flex-col items-center">
                    {/* the bar joining the deputies, and each one's drop from it */}
                    {units.length > 1 && (
                      <span
                        aria-hidden="true"
                        className={`absolute top-0 h-0.5 bg-slate-200 dark:bg-slate-700 ${i === 0 ? 'start-1/2 end-0' : i === units.length - 1 ? 'start-0 end-1/2' : 'start-0 end-0'}`}
                      />
                    )}
                    <span className="absolute top-0 start-1/2 w-0.5 h-8 bg-slate-200 dark:bg-slate-700" aria-hidden="true" />
                    {unitTree(unit)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {(data.data?.outsideTeams.length || 0) > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-violet-700 dark:text-violet-300 mb-1">
            <Users className="w-4 h-4" /> تیم‌هایی که سازنده‌شان در هیچ معاونتی نیست ({toPersianDigits(data.data!.outsideTeams.length)})
          </p>
          <p className="text-[11px] text-slate-500 mb-2">با قرار دادن سازندهٔ تیم در یک معاونت، تیم زیر همان معاونت نمایش داده می‌شود.</p>
          <div className="flex flex-wrap gap-3">
            {data.data!.outsideTeams.map((team) => (
              <BranchCard
                key={team.teamId}
                onBranch={false}
                icon={Users}
                tone="bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300"
                title={team.name}
                subtitle={`سازنده: ${team.owner.displayName}`}
                count={team.members.length}
                members={team.members}
                open={openGroups.has(`team:${team.teamId}`)}
                onToggle={() => toggleIn(setOpenGroups, `team:${team.teamId}`)}
                selected={isSelected({ kind: 'team', teamId: team.teamId })}
                onSelect={() => setSelection({ kind: 'team', teamId: team.teamId })}
                selectedUserId={selectedUserId}
                onSelectMember={selectMember}
              />
            ))}
          </div>
        </div>
      )}

      {(data.data?.unplaced.length || 0) > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 mb-2">
            <UserX className="w-4 h-4" /> افراد بدون جایگاه سازمانی ({toPersianDigits(data.data!.unplaced.length)})
          </p>
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {data.data!.unplaced.map((u) => (
              <button
                key={u.userId}
                type="button"
                onClick={() => setSelection({ kind: 'unplaced', userId: u.userId })}
                className={`flex items-center gap-1.5 rounded-full border ps-1 pe-3 py-1 text-xs cursor-pointer ${selectedUserId === u.userId ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/50' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
              >
                <PersonAvatar name={u.displayName} url={u.avatarUrl} />
                <span className="font-bold text-slate-700 dark:text-slate-200">{u.displayName}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AdminCard>
  );

  return (
    <>
    {fullscreen && <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs" onClick={() => setFullscreen(false)} />}
    {/* Full screen keeps the details panel beside the chart. */}
    <div className={fullscreen
      ? 'fixed inset-3 z-50 grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-3 items-stretch'
      : 'grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start'}
    >
      {/* On narrow screens the chart comes first and the details below it. */}
      <div className={fullscreen ? 'overflow-y-auto min-h-0 order-2 lg:order-none' : 'order-2 xl:order-none'}>
      <OrgChartDetails
        can={can}
        chart={chart}
        positions={data.data?.positions || []}
        unplaced={data.data?.unplaced || []}
        outsideTeams={data.data?.outsideTeams || []}
        selection={selection}
        onSelect={setSelection}
        onChanged={data.reload}
      />
      </div>
      <div className={fullscreen ? 'min-h-0 order-1 lg:order-none' : 'order-1 xl:order-none'}>{board}</div>
    </div>
    </>
  );
};
