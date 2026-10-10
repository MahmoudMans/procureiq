"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import { getCurrentUser, login as loginRequest } from "@/lib/api";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/lib/auth-storage";
import { isPublicRoute } from "@/lib/public-routes";
import type { AuthUser } from "@/types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearAccessToken();
    setUser(null);
    router.replace("/login");
  }, [router]);

  useEffect(() => {
    let active = true;

    async function hydrate() {
      const token = getAccessToken();

      if (!token) {
        if (active) {
          setLoading(false);
        }

        return;
      }

      try {
        const currentUser = await getCurrentUser();

        if (active) {
          setUser(currentUser);
        }
      } catch {
        clearAccessToken();

        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void hydrate();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleUnauthorized() {
      setUser(null);

      // A stale STAFF token must not pull a supplier out of the public pages
      // (the supplier portal has its own session and sign-in).
      if (!isPublicRoute(window.location.pathname)) {
        router.replace("/login");
      }
    }

    window.addEventListener("procureiq:unauthorized", handleUnauthorized);

    return () => {
      window.removeEventListener("procureiq:unauthorized", handleUnauthorized);
    };
  }, [router]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await loginRequest(email, password);

      setAccessToken(response.accessToken);
      setUser(response.user);

      router.replace("/");
      router.refresh();
    },
    [router],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
