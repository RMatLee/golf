/**
 * Reusable React error boundary (class component — hooks cannot catch render errors).
 *
 * Wraps a subtree and catches any render-phase exceptions thrown by descendants.
 * On error, renders a dark-themed fallback card with a "Try again" reset button
 * instead of crashing the whole page. An optional `fallback` prop overrides the
 * default card if custom recovery UI is needed.
 *
 * Usage:
 *   <ErrorBoundary section="Charts">
 *     <RechartsComponent />
 *   </ErrorBoundary>
 *
 * The `section` prop is used both in the fallback heading and in the console error
 * prefix so errors can be quickly identified in logs: "[ErrorBoundary – Charts]".
 */
"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.section ? ` – ${this.props.section}` : ""}]`, error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#c9a84c] font-semibold">
            {this.props.section ?? "Error"}
          </p>
          <p className="text-base font-semibold text-white">Something went wrong</p>
          <p className="text-sm text-white/40 max-w-xs">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            onClick={this.reset}
            className="mt-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2 text-sm text-white hover:bg-white/10 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
