// The «گزارش» of one meeting as an A4 PDF: details, people, agenda, minutes and the linked
// activities. Drawn into off-screen pages and captured with the same helper as the activity
// report (html2canvas + jsPDF), so Persian text keeps the app's font and shaping.
import { pagesToPdf, saveBlob } from './reportExport';

export interface MeetingReportData {
  title: string;
  typeLabel: string;
  dateText: string;
  timeText: string;
  location: string;
  organizer: string;
  description: string;
  participants: string[];
  agenda: { title: string; durationText: string; presenter: string }[];
  minutes: string;
  tasks: { title: string; statusText: string; dueText: string }[];
  generatedText: string;
}

// Plain hex colours and inline styles only: html2canvas cannot read Tailwind's oklch() colours.
const C = { ink: '#0f172a', muted: '#64748b', line: '#e2e8f0', head: '#3730a3', zebra: '#f8fafc' };
const PAGE_W = 794, PAGE_H = 1123, PAD = 48;

const el = (tag: string, css: string, text?: string): HTMLElement => {
  const node = document.createElement(tag);
  node.style.cssText = css;
  if (text !== undefined) node.textContent = text;
  return node;
};

const section = (heading: string, body: HTMLElement): HTMLElement => {
  const box = el('div', 'margin-bottom:18px');
  box.append(el('div', `font-size:15px;font-weight:700;color:${C.head};border-bottom:2px solid ${C.head};padding-bottom:4px;margin-bottom:8px`, heading), body);
  return box;
};

const row = (label: string, value: string) => {
  const line = el('div', 'display:flex;gap:8px;padding:4px 0;font-size:13px');
  line.append(el('span', `width:110px;flex:none;color:${C.muted}`, label), el('span', `color:${C.ink};flex:1`, value || '—'));
  return line;
};

const table = (head: string[], widths: string[], rows: string[][]) => {
  const t = el('table', 'width:100%;border-collapse:collapse;font-size:12.5px;table-layout:fixed') as HTMLTableElement;
  const addRow = (cells: string[], header: boolean, index: number) => {
    const tr = el('tr', header ? `background:${C.head}` : index % 2 ? `background:${C.zebra}` : '');
    cells.forEach((text, i) => {
      const td = el(header ? 'th' : 'td', `padding:6px 8px;text-align:right;vertical-align:top;border-bottom:1px solid ${C.line};width:${widths[i]};word-break:break-word;${header ? 'color:#ffffff;font-weight:700' : `color:${C.ink}`}`, text);
      tr.append(td);
    });
    t.append(tr);
  };
  addRow(head, true, 0);
  rows.forEach((cells, i) => addRow(cells, false, i));
  return t;
};

/** Blocks of the report in reading order; each is kept whole on one page where it fits. */
function buildBlocks(data: MeetingReportData): HTMLElement[] {
  const blocks: HTMLElement[] = [];
  const header = el('div', `border-bottom:3px solid ${C.head};padding-bottom:10px;margin-bottom:18px`);
  header.append(el('div', `font-size:12px;color:${C.muted}`, 'گزارش جلسه'), el('div', `font-size:22px;font-weight:800;color:${C.ink};margin-top:4px`, data.title));
  blocks.push(header);

  const details = el('div', '');
  details.append(row('نوع', data.typeLabel), row('تاریخ', data.dateText), row('ساعت', data.timeText), row('مکان', data.location), row('برگزارکننده', data.organizer));
  if (data.description.trim()) details.append(row('توضیحات', data.description));
  blocks.push(section('مشخصات جلسه', details));

  blocks.push(section(`افراد مرتبط (${data.participants.length})`, el('div', `font-size:13px;line-height:1.9;color:${C.ink}`, data.participants.join('، ') || 'فردی ثبت نشده است.')));

  blocks.push(section(`دستور جلسه (${data.agenda.length})`, data.agenda.length
    ? table(['ردیف', 'عنوان', 'مدت', 'ارائه‌دهنده'], ['8%', '50%', '16%', '26%'], data.agenda.map((a, i) => [String(i + 1), a.title, a.durationText, a.presenter || '—']))
    : el('div', `font-size:13px;color:${C.muted}`, 'بندی برای دستور جلسه ثبت نشده است.')));

  // Long minutes are split by paragraph so they can flow onto the next page.
  const minutesParts = data.minutes.trim() ? data.minutes.trim().split(/\n+/) : [];
  if (minutesParts.length) {
    minutesParts.forEach((part, i) => {
      const p = el('div', `font-size:13px;line-height:1.9;color:${C.ink};margin-bottom:6px;white-space:pre-wrap`, part);
      blocks.push(i === 0 ? section('مصوبات صورت‌جلسه', p) : p);
    });
  }

  blocks.push(section(`وظایف مرتبط (${data.tasks.length})`, data.tasks.length
    ? table(['ردیف', 'عنوان', 'وضعیت', 'موعد'], ['8%', '52%', '18%', '22%'], data.tasks.map((t, i) => [String(i + 1), t.title, t.statusText, t.dueText || '—']))
    : el('div', `font-size:13px;color:${C.muted}`, 'وظیفه‌ای به این جلسه وصل نشده است.')));
  return blocks;
}

