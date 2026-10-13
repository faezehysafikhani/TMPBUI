import React from 'react';
import { createPortal } from 'react-dom';
import { STATUSES } from '../types';
import { toPersianDigits } from '../utils/helpers';
import { REPORT_TYPE_TITLES, TaskReportRow, TaskReportSummary } from '../services/taskReportApi';

/** Rows on the first page (under the title and summary) and on each following page. */
const FIRST_PAGE_ROWS = 15;
const PAGE_ROWS = 20;

// Plain hex colours and inline styles only: html2canvas (PDF) cannot read Tailwind's oklch()
// colours, and print must look the same in dark mode.
const C = { ink: '#0f172a', muted: '#64748b', line: '#e2e8f0', head: '#3730a3', zebra: '#f8fafc', red: '#be123c' };

export type PrintableRow = TaskReportRow & { dueDateText: string; completedText: string };

/**
 * Long text is shortened here, not with CSS text-overflow: html2canvas draws an ellipsis over
 * right-to-left text as overlapping glyphs in the PDF.
 */
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

const COLUMNS: { title: string; width: string; value: (r: PrintableRow, i: number) => React.ReactNode }[] = [
  { title: 'ردیف', width: '5%', value: (_r, i) => toPersianDigits(i + 1) },
  { title: 'عنوان', width: '23%', value: (r) => clip(r.title, 42) },
  { title: 'نوع', width: '7%', value: (r) => REPORT_TYPE_TITLES[r.type] },
  { title: 'وضعیت', width: '8%', value: (r) => STATUSES[r.status]?.title || r.status },
  { title: 'مسئول', width: '17%', value: (r) => clip(r.responsible.map((p) => (p.positionTitle ? `${p.displayName} (${p.positionTitle})` : p.displayName)).join('، '), 34) || '—' },
  { title: 'ایجادکننده', width: '10%', value: (r) => clip(r.owner?.displayName || '—', 20) },
  { title: 'موعد انجام', width: '9%', value: (r) => r.dueDateText },
  { title: 'تکمیل', width: '9%', value: (r) => r.completedText || '—' },
  { title: 'برچسب‌ها', width: '12%', value: (r) => clip(r.tags.join('، '), 24) || '—' },
];

const cell: React.CSSProperties = {
  padding: '0 6px', height: 30, lineHeight: '30px', verticalAlign: 'middle', borderBottom: `1px solid ${C.line}`, overflow: 'hidden', whiteSpace: 'nowrap', textAlign: 'right',
};

/**
 * The report as A4 landscape pages, rendered off screen into document.body. Printing shows only
 * these pages (see `.report-print-root` in index.css); the PDF export captures each page.
 */
export const ReportPrintPages: React.FC<{
  rows: PrintableRow[];
  summary: TaskReportSummary;
  scopeText: string;
  filtersText: string;
  generatedText: string;
}> = ({ rows, summary, scopeText, filtersText, generatedText }) => {
  const pages: PrintableRow[][] = [rows.slice(0, FIRST_PAGE_ROWS)];
  for (let i = FIRST_PAGE_ROWS; i < rows.length; i += PAGE_ROWS) pages.push(rows.slice(i, i + PAGE_ROWS));
  const offsets = pages.map((_, p) => (p === 0 ? 0 : FIRST_PAGE_ROWS + (p - 1) * PAGE_ROWS));

  const stats: [string, number, string][] = [
    ['کل', summary.total, C.ink], ['شروع نشده', summary.todo, '#475569'], ['درحال اجرا', summary.inProgress, '#1d4ed8'],
    ['متوقف', summary.paused, '#b45309'], ['خاتمه یافته', summary.completed, '#047857'], ['عقب‌افتاده', summary.overdue, C.red],
    ['عادی', summary.normal, C.muted], ['پروژه', summary.project, C.muted], ['تکرارشونده', summary.recurring, C.muted],
  ];

  return createPortal(
    <div className="report-print-root" dir="rtl" aria-hidden="true" style={{ fontFamily: "'Vazirmatn Variable', Tahoma, sans-serif", color: C.ink, background: '#ffffff' }}>
      {pages.map((pageRows, p) => (
        <div
          key={p}
          className="report-page"
          style={{ width: '297mm', height: '210mm', padding: '10mm', boxSizing: 'border-box', background: '#ffffff', color: C.ink, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          {p === 0 ? (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `2px solid ${C.head}`, paddingBottom: 6 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.head }}>گزارش فعالیت‌ها</div>
                <div style={{ fontSize: 11, color: C.muted }}>{generatedText}</div>
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>{scopeText}</div>
              <div style={{ fontSize: 11, color: C.ink, marginTop: 2 }}>فیلترها: {filtersText}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {stats.map(([label, value, color]) => (
                  <div key={label} style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: C.muted }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color }}>{toPersianDigits(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11, fontWeight: 700, color: C.head, marginBottom: 6 }}>گزارش فعالیت‌ها (ادامه)</div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 10.5 }}>
            <colgroup>{COLUMNS.map((c) => <col key={c.title} style={{ width: c.width }} />)}</colgroup>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.title} style={{ ...cell, height: 28, lineHeight: '28px', background: C.head, color: '#ffffff', fontWeight: 700, borderBottom: 'none' }}>{c.title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 ? C.zebra : '#ffffff' }}>
                  {COLUMNS.map((c) => (
                    <td key={c.title} style={{ ...cell, color: c.title === 'موعد انجام' && r.isOverdue ? C.red : C.ink, fontWeight: c.title === 'عنوان' ? 700 : 400 }}>
                      {c.value(r, offsets[p] + i)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {pageRows.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: C.muted, fontSize: 12 }}>فعالیتی با این فیلترها پیدا نشد.</div>}

          <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.muted, paddingTop: 6 }}>
            <span>سامانه مدیریت وظایف</span>
            <span>صفحه {toPersianDigits(p + 1)} از {toPersianDigits(pages.length)}</span>
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
};
