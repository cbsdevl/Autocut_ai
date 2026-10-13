import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Film, Eye, EyeOff, Loader2, Mail, Lock, User, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface RegisterPageProps {
  onSwitchToLogin?: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin }) => {
  const { register, error, clearError, isLoading, currentUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // If already authenticated, redirect to editor
  React.useEffect(() => {
    if (currentUser) {
      navigate("/editor", { replace: true });
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!name.trim()) { setLocalError("Name is required."); return; }
    if (!email.trim()) { setLocalError("Email is required."); return; }
    if (password.length < 6) { setLocalError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setLocalError("Passwords do not match."); return; }

    setSubmitting(true);
    const success = await register(name.trim(), email.trim().toLowerCase(), password);
    setSubmitting(false);
    if (success) {
      navigate("/editor", { replace: true });
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-purple-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo and App Title */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Link to="/" className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20 hover:scale-105 transition-transform">
            <Film className="w-6 h-6 text-zinc-950" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white leading-none">AutoCut AI</h1>
            <p className="text-xs text-zinc-400">Intelligent Video Editor</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#13131a] border border-white/8 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="text-2xl font-bold text-white mb-1">Create account</h2>
          <p className="text-zinc-400 text-sm mb-6">Start with 2 free AI auto-edits</p>

          {displayError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-5 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivers"
                  className="w-full bg-[#1a1a24] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-colors text-sm"
                  autoComplete="name"
                  autoFocus
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-[#1a1a24] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-colors text-sm"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full bg-[#1a1a24] border border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-colors text-sm"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-[#1a1a24] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-colors text-sm"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || isLoading}
              className="w-full bg-amber-400 hover:bg-amber-300 active:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-semibold py-2.5 rounded-lg transition-all duration-200 shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2 mt-2"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</> : "Create Account"}
            </button>
          </form>

          {/* Free plan note */}
          <div className="mt-5 p-3 bg-amber-400/10 border border-amber-400/20 rounded-lg text-xs text-amber-300 text-center">
            ✨ Free plan includes 2 AI auto-video cuts + unlimited manual editing
          </div>

          <p className="text-center text-sm text-zinc-400 mt-5">
            Already have an account?{" "}
            {onSwitchToLogin ? (
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                Sign in
              </button>
            ) : (
              <Link
                to="/login"
                className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                Sign in
              </Link>
            )}
          </p>

          <div className="mt-6 pt-5 border-t border-zinc-800/80 flex items-center justify-center gap-4 text-xs text-zinc-500">
            <Link to="/pricing" className="hover:text-zinc-300 transition-colors">Pricing</Link>
            <span>•</span>
            <Link to="/help" className="hover:text-zinc-300 transition-colors">Help & Guides</Link>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          © {new Date().getFullYear()} AutoCut AI · Professional Video Editing Platform
        </p>
      </div>
    </div>
  );
};
