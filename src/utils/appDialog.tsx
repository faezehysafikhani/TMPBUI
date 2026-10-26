import React, { useEffect, useRef, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';

// The app's own alert / confirm / prompt, in place of the browser's: those look nothing like the
// app, follow the browser's language for their buttons, and block the page while open.
// One dialog shows at a time; others wait their turn.

type Request =
  | { kind: 'alert'; message: string; resolve: (v: void) => void }
  | { kind: 'confirm'; message: string; confirmLabel: string; danger: boolean; resolve: (v: boolean) => void }
  | { kind: 'prompt'; message: string; value: string; resolve: (v: string | null) => void };

const queue: Request[] = [];
let root: Root | null = null;
let rerender: (() => void) | null = null;

function host(): void {
  if (root || typeof document === 'undefined') return;
  const el = document.createElement('div');
  el.setAttribute('data-app-dialog-host', '');
  document.body.appendChild(el);
  root = createRoot(el);
  root.render(<DialogHost />);
}

function push(request: Request): void {
  queue.push(request);
  host();
  rerender?.();
}

export function appAlert(message: string): Promise<void> {
  return new Promise((resolve) => push({ kind: 'alert', message, resolve }));
}

export function appConfirm(message: string, options: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => push({
    kind: 'confirm', message, resolve,
    confirmLabel: options.confirmLabel ?? 'تأیید',
    danger: options.danger ?? /حذف|غیرفعال|برداشته|جدا شود|پایان/.test(message),
  }));
}

export function appPrompt(message: string, defaultValue = ''): Promise<string | null> {
  return new Promise((resolve) => push({ kind: 'prompt', message, value: defaultValue, resolve }));
}

const DialogHost: React.FC = () => {
  const [, setTick] = useState(0);
  useEffect(() => {
    rerender = () => setTick((t) => t + 1);
    return () => { rerender = null; };
  }, []);
  const current = queue[0];
  if (!current) return null;
  return <Dialog key={queue.length + current.message} request={current} />;
};

const Dialog: React.FC<{ request: Request }> = ({ request }) => {
  const [value, setValue] = useState(request.kind === 'prompt' ? request.value : '');
  const okRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const finish = (ok: boolean) => {
    queue.shift();
    if (request.kind === 'alert') request.resolve();
    else if (request.kind === 'confirm') request.resolve(ok);
    else request.resolve(ok ? value : null);
    rerender?.();
  };

  useEffect(() => {
    (request.kind === 'prompt' ? inputRef.current : okRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const danger = request.kind === 'confirm' && request.danger;
  const okClass = danger
    ? 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-400'
    : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-400';
  return (
    <div dir="rtl" className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs" onMouseDown={(e) => { if (e.target === e.currentTarget && request.kind !== 'alert') finish(false); }}>
      <div role={request.kind === 'alert' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-label={request.message} data-app-dialog={request.kind}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
        <form onSubmit={(e) => { e.preventDefault(); finish(true); }}>
          <div className="p-5 space-y-3">
            <p className="text-sm leading-7 text-slate-800 dark:text-slate-100 whitespace-pre-line">{request.message}</p>
            {request.kind === 'prompt' && (
              <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40" />
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 rounded-b-2xl">
            {request.kind !== 'alert' && (
              <button type="button" onClick={() => finish(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">انصراف</button>
            )}
            <button ref={okRef} type="submit" className={`px-4 py-2 rounded-xl text-sm font-bold text-white focus:outline-hidden focus:ring-2 cursor-pointer ${okClass}`}>
              {request.kind === 'confirm' ? request.confirmLabel : request.kind === 'prompt' ? 'ذخیره' : 'متوجه شدم'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
