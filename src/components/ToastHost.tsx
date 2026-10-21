import { useEffect, useState } from 'react';
import { subscribeToasts, ToastItem } from '../utils/toast';

const KIND_CLASS = {
  info: 'bg-slate-900 text-white',
  ok: 'bg-emerald-600 text-white',
  error: 'bg-rose-600 text-white',
} as const;

export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => subscribeToasts(setItems), []);
  if (items.length === 0) return null;
  return (
    <div className="fixed z-[100] bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none" dir="rtl">
      {items.map((t) => (
        <div key={t.id} role="status" className={`pointer-events-auto max-w-[90vw] px-4 py-2.5 rounded-xl shadow-xl text-xs sm:text-sm font-semibold animate-in fade-in slide-in-from-bottom-2 ${KIND_CLASS[t.kind]}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
