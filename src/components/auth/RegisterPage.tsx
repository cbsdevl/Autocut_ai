import React, { useState } from "react";
import { Film, Eye, EyeOff, Loader2, Mail, Lock, User, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface RegisterPageProps {
  onSwitchToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin }) => {
  const { register, error, clearError, isLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!name.trim()) { setLocalError("Name is required."); return; }
    if (!email.trim()) { setLocalError("Email is required."); return; }
    if (password.length < 6) { setLocalError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setLocalError("Passwords do not match."); return; }

    setSubmitting(true);
    await register(name.trim(), email.trim().toLowerCase(), password);
    setSubmitting(false);
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-blue-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Film className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-none">AutoCut AI</h1>
            <p className="text-xs text-gray-500">Intelligent Video Editor</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#13131a] border border-white/8 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-1">Create account</h2>
          <p className="text-gray-400 text-sm mb-6">Start with 2 free AI auto-edits</p>

          {displayError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-5 text-sm text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full bg-[#1a1a24] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-colors text-sm"
                  autoComplete="name"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-[#1a1a24] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-colors text-sm"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full bg-[#1a1a24] border border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-colors text-sm"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-[#1a1a24] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-colors text-sm"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || isLoading}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-all duration-200 shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 mt-2"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</> : "Create Account"}
            </button>
          </form>

          {/* Free plan note */}
          <div className="mt-5 p-3 bg-purple-500/8 border border-purple-500/20 rounded-lg text-xs text-purple-300 text-center">
            🎉 Free plan includes 2 AI auto-video generations + unlimited manual editing
          </div>

          <p className="text-center text-sm text-gray-500 mt-5">
            Already have an account?{" "}
            <button onClick={onSwitchToLogin} className="text-purple-400 hover:text-purple-300 font-medium transition-colors">
              Sign in
            </button>
          </p>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          © {new Date().getFullYear()} AutoCut AI · All rights reserved
        </p>
      </div>
    </div>
  );
};
