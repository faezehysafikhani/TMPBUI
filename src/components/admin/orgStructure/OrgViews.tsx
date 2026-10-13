import React, { useState } from 'react';
import { Building2, Network, Briefcase, UserCheck, ChevronLeft, ChevronDown, Users, Crown } from 'lucide-react';
import { AdminCard, Notice, StatusBadge, Toggle } from '../AdminUi';
import { toPersianDigits } from '../../../utils/helpers';
import {
  ChartCompany, ChartMember, ChartUnit, MANAGER_SOURCE_TITLES, getChart, getMyPlacement, getMySubordinates,
} from '../../../services/orgStructureApi';
import { EmptyRow, LoadingRow, useLoad } from './orgShared';

const InfoTile: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode }> = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40">
    <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
    <div className="min-w-0">
      <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-sm font-bold text-slate-900 dark:text-slate-100 break-words">{value || '—'}</div>
    </div>
  </div>
);

/** «جایگاه من»: the signed-in user's company, unit, position, managers and subordinates. */
export const MyPlacementPanel: React.FC = () => {
  const [allLevels, setAllLevels] = useState(false);
  const placement = useLoad(getMyPlacement, 'دریافت جایگاه سازمانی ممکن نشد.');
  const subordinates = useLoad(() => getMySubordinates(allLevels), 'دریافت زیرمجموعه ممکن نشد.');
  const firstRender = React.useRef(true);
  React.useEffect(() => {
    // The first load is useLoad's own; only a change of the toggle loads again.
    if (firstRender.current) { firstRender.current = false; return; }
    subordinates.reload();
  }, [allLevels]); // eslint-disable-line react-hooks/exhaustive-deps

  if (placement.loading) return <AdminCard><LoadingRow /></AdminCard>;
  if (placement.error) return <Notice type="error">{placement.error}</Notice>;

  const a = placement.data?.assignment;
  const chain = placement.data?.managementChain || [];
  return (
    <div className="space-y-4">
      <AdminCard className="p-5 space-y-4">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">جایگاه سازمانی من</h3>
        {!a ? (
          <Notice type="info">هنوز جایگاهی (شرکت، معاونت و سمت) برای شما تعیین نشده است.</Notice>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <InfoTile icon={Building2} label="شرکت" value={a.companyName} />
              <InfoTile icon={Network} label="معاونت / واحد" value={a.unitName} />
              <InfoTile icon={Briefcase} label="سمت" value={a.positionTitle} />
              <InfoTile
                icon={UserCheck}
                label="مدیر مستقیم"
                value={a.manager ? <>{a.manager.displayName} <span className="text-[11px] font-medium text-slate-500">({MANAGER_SOURCE_TITLES[a.manager.source]})</span></> : null}
              />
            </div>
            {chain.length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">زنجیره مدیریت</div>
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-700 text-white font-bold">من</span>
                  {chain.map((p) => (
                    <React.Fragment key={p.userId}>
                      <ChevronLeft className="w-4 h-4 text-slate-400" />
                      <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold">{p.displayName}</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </AdminCard>

      <AdminCard className="p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white">
            <Users className="w-5 h-5 text-indigo-600" /> زیردستان من
          </h3>
          <div className="w-full sm:w-72">
            <Toggle checked={allLevels} onChange={setAllLevels} label="همه سطوح" description="نمایش زیرمجموعه غیرمستقیم هم" />
          </div>
        </div>
        {subordinates.loading ? <LoadingRow /> : subordinates.error ? <Notice type="error">{subordinates.error}</Notice>
          : (subordinates.data || []).length === 0 ? <EmptyRow>زیردستی برای شما ثبت نشده است.</EmptyRow> : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {subordinates.data!.map((s) => (
                <div key={s.userId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{s.displayName}</div>
                    <div className="text-[11px] text-slate-500">{[s.positionTitle, s.unitName, s.companyName].filter(Boolean).join(' • ')}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!s.isActive && <StatusBadge tone="red">غیرفعال</StatusBadge>}
                    <StatusBadge tone={s.depth === 1 ? 'indigo' : 'slate'}>{s.depth === 1 ? 'مستقیم' : `سطح ${toPersianDigits(s.depth)}`}</StatusBadge>
                  </div>
                </div>
              ))}
            </div>
          )}
      </AdminCard>
    </div>
  );
};

const MemberChip: React.FC<{ member: ChartMember }> = ({ member }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${member.isActive ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700' : 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800'}`}>
    <span className="font-bold text-slate-800 dark:text-slate-100">{member.displayName}</span>
    {member.positionTitle && <span className="text-slate-500 dark:text-slate-400">{member.positionTitle}</span>}
  </span>
);

const UnitNode: React.FC<{ unit: ChartUnit; depth: number }> = ({ unit, depth }) => {
  const [open, setOpen] = useState(depth < 1);
  const count = unit.members.length;
  return (
    <div className={depth > 0 ? 'border-r-2 border-indigo-100 dark:border-indigo-900 pr-3 mr-2' : ''}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-2 py-2 text-right cursor-pointer">
        <span className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />}
          <Network className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{unit.name}</span>
          {unit.manager && <span className="text-[11px] text-slate-500 truncate">مدیر: {unit.manager.displayName}</span>}
        </span>
        <StatusBadge tone="slate">{toPersianDigits(count)} نفر</StatusBadge>
      </button>
      {open && (
        <div className="space-y-1 pb-1">
          {count > 0 && <div className="flex flex-wrap gap-1.5 pr-6 pb-1">{unit.members.map((m) => <MemberChip key={m.userId} member={m} />)}</div>}
          {unit.children.map((child) => <UnitNode key={child.unitId} unit={child} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
};

const CompanyCard: React.FC<{ company: ChartCompany }> = ({ company }) => (
  <AdminCard className="p-5 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white">
        <Building2 className="w-5 h-5 text-indigo-600" /> {company.name}
        <span className="text-xs font-medium text-slate-400 dir-ltr">{company.code}</span>
      </h3>
      <div className="flex items-center gap-1.5">
        {!company.isActive && <StatusBadge tone="red">غیرفعال</StatusBadge>}
        {company.manager && <StatusBadge tone="indigo"><Crown className="w-3 h-3" /> {company.manager.displayName}</StatusBadge>}
      </div>
    </div>
    {company.members.length > 0 && (
      <div className="flex flex-wrap gap-1.5">{company.members.map((m) => <MemberChip key={m.userId} member={m} />)}</div>
    )}
    {company.units.length === 0 ? (
      <p className="text-xs text-slate-500">هنوز معاونتی به این شرکت اختصاص داده نشده است.</p>
    ) : (
      <div className="divide-y divide-slate-100 dark:divide-slate-800">{company.units.map((u) => <UnitNode key={u.unitId} unit={u} depth={0} />)}</div>
    )}
  </AdminCard>
);

/** «چارت سازمانی»: companies → their deputies and units → people. */
export const OrgChartPanel: React.FC = () => {
  const chart = useLoad(() => getChart(), 'دریافت چارت سازمانی ممکن نشد.');
  if (chart.loading) return <AdminCard><LoadingRow /></AdminCard>;
  if (chart.error) return <Notice type="error">{chart.error}</Notice>;
  if (!chart.data || chart.data.length === 0) return <AdminCard><EmptyRow>هنوز شرکتی تعریف نشده است.</EmptyRow></AdminCard>;
  return <div className="space-y-4">{chart.data.map((c) => <CompanyCard key={c.companyId} company={c} />)}</div>;
};
