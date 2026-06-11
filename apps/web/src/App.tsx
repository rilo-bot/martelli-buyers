import '@/styles/theme.css';
import '@/styles/brand.css';
import { useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Sidebar } from '@/components/Sidebar';
import { applyPersistedTheme } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';
import { useBootstrapData } from '@/lib/bootstrap';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import DashboardPage from '@/pages/DashboardPage';
import LeadsPage from '@/pages/LeadsPage';
import LeadDetailPage from '@/pages/LeadDetailPage';
import DealsPage from '@/pages/DealsPage';
import DealDetailPage from '@/pages/DealDetailPage';
import ClientsPage from '@/pages/ClientsPage';
import ClientDetailPage from '@/pages/ClientDetailPage';
import PropertiesPage from '@/pages/PropertiesPage';
import PropertyDetailPage from '@/pages/PropertyDetailPage';
import AgentsPage from '@/pages/AgentsPage';
import EmailsPage from '@/pages/EmailsPage';
import DueDiligencePage from '@/pages/DueDiligencePage';
import SettingsPage from '@/pages/SettingsPage';

// Apply persisted theme before first render to avoid flash
applyPersistedTheme();

// Inject Google Fonts: Playfair Display (serif) + Inter (sans)
(function injectFonts() {
  if (document.getElementById('font-martelli')) return;
  const link = document.createElement('link');
  link.id = 'font-martelli';
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap';
  document.head.appendChild(link);
})();

// Rendered only when authenticated — safe to load server data here.
function AuthedShell() {
  useBootstrapData();
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main
        id="main-content"
        className={[
          'min-h-screen transition-[margin-left] duration-300 ease-in-out',
          'pt-[calc(3.5rem+1.5rem)] lg:pt-8',
          'pb-10',
          'px-4 md:px-6 lg:px-8',
        ].join(' ')}
      >
        <div className="max-w-[1440px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AuthedShell />
    </ProtectedRoute>
  );
}

export default function App() {
  useEffect(() => {
    applyPersistedTheme();
    // Restore the session from the auth cookie on boot.
    useAuthStore.getState().init();
  }, []);

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/:id" element={<LeadDetailPage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/deals/:id" element={<DealDetailPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientDetailPage />} />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/properties/:id" element={<PropertyDetailPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/emails" element={<EmailsPage />} />
          <Route path="/due-diligence" element={<DueDiligencePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </>
  );
}