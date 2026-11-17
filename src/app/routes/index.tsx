import { lazy, Suspense } from "react";
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { AppShell } from "../AppShell";
import { useAuth } from "../../features/auth/AuthProvider";
import AuthPage from "../../features/auth/AuthPage";
import { LoadingState } from "../../shared/ui/LoadingState";

const SharedLibraryPage = lazy(
  () => import("../../features/shared-library/SharedLibraryPage"),
);
const MyPdfsPage = lazy(
  () => import("../../features/personal-library/MyPdfsPage"),
);
const PdfReaderPage = lazy(
  () => import("../../features/pdf-reader/PdfReaderPage"),
);
const HighlightsPage = lazy(
  () => import("../../features/annotations/HighlightsPage"),
);
const AdminPage = lazy(() => import("../../features/admin/AdminPage"));
const SettingsPage = lazy(() => import("../../features/auth/SettingsPage"));
function PdfReaderRoute() {
  const { documentId } = useParams();
  return (
    <main id="main-content" className="main-reader">
      <PdfReaderPage key={documentId} />
    </main>
  );
}
function ProtectedRoute({ admin = false }: { admin?: boolean }) {
  const { user, loading, error } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState />;
  if (error)
    return (
      <div className="fatal-error" role="alert">
        <h1>Storage unavailable</h1>
        <p>{error}</p>
        <button
          className="btn btn-primary"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  if (!user)
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname + location.search }}
        replace
      />
    );
  if (admin && user.role !== "ADMIN") return <Navigate to="/library" replace />;
  return <Outlet />;
}
export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        <Route path="/login" element={<AuthPage key="login" />} />
        <Route
          path="/register"
          element={<AuthPage key="register" register />}
        />
        <Route element={<ProtectedRoute />}>
          <Route path="/reader/:documentId" element={<PdfReaderRoute />} />
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/library" replace />} />
            <Route path="/library" element={<SharedLibraryPage />} />
            <Route path="/my-pdfs" element={<MyPdfsPage />} />
            <Route path="/highlights" element={<HighlightsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route element={<ProtectedRoute admin />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>
            <Route
              path="*"
              element={
                <div className="empty-state">
                  <h1>That page isn’t in your library</h1>
                  <p>Let’s get you back to your study space.</p>
                  <a className="btn btn-primary" href="/library">
                    Back to library
                  </a>
                </div>
              }
            />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
