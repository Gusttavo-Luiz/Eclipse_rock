import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { LoadingState } from "../components/States";
import { AdminLayout } from "./AdminLayout";
import { AuthProvider, useAuth } from "./auth";
import { LoginPage } from "./LoginPage";
import { AcceptInvitePage, ForgotPasswordPage, ResetPasswordPage } from "./PasswordResetPages";
import { AccountPage } from "./pages/AccountPage";
import { BookingDetail, BookingsAdmin } from "./pages/BookingsAdmin";
import { Dashboard } from "./pages/Dashboard";
import { EventForm, EventsAdmin } from "./pages/EventsAdmin";
import { GalleryAdmin } from "./pages/GalleryAdmin";
import { MembersAdmin } from "./pages/MembersAdmin";
import { SettingsAdmin } from "./pages/SettingsAdmin";
import { UsersAdmin } from "./pages/UsersAdmin";
import { VideosAdmin } from "./pages/VideosAdmin";

function RequireAuth({ adminOnly, children }: { adminOnly?: boolean; children: JSX.Element }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <LoadingState className="min-h-[100svh]" />;
  if (!user) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (adminOnly && user.role !== "admin") {
    return (
      <div role="alert" className="surface p-8">
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-mist">Esta área é exclusiva de administradores.</p>
      </div>
    );
  }
  return children;
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="esqueci-senha" element={<ForgotPasswordPage />} />
        <Route path="redefinir-senha" element={<ResetPasswordPage />} />
        <Route path="convite" element={<AcceptInvitePage />} />
        <Route
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="shows" element={<EventsAdmin />} />
          <Route path="shows/novo" element={<EventForm />} />
          <Route path="shows/:id" element={<EventForm />} />
          <Route path="solicitacoes" element={<BookingsAdmin />} />
          <Route path="solicitacoes/:id" element={<BookingDetail />} />
          <Route path="integrantes" element={<MembersAdmin />} />
          <Route path="galeria" element={<GalleryAdmin />} />
          <Route path="videos" element={<VideosAdmin />} />
          <Route path="configuracoes" element={<RequireAuth adminOnly><SettingsAdmin /></RequireAuth>} />
          <Route path="usuarios" element={<RequireAuth adminOnly><UsersAdmin /></RequireAuth>} />
          <Route path="conta" element={<AccountPage />} />
          <Route path="*" element={<p className="text-mist">Página não encontrada no painel.</p>} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
