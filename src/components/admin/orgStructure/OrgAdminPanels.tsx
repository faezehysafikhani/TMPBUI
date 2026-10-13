import React, { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Network, Link2, Unlink, Loader2, Ban } from 'lucide-react';
import {
  AdminCard, AdminDialog, Field, IconAction, Notice, PrimaryButton, SecondaryButton, StatusBadge, Toggle, inputClass,
} from '../AdminUi';
import { userErrorMessage } from '../../../utils/errorMessages';
import {
  Company, CompanyUnitLink, OrgUnit, Position, buildUnitTree, createCompany, createOrgUnit, createPosition, deactivateOrgUnit,
  deleteCompany, deletePosition, flattenUnitTree, linkUnitToCompany, listCompanies, listCompanyUnits, listOrgUnits,
  listPositions, unitSubtreeIds, unlinkUnit, updateCompany, updateOrgUnit, updatePosition,
} from '../../../services/orgStructureApi';
import { EmptyRow, LoadingRow, UserPicker, useLoad, useUserNames } from './orgShared';

type Message = { type: 'success' | 'error'; text: string } | null;

const th = 'px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap';
const td = 'px-4 py-3 align-middle text-sm';

/** Runs a change, shows its result, and reloads. */
function useAction(reload: () => void, setMessage: (m: Message) => void) {
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<unknown>, success: string, failure: string): Promise<boolean> => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage({ type: 'success', text: success });
      reload();
      return true;
    } catch (err) {
      setMessage({ type: 'error', text: userErrorMessage(err, failure) });
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

// ============================================================================ companies

interface CompanyDraft { id?: string; name: string; code: string; description: string; managerUserId: string | null; managerName: string | null; isActive: boolean }

export const CompaniesPanel: React.FC<{ canManage: boolean; canSeeUnits: boolean }> = ({ canManage, canSeeUnits }) => {
  const data = useLoad(async () => {
    const [companies, links, units] = await Promise.all([listCompanies(), listCompanyUnits(), canSeeUnits ? listOrgUnits() : Promise.resolve([] as OrgUnit[])]);
    return { companies, links, units };
  }, 'دریافت فهرست شرکت‌ها ممکن نشد.');
  const [message, setMessage] = useState<Message>(null);
  const [draft, setDraft] = useState<CompanyDraft | null>(null);
  const [unitsOf, setUnitsOf] = useState<Company | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Company | null>(null);
  const { busy, run } = useAction(data.reload, setMessage);

  const save = async () => {
    if (!draft) return;
    const input = { name: draft.name, code: draft.code, description: draft.description || null, managerUserId: draft.managerUserId };
    const ok = await run(
      () => (draft.id ? updateCompany(draft.id, { ...input, isActive: draft.isActive }) : createCompany(input)),
      draft.id ? 'شرکت ویرایش شد.' : 'شرکت ایجاد شد.',
      'ذخیره شرکت انجام نشد.',
    );
    if (ok) setDraft(null);
  };

  return (
    <div className="space-y-4">
      {message && <Notice type={message.type} onClose={() => setMessage(null)}>{message.text}</Notice>}
      <AdminCard>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">شرکت‌ها</h3>
            <p className="text-xs text-slate-500 mt-0.5">شرکت‌های این سازمان و معاونت‌هایی که هر کدام در اختیار دارد.</p>
          </div>
          {canManage && (
            <PrimaryButton onClick={() => setDraft({ name: '', code: '', description: '', managerUserId: null, managerName: null, isActive: true })}>
              <Plus className="w-4 h-4" /> شرکت جدید
            </PrimaryButton>
          )}
        </div>
        {data.loading ? <LoadingRow /> : data.error ? <div className="p-5"><Notice type="error">{data.error}</Notice></div>
          : data.data!.companies.length === 0 ? <EmptyRow>هنوز شرکتی تعریف نشده است.</EmptyRow> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60"><tr>
                  <th className={th}>نام شرکت</th><th className={th}>کد</th><th className={th}>مدیر ارشد</th><th className={th}>معاونت‌ها</th><th className={th}>وضعیت</th><th className={th} />
                </tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.data!.companies.map((c) => (
                    <tr key={c.id}>
                      <td className={`${td} font-bold text-slate-900 dark:text-slate-100`}>{c.name}</td>
                      <td className={`${td} dir-ltr text-right text-slate-500`}>{c.code}</td>
                      <td className={td}>{c.manager?.displayName || '—'}</td>
                      <td className={td}>
                        <div className="flex flex-wrap gap-1">
                          {data.data!.links.filter((l) => l.companyId === c.id).map((l) => <StatusBadge key={l.unitId} tone="indigo">{l.unitName}</StatusBadge>)}
                          {c.linkedUnitIds.length === 0 && <span className="text-xs text-slate-400">—</span>}
                        </div>
                      </td>
                      <td className={td}>{c.isActive ? <StatusBadge tone="green">فعال</StatusBadge> : <StatusBadge tone="red">غیرفعال</StatusBadge>}</td>
                      <td className={`${td} whitespace-nowrap text-left`}>
                        {canManage && canSeeUnits && <IconAction icon={Link2} label="تعیین معاونت‌های شرکت" onClick={() => setUnitsOf(c)} />}
                        {canManage && (
                          <IconAction icon={Pencil} label="ویرایش" onClick={() => setDraft({ id: c.id, name: c.name, code: c.code, description: c.description || '', managerUserId: c.manager?.userId || null, managerName: c.manager?.displayName || null, isActive: c.isActive })} />
                        )}
                        {canManage && <IconAction icon={Trash2} tone="rose" label="حذف" onClick={() => setConfirmDelete(c)} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </AdminCard>

      {draft && (
        <AdminDialog
          title={draft.id ? 'ویرایش شرکت' : 'شرکت جدید'}
          onClose={() => setDraft(null)}
          footer={<>
            <SecondaryButton onClick={() => setDraft(null)}>انصراف</SecondaryButton>
            <PrimaryButton onClick={save} disabled={busy || !draft.name.trim() || !draft.code.trim()}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} ذخیره</PrimaryButton>
          </>}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="نام شرکت" required><input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="کد شرکت" required hint="کد یکتا، مثلاً TJ"><input className={`${inputClass} dir-ltr text-right`} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></Field>
          </div>
          <Field label="مدیر ارشد (مدیرعامل)" hint="مدیر کسانی که در این شرکت مدیر دیگری ندارند.">
            <UserPicker value={draft.managerUserId} valueLabel={draft.managerName} onChange={(id, name) => setDraft({ ...draft, managerUserId: id, managerName: name })} />
          </Field>
          <Field label="توضیحات"><textarea rows={3} className={inputClass} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
          {draft.id && <Toggle checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} label="شرکت فعال است" />}
        </AdminDialog>
      )}

      {confirmDelete && (
        <AdminDialog
          title="حذف شرکت"
          onClose={() => setConfirmDelete(null)}
          footer={<>
            <SecondaryButton onClick={() => setConfirmDelete(null)}>انصراف</SecondaryButton>
            <PrimaryButton className="bg-rose-700 hover:bg-rose-800" disabled={busy} onClick={async () => { if (await run(() => deleteCompany(confirmDelete.id), 'شرکت حذف شد.', 'حذف شرکت انجام نشد.')) setConfirmDelete(null); }}>حذف</PrimaryButton>
          </>}
        >
          <p className="text-sm text-slate-700 dark:text-slate-300">شرکت «{confirmDelete.name}» حذف شود؟ شرکتی که معاونت یا کارمند دارد حذف نمی‌شود؛ به‌جای آن غیرفعالش کنید.</p>
        </AdminDialog>
      )}

      {unitsOf && data.data && (
        <CompanyUnitsDialog
          company={unitsOf}
          units={data.data.units}
          links={data.data.links}
          onClose={() => setUnitsOf(null)}
          onChanged={data.reload}
        />
      )}
    </div>
  );
};

/** Which deputies (top units) belong to a company. Units below a linked unit follow it. */
const CompanyUnitsDialog: React.FC<{
  company: Company;
  units: OrgUnit[];
  links: CompanyUnitLink[];
  onClose: () => void;
  onChanged: () => void;
}> = ({ company, units, links, onClose, onChanged }) => {
  const [message, setMessage] = useState<Message>(null);
  const [selected, setSelected] = useState('');
  const { busy, run } = useAction(onChanged, setMessage);

  // A unit can be linked when neither it, a unit above it, nor a unit below it is linked yet.
  const covered = useMemo(() => {
    const set = new Set<string>();
    links.forEach((l) => unitSubtreeIds(units, l.unitId).forEach((id) => set.add(id)));
    return set;
  }, [links, units]);
  const eligible = useMemo(
    () => flattenUnitTree(buildUnitTree(units.filter((u) => u.isActive)))
      .filter((u) => !covered.has(u.id) && ![...unitSubtreeIds(units, u.id)].some((id) => id !== u.id && covered.has(id))),
    [units, covered],
  );
  const mine = links.filter((l) => l.companyId === company.id);

  return (
    <AdminDialog title={`معاونت‌های ${company.name}`} onClose={onClose} footer={<SecondaryButton onClick={onClose}>بستن</SecondaryButton>}>
      {message && <Notice type={message.type} onClose={() => setMessage(null)}>{message.text}</Notice>}
      <p className="text-xs text-slate-500 leading-relaxed">هر معاونت (یا واحد بالادستی) که به شرکت اختصاص داده شود، همه واحدهای زیرمجموعه‌اش هم متعلق به همان شرکت می‌شوند.</p>
      <div className="space-y-2">
        {mine.length === 0 ? <p className="text-sm text-slate-500">هنوز معاونتی اختصاص داده نشده است.</p> : mine.map((l) => (
          <div key={l.unitId} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
            <span className="flex items-center gap-2 text-sm font-bold"><Network className="w-4 h-4 text-indigo-600" /> {l.unitName}</span>
            <IconAction icon={Unlink} tone="rose" label="حذف از شرکت" disabled={busy} onClick={() => run(() => unlinkUnit(l.unitId), 'معاونت از شرکت جدا شد.', 'جدا کردن معاونت انجام نشد.')} />
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <select className={inputClass} value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">انتخاب معاونت یا واحد...</option>
          {eligible.map((u) => <option key={u.id} value={u.id}>{' '.repeat(u.depth * 3)}{u.name}</option>)}
        </select>
        <PrimaryButton disabled={!selected || busy} onClick={async () => { if (await run(() => linkUnitToCompany(selected, company.id), 'معاونت به شرکت اختصاص یافت.', 'اختصاص معاونت انجام نشد.')) setSelected(''); }}>
          <Link2 className="w-4 h-4" /> افزودن
        </PrimaryButton>
      </div>
      {eligible.length === 0 && <p className="text-[11px] text-slate-500">واحد آزادی برای اختصاص نیست. ابتدا در بخش «معاونت‌ها و واحدها» واحد جدید بسازید.</p>}
    </AdminDialog>
  );
};

// ============================================================================ units (Nexus.Organization)

interface UnitDraft { id?: string; name: string; code: string; parentId: string | null; managerUserId: string | null; managerName: string | null; isActive: boolean }

export const UnitsPanel: React.FC<{ canCreate: boolean; canUpdate: boolean; canDeactivate: boolean }> = ({ canCreate, canUpdate, canDeactivate }) => {
  const data = useLoad(async () => {
    const [units, links] = await Promise.all([listOrgUnits(), listCompanyUnits().catch(() => [] as CompanyUnitLink[])]);
    return { units, links };
  }, 'دریافت واحدهای سازمانی ممکن نشد.');
  const names = useUserNames();
  const [message, setMessage] = useState<Message>(null);
  const [draft, setDraft] = useState<UnitDraft | null>(null);
  const { busy, run } = useAction(data.reload, setMessage);

  const rows = useMemo(() => (data.data ? flattenUnitTree(buildUnitTree(data.data.units)) : []), [data.data]);
  const companyOf = useMemo(() => {
    const map = new Map<string, string>();
    if (!data.data) return map;
    for (const link of data.data.links) unitSubtreeIds(data.data.units, link.unitId).forEach((id) => map.set(id, link.companyName));
    return map;
  }, [data.data]);
  const parentOptions = useMemo(() => {
    if (!draft || !data.data) return rows;
    const blocked = draft.id ? unitSubtreeIds(data.data.units, draft.id) : new Set<string>();
    return rows.filter((u) => !blocked.has(u.id));
  }, [draft, rows, data.data]);

  const save = async () => {
    if (!draft) return;
    const ok = await run(
      () => draft.id
        ? updateOrgUnit(draft.id, { name: draft.name, code: draft.code, parentId: draft.parentId, managerUserId: draft.managerUserId, isActive: draft.isActive })
        : createOrgUnit({ name: draft.name, code: draft.code, parentId: draft.parentId }),
      draft.id ? 'واحد ویرایش شد.' : 'واحد ایجاد شد.',
      'ذخیره واحد انجام نشد.',
    );
    if (ok) setDraft(null);
  };

  return (
    <div className="space-y-4">
      {message && <Notice type={message.type} onClose={() => setMessage(null)}>{message.text}</Notice>}
      <AdminCard>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">معاونت‌ها و واحدها</h3>
            <p className="text-xs text-slate-500 mt-0.5">درخت واحدهای سازمانی. مدیر هر واحد، مدیر پیش‌فرض کارکنان آن واحد است.</p>
          </div>
          {canCreate && (
            <PrimaryButton onClick={() => setDraft({ name: '', code: '', parentId: null, managerUserId: null, managerName: null, isActive: true })}>
              <Plus className="w-4 h-4" /> واحد جدید
            </PrimaryButton>
          )}
        </div>
        {data.loading ? <LoadingRow /> : data.error ? <div className="p-5"><Notice type="error">{data.error}</Notice></div>
          : rows.length === 0 ? <EmptyRow>هنوز واحدی تعریف نشده است.</EmptyRow> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60"><tr>
                  <th className={th}>نام واحد</th><th className={th}>کد</th><th className={th}>مدیر واحد</th><th className={th}>شرکت</th><th className={th}>وضعیت</th><th className={th} />
                </tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((u) => (
                    <tr key={u.id}>
                      <td className={td}>
                        <span className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100" style={{ paddingRight: `${u.depth * 1.25}rem` }}>
                          <Network className={`w-4 h-4 shrink-0 ${u.depth === 0 ? 'text-indigo-600' : 'text-slate-400'}`} /> {u.name}
                        </span>
                      </td>
                      <td className={`${td} dir-ltr text-right text-slate-500`}>{u.code}</td>
                      <td className={td}>{u.managerUserId ? names.get(u.managerUserId) || 'کاربر' : '—'}</td>
                      <td className={td}>{companyOf.get(u.id) || <span className="text-xs text-slate-400">بدون شرکت</span>}</td>
                      <td className={td}>{u.isActive ? <StatusBadge tone="green">فعال</StatusBadge> : <StatusBadge tone="red">غیرفعال</StatusBadge>}</td>
                      <td className={`${td} whitespace-nowrap text-left`}>
                        {canUpdate && (
                          <IconAction icon={Pencil} label="ویرایش" onClick={() => setDraft({ id: u.id, name: u.name, code: u.code, parentId: u.parentId, managerUserId: u.managerUserId, managerName: u.managerUserId ? names.get(u.managerUserId) || 'کاربر' : null, isActive: u.isActive })} />
                        )}
                        {canDeactivate && u.isActive && (
                          <IconAction icon={Ban} tone="rose" label="غیرفعال کردن" disabled={busy} onClick={() => run(() => deactivateOrgUnit(u.id), 'واحد غیرفعال شد.', 'غیرفعال کردن واحد انجام نشد.')} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </AdminCard>

      {draft && (
        <AdminDialog
          title={draft.id ? 'ویرایش واحد' : 'واحد جدید'}
          onClose={() => setDraft(null)}
          footer={<>
            <SecondaryButton onClick={() => setDraft(null)}>انصراف</SecondaryButton>
            <PrimaryButton onClick={save} disabled={busy || !draft.name.trim() || !draft.code.trim()}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} ذخیره</PrimaryButton>
          </>}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="نام واحد" required hint="مثلاً «معاونت فناوری اطلاعات»"><input className={inputClass} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="کد واحد" required><input className={`${inputClass} dir-ltr text-right`} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></Field>
          </div>
          <Field label="واحد بالادستی" hint="برای معاونت‌ها خالی بگذارید.">
            <select className={inputClass} value={draft.parentId || ''} onChange={(e) => setDraft({ ...draft, parentId: e.target.value || null })}>
              <option value="">— بدون واحد بالادستی —</option>
              {parentOptions.map((u) => <option key={u.id} value={u.id}>{' '.repeat(u.depth * 3)}{u.name}</option>)}
            </select>
          </Field>
          {draft.id && (
            <>
              <Field label="مدیر واحد" hint="کارکنان این واحد که مدیر جداگانه‌ای ندارند، به این شخص گزارش می‌دهند.">
                <UserPicker value={draft.managerUserId} valueLabel={draft.managerName} onChange={(id, name) => setDraft({ ...draft, managerUserId: id, managerName: name })} />
              </Field>
              <Toggle checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} label="واحد فعال است" />
            </>
          )}
          {!draft.id && <p className="text-[11px] text-slate-500">مدیر واحد را پس از ایجاد، از دکمه ویرایش تعیین کنید.</p>}
        </AdminDialog>
      )}
    </div>
  );
};

// ============================================================================ positions

interface PositionDraft { id?: string; title: string; code: string; isActive: boolean }

export const PositionsPanel: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const data = useLoad(listPositions, 'دریافت فهرست سمت‌ها ممکن نشد.');
  const [message, setMessage] = useState<Message>(null);
  const [draft, setDraft] = useState<PositionDraft | null>(null);
  const { busy, run } = useAction(data.reload, setMessage);

  const save = async () => {
    if (!draft) return;
    const code = draft.code.trim() || null;
    const ok = await run(
      () => (draft.id ? updatePosition(draft.id, draft.title, code, draft.isActive) : createPosition(draft.title, code)),
      draft.id ? 'سمت ویرایش شد.' : 'سمت ایجاد شد.',
      'ذخیره سمت انجام نشد.',
    );
    if (ok) setDraft(null);
  };

  return (
    <div className="space-y-4">
      {message && <Notice type={message.type} onClose={() => setMessage(null)}>{message.text}</Notice>}
      <AdminCard>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">سمت‌ها</h3>
            <p className="text-xs text-slate-500 mt-0.5">عنوان‌های شغلی سازمان، مثل کارشناس، رئیس اداره و معاون. (جدا از نقش‌های دسترسی)</p>
          </div>
          {canManage && <PrimaryButton onClick={() => setDraft({ title: '', code: '', isActive: true })}><Plus className="w-4 h-4" /> سمت جدید</PrimaryButton>}
        </div>
        {data.loading ? <LoadingRow /> : data.error ? <div className="p-5"><Notice type="error">{data.error}</Notice></div>
          : (data.data || []).length === 0 ? <EmptyRow>هنوز سمتی تعریف نشده است.</EmptyRow> : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.data!.map((p: Position) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{p.title}</span>
                    {p.code && <span className="text-xs text-slate-400 dir-ltr">{p.code}</span>}
                    {!p.isActive && <StatusBadge tone="red">غیرفعال</StatusBadge>}
                  </div>
                  {canManage && (
                    <div className="whitespace-nowrap">
                      <IconAction icon={Pencil} label="ویرایش" onClick={() => setDraft({ id: p.id, title: p.title, code: p.code || '', isActive: p.isActive })} />
                      <IconAction icon={Trash2} tone="rose" label="حذف" disabled={busy} onClick={() => run(() => deletePosition(p.id), 'سمت حذف شد.', 'حذف سمت انجام نشد.')} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
      </AdminCard>

      {draft && (
        <AdminDialog
          title={draft.id ? 'ویرایش سمت' : 'سمت جدید'}
          onClose={() => setDraft(null)}
          footer={<>
            <SecondaryButton onClick={() => setDraft(null)}>انصراف</SecondaryButton>
            <PrimaryButton onClick={save} disabled={busy || !draft.title.trim()}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} ذخیره</PrimaryButton>
          </>}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="عنوان سمت" required><input className={inputClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
            <Field label="کد (اختیاری)"><input className={`${inputClass} dir-ltr text-right`} value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></Field>
          </div>
          {draft.id && <Toggle checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} label="سمت فعال است" description="سمت غیرفعال برای انتصاب جدید قابل انتخاب نیست." />}
        </AdminDialog>
      )}
    </div>
  );
};
