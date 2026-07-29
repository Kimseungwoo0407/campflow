import { create } from "zustand";
import type { AuthResult, SessionUser } from "@campflow/contracts";
import { clearApiSessionTokens, setApiSessionTokens } from "../api/client";

type AuthStatus = "checking" | "authenticated" | "anonymous";

interface AuthState {
  status: AuthStatus;
  user: SessionUser | null;
  setSession: (result: AuthResult) => void;
  updateUser: (user: SessionUser) => void;
  setAnonymous: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "checking",
  user: null,
  setSession: (result) => {
    setApiSessionTokens(result);
    set({ status: "authenticated", user: result.user });
  },
  updateUser: (user) => set({ user }),
  setAnonymous: () => {
    clearApiSessionTokens();
    set({ status: "anonymous", user: null });
  },
}));
