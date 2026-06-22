import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '100vh',
                    backgroundColor: 'var(--bg-color)',
                    color: 'var(--text-active)',
                    padding: '20px',
                    textAlign: 'center'
                }}>
                    <AlertTriangle size={64} color="#ff3b30" style={{ marginBottom: '20px' }} />
                    <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>Oops, something went wrong</h1>
                    <p style={{ color: 'var(--text-inactive)', marginBottom: '30px', maxWidth: '400px' }}>
                        {this.state.error?.message || "An unexpected error occurred."}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: '#f5a524',
                            color: 'var(--text-active)',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '24px',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        <RefreshCw size={18} />
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
