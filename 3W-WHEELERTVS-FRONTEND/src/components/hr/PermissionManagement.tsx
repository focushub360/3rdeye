import React, { useState, useEffect } from "react";
import {
  Clock,
  Plus,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  MapPin,
  ChevronRight,
  Filter,
  ChevronLeft,
  ChevronFirst,
  ChevronLast,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { apiClient } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { useNotification } from "../../context/NotificationContext";

const ITEMS_PER_PAGE = 10;

export default function PermissionManagement() {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const isAdmin = user?.role === "admin" || user?.role === "subadmin" || user?.role === "superadmin";
  const [activeTab, setActiveTab] = useState(isAdmin ? "all" : "my");

  const [myPermissions, setMyPermissions] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [selectedPermission, setSelectedPermission] = useState<any | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    permissionType: "short-leave",
    date: format(new Date(), "yyyy-MM-dd"),
    startTime: "09:00",
    endTime: "11:00",
    reason: "",
  });

  const getDurationInfo = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return { hours: 0, text: "0h", isValid: false };
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const totalStartMins = sh * 60 + sm;
    const totalEndMins = eh * 60 + em;
    const diffMins = totalEndMins - totalStartMins;
    if (diffMins <= 0) {
      return { hours: 0, text: "Invalid duration", isValid: false };
    }
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const text = hours > 0 && mins > 0 
      ? `${hours} hr ${mins} min` 
      : hours > 0 
        ? `${hours} hr${hours > 1 ? "s" : ""}` 
        : `${mins} mins`;
    return { hours: Number((diffMins / 60).toFixed(2)), text, isValid: true };
  };

  const applyTimePreset = (type: string) => {
    if (type === "1hr") {
      setFormData(prev => ({
        ...prev,
        startTime: "09:00",
        endTime: "10:00",
      }));
    } else if (type === "2hr") {
      setFormData(prev => ({
        ...prev,
        startTime: "09:00",
        endTime: "11:00",
      }));
    } else if (type === "afternoon") {
      setFormData(prev => ({
        ...prev,
        startTime: "14:00",
        endTime: "16:00",
      }));
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const res = await apiClient.getAllPermissions();
        if (res && Array.isArray(res)) setAllPermissions(res);
        else if (res?.data && Array.isArray(res.data)) setAllPermissions(res.data);
      }

      const myRes = await apiClient.getMyPermissions();
      if (myRes && Array.isArray(myRes)) setMyPermissions(myRes);
      else if (myRes?.data && Array.isArray(myRes.data)) setMyPermissions(myRes.data);
    } catch (error) {
      console.error("Failed to fetch permissions", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 30000);

    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const dur = getDurationInfo(formData.startTime, formData.endTime);
    if (!dur.isValid) {
      setFormError("End time must be after start time.");
      return;
    }

    if (!formData.reason.trim()) {
      setFormError("Please provide a reason for the permission request.");
      return;
    }

    setIsSubmitting(true);
    try {
      const baseDate = formData.date;
      const startDateTime = new Date(
        `${baseDate}T${formData.startTime}:00`,
      ).toISOString();
      const endDateTime = new Date(
        `${baseDate}T${formData.endTime}:00`,
      ).toISOString();

      await apiClient.applyPermission({
        ...formData,
        startTime: startDateTime,
        endTime: endDateTime,
        duration: dur.hours,
      });

      showSuccess("Permission request submitted successfully!");
      setShowApplyModal(false);
      fetchData();
      setFormData({
        permissionType: "short-leave",
        date: format(new Date(), "yyyy-MM-dd"),
        startTime: "09:00",
        endTime: "11:00",
        reason: "",
      });
    } catch (error: any) {
      const msg = error?.message || "Failed to submit permission request. Please try again.";
      setFormError(msg);
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

 const handleUpdateStatus = async (
 id: string,
 status:"approved" |"rejected",
 ) => {
 try {
 await apiClient.updatePermissionStatus(id, status);
 setStatusMessage({
 type:"success",
 text: `Permission ${status} successfully!`,
 });
 fetchData();
 } catch (error: any) {
 setStatusMessage({ type:"error", text:"Update failed" });
 }
 };

 const getStatusColor = (status: string) => {
 switch (status) {
 case"approved":
 return"bg-green-100 text-green-700 border-green-200";
 case"rejected":
 return"bg-red-100 text-red-700 border-red-200";
 default:
 return"bg-amber-100 text-amber-700 border-amber-200";
 }
 };

 const currentPermissions = activeTab === "all" ? allPermissions : myPermissions;
 const pendingCount = currentPermissions.filter((p) => p.status === "pending").length;
 const approvedCount = currentPermissions.filter((p) => p.status === "approved").length;
 const totalHours = currentPermissions
   .filter((p) => p.status === "approved")
   .reduce((acc, p) => acc + (p.duration || 0), 0)
   .toFixed(1);

 return (
 <div className="p-6 w-full font-sans">
 <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
 <div>
 <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
 Short Permission
 </h1>
 <p className="text-gray-500 mt-1">
 Request short leave, gate pass, or late arrival smoothly.
 </p>
 </div>

 <button
 onClick={() => {
   setFormError(null);
   setShowApplyModal(true);
 }}
 className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-700 to-indigo-700 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-800 hover:to-indigo-800 transition-all shadow-md shadow-blue-900/10 active:scale-95"
 >
 <Plus size={20} />
 Request Permission
 </button>
 </div>

 {/* Metric Summary Cards */}
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
   <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
     <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Requests</p>
     <p className="text-2xl font-black text-gray-900 dark:text-white mt-1">{currentPermissions.length}</p>
   </div>
   <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
     <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Pending</p>
     <p className="text-2xl font-black text-amber-600 mt-1">{pendingCount}</p>
   </div>
   <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
     <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Approved</p>
     <p className="text-2xl font-black text-green-600 mt-1">{approvedCount}</p>
   </div>
   <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
     <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Approved Hours</p>
     <p className="text-2xl font-black text-blue-600 mt-1">{totalHours}h</p>
   </div>
 </div>

 {/* Tabs */}
 <div className="flex bg-gray-100/70 dark:bg-gray-800 p-1 rounded-2xl mb-6 w-fit border border-gray-200/50 dark:border-gray-700">
 {isAdmin && (
 <button
 onClick={() => setActiveTab("all")}
 className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab ==="all" ?"bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-gray-700" :"text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
 >
 All Requests
 </button>
 )}
 <button
 onClick={() => setActiveTab("my")}
 className={`px-8 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab ==="my" ?"bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-gray-700" :"text-gray-500 hover:text-gray-700 dark:text-gray-400"}`}
 >
 My Requests
 </button>
 </div>

 {/* List */}
 <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
 {loading ? (
 <div className="p-20 text-center">
 <div className="w-12 h-12 border-4 border-blue-100 border-t-[#1e3a8a] rounded-full animate-spin mx-auto mb-4"></div>
 <p className="text-gray-400 font-medium">
 Loading permission records...
 </p>
 </div>
 ) : (
 <>
 {/* Desktop Table View */}
 <div className="hidden lg:block overflow-x-auto">
 <table className="w-full text-left">
 <thead>
 <tr className="bg-gray-50/50 border-b border-gray-100">
 <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">
 Type
 </th>
 {activeTab ==="all" && (
 <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">
 Employee
 </th>
 )}
 <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">
 Timing
 </th>
 <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">
 Status
 </th>
 {isAdmin && activeTab ==="all" && (
 <th className="px-6 py-5 text-xs font-bold text-gray-400 uppercase tracking-widest">
 Actions
 </th>
 )}
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-50">
 {(activeTab ==="all" ? allPermissions : myPermissions)
 .length === 0 ? (
 <tr>
 <td
 colSpan={isAdmin ? 5 : 4}
 className="px-6 py-20 text-center"
 >
 <div className="max-w-xs mx-auto">
 <Clock className="w-12 h-12 text-gray-100 mx-auto mb-4" />
 <p className="text-gray-400 font-bold mb-1">
 No requests found
 </p>
 <p className="text-gray-300 text-sm">
 Permission requests will appear here after submission.
 </p>
 </div>
 </td>
 </tr>
 ) : (
 (
 (activeTab ==="all" ? allPermissions : myPermissions) || []
 ).map((perm) => (
 <tr
 key={perm._id}
 className="hover:bg-gray-50/50 transition-colors group"
 >
 <td className="px-6 py-5">
 <div className="flex items-center gap-3">
 <div
 className={`p-2.5 rounded-xl ${perm.permissionType ==="short-leave" ?"bg-purple-50 text-purple-600" :"bg-amber-50 text-amber-600"}`}
 >
 <Clock size={18} />
 </div>
 <span className="font-bold text-gray-700 capitalize">
 {perm.permissionType.replace("-","")}
 </span>
 </div>
 </td>
 {activeTab ==="all" && (
 <td className="px-6 py-5">
 <div className="flex flex-col">
 <span className="font-bold text-gray-900">
 {perm.inspector?.firstName}{""}
 {perm.inspector?.lastName}
 </span>
 <span className="text-xs text-gray-400">
 {perm.inspector?.email}
 </span>
 </div>
 </td>
 )}
 <td className="px-6 py-5 text-sm font-medium text-gray-600">
 <div className="flex flex-col">
 <span className="font-bold text-gray-700">
 {format(new Date(perm.date),"MMM d, yyyy")}
 </span>
 <span className="text-xs text-blue-600 font-bold mt-1">
 {format(new Date(perm.startTime),"hh:mm a")} -{""}
 {format(new Date(perm.endTime),"hh:mm a")} (
 {perm.duration}h)
 </span>
 </div>
 </td>
 <td className="px-6 py-5">
 <span
 className={`px-4 py-1.5 rounded-full text-xs font-bold border ${getStatusColor(perm.status)}`}
 >
 {perm.status.toUpperCase()}
 </span>
 </td>
 {isAdmin && activeTab ==="all" && (
 <td className="px-6 py-5">
 {perm.status ==="pending" ? (
 <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
 <button
 onClick={() =>
 handleUpdateStatus(perm._id,"approved")
 }
 className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
 >
 <CheckCircle size={20} />
 </button>
 <button
 onClick={() =>
 handleUpdateStatus(perm._id,"rejected")
 }
 className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
 >
 <XCircle size={20} />
 </button>
 </div>
 ) : (
 <span className="text-xs text-gray-400 italic">
 Actioned
 </span>
 )}
 </td>
 )}
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>

 {/* Mobile Card View */}
 <div className="lg:hidden divide-y divide-gray-100">
 {(activeTab ==="all" ? allPermissions : myPermissions).length === 0 ? (
 <div className="px-6 py-20 text-center">
 <Clock className="w-12 h-12 text-gray-100 mx-auto mb-4" />
 <p className="text-gray-400 font-bold">No requests found</p>
 </div>
 ) : (
 (activeTab ==="all" ? allPermissions : myPermissions).map((perm) => (
 <div 
 key={perm._id} 
 className="p-5 space-y-4 hover:bg-gray-50/50 transition-colors cursor-pointer"
 onClick={() => {
 setSelectedPermission(perm);
 setShowDetailModal(true);
 }}
 >
 <div className="flex justify-between items-start">
 <div className="flex items-center gap-3">
 <div className={`p-2.5 rounded-xl ${perm.permissionType ==="short-leave" ?"bg-purple-100 text-purple-600" :"bg-amber-100 text-amber-600"}`}>
 <Clock size={18} />
 </div>
 <div>
 <span className="font-bold text-gray-900 capitalize block">
 {perm.permissionType.replace("-","")}
 </span>
 <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Type</span>
 </div>
 </div>
 <div className="flex flex-col items-end gap-1">
 <span className={`px-3 py-1 rounded-full text-[10px] font-bold border ${getStatusColor(perm.status)}`}>
 {perm.status.toUpperCase()}
 </span>
 <ChevronRight size={14} className="text-gray-300" />
 </div>
 </div>

 {activeTab ==="all" && (
 <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
 <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
 {perm.inspector?.firstName?.[0]}{perm.inspector?.lastName?.[0]}
 </div>
 <div>
 <p className="text-sm font-bold text-gray-900 dark:text-white">{perm.inspector?.firstName} {perm.inspector?.lastName}</p>
 <p className="text-[10px] text-gray-500">Employee</p>
 </div>
 </div>
 )}

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-1">
 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</p>
 <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{format(new Date(perm.date),"MMM d, yyyy")}</p>
 </div>
 <div className="space-y-1">
 <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Duration</p>
 <p className="text-xs text-blue-600 font-bold">
 {format(new Date(perm.startTime),"hh:mm a")} - {format(new Date(perm.endTime),"hh:mm a")}
 <span className="ml-1 text-gray-400 font-medium">({perm.duration}h)</span>
 </p>
 </div>
 </div>

 {perm.reason && (
 <div className="p-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-gray-100 dark:border-gray-700 italic text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
"{perm.reason}"
 </div>
 )}
 </div>
 ))
 )}
 </div>
 </>
 )}

 {/* Pagination */}
 {totalItems > ITEMS_PER_PAGE && (
 <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
 <div className="text-sm text-gray-500">
 Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{""}
 {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)} of{""}
 {totalItems}
 </div>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => setCurrentPage(1)}
 disabled={currentPage === 1}
 className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
 >
 <ChevronFirst size={18} />
 </button>
 <button
 type="button"
 onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
 disabled={currentPage === 1}
 className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
 >
 <ChevronLeft size={18} />
 </button>
 <span className="text-sm font-medium px-3">
 Page {currentPage}
 </span>
 <button
 type="button"
 onClick={() => setCurrentPage((p) => p + 1)}
 disabled={currentPage * ITEMS_PER_PAGE >= totalItems}
 className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
 >
 <ChevronRight size={18} />
 </button>
 <button
 type="button"
 onClick={() =>
 setCurrentPage(Math.ceil(totalItems / ITEMS_PER_PAGE))
 }
 disabled={currentPage * ITEMS_PER_PAGE >= totalItems}
 className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
 >
 <ChevronLast size={18} />
 </button>
 </div>
 </div>
 )}
 </div>

 {/* Detail Modal */}
 {showDetailModal && selectedPermission && (
 <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
 <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
 <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
 <div className="flex items-center gap-4">
 <div className={`p-3 rounded-2xl ${selectedPermission.permissionType ==="short-leave" ?"bg-purple-100 text-purple-600" :"bg-amber-100 text-amber-600"}`}>
 <Clock size={24} />
 </div>
 <div>
 <h3 className="text-lg font-black text-gray-900 dark:text-white capitalize">
 {selectedPermission.permissionType.replace("-","")}
 </h3>
 <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Permission Details</p>
 </div>
 </div>
 <button
 onClick={() => setShowDetailModal(false)}
 className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
 >
 <X size={24} className="text-gray-400" />
 </button>
 </div>

 <div className="p-6 space-y-6 overflow-y-auto no-scrollbar">
 {activeTab ==="all" && (
 <div className="flex items-center gap-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
 <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-lg">
 {selectedPermission.inspector?.firstName?.[0]}{selectedPermission.inspector?.lastName?.[0]}
 </div>
 <div>
 <p className="text-base font-black text-gray-900 dark:text-white">{selectedPermission.inspector?.firstName} {selectedPermission.inspector?.lastName}</p>
 <p className="text-xs text-gray-500 font-bold">{selectedPermission.inspector?.email}</p>
 </div>
 </div>
 )}

 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-1 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</p>
 <p className="text-sm font-black text-gray-900 dark:text-white">{format(new Date(selectedPermission.date),"MMMM d, yyyy")}</p>
 </div>
 <div className="space-y-1 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700">
 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</p>
 <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black border ${getStatusColor(selectedPermission.status)}`}>
 {selectedPermission.status.toUpperCase()}
 </span>
 </div>
 </div>

 <div className="p-4 bg-blue-50/30 dark:bg-blue-900/5 rounded-2xl border border-blue-50 dark:border-blue-900/20">
 <p className="text-[10px] font-black text-blue-400 dark:text-blue-500 uppercase tracking-widest mb-3">Time Window</p>
 <div className="flex items-center justify-between">
 <div className="text-center">
 <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">From</p>
 <p className="text-base font-black text-blue-600 dark:text-blue-400">{format(new Date(selectedPermission.startTime),"hh:mm a")}</p>
 </div>
 <div className="h-px flex-1 bg-blue-100 dark:bg-blue-900/30 mx-4 mt-4 relative">
 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 px-2 text-[10px] font-black text-blue-400">
 {selectedPermission.duration}h
 </div>
 </div>
 <div className="text-center">
 <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">To</p>
 <p className="text-base font-black text-blue-600 dark:text-blue-400">{format(new Date(selectedPermission.endTime),"hh:mm a")}</p>
 </div>
 </div>
 </div>

 {selectedPermission.reason && (
 <div className="space-y-2">
 <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Reason</p>
 <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-100 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
 {selectedPermission.reason}
 </div>
 </div>
 )}
 </div>

 <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
 {isAdmin && activeTab ==="all" && selectedPermission.status ==="pending" ? (
 <div className="flex gap-3">
 <button
 onClick={() => {
 handleUpdateStatus(selectedPermission._id,"rejected");
 setShowDetailModal(false);
 }}
 className="flex-1 py-4 bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-2xl font-black text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95"
 >
 Reject
 </button>
 <button
 onClick={() => {
 handleUpdateStatus(selectedPermission._id,"approved");
 setShowDetailModal(false);
 }}
 className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-black text-sm hover:bg-green-700 dark:shadow-none transition-all active:scale-95"
 >
 Approve
 </button>
 </div>
 ) : (
 <button
 onClick={() => setShowDetailModal(false)}
 className="w-full py-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-2xl font-black text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all active:scale-95"
 >
 Close
 </button>
 )}
 </div>
 </div>
 </div>
 )}

 {/* Apply Modal */}
 {showApplyModal && (
   <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
     <div
       className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
       onClick={() => !isSubmitting && setShowApplyModal(false)}
     />
     <div className="relative bg-white dark:bg-gray-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700 animate-in zoom-in-95 duration-200">
       {/* Header */}
       <div className="px-6 py-5 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex items-center justify-between">
         <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
             <Clock className="w-5 h-5 text-white" />
           </div>
           <div>
             <h2 className="text-xl font-bold tracking-tight">Request Permission</h2>
             <p className="text-xs text-blue-100 opacity-90">Short duration permission for today or upcoming dates</p>
           </div>
         </div>
         <button
           type="button"
           onClick={() => !isSubmitting && setShowApplyModal(false)}
           className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
           disabled={isSubmitting}
         >
           <X size={18} />
         </button>
       </div>

       <form onSubmit={handleApply} className="p-6 space-y-4">
         {formError && (
           <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
             <AlertCircle className="w-4 h-4 flex-shrink-0" />
             <span>{formError}</span>
           </div>
         )}

         {/* Permission Type */}
         <div>
           <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
             Permission Type
           </label>
           <select
             className="w-full bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm text-gray-800 dark:text-white font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all"
             value={formData.permissionType}
             onChange={(e) => setFormData({ ...formData, permissionType: e.target.value })}
           >
             <option value="short-leave">Short Leave (1-2 Hours)</option>
             <option value="half-day">Half Day</option>
             <option value="late-arrival">Late Arrival</option>
             <option value="early-departure">Early Departure</option>
             <option value="break-extension">Break Extension</option>
           </select>
         </div>

         {/* Date */}
         <div>
           <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
             Date
           </label>
           <input
             type="date"
             required
             className="w-full bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-white font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all"
             value={formData.date}
             onChange={(e) => setFormData({ ...formData, date: e.target.value })}
           />
         </div>

         {/* Time Range */}
         <div>
           <div className="flex items-center justify-between mb-2">
             <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
               Time Range
             </label>
             {/* Presets */}
             <div className="flex items-center gap-1.5">
               <button
                 type="button"
                 onClick={() => applyTimePreset("1hr")}
                 className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
               >
                 1 Hr
               </button>
               <button
                 type="button"
                 onClick={() => applyTimePreset("2hr")}
                 className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
               >
                 2 Hrs
               </button>
               <button
                 type="button"
                 onClick={() => applyTimePreset("afternoon")}
                 className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors"
               >
                 2-4 PM
               </button>
             </div>
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div>
               <span className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">Start Time</span>
               <input
                 type="time"
                 required
                 className="w-full bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-white font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all"
                 value={formData.startTime}
                 onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
               />
             </div>
             <div>
               <span className="block text-[11px] text-gray-500 dark:text-gray-400 mb-1">End Time</span>
               <input
                 type="time"
                 required
                 className="w-full bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl px-3.5 py-2.5 text-sm text-gray-800 dark:text-white font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all"
                 value={formData.endTime}
                 onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
               />
             </div>
           </div>
         </div>

         {/* Duration Live Indicator */}
         {(() => {
           const dur = getDurationInfo(formData.startTime, formData.endTime);
           return (
             <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
               dur.isValid 
                 ? "bg-blue-50/70 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/40"
                 : "bg-red-50/70 dark:bg-red-900/20 border-red-100 dark:border-red-800/40"
             }`}>
               <span className={`text-xs font-medium ${dur.isValid ? "text-blue-700 dark:text-blue-300" : "text-red-600 dark:text-red-400"}`}>
                 {dur.isValid ? "Calculated Duration:" : "Invalid Range:"}
               </span>
               <span className={`text-xs font-extrabold px-2.5 py-1 rounded-lg shadow-sm border ${
                 dur.isValid
                   ? "bg-white dark:bg-gray-800 text-blue-900 dark:text-blue-200 border-blue-200/50"
                   : "bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 border-red-200/50"
               }`}>
                 {dur.isValid ? dur.text : "End time must be after start"}
               </span>
             </div>
           );
         })()}

         {/* Reason */}
         <div>
           <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
             Reason <span className="text-red-500">*</span>
           </label>
           <textarea
             required
             rows={3}
             placeholder="Why do you need this permission?"
             className="w-full bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-3 text-sm text-gray-800 dark:text-white font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-all placeholder:text-gray-400"
             value={formData.reason}
             onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
           />
         </div>

         {/* Action Buttons */}
         <div className="flex gap-3 pt-2">
           <button
             type="button"
             disabled={isSubmitting}
             onClick={() => setShowApplyModal(false)}
             className="flex-1 py-3 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-all"
           >
             Cancel
           </button>
           <button
             type="submit"
             disabled={isSubmitting || !getDurationInfo(formData.startTime, formData.endTime).isValid}
             className="flex-1 py-3 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white font-bold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
           >
             {isSubmitting ? (
               <>
                 <Loader2 className="w-4 h-4 animate-spin" />
                 <span>Submitting...</span>
               </>
             ) : (
               <span>Submit Request</span>
             )}
           </button>
         </div>
       </form>
     </div>
   </div>
 )}
 </div>
 );
}
