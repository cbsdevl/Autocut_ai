import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { LoginPage } from "./LoginPage";
import { RegisterPage } from "./RegisterPage";

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isLoading } = useAuth();
  const [authView, setAuthView] = useState<"login" | "register">("login");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        <p className="text-gray-500 text-sm">Loading AutoCut AI…</p>
      </div>
    );
  }

  if (!currentUser) {
    return authView === "login"
      ? <LoginPage onSwitchToRegister={() => setAuthView("register")} />
      : <RegisterPage onSwitchToLogin={() => setAuthView("login")} />;
  }

  return <>{children}</>;
};
