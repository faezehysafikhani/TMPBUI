// The two ways a node enters the structure's shape: «افزودن» (only the types the rules allow there)
// and «جابه‌جایی» (only the places the rules allow; ends in the impact preview before it is saved).
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AdminDialog, Field, Notice, PrimaryButton, SecondaryButton, inputClass } from '../../AdminUi';
import { userErrorMessage } from '../../../../utils/errorMessages';
import { NexusApiError } from '../../../../services/nexusApi';
import { type ChartCompany, type ChartUnit, type NodeType, type NodeTypeRule, type OrgNode, createNode, createNodeType, getNodeTypeRules, moveNode, setNodeTypeRules } from '../../../../services/orgStructureApi';
import { toPersianDigits } from '../../../../utils/helpers';
import { allUnitsOf } from '../orgChartModel';
import { moveTargets } from '../orgNodeRules';
import { ImpactPreviewDialog } from './ImpactPreviewDialog';
import { NodeTypeIcon, safeColor } from './nodeTypeStyle';

/**
 * A new node type that may stand at `parentTypeId` (null: at the top of the company), made on the
 * spot: the type, then the rule that allows it there. With no rules yet (the flat structure) the
 * existing types are first allowed at the top, so nothing that is there now stops being allowed.
 */
export async function createAllowedType(name: string, parentTypeId: string | null, existing: NodeType[]): Promise<NodeType> {
  const type = await createNodeType({ name: name.trim() });
  const { rules } = await getNodeTypeRules();
  const all: NodeTypeRule[] = rules.length > 0
    ? [...rules]
    : existing.filter((t) => t.isActive).map((t) => ({ parentNodeTypeId: null, childNodeTypeId: t.id }));
  all.push({ parentNodeTypeId: parentTypeId, childNodeTypeId: type.id });
  await setNodeTypeRules(all);
  return type;
}

/**
 * «افزودن واحد»: one or several names (a line each) and the type they get, at this place (the top
 * of the company, or under `parent`). Only the types the rules allow are listed; a type that is
 * missing can be made right here (it is allowed at this place at once).
 */
