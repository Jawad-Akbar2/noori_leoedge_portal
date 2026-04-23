import React, { useRef, useState, useEffect } from "react";
import { User, Camera, Trash2, BadgeCheck, Eye } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

const getCurrentUserRole = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.role || localStorage.getItem("role") || "employee";
  } catch {
    return localStorage.getItem("role") || "employee";
  }
};

const ROLE_CONFIG = {
  owner: {
    label: "Owner",
    Icon: BadgeCheck,
    accent: "yellow",
    headerGrad: "from-yellow-700 to-yellow-500",
    avatarRing: "ring-yellow-400",
  },
  superadmin: {
    label: "Super Administrator",
    Icon: BadgeCheck,
    accent: "indigo",
    headerGrad: "from-indigo-700 to-indigo-500",
    avatarRing: "ring-indigo-400",
  },
  admin: {
    label: "Administrator",
    Icon: BadgeCheck,
    accent: "blue",
    headerGrad: "from-blue-700 to-blue-500",
    avatarRing: "ring-blue-400",
  },
  employee: {
    label: "Employee",
    Icon: BadgeCheck,
    accent: "emerald",
    headerGrad: "from-emerald-700 to-emerald-500",
    avatarRing: "ring-emerald-400",
  },
  hybrid: {
    label: "Hybrid Employee",
    Icon: BadgeCheck,
    accent: "purple",
    headerGrad: "from-purple-700 to-purple-500",
    avatarRing: "ring-purple-400",
  },
};

const ACCENT_CLASSES = {
  yellow: {
    headerGrad: "from-yellow-700 to-yellow-500",
    avatarRing: "ring-yellow-400",
  },
  indigo: {
    headerGrad: "from-indigo-700 to-indigo-500",
    avatarRing: "ring-indigo-400",
  },
  blue: {
    headerGrad: "from-blue-700 to-blue-500",
    avatarRing: "ring-blue-400",
  },
  emerald: {
    headerGrad: "from-emerald-700 to-emerald-500",
    avatarRing: "ring-emerald-400",
  },
  purple: {
    headerGrad: "from-purple-700 to-purple-500",
    avatarRing: "ring-purple-400",
  },
};

export default function ProfileHeader({
  employee,
  onProfileUpdate,
  mode = "view",
  onProfileDelete,
  profileBlobUrl,
  loadingProfilePic,
}) {
  const role = getCurrentUserRole();
  const config = ROLE_CONFIG[role] ?? ROLE_CONFIG.employee;
  const ac = ACCENT_CLASSES[config.accent] ?? ACCENT_CLASSES.emerald;
  const { Icon } = config;

 
  const picInputRef = useRef(null);

  const isEditable = mode === "edit";



  const handlePicFileSelect = async (e) => {
    if (!isEditable) return; // Prevent upload in view mode

    const file = e.target.files[0];
    if (!file) return;

    const validTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!validTypes.includes(file.type)) {
      toast.error("Please select a valid image (JPEG, PNG, GIF, or WebP)");
      return;
    }
    if (file.size > 500 * 1024) {
      toast.error("Image must be under 500 KB — resize it first");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      if (onProfileUpdate) {
        await onProfileUpdate(ev.target.result, file.type);
      }
    };
    reader.onerror = () => toast.error("Failed to read image");
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const fullName = employee
    ? `${employee.firstName || ""} ${employee.lastName || ""}`.trim()
    : "—";

  return (
    <div className={`w-full bg-gradient-to-br ${ac.headerGrad} text-white`}>
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 flex flex-col sm:flex-row items-center sm:items-end gap-6">
        {/* Left: text info */}
        <div className="flex-1 min-w-0 order-2 sm:order-1 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
            <Icon size={16} className="text-white/70 shrink-0" />
            <span className="text-sm font-medium text-white/70">
              {config.label}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight truncate">
            {fullName}
          </h1>
          <p className="text-white/80 text-sm mt-1 truncate">
            {employee?.email || "—"}
          </p>
          <div className="flex flex-wrap gap-3 mt-3 justify-center sm:justify-start">
            <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium">
              <BadgeCheck size={13} /> {employee?.employeeNumber || "—"}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium">
              {employee?.department || "—"}
            </span>
            {employee?.status && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                ${
                  employee.status === "Active"
                    ? "bg-green-400/30 text-green-100"
                    : employee.status === "Frozen"
                      ? "bg-blue-400/30 text-blue-100"
                      : "bg-gray-400/30 text-gray-100"
                }`}
              >
                {employee.status}
              </span>
            )}
          </div>
        </div>

        {/* Right: avatar */}
        <div className="order-1 sm:order-2 shrink-0">
          <div className="relative group">


            <input
              ref={picInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
              onChange={handlePicFileSelect}
              disabled={loadingProfilePic || !isEditable}
              className="hidden"
            />
            <div
              onClick={() =>
                isEditable && !loadingProfilePic && picInputRef.current.click()
              }
              className={`w-28 h-28 rounded-full ring-4 ${ac.avatarRing} ring-offset-2
                overflow-hidden bg-white/20 backdrop-blur-sm
                flex items-center justify-center transition relative
                ${!isEditable ? "cursor-default" : loadingProfilePic ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:ring-white"}`}
            >
              {loadingProfilePic && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full z-10">
                  <div className="w-7 h-7 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {profileBlobUrl ? (
                <>
                  <img
                    src={profileBlobUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                  {isEditable && !loadingProfilePic && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center">
                      <Camera
                        size={20}
                        className="text-white opacity-0 group-hover:opacity-100 transition"
                      />
                    </div>
                  )}
                </>
              ) : !loadingProfilePic ? (
                <>
                  <User size={40} className="text-white/70" />
                  {isEditable && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
                      <Camera
                        size={20}
                        className="text-white opacity-0 group-hover:opacity-100 transition"
                      />
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {profileBlobUrl && isEditable && !loadingProfilePic && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onProfileDelete) {
                    onProfileDelete(); // ✅ CALL PARENT
                  }
                }}
                className="absolute -bottom-1 -right-1 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg transition"
                title="Remove picture"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
          {isEditable ? (
            <p className="text-center text-[11px] text-white/50 mt-2">
              {loadingProfilePic
  ? "Processing image..."
  : `Click to ${profileBlobUrl ? "change" : "upload"} · max 500 KB`}
            </p>
          ) : (
            <p className="text-center text-[11px] text-white/50 mt-2">
              {profileBlobUrl ? "" : "No profile picture"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
