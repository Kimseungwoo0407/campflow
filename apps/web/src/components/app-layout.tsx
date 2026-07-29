import { Bell, CalendarRange, Home, LogOut, Menu, Settings, Users, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button } from "@campflow/ui";
import { apiRequest, readCsrfToken } from "../api/client";
import { useAuthStore } from "../stores/auth";
import { ServerStatusBanner } from "./server-status-banner";

const navItems = [
  { to: "/app", label: "홈", icon: Home },
  { to: "/groups", label: "내 그룹", icon: Users },
  { to: "/trips", label: "내 여행", icon: CalendarRange },
] as const;

export function AppLayout({ serverOnline }: { serverOnline: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const setAnonymous = useAuthStore((state) => state.setAnonymous);
  const navigate = useNavigate();

  async function logout() {
    try {
      await apiRequest("auth/logout", {
        method: "POST",
        headers: readCsrfToken() ? { "x-csrf-token": readCsrfToken() ?? "" } : {},
      });
    } finally {
      setAnonymous();
      navigate("/");
    }
  }

  return (
    <div className="app-frame">
      <ServerStatusBanner online={serverOnline} />
      <header className="topbar">
        <Link className="brand" to="/app" aria-label="CampFlow 홈">
          <span className="brand__mark" aria-hidden="true">
            △
          </span>
          <span>CampFlow</span>
        </Link>
        <nav className="desktop-nav" aria-label="주요 메뉴">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")}>
              <Icon size={18} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar__actions">
          <button className="icon-button" aria-label="알림">
            <Bell size={20} />
          </button>
          <button
            className="profile-chip"
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-expanded={menuOpen}
          >
            <span aria-hidden="true">{user?.nickname.slice(0, 1) ?? "?"}</span>
            <b>{user?.nickname}</b>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
        {menuOpen && (
          <div className="profile-menu">
            <Link to="/settings" onClick={() => setMenuOpen(false)}>
              <Settings size={17} />
              개인 설정
            </Link>
            <Button variant="ghost" onClick={() => void logout()}>
              <LogOut size={17} />
              로그아웃
            </Button>
          </div>
        )}
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="mobile-nav" aria-label="모바일 주요 메뉴">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "active" : "")}>
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