export const AddNodeDialog: React.FC<{
  company: ChartCompany;
  /** null: at the top of the company. */
  parent: ChartUnit | null;
  types: NodeType[];
  /** Every type (to keep what is allowed when the first rule is made). */
  allTypes?: NodeType[];
  /** Whether the user may make a new type (it needs the rules' permission). */
  canCreateTypes?: boolean;
  onCreated: (nodes: OrgNode[]) => Promise<void> | void;
  onClose: () => void;
}> = ({ company, parent, types: initialTypes, allTypes, canCreateTypes = false, onCreated, onClose }) => {
  const [types, setTypes] = useState(initialTypes);
  const [names, setNames] = useState('');
  const [code, setCode] = useState('');
  const [typeId, setTypeId] = useState(initialTypes.length === 1 ? initialTypes[0].id : '');
  const [newType, setNewType] = useState<string | null>(initialTypes.length === 0 && canCreateTypes ? (parent ? '' : 'معاونت') : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = names.split('\n').map((n) => n.trim()).filter(Boolean);
  const parentTypeId = parent?.nodeType?.nodeTypeId ?? null;

  const makeType = async () => {
    if (!newType?.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const type = await createAllowedType(newType, parentTypeId, allTypes ?? types);
      setTypes((t) => [...t, type]);
      setTypeId(type.id);
      setNewType(null);
    } catch (err) {
      setError(userErrorMessage(err, 'ساخت نوع واحد انجام نشد.'));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const made: OrgNode[] = [];
    try {
      for (const name of list) {
        made.push(await createNode({
          name,
          parentNodeId: parent?.unitId ?? null,
          companyId: parent ? null : company.companyId,
          nodeTypeId: typeId || null,
          code: list.length === 1 ? code.trim() || null : null,
        }));
      }
      await onCreated(made);
      onClose();
    } catch (err) {
      // What was made stays; the rest is left in the box to try again.
      setNames(list.slice(made.length).join('\n'));
      if (made.length > 0) await onCreated(made);
      setError(`${made.length > 0 ? `${toPersianDigits(made.length)} واحد ساخته شد. ` : ''}${userErrorMessage(err, 'افزودن واحد انجام نشد.')}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminDialog
      title={parent ? `افزودن زیرمجموعه به «${parent.name}»` : `افزودن واحد در بالاترین سطح «${company.name}»`}
      onClose={() => !busy && onClose()}
      footer={<>
        <SecondaryButton type="button" onClick={onClose} disabled={busy}>انصراف</SecondaryButton>
        <PrimaryButton type="button" onClick={save} disabled={busy || list.length === 0 || !typeId}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {list.length > 1 ? `افزودن ${toPersianDigits(list.length)} واحد` : 'افزودن'}
        </PrimaryButton>
      </>}
    >
      {error && <Notice type="error" onClose={() => setError(null)}>{error}</Notice>}
      <fieldset className="space-y-1.5">
        <legend className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">نوع واحد <span className="text-rose-500">*</span></legend>
        {types.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="نوع واحد">
            {types.map((type) => {
              const color = safeColor(type.color);
              const chosen = typeId === type.id;
              return (
                <label key={type.id} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 cursor-pointer ${chosen ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 dark:border-indigo-600' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200'}`}>
                  <input type="radio" name="node-type" className="sr-only" checked={chosen} onChange={() => setTypeId(type.id)} />
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}1a`, color }}><NodeTypeIcon icon={type.icon} className="w-4 h-4" /></span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{type.name}</span>
                </label>
              );
            })}
          </div>
        )}
        {types.length === 0 && newType === null && (
          <Notice type="info">{canCreateTypes ? 'هنوز نوعی برای این جایگاه تعریف نشده است.' : 'نوعی برای این جایگاه مجاز نیست و شما اجازه‌ی ساخت نوع تازه را ندارید.'}</Notice>
        )}
        {newType !== null ? (
          <div className="flex gap-2 items-center">
            <input
              className={`${inputClass} flex-1 min-w-0`}
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              maxLength={100}
              autoFocus={types.length === 0}
              aria-label="نام نوع واحد تازه"
              placeholder={parent ? 'مثلاً: اداره کل' : 'مثلاً: معاونت'}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void makeType(); } }}
            />
            <SecondaryButton type="button" disabled={busy || !newType.trim()} onClick={() => void makeType()}>ساخت این نوع</SecondaryButton>
            {types.length > 0 && <SecondaryButton type="button" disabled={busy} onClick={() => setNewType(null)}>بستن</SecondaryButton>}
          </div>
        ) : canCreateTypes && (
          <button type="button" onClick={() => setNewType('')} className="text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:underline cursor-pointer">+ نوع واحد تازه (همین‌جا مجاز می‌شود)</button>
        )}
        <p className="text-[11px] text-slate-500">«نوع واحد» مثلاً معاونت، اداره کل یا شعبه است. فقط نوع‌هایی که قاعده‌ی «سلسله‌مراتب مجاز» اینجا اجازه می‌دهد نشان داده می‌شود.</p>
      </fieldset>
      <Field label="نام واحد" required hint="برای ساخت چند واحد با یک نوع، هر نام را در یک خط بنویسید.">
        <textarea
          className={`${inputClass} min-h-[5.5rem] resize-y`}
          value={names}
          onChange={(e) => setNames(e.target.value)}
          maxLength={4000}
          rows={3}
          autoFocus={types.length > 0}
          placeholder={'مثلاً:\nاداره کل حسابداری\nاداره کل خزانه‌داری'}
        />
      </Field>
      {list.length <= 1 && (
        <Field label="کد (اختیاری)" hint="در هر شرکت یکتاست، مثلاً کد شعبه.">
          <input className={`${inputClass} dir-ltr text-right`} value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} />
        </Field>
      )}
    </AdminDialog>
  );
};

type Target = { unitId: string | null };

/**
 * «جابه‌جایی واحد»: pick the new place (or arrive with one, from dragging), see what it would change
 * for people, then confirm. With a place given, it opens at the preview.
 */
export const MoveNodeDialog: React.FC<{
  company: ChartCompany;
  unit: ChartUnit;
  rules: NodeTypeRule[];
  /** The place chosen already (dragging): undefined to choose here, null for the top. */
  initialParentId?: string | null;
  /** The node's version as the chart was loaded. */
  rowVersion: string | null;
  onMoved: () => Promise<void> | void;
  onReload: () => Promise<void> | void;
  onClose: () => void;
}> = ({ company, unit, rules, initialParentId, rowVersion, onMoved, onReload, onClose }) => {
  const [target, setTarget] = useState<Target | null>(initialParentId === undefined ? null : { unitId: initialParentId });
  const [choice, setChoice] = useState('');
  const { top, targets } = moveTargets(company, unit, rules);
  const parent = target?.unitId ? allUnitsOf(company).find((u) => u.unitId === target.unitId) ?? null : null;

  if (target) {
    const where = parent ? `«${parent.name}»` : 'بالاترین سطح شرکت';
    return (
      <ImpactPreviewDialog
        title={`جابه‌جایی «${unit.name}»`}
        summary={<>«{unit.name}» و همه‌ی زیرمجموعه‌اش از {unit.parentNodeId ? 'جای فعلی' : 'بالاترین سطح'} به <b>{where}</b> می‌روند.</>}
        changes={[{ kind: 'move', nodeId: unit.unitId, parentNodeId: target.unitId }]}
        confirmLabel="جابه‌جا کن"
        onConfirm={async () => {
          // Without the node's version the server could not tell that someone changed it first: refuse here.
          if (!rowVersion) throw new NexusApiError('نسخه‌ی این واحد دریافت نشده؛ چارت را دوباره بارگذاری کنید و دوباره امتحان کنید.', 409);
          await moveNode(unit.unitId, { parentNodeId: target.unitId, rowVersion });
          await onMoved();
          onClose();
        }}
        onReload={onReload}
        onClose={onClose}
      />
    );
  }

  const empty = !top && targets.length === 0;
  return (
    <AdminDialog
      title={`جابه‌جایی «${unit.name}»`}
      onClose={onClose}
      footer={<>
        <SecondaryButton type="button" onClick={onClose}>انصراف</SecondaryButton>
        <PrimaryButton type="button" disabled={!choice} onClick={() => setTarget({ unitId: choice === '__top' ? null : choice })}>مرحله‌ی بعد: پیش‌نمایش اثر</PrimaryButton>
      </>}
    >
      {empty ? (
        <Notice type="info">با قاعده‌های «سلسله‌مراتب مجاز» فعلی، جای دیگری برای این واحد مجاز نیست.{rules.length === 0 ? ' هنوز قاعده‌ای تعریف نشده و ساختار مسطح است.' : ''}</Notice>
      ) : (
        <Field label="واحد بالاتر جدید" required hint="فقط جاهایی که قاعده‌ی «سلسله‌مراتب مجاز» اجازه می‌دهد فهرست شده است.">
          <select className={inputClass} value={choice} onChange={(e) => setChoice(e.target.value)} autoFocus>
            <option value="">— انتخاب کنید —</option>
            {top && <option value="__top">بالاترین سطح شرکت</option>}
            {targets.map((t) => <option key={t.unit.unitId} value={t.unit.unitId}>{t.path}</option>)}
          </select>
        </Field>
      )}
    </AdminDialog>
  );
};
