// «قدم بعدی»: the four things a structure is made of, in order, with what is done and one button for
// the next one - so nobody has to know where to start. Shown while something is still missing.
import React from 'react';
import { Check, Plus } from 'lucide-react';
import { toPersianDigits } from '../../../../utils/helpers';
import type { ChartCompany } from '../../../../services/orgStructureApi';
import { allUnitsOf, nodeCount, positionsOf } from '../orgChartModel';

/** What is selected on the chart: the buttons only offer what can be done there. */
export type BuildScope = { kind: 'company' } | { kind: 'unit'; unitId: string; name: string } | { kind: 'post'; name: string } | { kind: 'other' };

export const BuildSteps: React.FC<{
  company: ChartCompany;
  scope: BuildScope;
  canAddUnits: boolean;
  canAddPosts: boolean;
  /** parentId null: at the top of the company. */
  onAddUnit: (parentId: string | null) => void;
  /** unitId null: the user chooses the unit. */
  onAddPosts: (unitId: string | null) => void;
  /** Where people are put (the form above the chart), filled from what is selected. */
  onPlacePeople: () => void;
}> = ({ company, scope, canAddUnits, canAddPosts, onAddUnit, onAddPosts, onPlacePeople }) => {
  const units = allUnitsOf(company);
  const posts = units.flatMap((u) => positionsOf(u));
  const filled = posts.filter((p) => p.holders.length > 0).length;
  const steps = [
    { id: 'company', title: 'شرکت', done: true, detail: company.name },
    { id: 'units', title: 'واحدها', done: nodeCount(company) > 0, detail: `${toPersianDigits(nodeCount(company))} واحد`, action: !canAddUnits || scope.kind === 'post'
        ? null
        : scope.kind === 'unit' ? { label: `افزودن زیرواحد به «${scope.name}»`, run: () => onAddUnit(scope.unitId) } : { label: 'افزودن واحد', run: () => onAddUnit(null) } },
    { id: 'posts', title: 'پست‌ها', done: posts.length > 0, detail: `${toPersianDigits(posts.length)} پست`, action: !canAddPosts || units.length === 0 || scope.kind === 'post'
        ? null
        : scope.kind === 'unit' ? { label: `افزودن پست به «${scope.name}»`, run: () => onAddPosts(scope.unitId) } : { label: 'افزودن پست', run: () => onAddPosts(null) } },
    { id: 'people', title: 'افراد', done: filled > 0, detail: `${toPersianDigits(filled)} پست پر`, action: posts.length > 0 ? { label: scope.kind === 'post' ? `افزودن نفر به «${scope.name}»` : scope.kind === 'unit' ? `افزودن نفر به «${scope.name}»` : 'افزودن نفر به پست', run: onPlacePeople } : null },
  ];
  if (steps.every((s) => s.done) && posts.length > 0 && filled >= posts.length) return null;
  const next = steps.find((s) => !s.done);
  return (
    <ol className="flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 px-3 py-2.5" data-testid="build-steps" aria-label="مراحل ساخت ساختار">
      {steps.map((s, i) => (
        <li key={s.id} className="flex items-center gap-2">
          <span className={`w-6 h-6 rounded-full text-[11px] font-extrabold flex items-center justify-center ${s.done ? 'bg-emerald-500 text-white' : next?.id === s.id ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
            {s.done ? <Check className="w-3.5 h-3.5" /> : toPersianDigits(i + 1)}
          </span>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{s.title}</span>
          <span className="text-[11px] text-slate-500">{s.detail}</span>
          {s.action && (
            <button type="button" onClick={s.action.run} data-testid={`step-${s.id}`} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-extrabold cursor-pointer ${next?.id === s.id ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'}`}>
              <Plus className="w-3 h-3" /> {s.action.label}
            </button>
          )}
          {i < steps.length - 1 && <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">‹</span>}
        </li>
      ))}
      {scope.kind === 'post' && <li className="text-[11px] text-slate-500">یک پست زیرمجموعه ندارد؛ برای ساخت واحد یا پست، شرکت یا یک واحد را انتخاب کنید.</li>}
    </ol>
  );
};
