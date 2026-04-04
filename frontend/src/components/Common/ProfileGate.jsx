import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useProfileComplete } from "../../hooks/useProfileComplete";
import { 
  AlertTriangle, 
  ArrowRight, 
  User, 
  XCircle, 
  CheckCircle,
  AlertCircle,
  Shield,
  Clock
} from "lucide-react";
import LoadingSpinner from "./LoadingSpinner";

export default function ProfileGate({ children, profilePath = "/employee/profile" }) {
  const { complete, missing, loading } = useProfileComplete();
  const navigate = useNavigate();
  const location = useLocation();
  const [isClosing, setIsClosing] = useState(false);

  // Never block the profile page itself
  const isOnProfilePage = location.pathname === profilePath ||
                          location.pathname.endsWith("/profile");

  const showModal = !loading && !complete && !isOnProfilePage;

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => setIsClosing(false), 300);
  };

  if (loading) {
    return (
      <div className="relative">
        <div className="opacity-50 pointer-events-none blur-sm">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner size="md" message="Checking profile..." variant="overlay" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Children with blur effect when modal is shown */}
      <div className={showModal ? "filter blur-sm pointer-events-none select-none" : ""}>
        {children}
      </div>

      {/* Blocking modal overlay */}
      {showModal && (
        <div 
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
            isClosing ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={handleClose}
        >
          <div 
            className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden transform transition-all duration-300 animate-in slide-in-from-bottom-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Gradient header */}
            <div className="h-1 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500"></div>
            
            <div className="p-8">
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-red-100 rounded-2xl flex items-center justify-center transform transition-transform hover:scale-105">
                    <User size={48} className="text-orange-500" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center shadow-lg animate-pulse">
                    <AlertTriangle size={16} className="text-white" />
                  </div>
                </div>
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-center bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">
                Complete Your Profile
              </h2>
              <p className="text-center text-gray-500 text-sm mb-6">
                A few details are needed before you can access the system
              </p>

              {/* Missing fields count badge */}
              <div className="flex justify-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-50 rounded-full border border-orange-200">
                  <AlertCircle size={14} className="text-orange-500" />
                  <span className="text-xs font-medium text-orange-700">
                    {missing.length} {missing.length === 1 ? 'field' : 'fields'} remaining
                  </span>
                </div>
              </div>

              {/* Missing fields list */}
              <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-5 mb-6 border border-orange-200">
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Shield size={12} />
                  Required Information
                </p>
                <ul className="space-y-2.5">
                  {missing.map((item, index) => (
                    <li 
                      key={item} 
                      className="flex items-center gap-3 text-sm text-gray-700 animate-in slide-in-from-left"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="w-5 h-5 rounded-full bg-orange-200 flex items-center justify-center flex-shrink-0">
                        <XCircle size={12} className="text-orange-600" />
                      </div>
                      <span className="flex-1">{item}</span>
                      <Clock size={12} className="text-gray-400" />
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => navigate(profilePath)}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3
                    bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 
                    text-white rounded-xl font-semibold text-sm transition-all duration-200 
                    shadow-lg shadow-blue-500/25 group"
                >
                  <span>Complete Profile Now</span>
                  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
                
                {/* <button
                  onClick={handleClose}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3
                    bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm
                    transition-all duration-200"
                >
                  <span>I'll do it later</span>
                </button> */}
              </div>

              {/* Note */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                  <Shield size={12} />
                  <span>Your information is securely stored</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}