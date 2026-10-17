// The organization chart as a PDF: the whole chart (not only the part in view), under a header
// with its title and the date and time it was downloaded. Captured as an image with html2canvas
// + jsPDF, like the reports' PDF, so Persian text keeps the app's font and shaping.
import { saveBlob } from './reportExport';
import { formatToJalali } from './helpers';

const ROOT_CLASS = 'org-chart-pdf-root';

/** The colour properties html2canvas reads (alone, or inside a shadow or gradient). */
const COLOR_PROPERTIES = [
  'color', 'background-color', 'background-image', 'border-top-color', 'border-right-color', 'border-bottom-color',
  'border-left-color', 'box-shadow', 'text-shadow', 'text-decoration-color', '-webkit-text-stroke-color',
];
/** How far (px at a 16px font) html2canvas draws this font below where the browser does. */
const TEXT_LIFT = 5;
const MODERN_COLOR = /(?:oklch|oklab|lch|lab|color)\([^()]*\)/g;

/** The colour as rgb()/rgba(), read back from a canvas pixel: the browser converts any colour it knows. */
function rgbConverter(): (value: string) => string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const cache = new Map<string, string>();
  return (value: string) => {
    let rgb = cache.get(value);
    if (rgb === undefined) {
      rgb = value;
      if (context) {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = '#000';
        context.fillStyle = value;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
        rgb = a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
      }
      cache.set(value, rgb);
    }
    return rgb;
  };
}

/**
 * In html2canvas's copy of the page: every oklch / oklab colour of the chart (Tailwind's, which
 * html2canvas cannot parse) written out as rgb. All styles are read before any is written, so the
 * browser computes them once.
 */
function plainColors(root: HTMLElement, view: Window): void {
  const toRgb = rgbConverter();
  const changes: Array<[HTMLElement | SVGElement, string, string]> = [];
  const truncated: HTMLElement[] = [];
  for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement | SVGElement>('*'))]) {
    const style = view.getComputedStyle(el);
    for (const property of COLOR_PROPERTIES) {
      const value = style.getPropertyValue(property);
      MODERN_COLOR.lastIndex = 0;
      if (value && MODERN_COLOR.test(value)) {
        MODERN_COLOR.lastIndex = 0;
        changes.push([el, property, value.replace(MODERN_COLOR, (color) => toRgb(color))]);
      }
    }
    // One-line texts cut short with an ellipsis: see shortenToFit.
    if (style.overflow === 'hidden' && style.whiteSpace === 'nowrap' && el.namespaceURI === 'http://www.w3.org/1999/xhtml') truncated.push(el as HTMLElement);
    // html2canvas draws this font a little below its line box: every text is lifted back into place,
    // so it lines up with the icons and avatars beside it.
    const lift = TEXT_LIFT * parseFloat(style.fontSize) / 16;
    if (style.position === 'static' && Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent!.trim())) {
      changes.push([el, 'position', 'relative'], [el, 'top', `${-lift}px`]);
    }
  }
  for (const [el, property, value] of changes) el.style.setProperty(property, value, 'important');
  for (const el of truncated) shortenToFit(el);
}

/**
 * html2canvas garbles right-to-left text that overflows its clipped box, and would cut the lower
 * half of this font: a text too long for its box is shortened here with an ellipsis, as the
 * browser shows it, and then drawn unclipped.
 */
function shortenToFit(el: HTMLElement): void {
  const full = el.textContent ?? '';
  if (el.children.length === 0 && el.scrollWidth > el.clientWidth + 1) {
    let low = 0;
    let high = full.length;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      el.textContent = `${full.slice(0, middle).trimEnd()}…`;
      if (el.scrollWidth <= el.clientWidth + 1) low = middle;
      else high = middle - 1;
    }
    el.textContent = `${full.slice(0, low).trimEnd()}…`;
  }
  el.style.setProperty('overflow', 'visible', 'important');
  el.style.setProperty('text-overflow', 'clip', 'important');
}

/**
 * Downloads `chart` (the chart's content element, at any zoom) as a PDF titled `title`, stamped
 * with the current date and time.
 */
export async function downloadOrgChartPdf(chart: HTMLElement, title: string, fileName: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  if (document.fonts?.ready) await document.fonts.ready;

  // A copy of the chart at full size, off screen, under its header.
  const root = document.createElement('div');
  root.className = ROOT_CLASS;
  root.dir = 'rtl';
  Object.assign(root.style, {
    position: 'fixed', top: '0', left: '-20000px', zIndex: '-1', background: '#ffffff', color: '#0f172a',
    padding: '28px 32px', width: 'max-content', fontFamily: "'Vazirmatn Variable', Tahoma, sans-serif",
  });
  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px',
    paddingBottom: '14px', marginBottom: '8px', borderBottom: '2px solid #4f46e5',
  });
  const heading = document.createElement('div');
  heading.textContent = title;
  Object.assign(heading.style, { fontSize: '22px', fontWeight: '800', color: '#1e1b4b' });
  const stamp = document.createElement('div');
  stamp.textContent = `تاریخ و ساعت دریافت: ${formatToJalali(new Date().toISOString())}`;
  Object.assign(stamp.style, { fontSize: '13px', fontWeight: '600', color: '#475569' });
  header.append(heading, stamp);

  const copy = chart.cloneNode(true) as HTMLElement;
  Object.assign(copy.style, { position: 'relative', transform: 'none', left: '0', top: '0' });
  root.append(header, copy);
  document.body.appendChild(root);

  try {
    const width = Math.ceil(root.scrollWidth);
    const height = Math.ceil(root.scrollHeight);
    // Sharp, but within what a browser canvas allows.
    const scale = Math.max(0.5, Math.min(2, 9000 / Math.max(width, height)));
    const canvas = await html2canvas(root, {
      scale, width, height, backgroundColor: '#ffffff', logging: false, useCORS: true,
      onclone: (doc) => {
        for (const el of [doc.documentElement, doc.body]) {
          el.removeAttribute('class');
          el.style.setProperty('background', '#ffffff', 'important');
        }
        for (const child of Array.from(doc.body.children)) {
          if (!child.classList.contains(ROOT_CLASS)) child.remove();
        }
        const copied = doc.body.querySelector<HTMLElement>(`.${ROOT_CLASS}`);
        if (copied && doc.defaultView) plainColors(copied, doc.defaultView);
      },
    });

    // One page the size of the chart (in points), so nothing is shrunk to fit a paper size.
    const pageWidth = width * 0.75;
    const pageHeight = height * 0.75;
    const pdf = new jsPDF({ orientation: pageWidth >= pageHeight ? 'landscape' : 'portrait', unit: 'pt', format: [pageWidth, pageHeight], compress: true });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
    saveBlob(pdf.output('blob'), fileName);
  } finally {
    root.remove();
  }
}
