import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Network, Briefcase, Plus, Minus, Check, X, CornerDownLeft } from 'lucide-react';
import { Company, CompanyUnitLink, Position } from '../../../services/orgStructureApi';

export interface PlacementChoice { companyId: string; unitId: string; positionId: string }

/** Positions in tree order (each followed by the ones under it), with their depth. */
function positionTree(positions: Position[], keepId: string): { position: Position; depth: number }[] {
  const visible = positions.filter((p) => p.isActive || p.id === keepId);
  const ids = new Set(visible.map((p) => p.id));
  const children = new Map<string | null, Position[]>();
  for (const p of visible) {
    const parent = p.parentPositionId && ids.has(p.parentPositionId) ? p.parentPositionId : null;
    children.set(parent, [...(children.get(parent) || []), p]);
  }
  const out: { position: Position; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number) => {
    for (const p of (children.get(parent) || []).sort((a, b) => a.title.localeCompare(b.title, 'fa'))) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({ position: p, depth });
      walk(p.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

const rowBase = 'group flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors';

/** The + / − that opens a node's children. */
const ExpandButton: React.FC<{ open: boolean; onClick: () => void; label: string }> = ({ open, onClick, label }) => (
  <button
    type="button"
    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
    aria-expanded={open}
    aria-label={`${open ? 'بستن' : 'باز کردن'} ${label}`}
    className={`w-6 h-6 shrink-0 rounded-lg border flex items-center justify-center cursor-pointer transition-colors ${
      open
        ? 'border-indigo-300 bg-indigo-600 text-white dark:border-indigo-700'
        : 'border-slate-300 dark:border-slate-600 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 bg-white dark:bg-slate-900'
    }`}
  >
    {open ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
  </button>
);

/** One choosable row: click to choose; the tick shows the current choice. */
const ChoiceRow: React.FC<{
  selected: boolean;
  onSelect: () => void;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  label: string;
  note?: string;
  muted?: boolean;
}> = ({ selected, onSelect, icon: Icon, tone, label, note, muted }) => (
  <button
    type="button"
    onClick={(e) => { e.preventDefault(); onSelect(); }}
    aria-pressed={selected}
    className={`flex-1 min-w-0 flex items-center gap-2 text-right cursor-pointer rounded-lg px-1.5 py-0.5 ${muted ? 'opacity-60' : ''}`}
  >
    <span className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center ${tone}`}><Icon className="w-4 h-4" /></span>
    <span className={`truncate text-sm ${selected ? 'font-extrabold text-indigo-700 dark:text-indigo-300' : 'font-bold text-slate-800 dark:text-slate-100'}`}>{label}</span>
    {note && <span className="text-[11px] text-slate-400 truncate">{note}</span>}
    <span className={`ms-auto w-5 h-5 shrink-0 rounded-full border flex items-center justify-center ${selected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 text-transparent group-hover:border-indigo-400'}`}>
      <Check className="w-3 h-3" />
    </span>
  </button>
);

/**
 * The «جایگاه سازمانی» picker as a tree: companies one under another; + opens a company's
 * deputies, and a deputy's + opens the positions to choose from. Choosing a company or a deputy
 * alone is allowed too (the position stays empty), and «مستقیم زیر شرکت» holds the positions of
 * people who are in no deputy.
 */
export const OrgPlacementTree: React.FC<{
  companies: Company[];
  links: CompanyUnitLink[];
  positions: Position[];
  value: PlacementChoice;
  onChange: (value: PlacementChoice) => void;
}> = ({ companies, links, positions, value, onChange }) => {
  // The chosen branch is open - also when the choice arrives after the tree (an edited user's
  // placement is loaded after the dialog opens).
  const branchOf = (v: PlacementChoice) => (v.companyId
    ? [`c:${v.companyId}`, ...(v.unitId || v.positionId ? [`u:${v.companyId}:${v.unitId || '-'}`] : [])]
    : []);
  const [open, setOpen] = useState<Set<string>>(() => new Set(branchOf(value)));
  useEffect(() => {
    const keys = branchOf(value);
    if (keys.length) setOpen((prev) => (keys.every((k) => prev.has(k)) ? prev : new Set([...prev, ...keys])));
  }, [value.companyId, value.unitId, value.positionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (key: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const visibleCompanies = companies
    .filter((c) => c.isActive || c.id === value.companyId)
    .sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  const tree = useMemo(() => positionTree(positions, value.positionId), [positions, value.positionId]);

  const companyName = companies.find((c) => c.id === value.companyId)?.name;
  const unitName = links.find((l) => l.unitId === value.unitId)?.unitName;
  const positionTitle = positions.find((p) => p.id === value.positionId)?.title;
  const path = [companyName, value.companyId ? unitName || (value.positionId ? 'مستقیم زیر شرکت' : null) : null, positionTitle].filter(Boolean);

  const positionRows = (companyId: string, unitId: string) => (
    <div className="ms-9 border-s-2 border-dashed border-slate-200 dark:border-slate-700 ps-2 py-1 space-y-0.5">
      {tree.length === 0 ? (
        <p className="text-xs text-slate-400 px-2 py-1">هنوز سمتی تعریف نشده است.</p>
      ) : tree.map(({ position, depth }) => {
        const selected = value.companyId === companyId && value.unitId === unitId && value.positionId === position.id;
        return (
          <div key={position.id} className={`${rowBase} ${selected ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`} style={{ paddingInlineStart: 8 + depth * 18 }}>
            {depth > 0 && <CornerDownLeft className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
            <ChoiceRow
              selected={selected}
              onSelect={() => onChange({ companyId, unitId, positionId: position.id })}
              icon={Briefcase}
              tone="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
              label={position.title}
              muted={!position.isActive}
              note={position.isActive ? undefined : 'غیرفعال'}
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 px-3 py-2 text-sm">
        <span className="min-w-0 truncate">
          <span className="text-slate-500 dark:text-slate-400">جایگاه انتخاب‌شده: </span>
          <span className="font-extrabold text-indigo-800 dark:text-indigo-200">{path.length ? path.join(' ‹ ') : 'بدون جایگاه'}</span>
        </span>
        {value.companyId && (
          <button type="button" onClick={(e) => { e.preventDefault(); onChange({ companyId: '', unitId: '', positionId: '' }); }} className="p-1 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer shrink-0" aria-label="حذف جایگاه">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 space-y-1">
        {visibleCompanies.length === 0 && <p className="text-xs text-slate-400 p-3 text-center">هنوز شرکتی تعریف نشده است.</p>}
        {visibleCompanies.map((company) => {
          const companyKey = `c:${company.id}`;
          const companyOpen = open.has(companyKey);
          const units = links.filter((l) => l.companyId === company.id).sort((a, b) => a.unitName.localeCompare(b.unitName, 'fa'));
          const companySelected = value.companyId === company.id && !value.unitId && !value.positionId;
          return (
            <div key={company.id}>
              <div className={`${rowBase} ${companySelected ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <ExpandButton open={companyOpen} onClick={() => toggle(companyKey)} label={company.name} />
                <ChoiceRow
                  selected={companySelected}
                  onSelect={() => onChange({ companyId: company.id, unitId: '', positionId: '' })}
                  icon={Building2}
                  tone="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300"
                  label={company.name}
                  note={units.length ? `${units.length.toLocaleString('fa-IR')} معاونت` : 'بدون معاونت'}
                  muted={!company.isActive}
                />
              </div>

              {companyOpen && (
                <div className="ms-3 border-s-2 border-slate-200 dark:border-slate-700 ps-2 py-1 space-y-0.5">
                  {[...units.map((u) => ({ id: u.unitId, name: u.unitName })), { id: '', name: 'مستقیم زیر شرکت (بدون معاونت)' }].map((unit) => {
                    const unitKey = `u:${company.id}:${unit.id || '-'}`;
                    const unitOpen = open.has(unitKey);
                    const unitSelected = !!unit.id && value.companyId === company.id && value.unitId === unit.id && !value.positionId;
                    return (
                      <div key={unitKey}>
                        <div className={`${rowBase} ${unitSelected ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                          <ExpandButton open={unitOpen} onClick={() => toggle(unitKey)} label={unit.name} />
                          {unit.id ? (
                            <ChoiceRow
                              selected={unitSelected}
                              onSelect={() => onChange({ companyId: company.id, unitId: unit.id, positionId: '' })}
                              icon={Network}
                              tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"
                              label={unit.name}
                            />
                          ) : (
                            <button type="button" onClick={(e) => { e.preventDefault(); toggle(unitKey); }} className="flex-1 text-right text-xs font-bold text-slate-500 dark:text-slate-400 cursor-pointer px-1.5">
                              {unit.name}
                            </button>
                          )}
                        </div>
                        {unitOpen && positionRows(company.id, unit.id)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
