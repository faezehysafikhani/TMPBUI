import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { AdminCard, Field, Notice, PrimaryButton, SecondaryButton, inputClass } from '../AdminUi';
import { userErrorMessage } from '../../../utils/errorMessages';
import { toPersianDigits } from '../../../utils/helpers';
import {
  IMPORT_COLUMNS, IMPORT_MAX_BYTES, type AutoLinkChoice, type ImportPreview, type ImportResult,
  commitImport, getChart, listNodeTypes, previewImport,
} from '../../../services/orgStructureApi';
import { EmptyRow, LoadingRow, useLoad } from './orgShared';
import { allUnitsOf } from './orgChartModel';
import { AutoLinkChoiceDialog } from './nodes/LinkDialogs';

/** A sample sheet (UTF-8 CSV, opens in Excel) with the columns in order and two example rows. */
function sampleCsv(typeCodes: string[]): string {
  const type = typeCodes[0] || '';
  const rows = [
    [...IMPORT_COLUMNS],
    ['A1', 'معاونت نمونه', '', type, ''],
    ['A1-1', 'اداره کل نمونه', 'A1', typeCodes[1] || type, ''],
  ];
  return `﻿${rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')}\r\n`;
}

/**
 * «ورود از اکسل»: a sheet of nodes (code, name, parent code, type, manager's position) becomes a
 * structure all at once: upload, check (every fault is listed with its row; nothing is made while
 * there is one), confirm. Only makes new nodes.
 */
