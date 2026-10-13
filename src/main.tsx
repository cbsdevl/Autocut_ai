import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import {
  RequireAuth,
  RequireAdmin,
  PublicOnlyRoute,
} from "./components/auth/AuthRouteGuards.tsx";
import { LoginPage } from "./components/auth/LoginPage.tsx";
import { RegisterPage } from "./components/auth/RegisterPage.tsx";
import { ProjectsPage } from "./pages/ProjectsPage.tsx";
import { PricingPage } from "./pages/PricingPage.tsx";
import { AccountPage } from "./pages/AccountPage.tsx";
import { HelpPage } from "./pages/HelpPage.tsx";
import { AdminPage } from "./pages/AdminPage.tsx";
import { NotFoundPage } from "./pages/NotFoundPage.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public / Informational Routes */}
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/guides" element={<Navigate to="/help" replace />} />

          {/* Guest / Public-Only Authentication Routes */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />

          {/* Protected Studio & Project Routes */}
          <Route path="/" element={<Navigate to="/editor" replace />} />
          <Route
            path="/editor"
            element={
              <RequireAuth>
                <App />
              </RequireAuth>
            }
          />
          <Route
            path="/editor/:projectId"
            element={
              <RequireAuth>
                <App />
              </RequireAuth>
            }
          />
          <Route
            path="/projects"
            element={
              <RequireAuth>
                <ProjectsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/account"
            element={
              <RequireAuth>
                <AccountPage />
              </RequireAuth>
            }
          />
          <Route path="/settings" element={<Navigate to="/account" replace />} />

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            }
          />

          {/* Catch-all 404 Route */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>
);
