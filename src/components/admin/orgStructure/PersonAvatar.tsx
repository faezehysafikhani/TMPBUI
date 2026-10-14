import React from 'react';
import { normalizeAvatar } from '../../../utils/avatars';
import { initials } from './orgChartModel';

/** A person's picture, or their initials. */
export const PersonAvatar: React.FC<{ name: string; url?: string | null; size?: 'sm' | 'md' | 'lg' }> = ({ name, url, size = 'sm' }) => {
  const box = size === 'lg' ? 'w-14 h-14 text-base' : size === 'md' ? 'w-9 h-9 text-xs' : 'w-7 h-7 text-[10px]';
  const src = normalizeAvatar(url);
  return src ? (
    <img src={src} alt="" className={`${box} rounded-full object-cover border border-white dark:border-slate-800 shadow-sm shrink-0`} />
  ) : (
    <span className={`${box} rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white font-extrabold flex items-center justify-center shrink-0`}>{initials(name)}</span>
  );
};
