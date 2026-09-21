import { AppTheme, AppColorPalette } from '../types';

export interface PatternConfig {
  id: AppTheme;
  name: string;
  patternClass: string;
  cardPatternClass: string;
}

export const PATTERN_THEMES: Record<AppTheme, PatternConfig> = {
  default: {
    id: 'default',
    name: 'ساده و مدرن',
    patternClass: 'bg-pattern-default',
    cardPatternClass: 'bg-white dark:bg-slate-800/90',
  },
  checkerboard: {
    id: 'checkerboard',
    name: 'طرح شطرنجی',
    patternClass: 'bg-pattern-checkerboard',
    cardPatternClass: 'bg-pattern-checkerboard bg-white/90 dark:bg-slate-800/90',
  },
  diagonal: {
    id: 'diagonal',
    name: 'خطوط مورب',
    patternClass: 'bg-pattern-diagonal',
    cardPatternClass: 'bg-pattern-diagonal bg-white/90 dark:bg-slate-800/90',
  },
  grid: {
    id: 'grid',
    name: 'طرح شبکه‌ای',
    patternClass: 'bg-pattern-grid',
    cardPatternClass: 'bg-pattern-grid bg-white/90 dark:bg-slate-800/90',
  },
  dots: {
    id: 'dots',
    name: 'طرح نقطه‌ای',
    patternClass: 'bg-pattern-dots',
    cardPatternClass: 'bg-pattern-dots bg-white/90 dark:bg-slate-800/90',
  },
  cross: {
    id: 'cross',
    name: 'چهارخانه (متقاطع)',
    patternClass: 'bg-pattern-cross',
    cardPatternClass: 'bg-pattern-cross bg-white/90 dark:bg-slate-800/90',
  },
  waves: {
    id: 'waves',
    name: 'طرح موجی',
    patternClass: 'bg-pattern-waves',
    cardPatternClass: 'bg-pattern-waves bg-white/90 dark:bg-slate-800/90',
  },
};

export interface ColorPaletteConfig {
  id: AppColorPalette;
  name: string;
  gradientFromTo: string;
  accentBg: string;
  accentHover: string;
  accentText: string;
  accentBorder: string;
  ringClass: string;
  badgeBg: string;
  previewBg: string;
}

export const COLOR_PALETTES: Record<AppColorPalette, ColorPaletteConfig> = {
  indigo: {
    id: 'indigo',
    name: 'نیلی / بنفش',
    gradientFromTo: 'from-indigo-600 to-violet-600',
    accentBg: 'bg-indigo-600',
    accentHover: 'hover:bg-indigo-500',
    accentText: 'text-indigo-600 dark:text-indigo-400',
    accentBorder: 'border-indigo-500',
    ringClass: 'focus:ring-indigo-500',
    badgeBg: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
    previewBg: 'bg-gradient-to-tr from-indigo-600 to-violet-600',
  },
  emerald: {
    id: 'emerald',
    name: 'زمردی / سبز',
    gradientFromTo: 'from-emerald-600 to-teal-600',
    accentBg: 'bg-emerald-600',
    accentHover: 'hover:bg-emerald-500',
    accentText: 'text-emerald-600 dark:text-emerald-400',
    accentBorder: 'border-emerald-500',
    ringClass: 'focus:ring-emerald-500',
    badgeBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    previewBg: 'bg-gradient-to-tr from-emerald-600 to-teal-600',
  },
  rose: {
    id: 'rose',
    name: 'سرخ / گلبهی',
    gradientFromTo: 'from-rose-600 to-pink-600',
    accentBg: 'bg-rose-600',
    accentHover: 'hover:bg-rose-500',
    accentText: 'text-rose-600 dark:text-rose-400',
    accentBorder: 'border-rose-500',
    ringClass: 'focus:ring-rose-500',
    badgeBg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
    previewBg: 'bg-gradient-to-tr from-rose-600 to-pink-600',
  },
  amber: {
    id: 'amber',
    name: 'طلایی / کهربایی',
    gradientFromTo: 'from-amber-600 to-orange-600',
    accentBg: 'bg-amber-600',
    accentHover: 'hover:bg-amber-500',
    accentText: 'text-amber-600 dark:text-amber-400',
    accentBorder: 'border-amber-500',
    ringClass: 'focus:ring-amber-500',
    badgeBg: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    previewBg: 'bg-gradient-to-tr from-amber-600 to-orange-600',
  },
  cyan: {
    id: 'cyan',
    name: 'فیروزه‌ای / آبی',
    gradientFromTo: 'from-cyan-600 to-blue-600',
    accentBg: 'bg-cyan-600',
    accentHover: 'hover:bg-cyan-500',
    accentText: 'text-cyan-600 dark:text-cyan-400',
    accentBorder: 'border-cyan-500',
    ringClass: 'focus:ring-cyan-500',
    badgeBg: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300',
    previewBg: 'bg-gradient-to-tr from-cyan-600 to-blue-600',
  },
  slate: {
    id: 'slate',
    name: 'زغالی / تیره',
    gradientFromTo: 'from-slate-700 to-slate-900',
    accentBg: 'bg-slate-700',
    accentHover: 'hover:bg-slate-600',
    accentText: 'text-slate-700 dark:text-slate-300',
    accentBorder: 'border-slate-600',
    ringClass: 'focus:ring-slate-500',
    badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    previewBg: 'bg-gradient-to-tr from-slate-700 to-slate-900',
  },
};

export interface ThemeConfig {
  headerBg: string;
  accentBg: string;
  accentHover: string;
  accentText: string;
  accentBorder: string;
  ringClass: string;
}

export const DEFAULT_HEADER_THEME: ThemeConfig = {
  headerBg: 'bg-slate-900',
  accentBg: 'bg-indigo-600',
  accentHover: 'hover:bg-indigo-500',
  accentText: 'text-indigo-600 dark:text-indigo-400',
  accentBorder: 'border-indigo-500',
  ringClass: 'focus:ring-indigo-500',
};

// Fallback compatibility map if any component imports THEMES
export const THEMES: Record<string, ThemeConfig> = new Proxy({}, {
  get: () => DEFAULT_HEADER_THEME,
});

