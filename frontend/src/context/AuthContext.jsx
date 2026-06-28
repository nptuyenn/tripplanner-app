import { createContext, useContext, useMemo, useState } from "react";
import { api } from "../lib/api.js";

const AuthContext = createContext(null);
const storageKey = "tripplanner.session";

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) ?? null;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession);

  async function authenticate(mode, credentials) {
    const nextSession = await api(`/api/auth/${mode}`, {
      method: "POST",
      body: credentials,
    });
    localStorage.setItem(storageKey, JSON.stringify(nextSession));
    setSession(nextSession);
  }

  function logout() {
    localStorage.removeItem(storageKey);
    setSession(null);
  }

  const value = useMemo(
    () => ({
      session,
      login: (credentials) => authenticate("login", credentials),
      register: (credentials) => authenticate("register", credentials),
      logout,
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
