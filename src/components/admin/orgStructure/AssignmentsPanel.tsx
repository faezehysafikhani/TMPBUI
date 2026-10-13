import React, { useMemo, useState } from 'react';
import { Pencil, UserMinus, UserPlus, Users, Loader2 } from 'lucide-react';
import {
  AdminCard, AdminDialog, Field, IconAction, Notice, PrimaryButton, SearchBox, SecondaryButton, StatusBadge, inputClass,
} from '../AdminUi';
import { userErrorMessage } from '../../../utils/errorMessages';
import { toPersianDigits } from '../../../utils/helpers';
import {
  CompanyUnitLink, MANAGER_SOURCE_TITLES, OrgUnit, Subordinate, UserAssignment, buildUnitTree, flattenUnitTree,
  getSubordinatesOf, listAssignments, listCompanies, listCompanyUnits, listOrgUnits, listPositions, removeAssignment,
  setAssignment, unitSubtreeIds,
} from '../../../services/orgStructureApi';
import { EmptyRow, LoadingRow, UserPicker, useLoad } from './orgShared';

interface Draft {
  isNew: boolean;
  userId: string | null;
  userName: string | null;
  companyId: string;
  unitId: string;
  positionId: string;
  managerUserId: string | null;
  managerName: string | null;
}

const th = 'px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap';
const td = 'px-4 py-3 align-middle text-sm';

