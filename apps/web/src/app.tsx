import { lazy, Suspense, useEffect } from "react";
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
import { GuidePage } from "./pages/guide-page";
import { InvitePage } from "./pages/invite-page";
import { LoginPage } from "./pages/auth-pages";
import { NotFoundPage } from "./pages/not-found-page";
import { SettingsPage } from "./pages/settings-page";
import { TripDetailPage, TripsPage } from "./pages/trips-pages";
import { TripArcadePage } from "./pages/trip-arcade-page";
import { TripAchievementsPage } from "./pages/trip-achievements-page";
import {
  TripBoardPage,
  TripDiscoverPage,
  TripExpensesPage,
  TripFilesPage,
  TripItineraryPage,
  TripLoungePage,
  TripMealsPage,
  TripPollsPage,
  TripTasksPage,
  TripTransportPage,
} from "./pages/trip-workspace-pages";
import { useAuthStore } from "./stores/auth";
import { TripPointsPage } from "./pages/trip-points-page";

const AfterglowFrontierPage = lazy(
  () => import("./games/afterglow-frontier/AfterglowFrontierPage"),
);

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
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<Navigate to="/login" replace />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout serverOnline={serverOnline} />}>
          <Route path="/app" element={<DashboardPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/groups/:groupId" element={<GroupDetailPage />} />
          <Route path="/trips" element={<TripsPage />} />
          <Route path="/trips/:tripId" element={<TripDetailPage />} />
          <Route path="/trips/:tripId/discover" element={<TripDiscoverPage />} />
          <Route path="/trips/:tripId/candidates" element={<TripDiscoverPage />} />
          <Route path="/trips/:tripId/polls" element={<TripPollsPage />} />
          <Route path="/trips/:tripId/itinerary" element={<TripItineraryPage />} />
          <Route path="/trips/:tripId/tasks" element={<TripTasksPage />} />
          <Route path="/trips/:tripId/meals" element={<TripMealsPage />} />
          <Route path="/trips/:tripId/transport" element={<TripTransportPage />} />
          <Route path="/trips/:tripId/expenses" element={<TripExpensesPage />} />
          <Route path="/trips/:tripId/points" element={<TripPointsPage />} />
          <Route path="/trips/:tripId/achievements" element={<TripAchievementsPage />} />
          <Route
            path="/trips/:tripId/games/afterglow-frontier"
            element={
              <Suspense fallback={<div className="page">잔광전선을 준비하는 중…</div>}>
                <AfterglowFrontierPage />
              </Suspense>
            }
          />
          <Route path="/trips/:tripId/games/:gameId" element={<TripArcadePage />} />
          <Route path="/trips/:tripId/board" element={<TripBoardPage />} />
          <Route path="/trips/:tripId/lounge" element={<TripLoungePage />} />
          <Route path="/trips/:tripId/files" element={<TripFilesPage />} />
          <Route path="/guide" element={<GuidePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/dashboard" element={<Navigate to="/app" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
