import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { ToastProvider } from "./components/ui/Toast";
import { AuthProvider } from "./lib/auth";
import { LanguageProvider } from "./lib/i18n";
import { SidebarStatsProvider } from "./lib/sidebar-stats";
import { mockInstitutions } from "./mock/institutions";
import { CandidatesPage } from "./pages/CandidatesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { DocumentTypesPage } from "./pages/DocumentTypesPage";
import { ExamUygulamaPage } from "./pages/ExamUygulamaPage";
import { ExamESinavPage } from "./pages/ExamESinavPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { GroupsPage } from "./pages/GroupsPage";
import { LoginPage } from "./pages/LoginPage";
import { MebJobsPage } from "./pages/MebJobsPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { PermissionsPage } from "./pages/PermissionsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RoleEditorPage } from "./pages/RoleEditorPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TrainingPage } from "./pages/TrainingPage";
import { UsersPage } from "./pages/UsersPage";

function AppShell() {
  const [institutionId, setInstitutionId] = useState<string>(mockInstitutions[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Route değişince mobilde sidebar'ı otomatik kapat.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <SidebarStatsProvider>
      <Header
        activeInstitutionId={institutionId}
        onInstitutionChange={setInstitutionId}
        onMenuToggle={() => setSidebarOpen((v) => !v)}
        userInitials="MS"
      />
      <Sidebar
        activeInstitutionId={institutionId}
        onClose={() => setSidebarOpen(false)}
        onInstitutionChange={setInstitutionId}
        open={sidebarOpen}
      />
      <main className="main">
        <Routes>
          <Route element={<DashboardPage />}  path="/" />
          <Route element={<CandidatesPage />} path="/candidates" />
          <Route element={<GroupsPage />}     path="/groups" />
          <Route element={<DocumentsPage />}  path="/documents" />
          <Route element={<DocumentTypesPage />} path="/document-types" />
          <Route element={<PaymentsPage />}   path="/payments" />
          <Route element={<TrainingPage />}   path="/training" />
          <Route element={<Navigate replace to="/exams/e-sinav" />} path="/exams" />
          <Route element={<ExamESinavPage />} path="/exams/e-sinav" />
          <Route element={<Navigate replace to="/exams/uygulama" />} path="/exams/direksiyon" />
          <Route element={<ExamUygulamaPage />} path="/exams/uygulama" />
          <Route element={<MebJobsPage />}    path="/meb-jobs" />
          <Route element={<NotificationsPage />} path="/notifications" />
          <Route element={<SettingsPage />}    path="/settings/*" />
          <Route element={<UsersPage />}       path="/users" />
          <Route element={<RoleEditorPage />}  path="/permissions/roles/new" />
          <Route element={<RoleEditorPage />}  path="/permissions/roles/:roleId" />
          <Route element={<PermissionsPage />} path="/permissions" />
          <Route element={<ProfilePage />} path="/profile" />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
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
            <Routes>
              <Route element={<LoginPage />} path="/login" />
              <Route element={<ForgotPasswordPage />} path="/forgot-password" />
              <Route element={<AppShell />} path="/*" />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
