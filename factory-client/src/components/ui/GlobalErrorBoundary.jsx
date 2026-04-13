import React from 'react';

export class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can log error info here if needed
    if (import.meta.env.DEV) {
      console.error('GlobalErrorBoundary caught:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ background: '#1a1a1a', color: '#ff5555', padding: 32, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <h1 style={{ fontSize: 32, marginBottom: 16 }}>Something went wrong</h1>
          <pre style={{ background: '#222', color: '#ffb3b3', padding: 16, borderRadius: 8, maxWidth: 600, overflowX: 'auto' }}>{this.state.error?.toString()}</pre>
          <button style={{ marginTop: 24, padding: '8px 24px', fontSize: 16, borderRadius: 6, background: '#333', color: '#fff', border: 'none', cursor: 'pointer' }} onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
