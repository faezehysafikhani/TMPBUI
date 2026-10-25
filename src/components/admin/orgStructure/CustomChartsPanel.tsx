// «طراحی چارت دلخواه»: charts drawn by hand. A designer ticks companies, deputies and posts from
// the organization chart and saves the chart under a name; everyone who may read the structure
// sees the saved charts and downloads them as PDF. Who holds each post is read live.
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Building2, Briefcase, Check, ChevronDown, ChevronLeft, FileDown, Loader2, Maximize, Minus, Network, Pencil, Plus, Trash2, Workflow,
} from 'lucide-react';
import { AdminCard, Field, IconAction, inputClass, Notice, PrimaryButton, SecondaryButton, Toggle } from '../AdminUi';
import { EmptyRow, LoadingRow, useLoad } from './orgShared';
import { usePanZoom } from './usePanZoom';
import { companyPostsOf, positionsOf, postTree } from './orgChartModel';
import {
  ChartCompany, ChartPosition, ChartUnit, CustomChart, CustomChartInput, createCustomChart, deleteCustomChart, getChart,
  listCustomCharts, postLabel, updateCustomChart,
} from '../../../services/orgStructureApi';
import { userErrorMessage } from '../../../utils/errorMessages';
import { appAlert, appConfirm } from '../../../utils/appDialog';
import { formatToJalali, toPersianDigits } from '../../../utils/helpers';

interface Draft {
  id?: string;
  name: string;
  description: string;
  showHolders: boolean;
  companies: Set<string>;
  units: Set<string>;
  posts: Set<string>;
}

interface Picked { companies: Set<string>; units: Set<string>; posts: Set<string> }

const pickedOf = (chart: CustomChart): Picked => ({
  companies: new Set(chart.companyIds), units: new Set(chart.unitIds), posts: new Set(chart.postIds),
});

/** Every post of a company: its own, and its deputies'. */
const allPostsOf = (company: ChartCompany) => [...companyPostsOf(company), ...company.units.flatMap(positionsOf)];

/**
 * The part of the organization chart that was chosen: a company when it or anything in it was
 * chosen; in it, the chosen posts directly in the company and the chosen deputies (or those
 * with a chosen post), each with its chosen posts.
 */
export function pickChart(chart: ChartCompany[], picked: Picked): ChartCompany[] {
  return chart.flatMap((company) => {
    const units = company.units
      .filter((unit) => picked.units.has(unit.unitId) || positionsOf(unit).some((p) => picked.posts.has(p.unitPositionId)))
      .map((unit) => ({ ...unit, positions: positionsOf(unit).filter((p) => picked.posts.has(p.unitPositionId)) }));
    const positions = companyPostsOf(company).filter((p) => picked.posts.has(p.unitPositionId));
    return picked.companies.has(company.companyId) || units.length > 0 || positions.length > 0
      ? [{ ...company, units, positions }]
      : [];
  });
}

// ---------------------------------------------------------------- the chart as drawn

const line = 'bg-slate-300 dark:bg-slate-600';

const PostBox: React.FC<{ post: ChartPosition; showHolders: boolean; head?: boolean }> = ({ post, showHolders, head }) => (
  <div className={`w-56 rounded-xl border bg-white dark:bg-slate-900 px-3 py-2 shadow-xs ${head ? 'border-amber-300 dark:border-amber-700' : 'border-slate-200 dark:border-slate-700'}`} data-custom-post={post.unitPositionId}>
    <div className="flex items-center gap-2">
      <Briefcase className={`w-4 h-4 shrink-0 ${head ? 'text-amber-600' : 'text-sky-600'}`} />
      <span className="text-xs font-extrabold text-slate-900 dark:text-white truncate">{postLabel(post)}</span>
    </div>
    {showHolders && (
      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate ps-6">
        {post.holders.length ? post.holders.map((h) => h.displayName).join('، ') : 'خالی'}
      </div>
    )}
  </div>
);

