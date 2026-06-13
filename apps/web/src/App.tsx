import '@/styles/theme.css';
import '@/styles/brand.css';
import { useEffect } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { PageTransition } from '@/components/motion';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
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
import InvoicesPage from '@/pages/InvoicesPage';
import DueDiligencePage from '@/pages/DueDiligencePage';
import SettingsPage from '@/pages/SettingsPage';
import SignAgreementPage from '@/pages/SignAgreementPage';

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
  const location = useLocation();
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div
        id="main-content"
        className="min-h-screen transition-[margin-left] duration-300 ease-in-out"
      >
        <TopBar />
        <main className="px-4 pb-12 pt-14 md:px-6 lg:px-8 lg:pt-0">
          <div className="mx-auto max-w-[1440px] pt-5 lg:pt-6">
            {/* Keyed by full path: every navigation remounts and fades in cleanly.
                No AnimatePresence/mode="wait" — that left the incoming page stuck
                blank (until refresh) because the exit clone shares <Outlet/>. */}
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </div>
        </main>
      </div>
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
        <Route path="/sign/:token" element={<SignAgreementPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/:id" element={<LeadDetailPage />} />
          {/* "Buyer Journeys" is the canonical name; /deals kept for back-compat
              (old links/bookmarks) — both render the same pages. */}
          <Route path="/journeys" element={<DealsPage />} />
          <Route path="/journeys/:id" element={<DealDetailPage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/deals/:id" element={<DealDetailPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientDetailPage />} />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/properties/:id" element={<PropertyDetailPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/emails" element={<EmailsPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/due-diligence" element={<DueDiligencePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </>
  );
}