/** «جایگاه کاربران»: each user's company, unit, position and manager. */
export const AssignmentsPanel: React.FC<{ canManage: boolean; canSeeUnits: boolean }> = ({ canManage, canSeeUnits }) => {
  const data = useLoad(async () => {
    const [assignments, companies, positions, links, units] = await Promise.all([
      listAssignments(), listCompanies(), listPositions(), listCompanyUnits(),
      canSeeUnits ? listOrgUnits() : Promise.resolve([] as OrgUnit[]),
    ]);
    return { assignments, companies, positions, links, units };
  }, 'دریافت جایگاه کاربران ممکن نشد.');
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [teamOf, setTeamOf] = useState<UserAssignment | null>(null);

  const rows = useMemo(() => (data.data?.assignments || []).filter((a) =>
    (!companyFilter || a.companyId === companyFilter)
    && (!search.trim() || [a.displayName, a.unitName, a.positionTitle, a.manager?.displayName].some((v) => v?.includes(search.trim())))), [data.data, search, companyFilter]);

  /** Units of the chosen company: its linked deputies and everything below them. */
  const unitsOfCompany = useMemo(() => {
    if (!data.data || !draft?.companyId) return [];
    const ids = new Set<string>();
    data.data.links.filter((l: CompanyUnitLink) => l.companyId === draft.companyId)
      .forEach((l) => unitSubtreeIds(data.data!.units, l.unitId).forEach((id) => ids.add(id)));
    return flattenUnitTree(buildUnitTree(data.data.units.filter((u) => ids.has(u.id) && u.isActive)));
  }, [data.data, draft?.companyId]);

  const open = (a?: UserAssignment) => setDraft(a ? {
    isNew: false, userId: a.userId, userName: a.displayName, companyId: a.companyId, unitId: a.unitId || '', positionId: a.positionId || '',
    managerUserId: a.explicitManagerUserId, managerName: a.explicitManagerUserId ? a.manager?.displayName || 'کاربر' : null,
  } : {
    isNew: true, userId: null, userName: null, companyId: data.data?.companies.find((c) => c.isActive)?.id || '', unitId: '', positionId: '', managerUserId: null, managerName: null,
  });

  const save = async () => {
    if (!draft?.userId || !draft.companyId) return;
    setBusy(true);
    setMessage(null);
    try {
      await setAssignment(draft.userId, {
        companyId: draft.companyId, unitId: draft.unitId || null, positionId: draft.positionId || null, managerUserId: draft.managerUserId,
      });
      setMessage({ type: 'success', text: 'جایگاه کاربر ذخیره شد.' });
      setDraft(null);
      data.reload();
    } catch (err) {
      setMessage({ type: 'error', text: userErrorMessage(err, 'ذخیره جایگاه کاربر انجام نشد.') });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: UserAssignment) => {
    setMessage(null);
    try {
      await removeAssignment(a.userId);
      setMessage({ type: 'success', text: `جایگاه «${a.displayName}» حذف شد.` });
      data.reload();
    } catch (err) {
      setMessage({ type: 'error', text: userErrorMessage(err, 'حذف جایگاه انجام نشد.') });
    }
  };

  return (
    <div className="space-y-4">
      {message && <Notice type={message.type} onClose={() => setMessage(null)}>{message.text}</Notice>}
      <AdminCard>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">جایگاه کاربران</h3>
            <p className="text-xs text-slate-500 mt-0.5">شرکت، معاونت، سمت و مدیر هر کاربر. اگر مدیر تعیین نشود، از مدیر واحد یا شرکت گرفته می‌شود.</p>
          </div>
          {canManage && <PrimaryButton onClick={() => open()} disabled={!data.data?.companies.length}><UserPlus className="w-4 h-4" /> تعیین جایگاه کاربر</PrimaryButton>}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 px-5 py-3 border-b border-slate-100 dark:border-slate-800">
          <SearchBox value={search} onChange={setSearch} placeholder="جستجوی نام، واحد، سمت یا مدیر..." />
          <select className={`${inputClass} sm:w-56`} value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
            <option value="">همه شرکت‌ها</option>
            {data.data?.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {data.loading ? <LoadingRow /> : data.error ? <div className="p-5"><Notice type="error">{data.error}</Notice></div>
          : data.data!.companies.length === 0 ? <EmptyRow>ابتدا در بخش «شرکت‌ها» یک شرکت تعریف کنید.</EmptyRow>
          : rows.length === 0 ? <EmptyRow>جایگاهی ثبت نشده است.</EmptyRow> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60"><tr>
                  <th className={th}>کاربر</th><th className={th}>شرکت</th><th className={th}>معاونت / واحد</th><th className={th}>سمت</th><th className={th}>مدیر</th><th className={th} />
                </tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((a) => (
                    <tr key={a.userId}>
                      <td className={td}>
                        <span className="font-bold text-slate-900 dark:text-slate-100">{a.displayName}</span>
                        {!a.isUserActive && <span className="mr-1.5"><StatusBadge tone="red">غیرفعال</StatusBadge></span>}
                      </td>
                      <td className={td}>{a.companyName}</td>
                      <td className={td}>{a.unitName || <span className="text-xs text-slate-400">—</span>}</td>
                      <td className={td}>{a.positionTitle || <span className="text-xs text-slate-400">—</span>}</td>
                      <td className={td}>
                        {a.manager ? (
                          <span className="flex flex-col">
                            <span className="font-bold">{a.manager.displayName}</span>
                            <span className="text-[11px] text-slate-500">{MANAGER_SOURCE_TITLES[a.manager.source]}</span>
                          </span>
                        ) : <span className="text-xs text-slate-400">ندارد</span>}
                      </td>
                      <td className={`${td} whitespace-nowrap text-left`}>
                        <IconAction icon={Users} label="زیردستان" onClick={() => setTeamOf(a)} />
                        {canManage && <IconAction icon={Pencil} label="ویرایش جایگاه" onClick={() => open(a)} />}
                        {canManage && <IconAction icon={UserMinus} tone="rose" label="حذف جایگاه" onClick={() => remove(a)} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </AdminCard>

      {draft && data.data && (
        <AdminDialog
          title={draft.isNew ? 'تعیین جایگاه کاربر' : `جایگاه ${draft.userName}`}
          onClose={() => setDraft(null)}
          footer={<>
            <SecondaryButton onClick={() => setDraft(null)}>انصراف</SecondaryButton>
            <PrimaryButton onClick={save} disabled={busy || !draft.userId || !draft.companyId}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} ذخیره</PrimaryButton>
          </>}
        >
          {draft.isNew && (
            <Field label="کاربر" required>
              <UserPicker value={draft.userId} valueLabel={draft.userName} onChange={(id, name) => setDraft({ ...draft, userId: id, userName: name })}
                excludeIds={data.data.assignments.map((a) => a.userId)} />
            </Field>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="شرکت" required>
              <select className={inputClass} value={draft.companyId} onChange={(e) => setDraft({ ...draft, companyId: e.target.value, unitId: '' })}>
                <option value="">انتخاب شرکت...</option>
                {data.data.companies.filter((c) => c.isActive || c.id === draft.companyId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="معاونت / واحد" hint={unitsOfCompany.length === 0 ? 'این شرکت هنوز معاونتی ندارد.' : undefined}>
              <select className={inputClass} value={draft.unitId} onChange={(e) => setDraft({ ...draft, unitId: e.target.value })} disabled={unitsOfCompany.length === 0}>
                <option value="">— مستقیم زیر شرکت —</option>
                {unitsOfCompany.map((u) => <option key={u.id} value={u.id}>{' '.repeat(u.depth * 3)}{u.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="سمت">
            <select className={inputClass} value={draft.positionId} onChange={(e) => setDraft({ ...draft, positionId: e.target.value })}>
              <option value="">— بدون سمت —</option>
              {data.data.positions.filter((p) => p.isActive || p.id === draft.positionId).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </Field>
          <Field label="مدیر مستقیم (اختیاری)" hint="خالی بگذارید تا مدیر از مدیر واحد یا مدیر ارشد شرکت گرفته شود.">
            <UserPicker value={draft.managerUserId} valueLabel={draft.managerName} onChange={(id, name) => setDraft({ ...draft, managerUserId: id, managerName: name })}
              excludeIds={draft.userId ? [draft.userId] : []} />
          </Field>
        </AdminDialog>
      )}

      {teamOf && <SubordinatesDialog person={teamOf} onClose={() => setTeamOf(null)} />}
    </div>
  );
};

const SubordinatesDialog: React.FC<{ person: UserAssignment; onClose: () => void }> = ({ person, onClose }) => {
  const list = useLoad(() => getSubordinatesOf(person.userId, true), 'دریافت زیردستان ممکن نشد.');
  return (
    <AdminDialog title={`زیردستان ${person.displayName}`} onClose={onClose} footer={<SecondaryButton onClick={onClose}>بستن</SecondaryButton>}>
      {list.loading ? <LoadingRow /> : list.error ? <Notice type="error">{list.error}</Notice>
        : (list.data || []).length === 0 ? <EmptyRow>زیردستی ندارد.</EmptyRow> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.data!.map((s: Subordinate) => (
              <div key={s.userId} className="flex items-center justify-between gap-2 py-2.5" style={{ paddingRight: `${(s.depth - 1) * 1.25}rem` }}>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{s.displayName}</div>
                  <div className="text-[11px] text-slate-500">{[s.positionTitle, s.unitName].filter(Boolean).join(' • ')}</div>
                </div>
                <StatusBadge tone={s.depth === 1 ? 'indigo' : 'slate'}>{s.depth === 1 ? 'مستقیم' : `سطح ${toPersianDigits(s.depth)}`}</StatusBadge>
              </div>
            ))}
          </div>
        )}
    </AdminDialog>
  );
};
