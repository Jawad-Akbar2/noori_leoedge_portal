import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useProfileComplete } from "../../hooks/useProfileComplete";
import { AlertTriangle, ArrowRight, User } from "lucide-react";

export default function ProfileGate({ children, profilePath = "/employee/profile" }) {
  const { complete, missing, loading } = useProfileComplete();
  const navigate = useNavigate();
  const location = useLocation();

  // Never block the profile page itself
  const isOnProfilePage = location.pathname === profilePath ||
                          location.pathname.endsWith("/profile");

  const showModal = !loading && !complete && !isOnProfilePage;

  return (
    <div className="relative">
      {/* Always render children — profile page works, other pages are dimmed */}
      {children}

      {/* Blocking modal overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ backdropFilter: "blur(4px)", backgroundColor: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-2xl border border-orange-100 max-w-md w-full p-8 text-center animate-in">

            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div className="relative">
                <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center">
                  <User size={36} className="text-orange-400" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-orange-500 rounded-full
                                flex items-center justify-center shadow">
                  <AlertTriangle size={14} className="text-white" />
                </div>
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-800 mb-2">
              Complete Your Profile First
            </h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              A few details are needed before you can use the system.
              This ensures your payroll and records are accurate.
            </p>

            {/* Missing fields */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-3">
                Still required ({missing.length}):
              </p>
              <ul className="space-y-2">
                {missing.map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-orange-800">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => navigate(profilePath)}
              className="w-full flex items-center justify-center gap-2 px-5 py-3
                bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl
                font-semibold text-sm transition shadow-sm"
            >
              Complete My Profile
              <ArrowRight size={16} />
            </button>

            <p className="text-xs text-gray-400 mt-4">
              You'll have full access as soon as all fields are filled in.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}