import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 bg-red-50 text-red-900 h-screen overflow-auto">
                    <h1 className="text-2xl font-bold mb-4">Something went wrong.</h1>
                    <div className="mb-4">
                        <h2 className="font-bold">Error:</h2>
                        <pre className="bg-red-100 p-4 rounded text-sm overflow-auto">
                            {this.state.error && this.state.error.toString()}
                        </pre>
                    </div>
                    <div>
                        <h2 className="font-bold">Component Stack:</h2>
                        <pre className="bg-red-100 p-4 rounded text-sm overflow-auto">
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
