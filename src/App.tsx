import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { ToastProvider } from "./components/ui/Toast";
import { AuthProvider } from "./lib/auth";
import { LanguageProvider } from "./lib/i18n";
import { SidebarStatsProvider } from "./lib/sidebar-stats";
import { mockInstitutions } from "./mock/institutions";

const CandidatesPage = lazy(() => import("./pages/CandidatesPage").then((m) => ({ default: m.CandidatesPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const DocumentsPage = lazy(() => import("./pages/DocumentsPage").then((m) => ({ default: m.DocumentsPage })));
const ExamUygulamaPage = lazy(() => import("./pages/ExamUygulamaPage").then((m) => ({ default: m.ExamUygulamaPage })));
const ExamESinavPage = lazy(() => import("./pages/ExamESinavPage").then((m) => ({ default: m.ExamESinavPage })));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })));
const GroupsPage = lazy(() => import("./pages/GroupsPage").then((m) => ({ default: m.GroupsPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const MebJobsPage = lazy(() => import("./pages/MebJobsPage").then((m) => ({ default: m.MebJobsPage })));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage").then((m) => ({ default: m.NotificationsPage })));
const PaymentsPage = lazy(() => import("./pages/PaymentsPage").then((m) => ({ default: m.PaymentsPage })));
const ProfilePage = lazy(() => import("./pages/ProfilePage").then((m) => ({ default: m.ProfilePage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const TrainingPage = lazy(() => import("./pages/TrainingPage").then((m) => ({ default: m.TrainingPage })));

function RouteFallback() {
  return <div className="page-loading">Yükleniyor...</div>;
}

function AppShell() {
  const [institutionId, setInstitutionId] = useState<string>(mockInstitutions[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarHoverOpen, setSidebarHoverOpen] = useState(false);
  const location = useLocation();
  const sidebarVisible = !sidebarCollapsed || sidebarHoverOpen;

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
    <SidebarStatsProvider>
      <Header
        activeInstitutionId={institutionId}
        onInstitutionChange={setInstitutionId}
        onMenuToggle={() => setSidebarOpen((v) => !v)}
        onSidebarToggle={toggleDesktopSidebar}
        sidebarCollapsed={sidebarCollapsed}
        userInitials="MS"
      />
      {sidebarCollapsed && (
        <div
          aria-hidden="true"
          className="sidebar-edge-trigger"
          onMouseEnter={() => setSidebarHoverOpen(true)}
        />
      )}
      <Sidebar
        activeInstitutionId={institutionId}
        desktopVisible={sidebarVisible}
        onClose={() => setSidebarOpen(false)}
        onInstitutionChange={setInstitutionId}
        onMouseLeave={() => {
          if (sidebarCollapsed) setSidebarHoverOpen(false);
        }}
        open={sidebarOpen}
      />
      <main className={sidebarCollapsed ? "main sidebar-collapsed" : "main"}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route element={<DashboardPage />}  path="/" />
            <Route element={<CandidatesPage />} path="/candidates" />
            <Route element={<GroupsPage />}     path="/groups" />
            <Route element={<DocumentsPage />}  path="/documents" />
            <Route element={<PaymentsPage />}   path="/payments" />
            <Route element={<Navigate replace to="/training/teorik" />} path="/training" />
            <Route element={<TrainingPage type="teorik" />} path="/training/teorik" />
            <Route element={<TrainingPage type="uygulama" />} path="/training/uygulama" />
            <Route element={<Navigate replace to="/exams/e-sinav" />} path="/exams" />
            <Route element={<ExamESinavPage />} path="/exams/e-sinav" />
            <Route element={<Navigate replace to="/exams/uygulama" />} path="/exams/direksiyon" />
            <Route element={<ExamUygulamaPage />} path="/exams/uygulama" />
            <Route element={<MebJobsPage />}    path="/meb-jobs" />
            <Route element={<NotificationsPage />} path="/notifications" />
            <Route element={<SettingsPage />}    path="/settings/*" />
            <Route element={<ProfilePage />} path="/profile" />
            <Route element={<Navigate replace to="/" />} path="*" />
          </Routes>
        </Suspense>
      </main>
    </SidebarStatsProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route element={<LoginPage />} path="/login" />
                <Route element={<ForgotPasswordPage />} path="/forgot-password" />
                <Route element={<AppShell />} path="/*" />
              </Routes>
            </Suspense>
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
