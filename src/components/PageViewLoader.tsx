import React from 'react';
import { AppColorPalette } from '../types';

interface PageViewLoaderProps {
  appColorPalette?: AppColorPalette;
  message?: string;
}

const paletteColors: Record<AppColorPalette, { primary: string; glow: string }> = {
  indigo: {
    primary: '#6366f1',
    glow: 'rgba(99, 102, 241, 0.3)',
  },
  emerald: {
    primary: '#10b981',
    glow: 'rgba(16, 185, 129, 0.3)',
  },
  rose: {
    primary: '#f43f5e',
    glow: 'rgba(244, 63, 94, 0.3)',
  },
  amber: {
    primary: '#f59e0b',
    glow: 'rgba(245, 158, 11, 0.3)',
  },
  cyan: {
    primary: '#06b6d4',
    glow: 'rgba(6, 182, 212, 0.3)',
  },
  slate: {
    primary: '#64748b',
    glow: 'rgba(100, 116, 139, 0.3)',
  },
};

export const PageViewLoader: React.FC<PageViewLoaderProps> = ({
  appColorPalette = 'indigo',
  message,
}) => {
  const colors = paletteColors[appColorPalette] || paletteColors.indigo;

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-320px)] sm:min-h-[calc(100vh-280px)] w-full py-12 px-4 select-none">
      {/* Continuous smooth revolving circular spinner */}
      <div className="relative flex items-center justify-center">
        {/* Soft Ambient Glow */}
        <div
          className="absolute inset-0 rounded-full blur-md opacity-40"
          style={{ backgroundColor: colors.glow }}
        />

        {/* Seamless revolving SVG Circle */}
        <svg
          className="w-12 h-12 animate-smooth-spin text-slate-200 dark:text-slate-800"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background circular track */}
          <circle
            cx="24"
            cy="24"
            r="18"
            stroke="currentColor"
            strokeWidth="3.5"
          />
          {/* Active revolving arc */}
          <circle
            cx="24"
            cy="24"
            r="18"
            stroke={colors.primary}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="113.1"
            strokeDashoffset="75"
          />
        </svg>
      </div>

      {message && (
        <p className="mt-4 text-xs font-semibold text-slate-600 dark:text-slate-400 tracking-wide animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
};


