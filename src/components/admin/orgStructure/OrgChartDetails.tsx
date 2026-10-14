import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2, Network, Users, UserRound, Pencil, Plus, UserPlus, Unlink, Zap, Loader2, Briefcase, LogOut,
} from 'lucide-react';
import { AdminCard, AdminDialog, Field, Notice, PrimaryButton, SecondaryButton, StatusBadge, Toggle, inputClass } from '../AdminUi';
import { userErrorMessage } from '../../../utils/errorMessages';
import { toPersianDigits } from '../../../utils/helpers';
import {
  ChartCompany, ChartMember, ChartUnit, ChartTeam, Position, UnplacedUser, UserAssignment, MANAGER_SOURCE_TITLES,
  ORG_STRUCTURE_PERMISSIONS as P, ORG_UNIT_PERMISSIONS as U,
  createOrgUnit, getAssignment, linkUnitToCompany, listCompanies, setAssignment,
  unlinkUnit, updateCompany, updateOrgUnit,
} from '../../../services/orgStructureApi';
import { UserPicker } from './orgShared';
import { ChartSelection, allTeams, companyHeadcount, findMember, findUnit, teamsOf, unitHeadcount } from './orgChartModel';
import { PersonAvatar } from './PersonAvatar';

type Dialog =
  | { kind: 'editCompany'; company: ChartCompany }
  | { kind: 'addUnit'; company: ChartCompany }
  | { kind: 'editUnit'; unit: ChartUnit }
  | { kind: 'addUnitMember'; company: ChartCompany; unit: ChartUnit }
  | { kind: 'placeUser'; userId: string; name: string };

const InfoRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
    <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
    <span className="text-sm font-bold text-slate-800 dark:text-slate-100 text-left min-w-0">{children}</span>
  </div>
);

const PersonValue: React.FC<{ person: { displayName: string; avatarUrl?: string | null } | null; empty?: string; note?: string }> = ({ person, empty = '—', note }) => (
  person ? (
    <span className="flex items-center gap-2 justify-end">
      <span className="text-left">
        <span className="block">{person.displayName}</span>
        {note && <span className="block text-[11px] font-normal text-slate-500">{note}</span>}
      </span>
      <PersonAvatar name={person.displayName} url={person.avatarUrl} size="md" />
    </span>
  ) : <span className="text-slate-400 font-normal">{empty}</span>
);

/** One of the «عملیات سریع» tiles. */
const ActionTile: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; tone?: 'indigo' | 'rose'; disabled?: boolean }> = ({ icon: Icon, label, onClick, tone = 'indigo', disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
      tone === 'rose'
        ? 'border-rose-100 bg-rose-50/60 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300'
        : 'border-slate-200 bg-white text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50/60 dark:border-slate-700 dark:bg-slate-900 dark:text-indigo-300'
    }`}
  >
    <Icon className="w-5 h-5" />
    <span className="text-center leading-tight">{label}</span>
  </button>
);

const Header: React.FC<{ icon: React.ComponentType<{ className?: string }>; tone: string; title: string; subtitle: string; badge?: React.ReactNode }> = ({ icon: Icon, tone, title, subtitle, badge }) => (
  <div className="flex items-center gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3">
    <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${tone}`}><Icon className="w-6 h-6" /></span>
    <span className="min-w-0 flex-1">
      <span className="block text-base font-extrabold text-slate-900 dark:text-white truncate">{title}</span>
      <span className="block text-xs text-slate-500 truncate">{subtitle}</span>
    </span>
    {badge}
  </div>
);

const ActiveBadge: React.FC<{ active: boolean }> = ({ active }) => <StatusBadge tone={active ? 'green' : 'red'}>{active ? 'فعال' : 'غیرفعال'}</StatusBadge>;

