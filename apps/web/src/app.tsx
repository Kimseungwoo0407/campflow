import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, restoreSession } from "./api/client";
import { AppLayout } from "./components/app-layout";
import { ProtectedRoute } from "./components/protected-route";
import { DashboardPage } from "./pages/dashboard-page";
import {
  ForgotPasswordPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from "./pages/account-recovery-pages";
import { GroupDetailPage } from "./pages/group-detail-page";
import { GroupsPage } from "./pages/groups-page";
import { InvitePage } from "./pages/invite-page";
import { LandingPage } from "./pages/landing-page";
import { LoginPage, SignUpPage } from "./pages/auth-pages";
import { NotFoundPage } from "./pages/not-found-page";
import { SettingsPage } from "./pages/settings-page";
import { useAuthStore } from "./stores/auth";

export function App() {
  const setSession = useAuthStore((state) => state.setSession);
  const setAnonymous = useAuthStore((state) => state.setAnonymous);
  const health = useQuery({
    queryKey: ["server-health"],
    queryFn: () => apiRequest<{ status: string }>("health/live", {}, false),
    retry: 1,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    void restoreSession().then(setSession).catch(setAnonymous);
  }, [setAnonymous, setSession]);

  const serverOnline = health.isPending || health.isSuccess;
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout serverOnline={serverOnline} />}>
          <Route path="/app" element={<DashboardPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/groups/:groupId" element={<GroupDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/dashboard" element={<Navigate to="/app" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
