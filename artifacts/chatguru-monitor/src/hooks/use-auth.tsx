import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

const BASE_URL = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");

export type UserRole = "admin" | "team";

interface AuthState {
  role: UserRole | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  role: null,
  loading: true,
  login: async () => null,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/api/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRole(d?.role ?? null))
      .catch(() => setRole(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (username: string, password: string): Promise<string | null> => {
      try {
        const r = await fetch(`${BASE_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ username, password }),
        });
        const d = await r.json();
        if (!r.ok) return d.error ?? "Erro desconhecido";
        setRole(d.role);
        return null;
      } catch {
        return "Erro de conexão";
      }
    },
    []
  );

  const logout = useCallback(async () => {
    await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    setRole(null);
  }, []);

  return (
    <AuthContext.Provider value={{ role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
