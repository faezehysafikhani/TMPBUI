import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  /** Shown above the retry button, e.g. "خطا در نمایش گفتگو". */
  title: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches a render-time crash in its subtree so the rest of the app stays usable - the
 * standard React mechanism, not a parallel error-handling system. A network or API failure
 * already shows its own inline message and never reaches here; this is only for something
 * unexpected throwing during render. "تلاش مجدد" remounts the subtree from scratch.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // This project ships no React type declarations (no @types/react), so plain `extends
  // React.Component<P, S>` resolves to an untyped base with no inherited members - these
  // `declare` fields (erased, no runtime code) tell TypeScript about the two the real,
  // untyped React.Component already provides at runtime.
  declare props: ErrorBoundaryProps;
  declare setState: (state: Partial<ErrorBoundaryState>) => void;

  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`${this.props.title}:`, error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="bg-white dark:bg-slate-800/90 rounded-3xl p-8 text-center border border-slate-200 dark:border-slate-700 shadow-sm my-auto space-y-3">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{this.props.title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            مشکلی در نمایش این بخش پیش آمد. می‌توانید دوباره تلاش کنید یا بخش دیگری را انتخاب نمایید.
          </p>
          <button
            type="button"
            onClick={this.reset}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>تلاش مجدد</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
