import React from 'react';
import { AlertCircle, RotateCcw, Home, Bug, Shield, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo);
    this.setState({ errorInfo });
    
    // Optional: Send error to logging service
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const isDev = process.env.NODE_ENV === 'development';
      
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 via-red-100 to-orange-100 flex items-center justify-center p-4 relative overflow-hidden">
          {/* Animated background */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-red-200/30 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-200/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
          </div>

          <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden transform transition-all duration-500">
            <div className="h-1 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500"></div>
            
            <div className="p-8 md:p-10">
              {/* Error Icon */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-lg mb-5 transform transition-transform hover:scale-105">
                  <Bug className="text-white" size={48} />
                </div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">
                  Something Went Wrong
                </h1>
                <p className="text-gray-500 text-sm">
                  An unexpected error has occurred
                </p>
              </div>

              {/* Error Message */}
              <div className="bg-red-50 rounded-xl p-4 mb-6 border border-red-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 mb-1">
                      Error Details:
                    </p>
                    <p className="text-sm text-red-700 font-mono break-all">
                      {this.state.error?.message || 'An unexpected error occurred'}
                    </p>
                    {isDev && this.state.errorInfo && (
                      <details className="mt-3">
                        <summary className="text-xs text-red-600 cursor-pointer hover:text-red-700">
                          Component Stack Trace
                        </summary>
                        <pre className="mt-2 text-xs text-red-600 overflow-auto p-2 bg-red-100 rounded">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={this.handleReload}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold group"
                >
                  <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                  Reload Page
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium group"
                >
                  <Home size={18} className="group-hover:-translate-x-1 transition-transform" />
                  Go to Homepage
                </button>

                {this.props.onReset && (
                  <button
                    onClick={this.handleReset}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 font-medium"
                  >
                    <RotateCcw size={18} />
                    Try Again
                  </button>
                )}
              </div>

              {/* Support Message */}
              <div className="mt-6 pt-4 border-t border-gray-100 text-center">
                <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                  <Shield size={12} />
                  <span>If the problem persists, please contact support</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;