const UnitColumn: React.FC<{ unit: ChartUnit; showHolders: boolean }> = ({ unit, showHolders }) => (
  <div className="flex flex-col items-center">
    <div className="w-60 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-2.5 shadow-xs" data-custom-unit={unit.unitId}>
      <div className="flex items-center gap-2">
        <Network className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{unit.name}</span>
      </div>
      {showHolders && unit.manager && <div className="mt-1 text-[11px] text-slate-500 truncate ps-6">مدیر: {unit.manager.displayName}</div>}
    </div>
    {positionsOf(unit).length > 0 && (
      <div className="self-stretch flex justify-center">
        <div className="ms-6 ps-4 pt-3 space-y-2 border-s-2 border-slate-200 dark:border-slate-700">
          {postTree(positionsOf(unit)).map(({ position, depth }) => (
            <div key={position.unitPositionId} style={depth ? { marginInlineStart: `${depth * 1.25}rem` } : undefined}>
              <PostBox post={position} showHolders={showHolders} />
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

const CompanyTree: React.FC<{ company: ChartCompany; showHolders: boolean }> = ({ company, showHolders }) => {
  const posts = postTree(companyPostsOf(company));
  const units = company.units;
  return (
    <div className="flex flex-col items-center">
      <div className="w-64 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50/80 to-white dark:from-indigo-950/40 dark:to-slate-900 px-4 py-3 shadow-sm" data-custom-company={company.companyId}>
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0"><Building2 className="w-4 h-4" /></span>
          <span className="text-base font-extrabold text-slate-900 dark:text-white truncate">{company.name}</span>
        </div>
      </div>
      {posts.length > 0 && (
        <>
          <span className={`w-0.5 h-5 ${line}`} aria-hidden="true" />
          <div className="flex flex-col items-center gap-2">
            {posts.map(({ position, depth }) => (
              <div key={position.unitPositionId} style={depth ? { marginInlineStart: `${depth * 1.25}rem` } : undefined}>
                <PostBox post={position} showHolders={showHolders} head={position.isHead} />
              </div>
            ))}
          </div>
        </>
      )}
      {units.length > 0 && (
        <>
          <span className={`w-0.5 h-6 ${line}`} aria-hidden="true" />
          <div className="flex items-start">
            {units.map((unit, i) => {
              const bar = units.length === 1 ? null : i === 0 ? 'start-1/2 end-0' : i === units.length - 1 ? 'start-0 end-1/2' : 'start-0 end-0';
              return (
                <div key={unit.unitId} className="relative px-3 pt-6 flex flex-col items-center">
                  {bar && <span aria-hidden="true" className={`absolute top-0 h-0.5 ${line} ${bar}`} />}
                  <span className={`absolute top-0 start-1/2 w-0.5 h-6 ${line}`} aria-hidden="true" />
                  <UnitColumn unit={unit} showHolders={showHolders} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

/** The chosen part of the chart, zoomable, with a PDF of it. */
const ChartCanvas: React.FC<{ companies: ChartCompany[]; showHolders: boolean; title: string }> = ({ companies, showHolders, title }) => {
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const { fit, zoomBy } = usePanZoom(viewport, content, companies.length > 0);
  const shape = useMemo(() => JSON.stringify(companies.map((c) => [c.companyId, c.units.map((u) => [u.unitId, positionsOf(u).length]), companyPostsOf(c).length])), [companies]);
  useLayoutEffect(() => { fit(); }, [shape, showHolders, fit]);

  const download = async () => {
    if (!content.current) return;
    setExporting(true);
    try {
      const { downloadOrgChartPdf } = await import('../../../utils/orgChartPdf');
      await downloadOrgChartPdf(content.current, title, `${title}.pdf`);
    } catch (err) {
      console.error('Custom chart PDF failed:', err);
      void appAlert('دریافت فایل PDF چارت انجام نشد.');
    } finally {
      setExporting(false);
    }
  };

  const control = 'w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-600 flex items-center justify-center cursor-pointer disabled:opacity-50';
  return (
    <div className="relative">
      <div className="absolute top-2 end-2 z-10 flex gap-1.5 bg-white/90 dark:bg-slate-900/90 rounded-xl p-1">
        <button type="button" className={control} onClick={() => zoomBy(1.25)} title="بزرگ‌نمایی" aria-label="بزرگ‌نمایی"><Plus className="w-4 h-4" /></button>
        <button type="button" className={control} onClick={() => zoomBy(0.8)} title="کوچک‌نمایی" aria-label="کوچک‌نمایی"><Minus className="w-4 h-4" /></button>
        <button type="button" className={control} onClick={() => fit()} title="نمایش کامل" aria-label="نمایش کامل"><Maximize className="w-4 h-4" /></button>
        <button type="button" className={control} onClick={download} disabled={exporting || companies.length === 0} title="دریافت PDF" aria-label="دریافت PDF">
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
        </button>
      </div>
      <div
        ref={viewport}
        tabIndex={0}
        aria-label={`چارت «${title}»؛ با چرخ ماوس بزرگ‌نمایی کنید و با کشیدن جابه‌جا کنید`}
        className="relative overflow-hidden touch-none select-none outline-hidden cursor-grab h-[60vh] min-h-[380px] rounded-xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800"
      >
        {companies.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">چیزی برای نمایش انتخاب نشده است.</div>
        ) : (
          <div ref={content} className="absolute top-0 left-0 origin-top-left w-max px-10 py-10 flex items-start gap-16" data-custom-chart>
            {companies.map((company) => <CompanyTree key={company.companyId} company={company} showHolders={showHolders} />)}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- choosing what the chart shows

const Tick: React.FC<{ state: boolean | 'some'; onChange: () => void; label: string }> = ({ state, onChange, label }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={state === 'some' ? 'mixed' : state}
    aria-label={label}
    onClick={onChange}
    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${state ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'}`}
  >
    {state === true ? <Check className="w-3 h-3" /> : state === 'some' ? <Minus className="w-3 h-3" /> : null}
  </button>
);

const SelectionTree: React.FC<{ chart: ChartCompany[]; draft: Draft; onChange: (next: Draft) => void }> = ({ chart, draft, onChange }) => {
  // Every company open at first: everything there is to choose is in sight.
  const [open, setOpen] = useState<Set<string>>(() => new Set(chart.map((c) => c.companyId)));
  const toggleOpen = (id: string) => setOpen((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  const set = (patch: Partial<Picked>) => onChange({ ...draft, ...patch });
  const flip = (source: Set<string>, ids: string[], on: boolean) => {
    const next = new Set(source);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    return next;
  };

  const companyState = (company: ChartCompany): boolean | 'some' => {
    const posts = allPostsOf(company).map((p) => p.unitPositionId);
    const units = company.units.map((u) => u.unitId);
    const all = draft.companies.has(company.companyId) && posts.every((id) => draft.posts.has(id)) && units.every((id) => draft.units.has(id));
    if (all) return true;
    return draft.companies.has(company.companyId) || posts.some((id) => draft.posts.has(id)) || units.some((id) => draft.units.has(id)) ? 'some' : false;
  };
  const unitState = (unit: ChartUnit): boolean | 'some' => {
    const posts = positionsOf(unit).map((p) => p.unitPositionId);
    if (draft.units.has(unit.unitId) && posts.every((id) => draft.posts.has(id))) return true;
    return draft.units.has(unit.unitId) || posts.some((id) => draft.posts.has(id)) ? 'some' : false;
  };

  const toggleCompany = (company: ChartCompany) => {
    const on = companyState(company) !== true;
    set({
      companies: flip(draft.companies, [company.companyId], on),
      units: flip(draft.units, company.units.map((u) => u.unitId), on),
      posts: flip(draft.posts, allPostsOf(company).map((p) => p.unitPositionId), on),
    });
  };
  const toggleUnit = (unit: ChartUnit) => {
    const on = unitState(unit) !== true;
    set({ units: flip(draft.units, [unit.unitId], on), posts: flip(draft.posts, positionsOf(unit).map((p) => p.unitPositionId), on) });
  };
  const togglePost = (post: ChartPosition) => set({ posts: flip(draft.posts, [post.unitPositionId], !draft.posts.has(post.unitPositionId)) });

  const postRows = (posts: ChartPosition[]) => postTree(posts).map(({ position, depth }) => (
    <label key={position.unitPositionId} className="flex items-center gap-2 py-1 text-xs text-slate-700 dark:text-slate-200" style={{ paddingInlineStart: `${1.5 + depth * 1.1}rem` }}>
      <Tick state={draft.posts.has(position.unitPositionId)} onChange={() => togglePost(position)} label={postLabel(position)} />
      <Briefcase className="w-3.5 h-3.5 text-sky-600 shrink-0" />
      <span className="truncate">{postLabel(position)}</span>
      <span className="text-[10px] text-slate-400 truncate">{position.holders.length ? position.holders.map((h) => h.displayName).join('، ') : 'خالی'}</span>
    </label>
  ));

  if (chart.length === 0) return <EmptyRow>هنوز شرکتی تعریف نشده است.</EmptyRow>;
  return (
    <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pe-1" data-custom-tree>
      {chart.map((company) => (
        <div key={company.companyId} className="rounded-xl border border-slate-200 dark:border-slate-700 p-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => toggleOpen(company.companyId)} className="text-slate-400 hover:text-indigo-600 cursor-pointer" aria-label={open.has(company.companyId) ? 'بستن' : 'باز کردن'}>
              {open.has(company.companyId) ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <Tick state={companyState(company)} onChange={() => toggleCompany(company)} label={company.name} />
            <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{company.name}</span>
          </div>
          {open.has(company.companyId) && (
            <div className="mt-1">
              {companyPostsOf(company).length > 0 && (
                <div>
                  <div className="text-[11px] font-bold text-slate-500 ps-6 pt-1">پست‌های مستقیم شرکت</div>
                  {postRows(companyPostsOf(company))}
                </div>
              )}
              {company.units.map((unit) => (
                <div key={unit.unitId}>
                  <div className="flex items-center gap-2 py-1 ps-6">
                    <Tick state={unitState(unit)} onChange={() => toggleUnit(unit)} label={unit.name} />
                    <Network className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{unit.name}</span>
                    <span className="text-[10px] text-slate-400">{toPersianDigits(positionsOf(unit).length)} سمت</span>
                  </div>
                  {postRows(positionsOf(unit))}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------- the panel

export const CustomChartsPanel: React.FC<{ canDesign: boolean }> = ({ canDesign }) => {
  const data = useLoad(async () => {
    const [charts, chart] = await Promise.all([listCustomCharts(), getChart()]);
    return { charts, chart };
  }, 'دریافت چارت‌های دلخواه ممکن نشد.');
  const [viewId, setViewId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const charts = data.data?.charts || [];
  const chart = data.data?.chart || [];
  const viewing = charts.find((c) => c.id === viewId) || null;
  const preview = useMemo(() => (draft ? pickChart(chart, draft) : []), [chart, draft]);
  const shown = useMemo(() => (viewing ? pickChart(chart, pickedOf(viewing)) : []), [chart, viewing]);

  const startNew = () => { setError(null); setDraft({ name: '', description: '', showHolders: true, companies: new Set(), units: new Set(), posts: new Set() }); };
  const startEdit = (c: CustomChart) => {
    setError(null);
    setDraft({ id: c.id, name: c.name, description: c.description || '', showHolders: c.showHolders, ...pickedOf(c) });
  };

  const save = async () => {
    if (!draft) return;
    const input: CustomChartInput = {
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      companyIds: [...draft.companies],
      unitIds: [...draft.units],
      postIds: [...draft.posts],
      showHolders: draft.showHolders,
    };
    if (!input.name) { setError('برای چارت یک نام بنویسید.'); return; }
    if (preview.length === 0) { setError('دست‌کم یک شرکت، معاونت یا سمت برای چارت انتخاب کنید.'); return; }
    setSaving(true);
    setError(null);
    try {
      const saved = draft.id ? await updateCustomChart(draft.id, input) : await createCustomChart(input);
      await data.reload();
      setDraft(null);
      setViewId(saved.id);
    } catch (err) {
      setError(userErrorMessage(err, 'ذخیرهٔ چارت انجام نشد.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: CustomChart) => {
    if (!(await appConfirm(`چارت «${c.name}» حذف شود؟`))) return;
    try {
      await deleteCustomChart(c.id);
      if (viewId === c.id) setViewId(null);
      await data.reload();
    } catch (err) {
      void appAlert(userErrorMessage(err, 'حذف چارت انجام نشد.'));
    }
  };

  if (data.loading && !data.data) return <AdminCard><LoadingRow /></AdminCard>;
  if (data.error) return <Notice type="error">{data.error}</Notice>;

  if (draft) {
    return (
      <AdminCard className="p-4 space-y-4" >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white"><Workflow className="w-5 h-5 text-indigo-600" /> {draft.id ? 'ویرایش چارت' : 'چارت جدید'}</h3>
          <div className="flex gap-2">
            <SecondaryButton type="button" onClick={() => setDraft(null)} disabled={saving}>انصراف</SecondaryButton>
            <PrimaryButton type="button" onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin" />} ذخیرهٔ چارت</PrimaryButton>
          </div>
        </div>
        {error && <Notice type="error" onClose={() => setError(null)}>{error}</Notice>}
        <div className="grid gap-4 xl:grid-cols-[22rem_1fr]">
          <div className="space-y-3">
            <Field label="نام چارت" required>
              <input className={inputClass} value={draft.name} maxLength={200} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="مثلاً چارت معاونت فناوری" data-custom-name />
            </Field>
            <Field label="توضیحات">
              <input className={inputClass} value={draft.description} maxLength={1000} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <Toggle checked={draft.showHolders} onChange={(value) => setDraft({ ...draft, showHolders: value })} label="نمایش نام دارندهٔ هر سمت" description="خاموش: فقط سمت‌ها نمایش داده می‌شوند." />
            <div>
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">شرکت‌ها، معاونت‌ها و سمت‌های این چارت</div>
              <SelectionTree chart={chart} draft={draft} onChange={setDraft} />
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">پیش‌نمایش</div>
            <ChartCanvas companies={preview} showHolders={draft.showHolders} title={draft.name.trim() || 'چارت دلخواه'} />
          </div>
        </div>
      </AdminCard>
    );
  }

  return (
    <div className="space-y-4">
      <AdminCard>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white"><Workflow className="w-5 h-5 text-indigo-600" /> طراحی چارت دلخواه</h3>
            <p className="text-xs text-slate-500 mt-0.5">از میان شرکت‌ها، معاونت‌ها و سمت‌ها هر کدام را بخواهید انتخاب کنید و چارت را با یک نام ذخیره کنید. دارندهٔ هر سمت همیشه به‌روز نمایش داده می‌شود.</p>
          </div>
          {canDesign && <PrimaryButton type="button" onClick={startNew}><Plus className="w-4 h-4" /> چارت جدید</PrimaryButton>}
        </div>
        {charts.length === 0 ? (
          <EmptyRow>هنوز چارتی طراحی نشده است.</EmptyRow>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800" data-custom-list>
            {charts.map((c) => (
              <li key={c.id} className={`flex flex-wrap items-center justify-between gap-2 px-5 py-3 ${viewId === c.id ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''}`}>
                <button type="button" onClick={() => setViewId(viewId === c.id ? null : c.id)} className="text-right min-w-0 flex-1 cursor-pointer">
                  <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">{c.name}</span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    {c.description ? `${c.description} · ` : ''}آخرین تغییر: {formatToJalali(c.modifiedAtUtc || c.createdAtUtc)}
                  </span>
                </button>
                {canDesign && (
                  <div className="flex gap-1">
                    <IconAction icon={Pencil} label="ویرایش" onClick={() => startEdit(c)} />
                    <IconAction icon={Trash2} label="حذف" tone="rose" onClick={() => remove(c)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
      {viewing && (
        <AdminCard className="p-4 space-y-2">
          <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">{viewing.name}</h4>
          <ChartCanvas companies={shown} showHolders={viewing.showHolders} title={viewing.name} />
        </AdminCard>
      )}
    </div>
  );
};