export const OrgImportPanel: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
  const data = useLoad(async () => {
    const [chart, types] = await Promise.all([getChart(), listNodeTypes().catch(() => [])]);
    return { chart, types };
  }, 'دریافت شرکت‌ها ممکن نشد.');
  const [companyId, setCompanyId] = useState('');
  const [parentId, setParentId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<AutoLinkChoice[] | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const chart = data.data?.chart || [];
  const company = chart.find((c) => c.companyId === (companyId || chart[0]?.companyId));
  const nodes = useMemo(() => (company ? allUnitsOf(company) : []), [company]);
  const typeCodes = (data.data?.types || []).filter((t) => t.isActive).map((t) => t.code);
  const tooBig = !!file && file.size > IMPORT_MAX_BYTES;

  const target = { companyId: parentId ? null : company?.companyId ?? null, parentNodeId: parentId || null };
  const reset = () => { setPreview(null); setResult(null); setError(null); };

  const run = async (kind: 'preview' | 'commit') => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === 'preview') {
        setResult(null);
        setPreview(await previewImport(file, target));
      } else {
        const made = await commitImport(file, target);
        setResult(made);
        setPreview(null);
        setFile(null);
        if (input.current) input.current.value = '';
        onChanged?.();
        await data.reload();
        if (made.autoLinkChoices.length > 0) setChoices(made.autoLinkChoices);
      }
    } catch (err) {
      setError(userErrorMessage(err, kind === 'preview' ? 'بررسی فایل انجام نشد.' : 'ساخت گره‌ها انجام نشد.'));
    } finally {
      setBusy(false);
    }
  };

  if (data.loading && !data.data) return <AdminCard><LoadingRow /></AdminCard>;
  if (data.error) return <Notice type="error">{data.error}</Notice>;
  if (chart.length === 0) return <AdminCard><EmptyRow>هنوز شرکتی تعریف نشده است.</EmptyRow></AdminCard>;

  return (
    <div className="space-y-4">
      <AdminCard>
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white"><FileSpreadsheet className="w-5 h-5 text-emerald-600" /> ورود گره‌ها از اکسل</h3>
          <p className="text-xs text-slate-500 mt-0.5 leading-6">
            ستون‌ها به این ترتیب و با یک ردیف عنوان: {IMPORT_COLUMNS.join('، ')}. «نوع» کدِ نوع گره است (خالی: واحد ساده) و «سمت مدیر» عنوان یکی از سمت‌های شرکت. فایل .xlsx (برگه‌ی اول) یا .csv با حداکثر ۵ مگابایت و ۵۰۰۰ ردیف. فقط گره‌ی تازه ساخته می‌شود؛ اگر حتی یک خطا باشد هیچ‌چیز ساخته نمی‌شود.
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="شرکت">
              <select className={inputClass} value={company?.companyId || ''} onChange={(e) => { setCompanyId(e.target.value); setParentId(''); reset(); }}>
                {chart.map((c) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="کجا ساخته شود؟" hint="زیر یک گره، فقط وقتی ساخت تودرتو روشن است.">
              <select className={inputClass} value={parentId} onChange={(e) => { setParentId(e.target.value); reset(); }}>
                <option value="">بالاترین سطح شرکت</option>
                {nodes.filter((n) => n.isActive !== false).map((n) => <option key={n.unitId} value={n.unitId}>زیر «{n.name}»</option>)}
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={input}
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label="فایل اکسل گره‌ها"
              className="block text-xs file:me-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-indigo-700 dark:file:bg-indigo-950/50"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); reset(); }}
            />
            <SecondaryButton
              type="button"
              onClick={() => {
                const url = URL.createObjectURL(new Blob([sampleCsv(typeCodes)], { type: 'text/csv;charset=utf-8' }));
                const a = document.createElement('a');
                a.href = url; a.download = 'org-nodes-sample.csv'; a.click();
                URL.revokeObjectURL(url);
              }}
            ><Download className="w-4 h-4" /> فایل نمونه</SecondaryButton>
          </div>
          {typeCodes.length > 0 && (
            <p className="text-[11px] text-slate-500">کد نوع‌ها: {(data.data?.types || []).filter((t) => t.isActive).map((t) => `${t.name} = ${t.code}`).join('، ')}</p>
          )}
          {tooBig && <Notice type="error">حجم فایل بیشتر از ۵ مگابایت است.</Notice>}
          {error && <Notice type="error" onClose={() => setError(null)}>{error}</Notice>}
          <div className="flex items-center gap-2">
            <PrimaryButton type="button" disabled={!file || tooBig || busy} onClick={() => run('preview')}>
              {busy && !preview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} بررسی فایل
            </PrimaryButton>
          </div>
        </div>
      </AdminCard>

      {preview && preview.errors.length > 0 && (
        <AdminCard>
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="flex items-center gap-2 text-base font-extrabold text-rose-700 dark:text-rose-300"><AlertTriangle className="w-5 h-5" /> {toPersianDigits(preview.errors.length)} خطا در فایل</h3>
            <p className="text-xs text-slate-500 mt-0.5">فایل را اصلاح و دوباره بارگذاری کنید. تا وقتی خطا هست چیزی ساخته نمی‌شود.</p>
          </div>
          <table className="w-full" data-testid="import-errors">
            <thead className="bg-slate-50 dark:bg-slate-800/60"><tr><th className="px-4 py-2 text-right text-xs font-bold text-slate-500 w-24">سطر</th><th className="px-4 py-2 text-right text-xs font-bold text-slate-500">مشکل</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {preview.errors.map((e, i) => (
                <tr key={i}><td className="px-4 py-2 text-sm font-bold tabular-nums">{e.row == null ? 'کل فایل' : toPersianDigits(e.row)}</td><td className="px-4 py-2 text-sm text-slate-700 dark:text-slate-200">{e.message}</td></tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      )}

      {preview && preview.errors.length === 0 && (
        <AdminCard>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="flex items-center gap-2 text-base font-extrabold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="w-5 h-5" /> فایل درست است: {toPersianDigits(preview.nodes.length)} گره ساخته می‌شود</h3>
            <PrimaryButton type="button" disabled={busy} onClick={() => run('commit')}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} تأیید و ساخت گره‌ها</PrimaryButton>
          </div>
          <div className="max-h-96 overflow-y-auto" data-scrollable>
            <table className="w-full" data-testid="import-nodes">
              <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0"><tr>
                {['سطر', 'کد', 'نام', 'نوع', 'سمت مدیر'].map((h) => <th key={h} className="px-4 py-2 text-right text-xs font-bold text-slate-500">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {preview.nodes.map((n) => (
                  <tr key={n.row}>
                    <td className="px-4 py-1.5 text-xs text-slate-500 tabular-nums">{toPersianDigits(n.row)}</td>
                    <td className="px-4 py-1.5 text-xs dir-ltr text-right">{n.code}</td>
                    <td className="px-4 py-1.5 text-sm font-bold text-slate-800 dark:text-slate-100"><span style={{ paddingInlineStart: `${n.depth * 1.25}rem` }}>{n.depth > 0 ? '└ ' : ''}{n.name}</span></td>
                    <td className="px-4 py-1.5 text-xs text-slate-600">{n.typeName}</td>
                    <td className="px-4 py-1.5 text-xs text-slate-600">{n.managerPosition || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}

      {result && (
        <Notice type="success" onClose={() => setResult(null)}>
          {toPersianDigits(result.nodes.length)} گره ساخته شد؛ {toPersianDigits(result.links)} رابطه‌ی خودکار و {toPersianDigits(result.posts)} پست اضافه شد.
          {result.skippedPosts.length > 0 && <span className="block mt-1 text-xs">{toPersianDigits(result.skippedPosts.length)} پستِ الگو ساخته نشد: {result.skippedPosts.slice(0, 5).map((s) => `${s.nodeName}: ${s.reason}`).join('؛ ')}{result.skippedPosts.length > 5 ? '…' : ''}</span>}
        </Notice>
      )}
      {choices && <AutoLinkChoiceDialog choices={choices} onDone={() => data.reload()} onClose={() => setChoices(null)} />}
    </div>
  );
};