/** Lays the blocks out on A4 pages (a block that does not fit goes to the next page) and makes the PDF. */
async function blocksToPdf(blocks: HTMLElement[], generatedText: string, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const root = el('div', 'position:fixed;top:0;left:-20000px;z-index:-1');
  root.className = 'report-print-root';
  document.body.appendChild(root);
  try {
    const pages: HTMLElement[] = [];
    const newPage = () => {
      const page = el('div', `width:${PAGE_W}px;height:${PAGE_H}px;box-sizing:border-box;padding:${PAD}px;background:#ffffff;color:${C.ink};direction:rtl;overflow:hidden;position:relative;font-family:inherit`);
      page.className = 'report-page';
      const body = el('div', `height:${PAGE_H - PAD * 2 - 22}px;overflow:hidden`);
      const footer = el('div', `position:absolute;right:${PAD}px;left:${PAD}px;bottom:24px;font-size:11px;color:${C.muted};display:flex;justify-content:space-between`);
      footer.append(el('span', '', generatedText), el('span', ''));
      page.append(body, footer);
      root.append(page);
      pages.push(page);
      return body;
    };
    let body = newPage();
    for (const block of blocks) {
      body.append(block);
      if (body.scrollHeight > body.clientHeight && body.children.length > 1) {
        body.removeChild(block);
        body = newPage();
        body.append(block);
      }
    }
    pages.forEach((page, i) => { (page.lastElementChild!.lastElementChild as HTMLElement).textContent = `صفحه ${i + 1} از ${pages.length}`.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]); });
    return await pagesToPdf(pages, onProgress);
  } finally {
    root.remove();
  }
}

/** The report of one meeting as a PDF. */
export function meetingReportBlob(data: MeetingReportData): Promise<Blob> {
  return blocksToPdf(buildBlocks(data), data.generatedText);
}

/** Builds the report pages, turns them into a PDF and downloads it. */
export async function downloadMeetingReport(data: MeetingReportData, fileName: string): Promise<void> {
  saveBlob(await meetingReportBlob(data), fileName);
}

export interface TableReportData {
  title: string;
  /** Lines under the title: scope, filters, totals. */
  infoLines: string[];
  head: string[];
  /** Column widths, as percentages that add up to 100. */
  widths: string[];
  rows: string[][];
  generatedText: string;
  emptyText: string;
}

/**
 * Any report as a list: the title and lines in words (scope, filters, totals), then the rows in a
 * table. Rows go on the pages in small groups, each with its heading row, so a page break never
 * splits a row. Used by the meetings and the users reports.
 */
export function tableReportBlob(data: TableReportData, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const blocks: HTMLElement[] = [];
  const header = el('div', `border-bottom:3px solid ${C.head};padding-bottom:10px;margin-bottom:14px`);
  header.append(el('div', `font-size:22px;font-weight:800;color:${C.ink}`, data.title));
  data.infoLines.forEach((line, i) => header.append(el('div', `font-size:12px;color:${i === data.infoLines.length - 1 ? C.ink : C.muted};margin-top:4px${i === data.infoLines.length - 1 ? ';font-weight:700' : ''}`, line)));
  blocks.push(header);
  const CHUNK = 6;
  for (let i = 0; i < data.rows.length; i += CHUNK) {
    blocks.push(table(data.head, data.widths, data.rows.slice(i, i + CHUNK)));
  }

  if (data.rows.length === 0) blocks.push(el('div', `font-size:13px;color:${C.muted}`, data.emptyText));
  return blocksToPdf(blocks, data.generatedText, onProgress);
}
