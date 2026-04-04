import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ 
  size = 'md', 
  message = 'Loading...',
  fullScreen = false,
  variant = 'default' // 'default', 'overlay', 'inline'
}) {
  const sizes = {
    sm: { container: 'w-6 h-6', icon: 18, text: 'text-sm' },
    md: { container: 'w-12 h-12', icon: 24, text: 'text-base' },
    lg: { container: 'w-16 h-16', icon: 32, text: 'text-lg' }
  };

  const currentSize = sizes[size];
  
  const SpinnerContent = () => (
    <div className="flex flex-col items-center justify-center">
      <div className="relative">
        {/* Outer ring */}
        <div className={`${currentSize.container} rounded-full border-4 border-gray-200`}></div>
        
        {/* Animated spinner */}
        <div className={`${currentSize.container} rounded-full border-4 border-t-blue-600 border-r-purple-600 border-b-indigo-600 border-l-transparent animate-spin absolute top-0 left-0`}></div>
        
        {/* Center icon (optional) */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={currentSize.icon / 1.5} className="text-blue-500 animate-pulse" />
        </div>
      </div>
      
      {message && (
        <div className="mt-4 text-center">
          <p className={`font-medium bg-gradient-to-r from-gray-700 to-gray-600 bg-clip-text text-transparent ${currentSize.text}`}>
            {message}
          </p>
          <div className="mt-2 flex items-center justify-center gap-1">
            <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center z-50">
        <div className="relative">
          {/* Animated background circles */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 bg-blue-100 rounded-full blur-2xl animate-pulse"></div>
          </div>
          <SpinnerContent />
        </div>
      </div>
    );
  }

  if (variant === 'overlay') {
    return (
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        <SpinnerContent />
      </div>
    );
  }

  if (variant === 'inline') {
    return <SpinnerContent />;
  }

  return <SpinnerContent />;
}