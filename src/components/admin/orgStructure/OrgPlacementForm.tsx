import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, Plus, Check, X } from 'lucide-react';
import { AdminCard, Field, Notice, PrimaryButton, SecondaryButton, inputClass } from '../AdminUi';
import { JalaliDatePicker } from '../../JalaliDatePicker';
import { userErrorMessage } from '../../../utils/errorMessages';
import { toPersianDigits } from '../../../utils/helpers';
import {
  addUnitPosition, appointToPost, createNode, createPosition, positionsForCompany, setAssignment,
} from '../../../services/orgStructureApi';
import { UserPicker } from './orgShared';
import { OrgPlacementBoard, PlacementPick, nodePath } from './orgPlacementData';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface Draft {
  companyId: string;
  unitId: string;
  positionId: string;
  userId: string | null;
  userName: string | null;
  managerUserId: string | null;
  managerName: string | null;
  startDate: string | undefined;
}

const EMPTY: Draft = { companyId: '', unitId: '', positionId: '', userId: null, userName: null, managerUserId: null, managerName: null, startDate: undefined };

type Message = { type: 'success' | 'error'; text: string } | null;

/** A select with a «+» that makes a new entry on the spot. */
const SelectWithAdd: React.FC<{
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
  addLabel: string;
  addPlaceholder: string;
  onAdd: ((name: string) => Promise<string>) | null;
}> = ({ label, required, value, onChange, options, placeholder, disabled, addLabel, addPlaceholder, onAdd }) => {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    if (!onAdd || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const id = await onAdd(name.trim());
      onChange(id);
      setName('');
      setAdding(false);
    } catch (err) {
      setError(userErrorMessage(err, `${addLabel} انجام نشد.`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">{label}{required && <span className="text-rose-500"> *</span>}</span>
      <div className="flex gap-2">
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={label} className={`${inputClass} flex-1 min-w-0`}>
          <option value="">{placeholder}</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        {onAdd && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setAdding((v) => !v)}
            title={addLabel}
            aria-label={addLabel}
            aria-expanded={adding}
            className="shrink-0 w-11 rounded-xl border border-slate-200 dark:border-slate-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 disabled:opacity-40 flex items-center justify-center cursor-pointer"
          >
            {adding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        )}
      </div>
      {adding && onAdd && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add(); } if (e.key === 'Escape') { e.stopPropagation(); setAdding(false); } }}
            placeholder={addPlaceholder}
            aria-label={addPlaceholder}
            maxLength={200}
            className={`${inputClass} flex-1 min-w-0`}
          />
          <SecondaryButton type="button" disabled={busy || !name.trim()} onClick={() => void add()}><Check className="w-4 h-4" /> ساخت</SecondaryButton>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
};

/**
 * «ثبت جایگاه»: the company, deputy/unit, position and person in one form. It uses the same
 * calls the chart and the user dialog always used (setAssignment; a start date in the future
 * appoints to the post from that day).
 */
