import React, { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "../hooks/useAuth";
import { DashboardLayout } from "../templates/DashboardLayout";
import { selectAccessData } from "../store/slices/accessSlice";
import { LoaderOverlay } from "../atoms/LoaderOverlay";
import { NavigationProgress } from "../atoms/NavigationProgress";
import { DashboardSkeleton } from "../atoms/skeleton/DashboardSkeleton";
import { BookingManagementSkeleton } from "../atoms/skeleton/BookingManagementSkeleton";
import { SettingConfigSkeleton, ApiKeyPageSkeleton } from "../atoms/skeleton/SettingConfigSkeleton";

// ── Lazy-loaded pages ──────────────────────────────────────────────────────
// Each page is code-split: the JS bundle for that page is only downloaded
// when the user first navigates to it — keeps the initial load fast.
const LoginPage          = lazy(() => import("../pages/LoginPage").then(m => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() => import("../pages/ForgotPasswordPage"));
const CreatePasswordPage = lazy(() => import("../pages/CreatePasswordPage"));
const DashboardPage      = lazy(() => import("../pages/dashboard-admin/DashboardPage").then(m => ({ default: m.DashboardPage })));
const SettingConfig      = lazy(() => import("../pages/setting-config"));
const ApiKeyPage         = lazy(() => import("../pages/setting-config/ApiKeyPage"));
const BookingPage        = lazy(() => import("../pages/booking-management"));
const AdminDashboard     = lazy(() => import("../pages/dashboard/admin-dashboard/AdminDashboard").then(m => ({ default: m.AdminDashboard })));
const ManagerDashboard   = lazy(() => import("../pages/dashboard/manager-dashboard/ManagerDashboard").then(m => ({ default: m.ManagerDashboard })));
const Course             = lazy(() => import("../pages/Course"));
const NotFoundPage       = lazy(() => import("../pages/NotFoundPage"));
const BoardPage          = lazy(() => import("../pages/Board/BoardPage"));
const HelpChatPage       = lazy(() => import("../pages/help-chat/HelpChatPage"));
const DocListPage        = lazy(() => import("../pages/DocListPage"));

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * rolePermitted — checks whether the logged-in user's role matches any of the
 * allowed role names.
 *
 * HOW IT WORKS:
 *   1. Reads `user.role_name` from the Redux store (e.g. "SUPER ADMIN").
 *   2. Lowercases it → "super admin".
 *   3. Checks if any allowed string is a substring:
 *        roleAllowed=["super"]   → "super admin".includes("super")   = true  ✓
 *        roleAllowed=["manager"] → "super admin".includes("manager") = false ✗
 *
 * WHERE role_name COMES FROM:
 *   AuthContext.applyProfile() → dispatch(setUserData({ role_name: profile.role.role_name }))
 *   → stored in Redux userSlice → read here via s.user.role_name
 */
function rolePermitted(user: any, allowed: string[]): boolean {
  const role = (user?.role_name || "").toLowerCase();
  return allowed.some(r => role.includes(r.toLowerCase()));
}

/**
 * dashboardForRole — maps a role name to its default home route.
 *
 * Used by RedirectToHome when the user hits "/" so they land on the
 * correct dashboard for their role automatically.
 *
 *   "SUPER ADMIN" → /dashboard/admin
 *   "MANAGER"     → /dashboard/manager
 *   anything else → /booking-management  (safe fallback)
 */
function dashboardForRole(roleName: string): string {
  const role = (roleName || "").toLowerCase();
  if (role.includes("super"))   return "/dashboard/admin";
  if (role.includes("manager")) return "/dashboard/manager";
  return "/booking-management";
}

// ── ProtectedRoute ─────────────────────────────────────────────────────────
/**
 * ProtectedRoute — gate that wraps every authenticated page.
 *
 * THREE LAYERS OF PROTECTION (evaluated in order):
 *
 * 1. INIT CHECK  (isLoading || !initDone)
 *    On page refresh the browser cookie survives but Redux resets to empty.
 *    AuthContext fires a profile fetch on mount and sets initDone=true when
 *    done. Until then we show a loader — this prevents premature redirects
 *    caused by reading an empty Redux store.
 *    → Shows: <LoaderOverlay />
 *
 * 2. AUTH CHECK  (!isAuthenticated)
 *    isAuthenticated = !!cookie("t"). If no token → not logged in.
 *    → Redirects to: /login
 *
 * 3a. ROLE CHECK  (roleAllowed prop)
 *    Some routes are restricted to specific roles (e.g. only SUPER ADMIN can
 *    see /dashboard/admin). Pass roleAllowed={["super"]} to enable this check.
 *    Reads user.role_name from Redux userSlice (flat — NOT user.userData).
 *    → Redirects to: / (which then sends user to their own dashboard)
 *
 * 3b. MODULE ACCESS CHECK  (moduleId prop)
 *    Most pages are gated by a module permission (e.g. "booking_management").
 *    The access map is built in AuthContext.buildAccessMap() from the API's
 *    role_access array and stored in Redux accessSlice:
 *      accessData["booking_management"].view = true/false
 *    If the user's role doesn't have view=true for that module → no access.
 *    → Redirects to: /no-access
 *
 * NOTE: roleAllowed and moduleId are BOTH optional. If neither is passed the
 * route is open to any authenticated user (e.g. /no-access, /help-chat).
 */
const ProtectedRoute: React.FC<{
  children:     React.ReactNode;
  moduleId?:    string;   // key in Redux accessSlice  e.g. "booking_management"
  roleAllowed?: string[]; // partial role-name matches  e.g. ["super", "manager"]
}> = ({ children, moduleId, roleAllowed }) => {
  const { isAuthenticated, isLoading, initDone } = useAuth();
  const access   = useSelector((s: any) => selectAccessData(s)); // Redux accessSlice
  const user     = useSelector((s: any) => s.user);              // Redux userSlice (flat)
  const { pathname } = useLocation();

  // Layer 1 — wait for profile init (covers page-refresh scenario).
  // Show a page-specific skeleton instead of a white screen + spinner so the
  // user sees the layout chrome immediately while auth resolves.
  if (isLoading || !initDone) {
    if (pathname.startsWith("/dashboard/admin") || pathname.startsWith("/dashboard/manager")) {
      return <DashboardSkeleton />;
    }
    if (pathname === "/booking-management") {
      return <BookingManagementSkeleton />;
    }
    if (
      pathname.startsWith("/setting-config/user-management") ||
      pathname.startsWith("/setting-config/role-management") ||
      pathname.startsWith("/setting-config/module-management")
    ) {
      return <SettingConfigSkeleton />;
    }
    if (pathname.startsWith("/setting-config/api-key-management")) {
      return <ApiKeyPageSkeleton />;
    }
    return <LoaderOverlay show />;
  }

  // Layer 2 — must be logged in
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Layer 3a — role-based gate (e.g. only SUPER ADMIN → /dashboard/admin)
  if (roleAllowed && !rolePermitted(user, roleAllowed)) return <Navigate to="/" replace />;

  // Layer 3b — module permission gate (reads Redux accessSlice built from API)
  if (moduleId && !access[moduleId]?.view) return <Navigate to="/no-access" replace />;

  return <>{children}</>;
};

// ── PublicRoute ────────────────────────────────────────────────────────────
/**
 * PublicRoute — wraps login / forgot-password / create-password pages.
 *
 * If the user is already authenticated (cookie exists) they are sent away
 * from the public page back to "/" which RedirectToHome resolves to their
 * role's dashboard.  Prevents a logged-in user from seeing the login screen.
 */
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (!isLoading && isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
};

// ── RedirectToHome ─────────────────────────────────────────────────────────
/**
 * RedirectToHome — rendered when the user hits the root path "/".
 *
 * HOW IT WORKS:
 *   1. Waits for initDone (profile loaded after page refresh).
 *   2. Reads user.role_name from Redux.
 *   3. Calls dashboardForRole() to pick the correct destination:
 *        SUPER ADMIN → /dashboard/admin
 *        MANAGER     → /dashboard/manager
 *        default     → /booking-management
 *   4. Navigates with replace so "/" never appears in browser history.
 *
 * This is wrapped inside <ProtectedRoute> so unauthenticated users are
 * already sent to /login before this component even renders.
 */
const RedirectToHome: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, initDone } = useAuth();
  const user = useSelector((s: any) => s.user); // role_name lives here (flat)

  useEffect(() => {
    if (isLoading || !initDone) return; // wait for profile on page refresh
    if (!isAuthenticated) { navigate("/login", { replace: true }); return; }
    navigate(dashboardForRole(user?.role_name), { replace: true });
  }, [isAuthenticated, isLoading, initDone, user?.role_name, navigate]);

  return null;
};

