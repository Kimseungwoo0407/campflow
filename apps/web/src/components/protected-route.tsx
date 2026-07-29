import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Spinner } from "@campflow/ui";
import { useAuthStore } from "../stores/auth";

export function ProtectedRoute() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();
  if (status === "checking") {
    return (
      <main className="centered-page">
        <Spinner label="로그인 상태 확인 중" />
      </main>
    );
  }
  if (status !== "authenticated") {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <Outlet />;
}
