import { Component } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <main className="fatal-error"><AlertCircle size={36} /><h1>Something interrupted your workspace</h1><p>Your saved study material is still in this browser. Reload to try again.</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Reload StudyMark</button></main>;
    return this.props.children;
  }
}
