import { lazy, Suspense, useEffect, useState, type ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { PageSkeleton } from "./components/ui/Skeleton";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { AuthProvider, RequireAuth, useAuth } from "./lib/auth";
import { LanguageProvider, useT } from "./lib/i18n";
import { canViewAnyArea, firstAllowedTenantPath, settingsPermissionAreas } from "./lib/permissions";
import { createQueryClient } from "./lib/query-client";
import { ThemeProvider } from "./lib/theme";

const queryClient = createQueryClient();

const ActivityPage = lazy(() => import("./pages/ActivityPage").then((m) => ({ default: m.ActivityPage })));
const CandidateDetailPage = lazy(() => import("./pages/CandidateDetailPage").then((m) => ({ default: m.CandidateDetailPage })));
const CandidatesPage = lazy(() => import("./pages/CandidatesPage").then((m) => ({ default: m.CandidatesPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage").then((m) => ({ default: m.DocumentsPage })));
const ExamUygulamaPage = lazy(() => import("./pages/ExamUygulamaPage").then((m) => ({ default: m.ExamUygulamaPage })));
const ExamESinavPage = lazy(() => import("./pages/ExamESinavPage").then((m) => ({ default: m.ExamESinavPage })));
const GroupsPage = lazy(() => import("./pages/GroupsPage").then((m) => ({ default: m.GroupsPage })));
const InstitutionsPage = lazy(() => import("./pages/InstitutionsPage").then((m) => ({ default: m.InstitutionsPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const MebJobsPage = lazy(() => import("./pages/MebJobsPage").then((m) => ({ default: m.MebJobsPage })));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage").then((m) => ({ default: m.NotificationsPage })));
const OutboxPage = lazy(() => import("./pages/OutboxPage").then((m) => ({ default: m.OutboxPage })));
const PaymentsPage = lazy(() => import("./pages/PaymentsPage").then((m) => ({ default: m.PaymentsPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const TrainingPage = lazy(() => import("./pages/TrainingPage").then((m) => ({ default: m.TrainingPage })));

function RouteFallback() {
  return <PageSkeleton />;
}

function RequireTenantPermission({
  areas,
  children,
}: {
  areas: readonly string[];
  children: ReactElement;
}) {
  const { user, permissions } = useAuth();
  const location = useLocation();

  if (canViewAnyArea(user, permissions, areas)) {
    return children;
  }

  const fallbackPath = firstAllowedTenantPath(user, permissions);
  if (fallbackPath && fallbackPath !== location.pathname) {
    return <Navigate replace to={fallbackPath} />;
  }

  return (
    <div className="page-shell">
      <section className="empty-state">
        <h2>Yetkiniz yok</h2>
        <p>Bu ekrana erişmek için gerekli yetkiye sahip değilsiniz.</p>
      </section>
    </div>
  );
}

function RequireSuperAdmin({ children }: { children: ReactElement }) {
  const { user } = useAuth();

  if (user?.isSuperAdmin) {
    return children;
  }

  return (
    <div className="page-shell">
      <section className="empty-state">
        <h2>Yetkiniz yok</h2>
        <p>Bu ekrana yalnızca super admin kullanıcılar erişebilir.</p>
      </section>
    </div>
  );
}

function isFeesRoute(pathname: string) {
  return pathname.replace(/\/+$/, "") === "/settings/definitions/fees";
}

export function AppShell() {
  const {
    user,
    institutions,
    activeInstitution,
    hasInstitution,
    institutionRequired,
    selectInstitution,
  } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHoverOpen, setSidebarHoverOpen] = useState(false);
  const location = useLocation();
  const fullScreenRoute = isFeesRoute(location.pathname);
  const globalSuperAdminRoute =
    user?.isSuperAdmin === true && location.pathname.startsWith("/institutions");
  const sidebarVisible = !sidebarCollapsed || sidebarHoverOpen;
  const activeInstitutionId = activeInstitution?.id ?? "";

  // Route değişince mobilde sidebar'ı otomatik kapat.
  useEffect(() => {
    setSidebarOpen(false);
    setSidebarHoverOpen(false);
  }, [location.pathname]);

  const toggleDesktopSidebar = () => {
    setSidebarHoverOpen(false);
    setSidebarCollapsed((current) => !current);
  };

  return (
    <>
      {!fullScreenRoute ? (
        <Header
          activeInstitutionId={activeInstitutionId}
          institutions={institutions}
          onInstitutionChange={selectInstitution}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
          onSidebarToggle={toggleDesktopSidebar}
          sidebarCollapsed={sidebarCollapsed}
          userInitials={getInitials(user?.name)}
        />
      ) : null}
      {!fullScreenRoute && sidebarCollapsed && (
        <div
          aria-hidden="true"
          className="sidebar-edge-trigger"
          onMouseEnter={() => setSidebarHoverOpen(true)}
        />
      )}
      {!fullScreenRoute ? (
        <Sidebar
          activeInstitutionId={activeInstitutionId}
          desktopVisible={sidebarVisible}
          institutions={institutions}
          onClose={() => setSidebarOpen(false)}
          onInstitutionChange={selectInstitution}
          onMouseLeave={() => {
            if (sidebarCollapsed) setSidebarHoverOpen(false);
          }}
          open={sidebarOpen}
        />
      ) : null}
      <main
        className={[
          "main",
          sidebarCollapsed || fullScreenRoute ? "sidebar-collapsed" : "",
          fullScreenRoute ? "main-fullscreen" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {!globalSuperAdminRoute && (!hasInstitution || institutionRequired || !activeInstitution) ? (
          <NoActiveInstitutionState institutions={institutions} onSelect={selectInstitution} />
        ) : (
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route
                element={
                  <RequireSuperAdmin>
                    <InstitutionsPage />
                  </RequireSuperAdmin>
                }
                path="/institutions"
              />
              <Route
                element={
                  <RequireTenantPermission areas={["dashboard"]}>
                    <DashboardPage userName={user?.name ?? null} />
                  </RequireTenantPermission>
                }
                path="/"
              />
              <Route
                element={
                  <RequireTenantPermission areas={["candidates"]}>
                    <CandidatesPage />
                  </RequireTenantPermission>
                }
                path="/candidates"
              />
              <Route
                element={
                  <RequireTenantPermission areas={["candidates"]}>
                    <CandidateDetailPage />
                  </RequireTenantPermission>
                }
                path="/candidates/:candidateId"
              />
              <Route
                element={
                  <RequireTenantPermission areas={["groups"]}>
                    <GroupsPage />
                  </RequireTenantPermission>
                }
                path="/groups"
              />
              <Route
                element={
                  <RequireTenantPermission areas={["documents"]}>
                    <DocumentsPage />
                  </RequireTenantPermission>
                }
                path="/documents"
              />
              <Route element={<Navigate replace to="/payments/balances" />} path="/payments" />
              <Route
                element={
                  <RequireTenantPermission areas={["payments"]}>
                    <PaymentsPage mode="balances" />
                  </RequireTenantPermission>
                }
                path="/payments/balances"
              />
              <Route
                element={
                  <RequireTenantPermission areas={["payments"]}>
                    <PaymentsPage mode="collections" />
                  </RequireTenantPermission>
                }
                path="/payments/collections"
              />
              <Route
                element={
                  <RequireTenantPermission areas={["payments"]}>
                    <PaymentsPage mode="invoices" />
                  </RequireTenantPermission>
                }
                path="/payments/invoices"
              />
              <Route
                element={
                  <RequireTenantPermission areas={["payments"]}>
                    <PaymentsPage mode="cash" />
                  </RequireTenantPermission>
                }
                path="/payments/cash"
              />
              <Route
                element={
                  <RequireTenantPermission areas={["payments"]}>
                    <PaymentsPage mode="statistics" />
                  </RequireTenantPermission>
                }
                path="/payments/statistics"
              />
              <Route element={<Navigate replace to="/training/teorik" />} path="/training" />
              <Route
                element={
                  <RequireTenantPermission areas={["training"]}>
                    <TrainingPage type="teorik" />
                  </RequireTenantPermission>
                }
                path="/training/teorik"
              />
              <Route
                element={
                  <RequireTenantPermission areas={["training"]}>
                    <TrainingPage type="uygulama" />
                  </RequireTenantPermission>
                }
                path="/training/uygulama"
              />
              <Route element={<Navigate replace to="/exams/e-sinav" />} path="/exams" />
              <Route
                element={
                  <RequireTenantPermission areas={["groups"]}>
                    <ExamESinavPage />
                  </RequireTenantPermission>
                }
                path="/exams/e-sinav"
              />
              <Route element={<Navigate replace to="/exams/uygulama" />} path="/exams/direksiyon" />
              <Route
                element={
                  <RequireTenantPermission areas={["groups"]}>
                    <ExamUygulamaPage />
                  </RequireTenantPermission>
                }
                path="/exams/uygulama"
              />
              <Route
                element={
                  <RequireTenantPermission areas={["mebjobs"]}>
                    <MebJobsPage />
                  </RequireTenantPermission>
                }
                path="/meb-jobs"
              />
              <Route
                element={
                  <RequireTenantPermission areas={["dashboard"]}>
                    <NotificationsPage />
                  </RequireTenantPermission>
                }
                path="/notifications"
              />
              <Route
                element={
                  <RequireTenantPermission areas={["dashboard"]}>
                    <ActivityPage />
                  </RequireTenantPermission>
                }
                path="/activity"
              />
              <Route
                element={
                  <RequireTenantPermission areas={["__superadmin"]}>
                    <OutboxPage />
                  </RequireTenantPermission>
                }
                path="/outbox"
              />
              <Route
                element={
                  <RequireTenantPermission areas={settingsPermissionAreas}>
                    <SettingsPage />
                  </RequireTenantPermission>
                }
                path="/settings/*"
              />
              <Route element={<ProfilePage />} path="/profile" />
              <Route element={<Navigate replace to="/" />} path="*" />
            </Routes>
          </Suspense>
        )}
      </main>
    </>
  );
}

function NoActiveInstitutionState({
  institutions,
  onSelect,
}: {
  institutions: ReturnType<typeof useAuth>["institutions"];
  onSelect: (institutionId: string) => Promise<void>;
}) {
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const { showToast } = useToast();
  const t = useT();

  const handleSelect = async (institutionId: string, institutionName: string) => {
    setSelectingId(institutionId);
    try {
      await onSelect(institutionId);
      showToast(t("app.toast.institutionSelected", { name: institutionName }));
    } catch {
      showToast(t("app.toast.institutionSwitchFailed"), "error");
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <div className="empty-state tenant-empty-state">
      <h3>{t("app.empty.noActiveInstitution")}</h3>
      <p>{t("app.empty.selectInstitution")}</p>
      {institutions.length > 0 ? (
        <div className="tenant-empty-actions">
          {institutions.map((institution) => (
            <button
              className="btn btn-secondary"
              disabled={selectingId !== null}
              key={institution.id}
              onClick={() => void handleSelect(institution.id, institution.name)}
              type="button"
            >
              {selectingId === institution.id ? t("app.label.selecting") : institution.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ToastProvider>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route element={<LoginPage />} path="/login" />
                    <Route
                      element={
                        <RequireAuth>
                          <AppShell />
                        </RequireAuth>
                      }
                      path="/*"
                    />
                  </Routes>
                </Suspense>
              </ToastProvider>
            </AuthProvider>
            {import.meta.env.DEV ? <ReactQueryDevtools buttonPosition="bottom-right" /> : null}
          </QueryClientProvider>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

function getInitials(name?: string | null) {
  const initials = (name ?? "")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return initials || "P";
}
