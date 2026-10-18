import { Component, type ReactNode } from "react";

/** Stops one broken part (for example the 3D background on a computer without WebGL) from blanking the whole app. */
export class ErrorBoundary extends Component<{ fallback: ReactNode; onError?(error: Error): void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error("[ErrorBoundary]", error);
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
