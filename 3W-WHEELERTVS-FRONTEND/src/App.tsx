import React, { useMemo } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
  useLocation,
  useParams,
} from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import {
  AttendanceProvider,
  useAttendanceStatus,
} from "./context/AttendanceContext";
import { useActivityTracker } from "./hooks/useActivityTracker";
import { LAYOUT_CONFIG } from "./config/layoutConfig";





import { FormWithFollowUpCreator } from "./components/forms/FormWithFollowUpCreator";



























import LoginPage from "./components/auth/LoginPage";
import SignupPage from "./components/auth/SignupPage";


import NotificationContainer from "./components/ui/NotificationContainer";
import Header from "./components/Header";
import Sidebar from "./components/layout/Sidebar";

const FormsPreview = React.lazy(() => import('./components/FormsPreview'));
const TestAPI = React.lazy(() => import('./components/TestAPI'));
const ResponseForm = React.lazy(() => import('./components/ResponseForm'));
const FollowUpFormDemo = React.lazy(() => import('./components/forms/FollowUpFormDemo'));
const FollowUpFormManager = React.lazy(() => import('./components/forms/FollowUpFormManager'));
const FormWithFollowUpResponderWrapper = React.lazy(() => import('./components/forms/FormWithFollowUpResponderWrapper'));
const FormsAnalytics = React.lazy(() => import('./components/analytics/FormsAnalytics'));
const FormAnalyticsDashboard = React.lazy(() => import('./components/analytics/FormAnalyticsDashboard'));
const FormsManagementNew = React.lazy(() => import('./components/FormsManagementNew'));
const Management = React.lazy(() => import('./components/management/Management'));
const MailTest = React.lazy(() => import('./components/MailTest'));
const WhatsAppTest = React.lazy(() => import('./components/WhatsAppTest'));
const FormsList = React.lazy(() => import('./components/FormsList'));
const FormCreator = React.lazy(() => import('./components/FormCreator'));
const PreviewFormWrapper = React.lazy(() => import('./components/PreviewFormWrapper'));
const FormResponses = React.lazy(() => import('./components/FormResponses'));
const FormUploadsView = React.lazy(() => import('./components/analytics/FormUploadsView'));
const AllResponses = React.lazy(() => import('./components/AllResponses'));
const EditResponsePage = React.lazy(() => import('./components/EditResponsePage'));
const EditResponseFormPage = React.lazy(() => import('./pages/EditResponseFormPage'));
const DashboardNew = React.lazy(() => import('./components/DashboardNew'));
const Overall = React.lazy(() => import('./components/Overall'));
const TenantManagement = React.lazy(() => import('./components/superadmin/TenantManagement'));
const GlobalFormManagement = React.lazy(() => import('./components/superadmin/GlobalFormManagement'));
const AdminManagement = React.lazy(() => import('./components/admin/AdminManagement'));
const UserActivityLogs = React.lazy(() => import('./components/admin/UserActivityLogs'));
const Attendance = React.lazy(() => import('./components/admin/Attendance'));
const HRAttendance = React.lazy(() => import('./components/admin/HRAttendance'));
const ShiftManagement = React.lazy(() => import('./components/admin/ShiftManagement'));
const AttendanceAnalytics = React.lazy(() => import('./components/analytics/AttendanceAnalytics'));
const AttendanceDashboard = React.lazy(() => import('./components/inspectors/AttendanceDashboard'));
const GuestAnalyticsLogin = React.lazy(() => import('./components/auth/GuestAnalyticsLogin'));
const FreeTrialManagement = React.lazy(() => import('./components/superadmin/FreeTrialManagement'));
const ResponseDetailsPage = React.lazy(() => import('./components/ResponseDetailsPage'));
const InviteStatusPage = React.lazy(() => import('./components/InviteStatusPage'));
const ErrorPage = React.lazy(() => import('./components/ErrorPage'));
const LeaveManagement = React.lazy(() => import('./components/hr/LeaveManagement'));
const PermissionManagement = React.lazy(() => import('./components/hr/PermissionManagement'));
const InspectorChat = React.lazy(() => import('./components/inspectors/InspectorChat'));
const InternalTracking = React.lazy(() => import('./pages/InternalTracking'));








const ROUTE_PERMISSIONS = {
  DASHBOARD: "dashboard:view",
  ANALYTICS: "analytics:view",
  CUSTOMER_REQUESTS: "requests:view",
  REQUEST_MANAGEMENT: "requests:manage",
} as const;

