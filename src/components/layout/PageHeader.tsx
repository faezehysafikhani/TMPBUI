import React from 'react';

/**
 * The top of a page in the new layout: an optional small path above, the title, one line under it, and the
 * page's actions on the left (RTL). Same on every redesigned page.
 */
export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  crumb?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ title, subtitle, crumb, actions, children }) => (
  <div className="flex flex-col gap-4 mb-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {crumb && <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">{crumb}</p>}
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
    {children}
  </div>
);

/** Card surface of the new layout. */
export const surface = 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl';

/** Buttons of the new layout. */
export const btnPrimary = 'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm shadow-indigo-600/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
export const btnSecondary = 'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
export const btnIcon = 'inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
