import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Fix #10: Global error boundary.
 * Catches any unhandled errors (including thrown Firestore errors) so the app
 * never shows a blank white screen. Displays a friendly recovery UI instead.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const msg = this.state.error?.message || 'Unknown error';
      let friendlyMsg = msg;
      try {
        const parsed = JSON.parse(msg) as { error?: string };
        if (parsed?.error) friendlyMsg = parsed.error;
      } catch {
        /* not JSON */
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-surface-container border border-error/30 rounded-3xl p-8 text-center space-y-6 shadow-[0_0_40px_rgba(239,68,68,0.1)]">
            <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={32} className="text-error" />
            </div>
            <div>
              <h2 className="text-2xl font-headline font-bold text-on-surface mb-2">
                Something went wrong
              </h2>
              <p className="text-sm text-on-surface-variant font-mono bg-surface-variant rounded-xl px-4 py-3 text-left break-all">
                {friendlyMsg}
              </p>
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="flex items-center gap-2 mx-auto bg-primary text-on-primary font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
            >
              <RefreshCw size={18} />
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