/** People listed inside a details panel; each opens its own details. */
const PeopleList: React.FC<{ members: ChartMember[]; onOpen: (userId: string) => void; onRemove?: (member: ChartMember) => void; busy?: boolean }> = ({ members, onOpen, onRemove, busy }) => (
  members.length === 0 ? <p className="text-xs text-slate-400 py-2">کسی نیست.</p> : (
    <div className="space-y-1 max-h-64 overflow-y-auto">
      {members.map((m) => (
        <div key={m.userId} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
          <button type="button" onClick={() => onOpen(m.userId)} className="flex items-center gap-2 min-w-0 flex-1 text-right cursor-pointer">
            <PersonAvatar name={m.displayName} url={m.avatarUrl} />
            <span className="min-w-0">
              <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{m.displayName}</span>
              <span className="block text-[10px] text-slate-500 truncate">{m.positionTitle || 'بدون سمت'}</span>
            </span>
          </button>
          {onRemove && (
            <button type="button" disabled={busy} onClick={() => onRemove(m)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer disabled:opacity-40" title="خروج از تیم" aria-label={`خروج ${m.displayName} از تیم`}>
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
);

/**
 * The side panel of the org chart: everything about the selected company, deputy, team or
 * person, and the changes that fit it - each shown only to whoever may make it.
 */
export const OrgChartDetails: React.FC<{
  can: (permission: string) => boolean;
  chart: ChartCompany[];
  positions: Position[];
  unplaced: UnplacedUser[];
  /** Work teams whose builder is in no deputy. */
  outsideTeams: ChartTeam[];
  selection: ChartSelection | null;
  onSelect: (selection: ChartSelection) => void;
  onChanged: () => Promise<void> | void;
}> = ({ can, chart, positions, unplaced, outsideTeams, selection, onSelect, onChanged }) => {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setMessage(null), [JSON.stringify(selection)]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Runs a change, reports it and reloads the chart. */
  const run = async (action: () => Promise<unknown>, success: string, failure: string): Promise<boolean> => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      await onChanged();
      setMessage({ type: 'success', text: success });
      return true;
    } catch (err) {
      setMessage({ type: 'error', text: userErrorMessage(err, failure) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openMember = (userId: string) => onSelect({ kind: 'member', userId });

  let body: React.ReactNode = <p className="text-sm text-slate-500 p-4">یک بخش از چارت را انتخاب کنید.</p>;

  if (selection?.kind === 'company' || selection?.kind === 'direct') {
    const company = chart.find((c) => c.companyId === selection.companyId);
    if (company) {
      const teamCount = company.units.reduce((n, u) => n + teamsOf(u).length, 0);
      body = selection.kind === 'company' ? (
        <>
          <Header icon={Building2} tone="bg-indigo-600 text-white" title={company.name} subtitle={`شرکت · کد ${company.code}`} badge={<ActiveBadge active={company.isActive} />} />
          <div>
            <InfoRow label="مدیر ارشد"><PersonValue person={company.manager} empty="تعیین نشده" /></InfoRow>
            <InfoRow label="معاونت‌ها">{toPersianDigits(company.units.length)}</InfoRow>
            <InfoRow label="تیم‌های کاری">{toPersianDigits(teamCount)}</InfoRow>
            <InfoRow label="تعداد افراد">{toPersianDigits(companyHeadcount(company))} نفر</InfoRow>
          </div>
          {company.units.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500">معاونت‌ها</p>
              {company.units.map((u) => (
                <button key={u.unitId} type="button" onClick={() => onSelect({ kind: 'unit', companyId: company.companyId, unitId: u.unitId })} className="w-full flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-right hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer">
                  <span className="flex items-center gap-2 min-w-0 text-sm font-bold text-slate-800 dark:text-slate-100"><Network className="w-4 h-4 text-emerald-600 shrink-0" /> {u.name}</span>
                  <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0">{toPersianDigits(unitHeadcount(u))} نفر</span>
                </button>
              ))}
            </div>
          )}
          <QuickActions>
            {can(P.manageCompanies) && <ActionTile icon={Pencil} label="ویرایش شرکت" onClick={() => setDialog({ kind: 'editCompany', company })} />}
            {can(P.manageCompanies) && can(U.create) && <ActionTile icon={Plus} label="افزودن معاونت" onClick={() => setDialog({ kind: 'addUnit', company })} />}
          </QuickActions>
        </>
      ) : (
        <>
          <Header icon={UserRound} tone="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" title="مستقیم زیر شرکت" subtitle={`${company.name} · بدون معاونت`} />
          <PeopleList members={company.members} onOpen={openMember} />
        </>
      );
    }
  }

  if (selection?.kind === 'unit' || selection?.kind === 'noTeam') {
    const found = findUnit(chart, selection.unitId);
    if (found) {
      const { company, unit } = found;
      const teams = teamsOf(unit);
      body = selection.kind === 'unit' ? (
        <>
          <Header icon={Network} tone="bg-emerald-600 text-white" title={unit.name} subtitle={`معاونت · ${company.name}`} badge={<ActiveBadge active={unit.isActive !== false} />} />
          <div>
            <InfoRow label="مدیر معاونت"><PersonValue person={unit.manager} empty="تعیین نشده" /></InfoRow>
            <InfoRow label="تیم‌های ساخته‌شده">{toPersianDigits(teams.length)}</InfoRow>
            <InfoRow label="تعداد افراد">{toPersianDigits(unitHeadcount(unit))} نفر</InfoRow>
            <InfoRow label="بدون تیم">{toPersianDigits(unit.members.length)} نفر</InfoRow>
          </div>
          {teams.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500">تیم‌های کاری که افراد این معاونت ساخته‌اند</p>
              {teams.map((t) => (
                <button key={t.teamId} type="button" onClick={() => onSelect({ kind: 'team', teamId: t.teamId })} className="w-full flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-right hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer">
                  <span className="flex items-center gap-2 min-w-0 text-sm font-bold text-slate-800 dark:text-slate-100"><Users className="w-4 h-4 text-violet-600 shrink-0" /> {t.name}</span>
                  <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0">{toPersianDigits(t.members.length)} نفر</span>
                </button>
              ))}
            </div>
          )}
          <QuickActions>
            {can(U.update) && <ActionTile icon={Pencil} label="ویرایش معاونت" onClick={() => setDialog({ kind: 'editUnit', unit })} />}
            {can(P.manageAssignments) && <ActionTile icon={UserPlus} label="افزودن فرد" onClick={() => setDialog({ kind: 'addUnitMember', company, unit })} />}
            {can(P.manageCompanies) && (
              <ActionTile
                icon={Unlink}
                tone="rose"
                label="جدا کردن از شرکت"
                disabled={busy || unitHeadcount(unit) > 0}
                onClick={() => window.confirm(`معاونت «${unit.name}» از شرکت «${company.name}» جدا شود؟`)
                  && run(async () => {
                    await unlinkUnit(unit.unitId);
                    onSelect({ kind: 'company', companyId: company.companyId });
                  }, 'معاونت از شرکت جدا شد.', 'جدا کردن معاونت انجام نشد.')}
              />
            )}
          </QuickActions>
          {can(P.manageCompanies) && unitHeadcount(unit) > 0 && <p className="text-[11px] text-slate-400">برای جدا کردن معاونت از شرکت، ابتدا افراد آن را جابه‌جا کنید.</p>}
        </>
      ) : (
        <>
          <Header icon={UserRound} tone="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" title="بدون تیم" subtitle={`${unit.name} · افرادی که عضو هیچ تیم کاری نیستند`} />
          <PeopleList members={unit.members} onOpen={openMember} />
        </>
      );
    }
  }

  if (selection?.kind === 'team') {
    const place = allTeams(chart, outsideTeams).find((p) => p.team.teamId === selection.teamId);
    if (place) {
      const { team, company, unit } = place;
      body = (
        <>
          <Header icon={Users} tone="bg-violet-600 text-white" title={team.name} subtitle={unit ? `تیم کاری · ${unit.name}` : 'تیم کاری · سازنده در هیچ معاونتی نیست'} />
          <div>
            <InfoRow label="سازنده تیم"><PersonValue person={team.owner} /></InfoRow>
            {unit && company && (
              <InfoRow label="معاونت سازنده">
                <button type="button" className="text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer" onClick={() => onSelect({ kind: 'unit', companyId: company.companyId, unitId: unit.unitId })}>
                  {unit.name}
                </button>
              </InfoRow>
            )}
            <InfoRow label="تعداد اعضا">{toPersianDigits(team.members.length)} نفر</InfoRow>
            {team.description && <InfoRow label="توضیحات"><span className="font-normal whitespace-pre-line">{team.description}</span></InfoRow>}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500">اعضای تیم</p>
            <PeopleList members={team.members} onOpen={openMember} />
          </div>
          <p className="text-[11px] text-slate-500">تیم کاری را سازنده‌اش از «مدیریت تیم کاری» می‌سازد و اعضایش را تعیین می‌کند.</p>
        </>
      );
    }
  }

  if (selection?.kind === 'member') {
    const place = findMember(chart, outsideTeams, selection.userId);
    if (place) {
      body = <MemberDetails key={selection.userId} place={place} chart={chart} positions={positions} can={can} busy={busy} run={run} onSelect={onSelect} />;
    }
  }

  if (selection?.kind === 'unplaced') {
    const person = unplaced.find((u) => u.userId === selection.userId);
    if (person) {
      body = (
        <>
          <div className="flex flex-col items-center gap-2 py-3">
            <PersonAvatar name={person.displayName} url={person.avatarUrl} size="lg" />
            <span className="text-base font-extrabold text-slate-900 dark:text-white">{person.displayName}</span>
            <StatusBadge tone="amber">بدون جایگاه سازمانی</StatusBadge>
          </div>
          <p className="text-xs text-slate-500">این فرد هنوز در هیچ شرکت یا معاونتی قرار نگرفته است.</p>
          <QuickActions>
            {can(P.manageAssignments) && <ActionTile icon={UserPlus} label="قرار دادن در ساختار" onClick={() => setDialog({ kind: 'placeUser', userId: person.userId, name: person.displayName })} />}
          </QuickActions>
        </>
      );
    }
  }

  return (
    <AdminCard className="p-4 space-y-4 xl:sticky xl:top-4">
      <div>
        <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white"><Zap className="w-5 h-5 text-indigo-600" /> جزئیات</h3>
        <p className="text-xs text-slate-500 mt-0.5">اطلاعات و عملیات بخش انتخاب‌شده</p>
      </div>
      {message && <Notice type={message.type} onClose={() => setMessage(null)}>{message.text}</Notice>}
      {body}
      {/* At the page root: the panel is sticky, and the chart's cards would otherwise cover a dialog opened inside it. */}
      {dialog && createPortal(
        <ChartDialog
          dialog={dialog}
          chart={chart}
          positions={positions}
          can={can}
          busy={busy}
          run={run}
          onClose={() => setDialog(null)}
          onSelect={onSelect}
        />,
        document.body,
      )}
    </AdminCard>
  );
};

const QuickActions: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const items = React.Children.toArray(children).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500"><Zap className="w-3.5 h-3.5" /> عملیات سریع</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4 gap-2">{items}</div>
    </div>
  );
};

type Run = (action: () => Promise<unknown>, success: string, failure: string) => Promise<boolean>;

/** A person: where they sit (from their assignment), their manager, their work teams, and changing their position. */
const MemberDetails: React.FC<{
  place: NonNullable<ReturnType<typeof findMember>>;
  chart: ChartCompany[];
  positions: Position[];
  can: (permission: string) => boolean;
  busy: boolean;
  run: Run;
  onSelect: (selection: ChartSelection) => void;
}> = ({ place, chart, positions, can, busy, run, onSelect }) => {
  const { member, teams } = place;
  const [assignment, setAssignmentState] = useState<UserAssignment | null | undefined>(undefined);
  const [positionId, setPositionId] = useState(member.positionId || '');

  useEffect(() => {
    let alive = true;
    getAssignment(member.userId).then((a) => alive && setAssignmentState(a)).catch(() => alive && setAssignmentState(null));
    return () => { alive = false; };
  }, [member.userId, member.positionId]);
  useEffect(() => { setPositionId(member.positionId || ''); }, [member.positionId]);

  const company = assignment ? chart.find((c) => c.companyId === assignment.companyId) : undefined;
  const path = assignment ? [assignment.companyName, assignment.unitName].filter(Boolean).join(' ‹ ') : null;

  return (
    <>
      <div className="flex flex-col items-center gap-2 py-2">
        <PersonAvatar name={member.displayName} url={member.avatarUrl} size="lg" />
        <span className="text-base font-extrabold text-slate-900 dark:text-white text-center">{member.displayName}</span>
        <span className="text-xs text-slate-500">{member.positionTitle || 'بدون سمت'}</span>
        {!member.isActive && <StatusBadge tone="red">حساب غیرفعال</StatusBadge>}
      </div>
      <div>
        <InfoRow label="جایگاه">
          {assignment === undefined ? '…' : !assignment ? <span className="text-amber-600 font-normal">بدون جایگاه سازمانی</span> : (
            <button type="button" className="text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer" onClick={() => company && onSelect(assignment.unitId
              ? { kind: 'unit', companyId: company.companyId, unitId: assignment.unitId }
              : { kind: 'company', companyId: company.companyId })}
            >
              {path}
            </button>
          )}
        </InfoRow>
        <InfoRow label="مدیر مستقیم">
          {assignment?.manager
            ? <PersonValue person={{ displayName: assignment.manager.displayName }} note={MANAGER_SOURCE_TITLES[assignment.manager.source]} />
            : <span className="text-slate-400 font-normal">ندارد</span>}
        </InfoRow>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-bold text-slate-500">تیم‌های کاری ({toPersianDigits(teams.length)})</p>
        {teams.length === 0 ? <p className="text-xs text-slate-400">عضو هیچ تیم کاری نیست.</p> : teams.map(({ team, unit }) => (
          <button key={team.teamId} type="button" onClick={() => onSelect({ kind: 'team', teamId: team.teamId })} className="w-full flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-right hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer">
            <span className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100 min-w-0"><Users className="w-4 h-4 text-violet-600 shrink-0" /> <span className="truncate">{team.name}</span></span>
            <span className="text-[11px] text-slate-500 whitespace-nowrap shrink-0">{team.owner.userId === member.userId ? 'سازنده' : unit?.name || ''}</span>
          </button>
        ))}
      </div>

      {can(P.manageAssignments) && assignment && (
        <div className="space-y-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 p-3">
          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300"><Briefcase className="w-3.5 h-3.5" /> سمت</span>
          <div className="flex gap-2">
            <select className={inputClass} value={positionId} onChange={(e) => setPositionId(e.target.value)} aria-label="سمت">
              <option value="">— بدون سمت —</option>
              {positions.filter((p) => p.isActive || p.id === positionId).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <PrimaryButton
              type="button"
              className="shrink-0"
              disabled={busy || !assignment || positionId === (member.positionId || '')}
              onClick={() => assignment && run(() => setAssignment(member.userId, {
                companyId: assignment.companyId,
                unitId: assignment.unitId,
                positionId: positionId || null,
                managerUserId: assignment.explicitManagerUserId,
              }), 'سمت فرد تغییر کرد.', 'تغییر سمت انجام نشد.')}
            >
              ذخیره
            </PrimaryButton>
          </div>
        </div>
      )}
    </>
  );
};

/** The add/edit dialogs opened from the panel. */
const ChartDialog: React.FC<{
  dialog: Dialog;
  chart: ChartCompany[];
  positions: Position[];
  can: (permission: string) => boolean;
  busy: boolean;
  run: Run;
  onClose: () => void;
  onSelect: (selection: ChartSelection) => void;
}> = ({ dialog, chart, positions, can, busy, run, onClose, onSelect }) => {
  const [name, setName] = useState(
    dialog.kind === 'editCompany' ? dialog.company.name : dialog.kind === 'editUnit' ? dialog.unit.name : '',
  );
  const [code, setCode] = useState(dialog.kind === 'editCompany' ? dialog.company.code : '');
  const initialPerson = dialog.kind === 'editCompany' ? dialog.company.manager : dialog.kind === 'editUnit' ? dialog.unit.manager : null;
  const [personId, setPersonId] = useState<string | null>(initialPerson?.userId || null);
  const [personName, setPersonName] = useState<string | null>(initialPerson?.displayName || null);
  const [active, setActive] = useState(
    dialog.kind === 'editCompany' ? dialog.company.isActive : dialog.kind === 'editUnit' ? dialog.unit.isActive !== false : true,
  );
  // Placing someone: the deputy (or company directly) and position.
  const destinations = chart.flatMap((c) => [
    { key: `${c.companyId}|`, label: `${c.name} (مستقیم زیر شرکت)`, companyId: c.companyId, unit: null as ChartUnit | null },
    ...c.units.map((u) => ({ key: `${c.companyId}|${u.unitId}`, label: `${c.name} ‹ ${u.name}`, companyId: c.companyId, unit: u as ChartUnit | null })),
  ]);
  const [destination, setDestination] = useState(destinations[0]?.key || '');
  const [positionId, setPositionId] = useState('');

  const close = () => !busy && onClose();
  const done = (ok: boolean) => { if (ok) onClose(); };

  /** Moves someone into a deputy, keeping their position and any manager set on them. */
  const placeInUnit = async (userId: string, companyId: string, unitId: string | null, newPositionId?: string | null) => {
    const current = await getAssignment(userId);
    await setAssignment(userId, {
      companyId,
      unitId,
      positionId: newPositionId !== undefined ? newPositionId : current?.positionId ?? null,
      managerUserId: current?.explicitManagerUserId ?? null,
    });
  };

  let title = '';
  let content: React.ReactNode = null;
  let save: (() => void) | null = null;
  let canSave = !busy;

  switch (dialog.kind) {
    case 'editCompany': {
      title = 'ویرایش شرکت';
      canSave = canSave && !!name.trim() && !!code.trim();
      save = async () => {
        const full = (await listCompanies()).find((c) => c.id === dialog.company.companyId);
        done(await run(() => updateCompany(dialog.company.companyId, {
          name: name.trim(), code: code.trim(), description: full?.description ?? null, managerUserId: personId, isActive: active,
        }), 'شرکت ویرایش شد.', 'ویرایش شرکت انجام نشد.'));
      };
      content = (
        <>
          <Field label="نام شرکت" required><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} /></Field>
          <Field label="کد شرکت" required><input className={`${inputClass} dir-ltr text-right`} value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} /></Field>
          <PersonField label="مدیر ارشد شرکت" personId={personId} personName={personName} onChange={(id, n) => { setPersonId(id); setPersonName(n); }} />
          <Toggle checked={active} onChange={setActive} label="فعال" />
        </>
      );
      break;
    }
    case 'addUnit': {
      title = `معاونت جدید در «${dialog.company.name}»`;
      canSave = canSave && !!name.trim();
      save = async () => done(await run(async () => {
        const unit = await createOrgUnit({ name: name.trim() });
        if (personId) await updateOrgUnit(unit.id, { name: unit.name, managerUserId: personId, isActive: true });
        await linkUnitToCompany(unit.id, dialog.company.companyId);
      }, `معاونت «${name.trim()}» اضافه شد.`, 'افزودن معاونت انجام نشد.'));
      content = (
        <>
          <Field label="نام معاونت" required><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} autoFocus placeholder="مثلاً: معاونت فناوری اطلاعات" /></Field>
          <PersonField label="مدیر معاونت (اختیاری)" personId={personId} personName={personName} onChange={(id, n) => { setPersonId(id); setPersonName(n); }} />
        </>
      );
      break;
    }
    case 'editUnit': {
      title = 'ویرایش معاونت';
      canSave = canSave && !!name.trim();
      save = async () => done(await run(() => updateOrgUnit(dialog.unit.unitId, { name: name.trim(), managerUserId: personId, isActive: active }), 'معاونت ویرایش شد.', 'ویرایش معاونت انجام نشد.'));
      content = (
        <>
          <Field label="نام معاونت" required><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} /></Field>
          <PersonField label="مدیر معاونت" personId={personId} personName={personName} onChange={(id, n) => { setPersonId(id); setPersonName(n); }} />
          {can(U.update) && <Toggle checked={active} onChange={setActive} label="فعال" />}
        </>
      );
      break;
    }
    case 'addUnitMember': {
      title = `افزودن فرد به «${dialog.unit.name}»`;
      canSave = canSave && !!personId;
      save = async () => done(await run(() => placeInUnit(personId!, dialog.company.companyId, dialog.unit.unitId), `«${personName}» به معاونت اضافه شد.`, 'افزودن فرد انجام نشد.'));
      content = (
        <PersonField
          label="کاربر"
          personId={personId}
          personName={personName}
          onChange={(id, n) => { setPersonId(id); setPersonName(n); }}
          hint="سمت و مدیر تعیین‌شده‌اش حفظ می‌شود."
        />
      );
      break;
    }
    case 'placeUser': {
      title = `قرار دادن «${dialog.name}» در ساختار`;
      const target = destinations.find((d) => d.key === destination);
      canSave = canSave && !!target && can(P.manageAssignments);
      save = async () => {
        if (!target) return;
        done(await run(async () => {
          await setAssignment(dialog.userId, { companyId: target.companyId, unitId: target.unit?.unitId ?? null, positionId: positionId || null, managerUserId: null });
          onSelect({ kind: 'member', userId: dialog.userId });
        }, `«${dialog.name}» در ساختار قرار گرفت.`, 'قرار دادن در ساختار انجام نشد.'));
      };
      content = (
        <>
          <Field label="معاونت" required>
            <select className={inputClass} value={destination} onChange={(e) => setDestination(e.target.value)}>
              {destinations.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </Field>
          <Field label="سمت (اختیاری)">
            <select className={inputClass} value={positionId} onChange={(e) => setPositionId(e.target.value)}>
              <option value="">— بدون سمت —</option>
              {positions.filter((p) => p.isActive).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
        </>
      );
      break;
    }
  }

  return (
    <AdminDialog
      title={title}
      onClose={close}
      footer={<>
        <SecondaryButton type="button" onClick={close}>انصراف</SecondaryButton>
        <PrimaryButton type="button" onClick={() => save?.()} disabled={!canSave}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} ذخیره</PrimaryButton>
      </>}
    >
      {content}
    </AdminDialog>
  );
};

/** A person chosen with the user search (not inside a <label>: see UserPicker). */
const PersonField: React.FC<{
  label: string;
  personId: string | null;
  personName: string | null;
  onChange: (id: string | null, name: string | null) => void;
  hint?: string;
}> = ({ label, personId, personName, onChange, hint }) => (
  <div className="space-y-1.5">
    <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">{label}</span>
    <UserPicker value={personId} valueLabel={personName} onChange={onChange} />
    {hint && <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>}
  </div>
);

