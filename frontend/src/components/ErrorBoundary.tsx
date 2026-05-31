"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="card p-6 text-center space-y-3">
            <div className="text-2xl">⚠</div>
            <h3 className="text-sm font-semibold">Something went wrong</h3>
            <p className="text-xs text-[var(--text-secondary)]">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="text-xs px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]"
            >
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