export const OrgPlacementForm: React.FC<{
  board: OrgPlacementBoard;
  pick: PlacementPick | null;
  canAssign: boolean;
  canCreateUnits: boolean;
  canCreatePositions: boolean;
  onSaved: () => Promise<void>;
}> = ({ board, pick, canAssign, canCreateUnits, canCreatePositions, onSaved }) => {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  // A click in the chart fills the form for editing.
  useEffect(() => {
    if (!pick) return;
    setDraft({
      ...EMPTY,
      companyId: pick.companyId,
      unitId: pick.unitId ?? '',
      positionId: pick.positionId ?? '',
      userId: pick.userId ?? null,
      userName: pick.userName ?? null,
    });
    setMessage(null);
  }, [pick?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  const nodesById = useMemo(() => new Map(board.nodes.map((n) => [n.id, n])), [board.nodes]);
  const units = useMemo(
    () => board.nodes
      .filter((n) => n.companyId === draft.companyId && (n.isActive || n.id === draft.unitId))
      .map((n) => ({ id: n.id, label: nodePath(n, nodesById) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fa')),
    [board.nodes, nodesById, draft.companyId, draft.unitId],
  );
  const positions = useMemo(
    () => (draft.companyId ? positionsForCompany(board.positions, draft.companyId) : [])
      .filter((p) => p.isActive || p.id === draft.positionId)
      .map((p) => ({ id: p.id, label: p.title }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fa')),
    [board.positions, draft.companyId, draft.positionId],
  );

  const set = (patch: Partial<Draft>) => { setDraft((d) => ({ ...d, ...patch })); setMessage(null); };
  const companyName = board.companies.find((c) => c.id === draft.companyId)?.name;
  const unitName = units.find((u) => u.id === draft.unitId)?.label;
  const positionTitle = positions.find((p) => p.id === draft.positionId)?.label;
  const ready = !!(draft.companyId && draft.unitId && draft.positionId && draft.userId);

  const crumbs = [
    { text: companyName, empty: 'شرکت' },
    { text: unitName, empty: 'واحد' },
    { text: positionTitle, empty: 'سمت' },
    { text: draft.userName, empty: 'کاربر' },
  ];

  const save = async (andNext: boolean) => {
    if (!ready || !canAssign) return;
    setBusy(true);
    setMessage(null);
    try {
      const userId = draft.userId!;
      const later = !!draft.startDate && draft.startDate > todayIso();
      if (later) {
        // From a later day: the user takes the post then (the post is made if the unit has none).
        const posts = board.posts.filter((p) => p.unitId === draft.unitId && p.positionId === draft.positionId);
        const post = posts[0] ?? await addUnitPosition(draft.unitId, draft.positionId);
        await appointToPost(post.id, userId, draft.startDate);
      } else {
        await setAssignment(userId, {
          companyId: draft.companyId,
          unitId: draft.unitId,
          positionId: draft.positionId,
          managerUserId: draft.managerUserId,
        });
      }
      await onSaved();
      setMessage({ type: 'success', text: later ? `جایگاه «${draft.userName}» از تاریخ انتخاب‌شده ثبت شد.` : `جایگاه «${draft.userName}» ثبت شد.` });
      setDraft(andNext ? { ...EMPTY, companyId: draft.companyId, unitId: draft.unitId, positionId: '' } : draft);
    } catch (err) {
      setMessage({ type: 'error', text: userErrorMessage(err, 'ثبت جایگاه انجام نشد.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminCard className="p-5 space-y-4">
      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">ثبت جایگاه</h3>

      <div className="flex flex-wrap items-center gap-1.5 text-xs" aria-label="مسیر زنده" data-testid="placement-path">
        {crumbs.map((c, i) => (
          <React.Fragment key={c.empty}>
            {i > 0 && <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />}
            <span className={`px-2.5 py-1 rounded-lg font-bold ${c.text ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
              {c.text || c.empty}
            </span>
          </React.Fragment>
        ))}
      </div>

      {message && <Notice type={message.type} onClose={() => setMessage(null)}>{message.text}</Notice>}
      {!canAssign && <Notice type="info">برای ثبت جایگاه، دسترسی «مدیریت جایگاه کاربران» لازم است.</Notice>}

      <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); void save(false); }}>
        <div className="space-y-1.5">
          <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">شرکت <span className="text-rose-500">*</span></span>
          <select value={draft.companyId} onChange={(e) => set({ companyId: e.target.value, unitId: '', positionId: '' })} aria-label="شرکت" className={inputClass}>
            <option value="">انتخاب شرکت…</option>
            {board.companies.filter((c) => c.isActive || c.id === draft.companyId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <SelectWithAdd
          label="معاونت / واحد"
          required
          value={draft.unitId}
          onChange={(unitId) => set({ unitId })}
          options={units}
          placeholder={draft.companyId ? 'انتخاب واحد…' : 'ابتدا شرکت را انتخاب کنید'}
          disabled={!draft.companyId}
          addLabel="ساخت واحد جدید"
          addPlaceholder="نام واحد جدید"
          onAdd={canCreateUnits ? async (name) => {
            const node = await createNode({ name, companyId: draft.companyId, parentNodeId: null });
            await onSaved();
            return node.id;
          } : null}
        />

        <SelectWithAdd
          label="سمت"
          required
          value={draft.positionId}
          onChange={(positionId) => set({ positionId })}
          options={positions}
          placeholder={draft.companyId ? 'انتخاب سمت…' : 'ابتدا شرکت را انتخاب کنید'}
          disabled={!draft.companyId}
          addLabel="ساخت سمت جدید"
          addPlaceholder="عنوان سمت جدید"
          onAdd={canCreatePositions ? async (title) => {
            const position = await createPosition(title, null, [draft.companyId]);
            await onSaved();
            return position.id;
          } : null}
        />

        <div className="space-y-1.5">
          <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">کاربر <span className="text-rose-500">*</span></span>
          <UserPicker value={draft.userId} valueLabel={draft.userName} onChange={(id, name) => set({ userId: id, userName: name })} />
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">مدیر مستقیم</span>
          {draft.managerUserId ? (
            <UserPicker value={draft.managerUserId} valueLabel={draft.managerName} onChange={(id, name) => set({ managerUserId: id, managerName: name })} excludeIds={draft.userId ? [draft.userId] : []} />
          ) : (
            <div className="space-y-1.5">
              <div className="px-3 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-300">خودکار بر اساس سمت</div>
              <UserPicker value={null} onChange={(id, name) => set({ managerUserId: id, managerName: name })} placeholder="یا مدیر را جستجو کنید…" excludeIds={draft.userId ? [draft.userId] : []} />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">تاریخ شروع</span>
          <JalaliDatePicker value={draft.startDate} onChange={(startDate) => set({ startDate })} ariaLabel="تاریخ شروع" placeholder="از همین الان" />
        </div>

        <div className="md:col-span-2">
          <button type="button" onClick={() => setMore((v) => !v)} aria-expanded={more} className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer">
            <ChevronDown className={`w-4 h-4 transition-transform ${more ? 'rotate-180' : ''}`} /> تنظیمات بیشتر (اختیاری)
          </button>
          {more && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="placement-more">
              <Field label="نوع رابطه گزارش‌دهی" hint="هنوز در سرور ذخیره نمی‌شود؛ همه‌ی جایگاه‌ها مستقیم ثبت می‌شوند.">
                <select disabled value="direct" aria-label="نوع رابطه گزارش‌دهی" className={inputClass}>
                  <option value="direct">مستقیم</option>
                  <option value="matrix">ماتریسی</option>
                </select>
              </Field>
              <Field label="قالب آماده" hint="هنوز در سرور پشتیبانی نمی‌شود.">
                <select disabled value="" aria-label="قالب آماده" className={inputClass}><option value="">بدون قالب</option></select>
              </Field>
              <Field label="توضیحات" hint="هنوز در سرور ذخیره نمی‌شود." className="md:col-span-2">
                <textarea disabled rows={2} aria-label="توضیحات" className={inputClass} />
              </Field>
            </div>
          )}
        </div>

        <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-2">
          {draft.companyId && <SecondaryButton type="button" disabled={busy} onClick={() => { setDraft(EMPTY); setMessage(null); }}>پاک کردن فرم</SecondaryButton>}
          <SecondaryButton type="button" disabled={busy || !ready || !canAssign} onClick={() => void save(true)}>ثبت و افزودن بعدی</SecondaryButton>
          <PrimaryButton type="submit" disabled={busy || !ready || !canAssign}>ثبت جایگاه</PrimaryButton>
        </div>
      </form>
      {draft.startDate && draft.startDate > todayIso() && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">با تاریخ شروع در آینده، کاربر از همان روز به این سمت منصوب می‌شود ({toPersianDigits(draft.startDate)}).</p>
      )}
    </AdminCard>
  );
};
