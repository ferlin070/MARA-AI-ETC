import { Link, Route, Routes, useLocation } from 'react-router';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthGuard } from './components/AuthGuard';
import { AssessmentProvider } from './context/AssessmentContext';
import { CallbackPage } from './pages/CallbackPage';
import { LoginPage } from './pages/LoginPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { DashboardPage } from './pages/DashboardPage';
import { ReviewConsolePage } from './pages/ReviewConsolePage';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { AdminConsolePage } from './pages/AdminConsolePage';
import { AuditorConsolePage } from './pages/AuditorConsolePage';
import { ApplicantPortalPage } from './pages/ApplicantPortalPage';

function NotFoundPage() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-[#0F0F11]">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-[#222328] dark:bg-[#131417]">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/50">
          <span className="text-2xl">🔍</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tidak Dijumpai</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Halaman <span className="font-mono">{location.pathname}</span> tidak wujud atau telah
          dialihkan.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          Kembali ke Halaman Utama
        </Link>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AssessmentProvider>
      <ErrorBoundary>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/callback" element={<CallbackPage />} />
          <Route path="/applicant" element={<ApplicantPortalPage />} />
          <Route path="/" element={<AuthGuard><WorkspacePage /></AuthGuard>} />
          <Route path="/dashboard" element={<AuthGuard><DashboardPage /></AuthGuard>} />
          <Route path="/review" element={<AuthGuard><ReviewConsolePage /></AuthGuard>} />
          <Route path="/review/:id" element={<AuthGuard><CaseDetailPage /></AuthGuard>} />
          <Route path="/admin" element={<AuthGuard><AdminConsolePage /></AuthGuard>} />
          <Route path="/auditor" element={<AuthGuard><AuditorConsolePage /></AuthGuard>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ErrorBoundary>
    </AssessmentProvider>
  );
}


