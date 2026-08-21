import {
  CalendarRange,
  CircleHelp,
  Home,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  TentTree,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { apiRequest, readCsrfToken } from "../api/client";
import { hasDemoSession, isDemoMode } from "../lib/demo-session";
import { useAuthStore } from "../stores/auth";
import { ServerStatusBanner } from "./server-status-banner";

const navItems = [
  { to: "/app", label: "홈", icon: Home },
  { to: "/groups", label: "내 그룹", icon: Users },
  { to: "/trips", label: "내 여행", icon: CalendarRange },
  { to: "/guide", label: "사용 가이드", icon: CircleHelp },
] as const;

function getPageTitle(pathname: string) {
  if (pathname.startsWith("/groups")) return "내 그룹";
  if (pathname.startsWith("/trips")) return "여행 준비";
  if (pathname.startsWith("/guide")) return "사용 가이드";
  if (pathname.startsWith("/settings")) return "개인 설정";
  return "오늘의 여행";
}

export function AppLayout({ serverOnline }: { serverOnline: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const setAnonymous = useAuthStore((state) => state.setAnonymous);
  const navigate = useNavigate();
  const location = useLocation();
  const demoActive = isDemoMode() && hasDemoSession();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

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

  const nickname = user?.nickname ?? "여행자";

  return (
    <div className="app-frame">
      <a className="skip-link" href="#app-content">
        본문으로 바로가기
      </a>

      <aside className="app-sidebar">
        <Link className="brand app-sidebar__brand" to="/app" aria-label="CampFlow 홈">
          <span className="brand__mark" aria-hidden="true">
            <TentTree size={21} strokeWidth={2.2} />
          </span>
          <span>CampFlow</span>
        </Link>

        <div className="app-sidebar__intro">
          <span>
            <Sparkles size={14} aria-hidden="true" /> Together mode
          </span>
          <p>친구들과 같은 여행을 보고, 한곳에서 결정해요.</p>
        </div>

        <nav className="desktop-nav" aria-label="주요 메뉴">
          <span className="desktop-nav__label">메뉴</span>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/app"}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="app-sidebar__footer">
          {demoActive && <span className="app-demo-badge">데모 · 조회 전용</span>}
          <Link className="sidebar-profile" to="/settings">
            <span aria-hidden="true">{nickname.slice(0, 1)}</span>
            <span>
              <strong>{nickname}</strong>
              <small>내 설정 보기</small>
            </span>
            <Settings size={17} aria-hidden="true" />
          </Link>
          <button className="sidebar-logout" type="button" onClick={() => void logout()}>
            <LogOut size={17} aria-hidden="true" />
            로그아웃
          </button>
        </div>
      </aside>

      <div className="app-shell">
        <ServerStatusBanner online={serverOnline} />
        <header className="topbar">
          <Link className="brand topbar__brand" to="/app" aria-label="CampFlow 홈">
            <span className="brand__mark" aria-hidden="true">
              <TentTree size={20} strokeWidth={2.2} />
            </span>
            <span>CampFlow</span>
          </Link>
          <div className="topbar__context">
            <span>여행 준비 공간</span>
            <strong>{getPageTitle(location.pathname)}</strong>
          </div>
          <div className="topbar__actions">
            {demoActive && <span className="app-demo-badge topbar__demo">데모</span>}
            <button
              className="profile-chip"
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-controls="profile-menu"
              aria-label={`${nickname} 계정 메뉴`}
            >
              <span aria-hidden="true">{nickname.slice(0, 1)}</span>
              <b>{nickname}</b>
              {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
          </div>
          {menuOpen && (
            <div className="profile-menu" id="profile-menu">
              <Link to="/guide">
                <CircleHelp size={17} aria-hidden="true" />
                사용 가이드
              </Link>
              <Link to="/settings">
                <Settings size={17} aria-hidden="true" />
                개인 설정
              </Link>
              <button type="button" onClick={() => void logout()}>
                <LogOut size={17} aria-hidden="true" />
                로그아웃
              </button>
            </div>
          )}
        </header>

        <main className="app-main" id="app-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <nav className="mobile-nav" aria-label="모바일 주요 메뉴">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/app"}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
