// ─────────────────────────────────────────────────────────────
// Auth Context — provides currentUser, login, logout, register
// ─────────────────────────────────────────────────────────────
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  plan_slug: string;
  plan_name: string;
  plan_price: number;
  plan_currency: string;
  ai_video_limit: number;
  ai_videos_used: number;
  expires_at: string | null;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    }
  }, []);

  // Check session on mount
  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const login = async (email: string, password: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.user);
        return true;
      }
      setError(data.error || "Login failed");
      return false;
    } catch {
      setError("Network error. Please try again.");
      return false;
    }
  };

  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.user);
        return true;
      }
      setError(data.error || "Registration failed");
      return false;
    } catch {
      setError("Network error. Please try again.");
      return false;
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setCurrentUser(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, error, login, register, logout, refreshUser, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
