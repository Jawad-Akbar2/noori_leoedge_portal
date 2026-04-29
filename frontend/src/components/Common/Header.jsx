import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  LogOut, 
  User, 
  Bell, 
  Menu, 
  Settings, 
  HelpCircle, 
  ChevronDown,
  Shield,
  Briefcase,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Edit2
} from "lucide-react";
import { logout, getUser } from "../../services/auth";
import axios from "axios";
import toast from "react-hot-toast";
import { useAuthImage } from "../../hooks/useAuthImage";


export default function Header({ onMenuClick }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [profilePictureApiUrl, setProfilePictureApiUrl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const dropdownRef = useRef(null);
  const notificationRef = useRef(null);
const { blobUrl: profileBlobUrl } = useAuthImage(profilePictureApiUrl);


useEffect(() => {
  const token = localStorage.getItem("token");

  if (!token) {
    setProfilePictureApiUrl(null); // 🔥 clear old image
    return;
  }

  setProfilePictureApiUrl("/api/employees/me/profile-picture");
}, [user?.id]); // 👈 VERY IMPORTANT

  // Fetch notifications based on user role
  useEffect(() => {
    const fetchNotifications = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      setLoading(true);
      try {
        const role = user?.role;
        let endpoint = "";
        
        if (role === "admin" || role === "superadmin" || role === "owner") {
          endpoint = "/api/notifications/pending";
        } else {
          endpoint = "/api/notifications/my";
        }

        const { data } = await axios.get(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (data.success) {
          // Transform API data to notification format
          const formattedNotifications = [];
          
          if (role === "admin" || role === "superadmin" || role === "owner") {
            // Admin notifications - pending leave requests
            data.leaveRequests?.forEach(request => {
              formattedNotifications.push({
                id: `leave-${request._id}`,
                type: "leave",
                title: "Leave Request",
                message: `${request.empName || `Employee ${request.empId}`} requested leave from ${request.fromDateFormatted} to ${request.toDateFormatted}`,
                time: request.createdAtFormatted,
                read: false,
                data: request,
                status: "pending"
              });
            });
            
            // Admin notifications - pending correction requests
            data.correctionRequests?.forEach(request => {
              formattedNotifications.push({
                id: `correction-${request._id}`,
                type: "correction",
                title: "Attendance Correction",
                message: `${request.empName || `Employee ${request.empId}`} requested correction for ${request.dateFormatted}`,
                time: request.createdAtFormatted,
                read: false,
                data: request,
                status: "pending"
              });
            });
          } else {
            // Employee notifications - their own requests
            data.leaveRequests?.forEach(request => {
              let statusIcon = "";
              let statusColor = "";
              if (request.status === "Approved") {
                statusIcon = "✅";
                statusColor = "text-green-600";
              } else if (request.status === "Rejected") {
                statusIcon = "❌";
                statusColor = "text-red-600";
              } else {
                statusIcon = "⏳";
                statusColor = "text-yellow-600";
              }
              
              formattedNotifications.push({
                id: `leave-${request._id}`,
                type: "leave",
                title: `Leave Request ${request.status}`,
                message: `${statusIcon} Your leave from ${request.fromDateFormatted} to ${request.toDateFormatted} is ${request.status}`,
                time: request.createdAtFormatted,
                read: false,
                data: request,
                status: request.status.toLowerCase()
              });
            });
            
            data.correctionRequests?.forEach(request => {
              let statusIcon = "";
              let statusColor = "";
              if (request.status === "Approved") {
                statusIcon = "✅";
                statusColor = "text-green-600";
              } else if (request.status === "Rejected") {
                statusIcon = "❌";
                statusColor = "text-red-600";
              } else {
                statusIcon = "⏳";
                statusColor = "text-yellow-600";
              }
              
              formattedNotifications.push({
                id: `correction-${request._id}`,
                type: "correction",
                title: `Correction Request ${request.status}`,
                message: `${statusIcon} Your correction request for ${request.dateFormatted} is ${request.status}`,
                time: request.createdAtFormatted,
                read: false,
                data: request,
                status: request.status.toLowerCase()
              });
            });
          }
          
          // Sort by time (newest first)
          formattedNotifications.sort((a, b) => new Date(b.time) - new Date(a.time));
          setNotifications(formattedNotifications);
        }
      } catch (error) {
        console.error("Error fetching notifications:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.role) {
      fetchNotifications();
      // Poll every 30 seconds for new notifications
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user?.role]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    setShowDropdown(false);
    logout();
    toast.success("Logged out successfully");
    navigate("/", { replace: true });
    window.location.reload();
  };

  const handleProfile = () => {
    const role = user?.role;
    if (role === "admin" || role === "superadmin" || role === "owner") {
      navigate("/admin/profile");
    } else if (role === "hybrid") {
      navigate("/hybrid/profile");
    } else {
      navigate("/employee/profile");
    }
    setShowDropdown(false);
  };

  const handleApprove = async (notification) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setProcessingId(notification.id);
    try {
      let endpoint = "";
      if (notification.type === "leave") {
        endpoint = `/api/notifications/leave/${notification.data._id}/approve`;
      } else {
        endpoint = `/api/notifications/correction/${notification.data._id}/approve`;
      }

      const { data } = await axios.post(endpoint, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        toast.success(`${notification.type === "leave" ? "Leave" : "Correction"} request approved`);
        // Remove from notifications list
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to approve request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (notification) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const reason = prompt("Please enter rejection reason:");
    if (!reason) return;

    setProcessingId(notification.id);
    try {
      let endpoint = "";
      if (notification.type === "leave") {
        endpoint = `/api/notifications/leave/${notification.data._id}/reject`;
      } else {
        endpoint = `/api/notifications/correction/${notification.data._id}/reject`;
      }

      const { data } = await axios.post(endpoint, { reason }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (data.success) {
        toast.success(`${notification.type === "leave" ? "Leave" : "Correction"} request rejected`);
        // Remove from notifications list
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to reject request");
    } finally {
      setProcessingId(null);
    }
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes("dashboard")) return "Dashboard";
    if (path.includes("attendance")) return "Attendance";
    if (path.includes("salary") || path.includes("payroll")) return "Payroll";
    if (path.includes("employees")) return "Employees";
    if (path.includes("requests")) return "Requests";
    if (path.includes("profile")) return "Profile";
    if (path.includes("notifications")) return "Notifications";
    return "Portal";
  };

  const getRoleIcon = () => {
    const role = user?.role;
    if (role === "admin" || role === "superadmin" || role === "owner") {
      return <Shield size={18} className="text-purple-600" />;
    } else if (role === "hybrid") {
      return <Users size={18} className="text-indigo-600" />;
    }
    return <Briefcase size={18} className="text-blue-600" />;
  };

  const getRoleBadgeColor = () => {
    const role = user?.role;
    if (role === "admin" || role === "superadmin" || role === "owner") {
      return "bg-purple-100 text-purple-700";
    } else if (role === "hybrid") {
      return "bg-indigo-100 text-indigo-700";
    }
    return "bg-blue-100 text-blue-700";
  };

  const getNotificationIcon = (type, status) => {
    if (status === "approved") return <CheckCircle size={16} className="text-green-500" />;
    if (status === "rejected") return <XCircle size={16} className="text-red-500" />;
    if (type === "leave") return <Calendar size={16} className="text-blue-500" />;
    return <Edit2 size={16} className="text-orange-500" />;
  };

  const unreadCount = notifications.filter(n => !n.read && n.status === "pending").length;

  const initials = `${user?.firstName?.charAt(0) ?? ""}${user?.lastName?.charAt(0) ?? ""}`.toUpperCase();

  const Avatar = ({ size = "w-8 h-8", textSize = "text-xs", showStatus = false }) => (
    <div className="relative">
      {profileBlobUrl ? (
  <img src={profileBlobUrl}
          alt="Profile"
          className={`${size} rounded-full object-cover ring-2 ring-white shadow-sm shrink-0`}
        />
      ) : (
        <div
          className={`${size} bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold ${textSize} select-none shrink-0 shadow-sm`}
        >
          {initials || "?"}
        </div>
      )}
      {showStatus && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>
      )}
    </div>
  );

  const isAdmin = user?.role === "admin" || user?.role === "superadmin" || user?.role === "owner";

  return (
    <header className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-200/80 shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 md:px-6">
        
        {/* Left Section - Menu & Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
            aria-label="Toggle menu"
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb / Page Title */}
          <div className="hidden md:block">
            <div className="flex items-center gap-2">
              {getRoleIcon()}
              <h1 className="text-xl font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                {getPageTitle()}
              </h1>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Welcome back, {user?.firstName} {user?.lastName}
            </p>
          </div>
        </div>

        {/* Center - Brand Logo (Mobile) */}
        <div className="md:hidden">
          <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            NOORI HR
          </h1>
        </div>

        {/* Right Section - Actions */}
        <div className="flex items-center gap-1 md:gap-2">
          
          {/* Notifications */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowDropdown(false);
              }}
              className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all duration-200"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-xl z-50 border border-gray-200 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">
                      Notifications
                      {notifications.length > 0 && (
                        <span className="ml-2 text-xs text-gray-500">({notifications.length})</span>
                      )}
                    </h3>
                    {isAdmin && notifications.length > 0 && (
                      <button 
                        onClick={() => {
                          // Optional: Mark all as read functionality
                          toast.success("All notifications marked as read");
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="max-h-96 overflow-y-auto">
                  {loading ? (
                    <div className="px-4 py-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600"></div>
                      <p className="text-sm text-gray-500 mt-2">Loading notifications...</p>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <Bell size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">No notifications</p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition ${
                          !notif.read ? "bg-blue-50/30" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {getNotificationIcon(notif.type, notif.status)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-medium text-gray-900">{notif.title}</p>
                              <span className="text-xs text-gray-400">{notif.time}</span>
                            </div>
                            <p className="text-xs text-gray-600">{notif.message}</p>
                            
                            {/* Action buttons for admin pending requests */}
                            {isAdmin && notif.status === "pending" && (
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleApprove(notif)}
                                  disabled={processingId === notif.id}
                                  className="px-2 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                                >
                                  {processingId === notif.id ? "Processing..." : "Approve"}
                                </button>
                                <button
                                  onClick={() => handleReject(notif)}
                                  disabled={processingId === notif.id}
                                  className="px-2 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {!loading && notifications.length > 0 && (
                  <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                    <button 
                      onClick={() => {
                        if (isAdmin) {
                          navigate("/admin/notifications");
                        } else {
                          navigate("/employee/requests");
                        }
                        setShowNotifications(false);
                      }}
                      className="w-full text-center text-xs text-gray-600 hover:text-gray-900 font-medium py-1"
                    >
                      {isAdmin ? "View all requests" : "View my requests"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => {
                setShowDropdown(!showDropdown);
                setShowNotifications(false);
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition-all duration-200 group"
            >
              <Avatar showStatus={true} />
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold text-gray-800">
                  {user?.firstName} {user?.lastName}
                </p>
                <div className="flex items-center gap-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${getRoleBadgeColor()}`}>
                    {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
                  </span>
                  <ChevronDown size={14} className="text-gray-400 group-hover:text-gray-600 transition" />
                </div>
              </div>
              <ChevronDown size={16} className="text-gray-400 md:hidden group-hover:text-gray-600 transition" />
            </button>

            {/* User Dropdown Menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl z-50 border border-gray-200 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                {/* User Info Header */}
                <div className="px-4 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
                  <div className="flex items-center gap-3">
                    <Avatar size="w-12 h-12" textSize="text-base" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">
                        {user?.firstName} {user?.lastName}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {user?.email}
                      </p>
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1.5 ${getRoleBadgeColor()}`}>
                        {user?.role?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="py-2">
                  <button
                    onClick={handleProfile}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50 transition text-sm"
                  >
                    <User size={16} className="text-gray-400" />
                    <span>My Profile</span>
                  </button>
                </div>

                {/* Logout */}
                <div className="border-t border-gray-100 py-2">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-red-600 hover:bg-red-50 transition text-sm"
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-in {
          animation: slideIn 0.2s ease-out;
        }
      `}</style>
    </header>
  );
}