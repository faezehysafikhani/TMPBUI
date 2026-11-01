// «قدم بعدی»: the four things a structure is made of, in order, with what is done and one button for
// the next one - so nobody has to know where to start. Shown while something is still missing.
import React from 'react';
import { Check, Plus } from 'lucide-react';
import { toPersianDigits } from '../../../../utils/helpers';
import type { ChartCompany } from '../../../../services/orgStructureApi';
import { allUnitsOf, nodeCount, positionsOf } from '../orgChartModel';

export const BuildSteps: React.FC<{
  company: ChartCompany;
  canAddUnits: boolean;
  canAddPosts: boolean;
  onAddUnit: () => void;
  onAddPosts: () => void;
  /** Where people are put (the form above the chart). */
  onPlacePeople: () => void;
}> = ({ company, canAddUnits, canAddPosts, onAddUnit, onAddPosts, onPlacePeople }) => {
  const units = allUnitsOf(company);
  const posts = units.flatMap((u) => positionsOf(u));
  const filled = posts.filter((p) => p.holders.length > 0).length;
  const steps = [
    { id: 'company', title: 'شرکت', done: true, detail: company.name },
    { id: 'units', title: 'واحدها', done: nodeCount(company) > 0, detail: `${toPersianDigits(nodeCount(company))} واحد`, action: canAddUnits ? { label: 'افزودن واحد', run: onAddUnit } : null },
    { id: 'posts', title: 'پست‌ها', done: posts.length > 0, detail: `${toPersianDigits(posts.length)} پست`, action: canAddPosts && units.length > 0 ? { label: 'افزودن پست', run: onAddPosts } : null },
    { id: 'people', title: 'افراد', done: filled > 0, detail: `${toPersianDigits(filled)} پست پر`, action: posts.length > 0 ? { label: 'افزودن نفر به پست', run: onPlacePeople } : null },
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
          {next?.id === s.id && s.action && (
            <button type="button" onClick={s.action.run} data-testid={`step-${s.id}`} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 text-[11px] font-extrabold cursor-pointer">
              <Plus className="w-3 h-3" /> {s.action.label}
            </button>
          )}
          {i < steps.length - 1 && <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">‹</span>}
        </li>
      ))}
    </ol>
  );
};
