import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Search, FileQuestion, Compass, AlertTriangle } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-100/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden transform transition-all duration-500">
        <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500"></div>
        
        <div className="p-8 md:p-10 text-center">
          {/* 404 Icon */}
          <div className="relative mb-8">
            <div className="inline-flex items-center justify-center w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl shadow-lg transform transition-transform hover:scale-105">
              <FileQuestion className="text-white" size={64} />
            </div>
            <div className="absolute -top-2 -right-2 animate-bounce">
              <AlertTriangle className="text-yellow-500" size={24} />
            </div>
          </div>

          {/* 404 Text */}
          <h1 className="text-8xl font-bold bg-gradient-to-r from-gray-800 via-gray-700 to-gray-600 bg-clip-text text-transparent mb-4">
            404
          </h1>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            Page Not Found
          </h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Oops! The page you're looking for doesn't exist or has been moved.
          </p>

          {/* Search Suggestion */}
          <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
            <div className="flex items-center gap-3">
              <Search className="text-gray-400 flex-shrink-0" size={18} />
              <p className="text-sm text-gray-600">
                Try checking the URL or navigating back to the homepage.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-semibold group"
            >
              <Home size={18} className="group-hover:-translate-y-0.5 transition-transform" />
              Go to Dashboard
            </button>
            
            <button
              onClick={() => navigate(-1)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium group"
            >
              <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
              Go Back
            </button>
          </div>

          {/* Helpful Links */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-xs text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-1"
              >
                <Compass size={12} />
                Dashboard
              </button>
              <button
                onClick={() => navigate('/profile')}
                className="text-xs text-gray-500 hover:text-blue-600 transition-colors"
              >
                Profile
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="text-xs text-gray-500 hover:text-blue-600 transition-colors"
              >
                Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}