import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Film,
  User,
  Mail,
  Shield,
  Zap,
  Calendar,
  Clock,
  LogOut,
  FolderOpen,
  ArrowRight,
  Crown,
  CheckCircle2,
  HardDrive,
  CreditCard,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { listProjectsForUser } from "../utils/projectStorage";

export const AccountPage: React.FC = () => {
  const { currentUser, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [projectCount, setProjectCount] = useState<number>(0);

  useEffect(() => {
    if (currentUser) {
      listProjectsForUser(currentUser.id)
        .then((list) => setProjectCount(list.length))
        .catch(() => {});
      refreshUser().catch(() => {});
    }
  }, [currentUser]);

  if (!currentUser) return null;

  const isUnlimited = currentUser.ai_video_limit >= 9999 || currentUser.plan_slug === "agency";
  const used = currentUser.ai_videos_used;
  const limit = currentUser.ai_video_limit;
  const percentage = isUnlimited ? 0 : Math.min(100, Math.round((used / limit) * 100));

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100 flex flex-col">
      {/* Top Header */}
      <header className="h-14 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center text-zinc-950 font-bold shadow-md shadow-amber-400/20">
              <Film className="w-4 h-4" />
            </div>
            <span className="font-bold text-base tracking-tight text-white">AutoCut AI</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
            <Link
              to="/editor"
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              Studio
            </Link>
            <Link
              to="/projects"
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              Projects
            </Link>
            <Link
              to="/pricing"
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              Pricing
            </Link>
            <Link
              to="/help"
              className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              Guides
            </Link>
            {currentUser.role === "admin" && (
              <Link
                to="/admin"
                className="px-3 py-1.5 rounded-md text-purple-400 hover:text-purple-300 hover:bg-purple-950/30 transition-colors flex items-center gap-1"
              >
                <Crown className="w-3.5 h-3.5" />
                Admin
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/editor"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-zinc-950 transition"
          >
            <Film className="w-3.5 h-3.5" />
            Launch Studio
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Account & Subscription
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Manage your profile, plan limits, AI quotas, and active video projects.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User Profile Card */}
          <div className="md:col-span-1 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-3xl font-black text-zinc-950 shadow-xl shadow-amber-400/20 mb-4">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-lg font-bold text-white">{currentUser.name}</h2>
            <p className="text-xs text-zinc-400 mb-3">{currentUser.email}</p>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 text-[11px] font-medium text-zinc-300 mb-6">
              <Shield className="w-3 h-3 text-amber-400" />
              <span>Role: <strong className="text-white capitalize">{currentUser.role}</strong></span>
            </div>

            <div className="w-full pt-4 border-t border-zinc-800 flex flex-col gap-2">
              <Link
                to="/projects"
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800/80 text-xs font-medium text-zinc-300 transition"
              >
                <span className="flex items-center gap-2">
                  <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
                  My Projects
                </span>
                <span className="font-mono text-zinc-400">{projectCount}</span>
              </Link>

              {currentUser.role === "admin" && (
                <Link
                  to="/admin"
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-purple-950/30 hover:bg-purple-900/40 border border-purple-800/40 text-xs font-medium text-purple-300 transition"
                >
                  <span className="flex items-center gap-2">
                    <Crown className="w-3.5 h-3.5 text-purple-400" />
                    Admin Panel
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}

              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-950/30 border border-transparent hover:border-red-900/40 transition mt-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Subscription & Usage Card */}
          <div className="md:col-span-2 space-y-6">
            {/* Plan details */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      {currentUser.plan_name} Plan
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Active Subscription Tier
                    </p>
                  </div>
                </div>

                <Link
                  to="/pricing"
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-zinc-950 transition"
                >
                  {currentUser.plan_slug === "free" ? "Upgrade" : "Change Plan"}
                </Link>
              </div>

              {/* Quota Progress */}
              <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-4 mt-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-medium text-zinc-300">AI Video Generation Quota</span>
                  <span className="font-mono text-zinc-400">
                    {isUnlimited ? (
                      <span className="text-emerald-400 font-semibold">Unlimited</span>
                    ) : (
                      `${used} / ${limit} used`
                    )}
                  </span>
                </div>

                {!isUnlimited && (
                  <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        percentage >= 100
                          ? "bg-red-500"
                          : percentage >= 75
                          ? "bg-amber-400"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                )}

                <p className="text-[11px] text-zinc-500 mt-2">
                  {isUnlimited
                    ? "Your Agency tier includes unlimited AI auto-remix cuts and beat syncing."
                    : `${Math.max(0, limit - used)} generation credits remaining this billing cycle.`}
                </p>
              </div>
            </div>

            {/* Storage & Specs */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-zinc-400" />
                Browser Local Storage & Sync
              </h3>
              <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                Projects and video clips are stored safely in your browser database using IndexedDB. You can export complete project zip packages for backup or transfer between computers.
              </p>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/60">
                  <span className="text-zinc-500 block mb-0.5">Local Projects</span>
                  <span className="font-bold text-white text-base">{projectCount}</span>
                </div>
                <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/60">
                  <span className="text-zinc-500 block mb-0.5">Render Engine</span>
                  <span className="font-bold text-emerald-400 text-base">FFmpeg & Canvas</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
