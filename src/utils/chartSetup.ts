// Chart.js for the Kanban board's charts: only the pieces they use are registered (keeps the
// bundle small), with the app's Persian font, right-to-left tooltips and legends.
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type Plugin,
} from 'chart.js';
import { toPersianDigits } from './helpers';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

export const CHART_FONT_FAMILY = "'Vazirmatn', system-ui, -apple-system, sans-serif";

export const isDarkMode = (): boolean =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

/** Tooltip look shared by the charts: the same dark card the board used before, right to left. */
export const rtlTooltip = {
  rtl: true,
  textDirection: 'rtl' as const,
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  borderColor: '#334155',
  borderWidth: 1,
  padding: 10,
  cornerRadius: 12,
  boxPadding: 4,
  usePointStyle: true,
  titleFont: { family: CHART_FONT_FAMILY, size: 12, weight: 'bold' as const },
  bodyFont: { family: CHART_FONT_FAMILY, size: 11 },
  footerFont: { family: CHART_FONT_FAMILY, size: 10, weight: 'normal' as const },
  footerColor: '#fcd34d',
};

/** Persian digits for whole-number axis ticks; fractional ticks are left blank. */
export const persianIntegerTick = (value: string | number): string => {
  const n = Number(value);
  return Number.isInteger(n) ? toPersianDigits(n) : '';
};

/**
 * Draws, for each bar, its count above it and the person's name written vertically - inside the
 * bar when it fits, otherwise above it (as the board always showed them). `names` gives the
 * label of each bar by index.
 */
export const barNameLabels = (names: () => string[]): Plugin<'bar'> => ({
  id: 'barNameLabels',
  afterDatasetsDraw(chart) {
    const meta = chart.getDatasetMeta(0);
    const dataset = chart.data.datasets[0];
    if (!meta || !dataset) return;
    const { ctx } = chart;
    const labels = names();
    const dark = isDarkMode();
    const countColor = dark ? '#e2e8f0' : '#334155';
    const nameAboveColor = dark ? '#f1f5f9' : '#1e293b';

    ctx.save();
    meta.data.forEach((element, index) => {
      const bar = element as unknown as { x: number; y: number; base: number };
      const value = Number(dataset.data[index] ?? 0);
      const rawName = labels[index] ?? '';
      const height = Math.abs(bar.base - bar.y);
      const top = Math.min(bar.y, bar.base);

      ctx.font = `bold 11px ${CHART_FONT_FAMILY}`;
      const namePixelHeight = ctx.measureText(rawName).width + 14;
      const fitsInside = height >= namePixelHeight && height >= 44;

      let name = rawName;
      if (fitsInside) {
        while (name.length > 2 && ctx.measureText(name).width > height - 12) name = name.slice(0, -1);
        if (name !== rawName) name = `${name.slice(0, -1)}…`;
      } else if (rawName.length > 14) {
        name = `${rawName.slice(0, 12)}…`;
      }
      const nameWidth = Math.max(18, ctx.measureText(name).width);

      // Count: right above the bar, or above the name when the name sits above the bar.
      ctx.fillStyle = countColor;
      ctx.font = `900 11px ${CHART_FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(toPersianDigits(value), bar.x, fitsInside ? top - 6 : top - 6 - nameWidth - 6);

      // Name, rotated to read bottom-up.
      ctx.save();
      ctx.translate(bar.x, fitsInside ? top + height / 2 : top - 6 - nameWidth / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `${fitsInside ? 'bold' : '800'} 11px ${CHART_FONT_FAMILY}`;
      if (fitsInside) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.fillStyle = nameAboveColor;
      }
      ctx.fillText(name, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  },
});