// Leaf keys as actually stored in User.permissions by the tree in
// src/config/permissionTree.ts. The tree NEVER grants a parent key like
// "requests:view" or "analytics:view" directly — only child leaves like
// "requests:response" or "analytics:form:<id>:response". Any route/UI check
// that only looks for the parent key will always fail for tree-granted
// permissions, which is what was happening here.
const TREE_PERMISSIONS = {
  ADMIN_MANAGEMENT: "admin:manage",
  CHAT: "chat",
  ACTIVITY_LOGS: "attendance:activityLogs",
  ATTENDANCE_RECORD: [
    "attendance:record:report",
    "attendance:record:response",
    "attendance:record:calendar",
    "attendance:record:summary",
  ],
  REQUESTS: ["requests:dashboard", "requests:response"],
  HR_LEAVES: "hr:leaves",
  HR_PERMISSION: "hr:permission",
  HR_SHIFTS: "hr:shifts",
  HR_REPORTS: "hr:reports",
} as const;

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // If user is a guest (guest token exists), and trying to access any private route
  // (Note: analytics route uses FlexibleAnalyticsRoute, not PrivateRoute directly)
  const isGuest = !!localStorage.getItem("guest_auth_token");

  if (isGuest && !isAuthenticated) {
    const guestFormId = localStorage.getItem("guest_form_id");
    return (
      <Navigate to={`/forms/${guestFormId}/analytics?guest=true`} replace />
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  useActivityTracker(isAuthenticated);

  const isGuest = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return (
      searchParams.get("guest") === "true" ||
      !!localStorage.getItem("guest_auth_token")
    );
  }, [location.search]);

  return (
    <div
      className="min-h-screen bg-white dark:bg-gray-950"
      style={{ zoom: LAYOUT_CONFIG.zoomScale }}
    >
      {!isGuest && <Header />}
      <main className={`${isGuest ? "" : "pt-16"} transition-all duration-300`}>
        <div className={isGuest ? "" : "p-4 sm:p-6"}>{children}</div>
      </main>
    </div>
  );
}

function AccessControl({
  children,
  allowedRoles,
  requiredPermission,
  requiredAnyPermission,
  permissionCheckRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: string[];
  requiredPermission?: string;
  /** Passes if the user has AT LEAST ONE of these leaf permissions. */
  requiredAnyPermission?: string[];
  /**
   * Restricts requiredPermission/requiredAnyPermission checks to only these
   * roles (e.g. ["subadmin"]) so routes shared with self-service roles
   * (inspector applying for their own leave, etc.) aren't affected.
   */
  permissionCheckRoles?: string[];
}) {
  const { user } = useAuth();
  const { isCheckedIn, loading: attendanceLoading } = useAttendanceStatus();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  if (
    requiredPermission === ROUTE_PERMISSIONS.ANALYTICS &&
    user.role === "inspector"
  ) {
    if (attendanceLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      );
    }
    if (!isCheckedIn) {
      return <Navigate to="/attendance-dashboard" replace />;
    }
  }

  const subjectToPermissionCheck =
    !permissionCheckRoles || permissionCheckRoles.includes(user.role);

  if (
    requiredPermission &&
    user.role !== "admin" &&
    user.role !== "superadmin" &&
    subjectToPermissionCheck
  ) {
    const permissionSet = new Set(user.permissions || []);

    // Special handling for analytics permissions: the tree only ever grants
    // "analytics:form:<id>:<tab>" leaves, never the parent "analytics:view".
    if (requiredPermission === ROUTE_PERMISSIONS.ANALYTICS) {
      const hasAnalyticsPermission =
        permissionSet.has("analytics:view") ||
        Array.from(permissionSet).some((permission) =>
          permission.startsWith("analytics:form:"),
        );
      if (!hasAnalyticsPermission) {
        return <Navigate to="/login" replace />;
      }
    } else if (requiredPermission === ROUTE_PERMISSIONS.CUSTOMER_REQUESTS) {
      // Same problem: the tree only grants "requests:dashboard" /
      // "requests:response", never the parent "requests:view".
      const hasRequestsPermission =
        permissionSet.has("requests:view") ||
        TREE_PERMISSIONS.REQUESTS.some((permission) =>
          permissionSet.has(permission),
        );
      if (!hasRequestsPermission) {
        return <Navigate to="/login" replace />;
      }
    } else if (!permissionSet.has(requiredPermission)) {
      return <Navigate to="/login" replace />;
    }
  }

  if (
    requiredAnyPermission &&
    requiredAnyPermission.length > 0 &&
    user.role !== "admin" &&
    user.role !== "superadmin" &&
    subjectToPermissionCheck
  ) {
    const permissionSet = new Set(user.permissions || []);
    if (!requiredAnyPermission.some((p) => permissionSet.has(p))) {
      return <Navigate to="/login" replace />;
    }
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Default landing pages by role
  if (user?.role === "inspector") {
    return <Navigate to="/attendance-dashboard" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

function RootShell() {
  return (
    <AttendanceProvider>
      <NotificationContainer />
      <React.Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>}><Outlet /></React.Suspense>
    </AttendanceProvider>
  );
}

const withAuthenticatedLayout = (node: React.ReactNode) => (
  <PrivateRoute>
    <AuthenticatedLayout>{node}</AuthenticatedLayout>
  </PrivateRoute>
);

const withAccessControl = (
  node: React.ReactNode,
  options?: {
    allowedRoles?: string[];
    requiredPermission?: string;
    requiredAnyPermission?: string[];
    permissionCheckRoles?: string[];
  },
) =>
  withAuthenticatedLayout(<AccessControl {...options}>{node}</AccessControl>);

function FlexibleAnalyticsRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const { id } = useParams();
  const guestToken = localStorage.getItem("guest_auth_token");
  const guestFormId = localStorage.getItem("guest_form_id");

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  if (guestToken) {
    // If it's a guest, they can ONLY access their assigned form analytics
    if (id === guestFormId) {
      return <>{children}</>;
    }
    // Otherwise redirect to their assigned analytics page
    return (
      <Navigate to={`/forms/${guestFormId}/analytics?guest=true`} replace />
    );
  }

  return <Navigate to="/login" replace />;
}