// ── Layout helper ──────────────────────────────────────────────────────────
// Shorthand so each route doesn't repeat <DashboardLayout>…</DashboardLayout>.
const InLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <DashboardLayout>{children}</DashboardLayout>
);

// ── AppRoutes ──────────────────────────────────────────────────────────────
export const AppRoutes: React.FC = () => {
  return (
    <>
      {/* Slim YouTube-style progress bar at the very top of the viewport.
          NavItem fires emitNavStart() on click; pages call emitNavDone()
          after their API data loads so the bar completes at the right moment. */}
      <NavigationProgress />

      {/* fallback={null} — each page renders its own skeleton while loading,
          so we never show the full-screen spinner between navigations. */}
      <Suspense fallback={null}>
      <Routes>

        {/* ── PUBLIC ROUTES ──────────────────────────────────────────────────
            Wrapped in <PublicRoute>: if the user is already logged in they
            are redirected to "/" instead of seeing the auth pages.           */}
        <Route path="/login"               element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/forgot-password"     element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="auth/create-password" element={<PublicRoute><CreatePasswordPage type="create" /></PublicRoute>} />
        <Route path="auth/reset-password"  element={<PublicRoute><CreatePasswordPage type="reset" /></PublicRoute>} />

        {/* Fully public — no auth required */}
        <Route path="/c"     element={<Course />} />
        <Route path="/doc"   element={<DocListPage />} />
        <Route path="/board" element={<BoardPage />} />

        {/* ── ROOT REDIRECT ──────────────────────────────────────────────────
            "/" → ProtectedRoute (must be logged in) → RedirectToHome
            RedirectToHome reads role_name from Redux and navigates to the
            correct dashboard for that role.                                  */}
        <Route path="/" element={<ProtectedRoute><RedirectToHome /></ProtectedRoute>} />

        {/* ── LEGACY DASHBOARDS (module-id gated) ───────────────────────────
            These old dashboard routes check whether the role has view=true
            for the matching module key in Redux accessSlice.
            They are kept for backward compatibility — new roles use the
            /dashboard/admin and /dashboard/manager routes below instead.    */}
        <Route path="/dashboard-admin"          element={<ProtectedRoute moduleId="data-dashboard"           ><DashboardPage /></ProtectedRoute>} />
        <Route path="/dashboard-tso"            element={<ProtectedRoute moduleId="dashboard-tso"            ><DashboardPage /></ProtectedRoute>} />
        <Route path="/dashboard-manager"        element={<ProtectedRoute moduleId="dashboard-manager"        ><DashboardPage /></ProtectedRoute>} />
        <Route path="/dashboard-team-leader"    element={<ProtectedRoute moduleId="dashboard-team-leader"    ><DashboardPage /></ProtectedRoute>} />
        <Route path="/dashboard-branch-manager" element={<ProtectedRoute moduleId="dashboard-branch-manager" ><DashboardPage /></ProtectedRoute>} />
        <Route path="/dashboard-xyz"            element={<ProtectedRoute moduleId="dashboard-xyz"            ><DashboardPage /></ProtectedRoute>} />

        {/* Authenticated but no module/role restriction */}
        {/* Authenticated but no module/role restriction */}
        <Route path="/help-chat" element={<ProtectedRoute><InLayout><HelpChatPage /></InLayout></ProtectedRoute>} />

        {/* ── SETTINGS & CONFIG (module-id gated) ───────────────────────────
            Each sub-route checks a different module key from Redux accessSlice:
              /user-management   → accessSlice["user_management"].view
              /role-management   → accessSlice["role_management"].view
              /module-management → accessSlice["module_management"].view
              /api-key-management→ accessSlice["api_key_management"].view
            All four render <SettingConfig /> (or <ApiKeyPage />) inside the
            DashboardLayout.  The SettingConfig component shows tabs based on
            which modules are accessible.                                     */}
        <Route
          path="/setting-config/user-management"
          element={
            // OPEN WHEN: accessSlice["user_management"].view === true
            <ProtectedRoute moduleId="user_management">
              <InLayout><SettingConfig /></InLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/setting-config/role-management"
          element={
            // OPEN WHEN: accessSlice["role_management"].view === true
            <ProtectedRoute moduleId="role_management">
              <InLayout><SettingConfig /></InLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/setting-config/module-management"
          element={
            // OPEN WHEN: accessSlice["module_management"].view === true
            <ProtectedRoute moduleId="module_management">
              <InLayout><SettingConfig /></InLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/setting-config/api-key-management"
          element={
            // OPEN WHEN: accessSlice["api_key_management"].view === true
            <ProtectedRoute moduleId="api_key_management">
              <InLayout><ApiKeyPage /></InLayout>
            </ProtectedRoute>
          }
        />

        {/* ── ROLE-BASED DASHBOARDS ──────────────────────────────────────────
            These routes use roleAllowed instead of moduleId.
            rolePermitted() reads user.role_name from Redux userSlice and
            checks if it contains the allowed substring (case-insensitive).

            /dashboard/admin
              OPEN WHEN: user.role_name contains "super"  (e.g. "SUPER ADMIN")
              BLOCKED:   any other role → redirected to "/" → their own dashboard

            /dashboard/manager
              OPEN WHEN: user.role_name contains "manager"
              BLOCKED:   SUPER ADMIN and others → redirected to "/"

            HOW role_name GETS INTO REDUX:
              Login → fetchProfile() → applyProfile() → setUserData({ role_name })
              Page refresh → AuthContext useEffect → fetchProfile() → same path  */}
        <Route
          path="/dashboard/admin"
          element={
            // OPEN WHEN: user.role_name includes "super"  (e.g. "SUPER ADMIN")
            <ProtectedRoute roleAllowed={["super"]}>
              <InLayout><AdminDashboard /></InLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/manager"
          element={
            // OPEN WHEN: user.role_name includes "manager"  (e.g. "MANAGER")
            <ProtectedRoute roleAllowed={["manager"]}>
              <InLayout><ManagerDashboard /></InLayout>
            </ProtectedRoute>
          }
        />

        {/* ── OPERATIONS (module-id gated) ───────────────────────────────────
            OPEN WHEN: accessSlice["booking_management"].view === true         */}
        <Route
          path="/booking-management"
          element={
            <ProtectedRoute moduleId="booking_management">
              <InLayout><BookingPage /></InLayout>
            </ProtectedRoute>
          }
        />

        {/* ── LEGACY REDIRECT ────────────────────────────────────────────────
            Old /user-management URL → new location under /setting-config     */}
        <Route path="/user-management" element={<Navigate to="/setting-config/user-management" replace />} />

        {/* ── NO ACCESS ──────────────────────────────────────────────────────
            Shown when a moduleId check fails (user is authenticated but the
            module is not in their role_access array from the API).
            No moduleId or roleAllowed — any authenticated user can see this. */}
        <Route
          path="/no-access"
          element={
            <ProtectedRoute>
              <InLayout>
                <div className="text-center py-16">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Access</h1>
                  <p className="text-gray-600 dark:text-gray-400">
                    You do not have permission to access this page. Please contact your administrator.
                  </p>
                </div>
              </InLayout>
            </ProtectedRoute>
          }
        />

        {/* ── 404 CATCH-ALL ──────────────────────────────────────────────────
            Any unknown URL renders NotFoundPage inside the dashboard layout.
            Not wrapped in ProtectedRoute — visible even when not logged in.  */}
        <Route path="*" element={<InLayout><NotFoundPage /></InLayout>} />

      </Routes>
      </Suspense>
    </>
  );
};
