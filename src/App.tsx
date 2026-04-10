import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { ToastProvider } from "./components/ui/Toast";
import { mockInstitutions } from "./mock/institutions";
import { CandidatesPage } from "./pages/CandidatesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { GroupsPage } from "./pages/GroupsPage";
import { MebJobsPage } from "./pages/MebJobsPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { PermissionsPage } from "./pages/PermissionsPage";
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
    <>
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
          <Route element={<PaymentsPage />}   path="/payments" />
          <Route element={<TrainingPage />}   path="/training" />
          <Route element={<MebJobsPage />}    path="/meb-jobs" />
          <Route element={<SettingsPage />}    path="/settings" />
          <Route element={<UsersPage />}       path="/users" />
          <Route element={<PermissionsPage />} path="/permissions" />
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </BrowserRouter>
  );
}