const withFlexibleAnalytics = (node: React.ReactNode) => (
  <FlexibleAnalyticsRoute>
    <AuthenticatedLayout>{node}</AuthenticatedLayout>
  </FlexibleAnalyticsRoute>
);

const router = createBrowserRouter(
  [
    {
      element: <RootShell />,
      errorElement: <ErrorPage />,
      children: [
        { path: "/login", element: <LoginPage /> },
        { path: "/signup", element: <SignupPage /> },
        {
          path: "/forms/:id/analytics/login",
          element: <GuestAnalyticsLogin />,
        },
        { path: "/", element: <RootRedirect /> },
        { path: "/forms/preview", element: <FormsPreview /> },
        { path: "/api-test", element: <TestAPI /> },
        { path: "/forms/:id/respond", element: <ResponseForm /> },
        { path: "/followup/demo", element: <FollowUpFormDemo /> },
        {
          path: "/followup/forms/:id/respond",
          element: <FormWithFollowUpResponderWrapper />,
        },
        {
          path: "/dashboard",
          element: withAccessControl(<DashboardNew />, {
            requiredPermission: ROUTE_PERMISSIONS.DASHBOARD,
          }),
        },
        {
          path: "/overall",
          element: withAuthenticatedLayout(<Overall />),
        },
        {
          path: "/forms/analytics",
          element: withAccessControl(<FormsAnalytics />, {
            requiredPermission: ROUTE_PERMISSIONS.ANALYTICS,
          }),
        },
        {
          path: "/forms/:id/analytics",
          element: withFlexibleAnalytics(<FormAnalyticsDashboard />),
        },
        {
          path: "/forms/management",
          element: withAccessControl(<FormsManagementNew />, {
            requiredPermission: ROUTE_PERMISSIONS.REQUEST_MANAGEMENT,
          }),
        },
        {
          path: "/forms/followup/management",
          element: withAuthenticatedLayout(
            <FollowUpFormManager onFormCreated={() => { }} />,
          ),
        },
        {
          path: "/forms/followup/create",
          element: withAuthenticatedLayout(
            <FormWithFollowUpCreator onFormCreated={() => { }} />,
          ),
        },
        {
          path: "/system/management",
          element: withAuthenticatedLayout(<Management />),
        },
        {
          path: "/mail/test",
          element: withAuthenticatedLayout(<MailTest />),
        },
        {
          path: "/whatsapp/test",
          element: withAuthenticatedLayout(<WhatsAppTest />),
        },
        {
          path: "/forms",
          element: withAuthenticatedLayout(<FormsList />),
        },
        {
          path: "/forms/create",
          element: withAuthenticatedLayout(<FormCreator />),
        },
        {
          path: "/forms/:id/edit",
          element: withAuthenticatedLayout(<FormCreator />),
        },
        {
          path: "/forms/:id/preview",
          element: withAuthenticatedLayout(<PreviewFormWrapper />),
        },
        {
          path: "/forms/:id/responses",
          element: withAuthenticatedLayout(<FormResponses />),
        },
        {
          path: "/forms/:id/uploads",
          element: withAuthenticatedLayout(<FormUploadsView />),
        },
        {
          path: "/responses/all",
          element: withAccessControl(<AllResponses />, {
            requiredPermission: ROUTE_PERMISSIONS.CUSTOMER_REQUESTS,
          }),
        },
        {
          path: "/responses/:responseId/edit-form",
          element: withAccessControl(<EditResponseFormPage />, {
            requiredPermission: ROUTE_PERMISSIONS.CUSTOMER_REQUESTS,
          }),
        },
        {
          path: "/responses/:id/edit",
          element: withAccessControl(<EditResponsePage />, {
            requiredPermission: ROUTE_PERMISSIONS.CUSTOMER_REQUESTS,
          }),
        },
        {
          path: "/responses/:id",
          element: withAccessControl(<ResponseDetailsPage />, {
            requiredPermission: ROUTE_PERMISSIONS.CUSTOMER_REQUESTS,
          }),
        },
        {
          path: "/admin/management",
          element: withAccessControl(<AdminManagement />, {
            allowedRoles: ["admin", "subadmin"],
            requiredPermission: TREE_PERMISSIONS.ADMIN_MANAGEMENT,
            permissionCheckRoles: ["subadmin"],
          }),
        },
        {
          path: "/admin/activity-logs",
          element: withAccessControl(<UserActivityLogs />, {
            allowedRoles: ["admin", "superadmin", "subadmin"],
            requiredPermission: TREE_PERMISSIONS.ACTIVITY_LOGS,
            permissionCheckRoles: ["subadmin"],
          }),
        },
        {
          path: "/admin/attendance",
          element: withAccessControl(<Attendance />, {
            allowedRoles: ["admin", "superadmin", "subadmin"],
            requiredAnyPermission: [...TREE_PERMISSIONS.ATTENDANCE_RECORD],
            permissionCheckRoles: ["subadmin"],
          }),
        },
        {
          path: "/hr-attendance",
          element: withAccessControl(<HRAttendance />, {
            allowedRoles: ["admin", "subadmin"],
            requiredPermission: TREE_PERMISSIONS.HR_REPORTS,
            permissionCheckRoles: ["subadmin"],
          }),
        },
        {
          path: "/shifts",
          element: withAccessControl(<ShiftManagement />, {
            allowedRoles: ["admin", "subadmin"],
            requiredPermission: TREE_PERMISSIONS.HR_SHIFTS,
            permissionCheckRoles: ["subadmin"],
          }),
        },
        {
          path: "/attendance/analytics",
          element: withAccessControl(<AttendanceAnalytics />, {
            allowedRoles: ["admin", "superadmin", "subadmin"],
          }),
        },
        {
          path: "/attendance-dashboard",
          element: withAccessControl(<AttendanceDashboard />, {
            allowedRoles: ["inspector"],
          }),
        },
        {
          path: "/inspector/attendance",
          element: withAccessControl(
            <AttendanceDashboard showAllHistory={true} />,
            {
              allowedRoles: ["inspector"],
            },
          ),
        },
        {
          path: "/hr/leaves",
          element: withAccessControl(<LeaveManagement />, {
            allowedRoles: ["admin", "inspector", "subadmin"],
            requiredPermission: TREE_PERMISSIONS.HR_LEAVES,
            permissionCheckRoles: ["subadmin"],
          }),
        },
        {
          path: "/hr/permissions",
          element: withAccessControl(<PermissionManagement />, {
            allowedRoles: ["admin", "inspector", "subadmin"],
            requiredPermission: TREE_PERMISSIONS.HR_PERMISSION,
            permissionCheckRoles: ["subadmin"],
          }),
        },
        {
          path: "/superadmin/tenants",
          element: withAccessControl(<TenantManagement />, {
            allowedRoles: ["superadmin"],
          }),
        },
        {
          path: "/superadmin/free-trial",
          element: withAccessControl(<FreeTrialManagement />, {
            allowedRoles: ["superadmin"],
          }),
        },
        {
          path: "/superadmin/forms",
          element: withAccessControl(<GlobalFormManagement />, {
            allowedRoles: ["superadmin"],
          }),
        },
        {
          path: "/forms/:id/invites",
          element: withAuthenticatedLayout(<InviteStatusPage />),
        },
        {
          path: "/inspector/chat",
          element: withAccessControl(<InspectorChat />, {
            allowedRoles: ["inspector", "admin", "tenant_admin", "staff", "subadmin"],
            requiredPermission: TREE_PERMISSIONS.CHAT,
            permissionCheckRoles: ["subadmin"],
          }),
        },
        {
          path: "/internal-tracking",
          element: withAccessControl(<InternalTracking />, {
            allowedRoles: ["admin", "superadmin", "inspector"],
          }),
        },
      ],
    },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    },
  },
);

export default function App() {
  return <RouterProvider router={router} />;
}
