import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Activity, ArrowLeft, BarChart3, CalendarDays, Check, ChevronDown,
  CreditCard, DollarSign, Edit3, Loader2, RefreshCw, Save, Search,
  Shield, Trash2, Users, AlertCircle, Crown
} from "lucide-react";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  plan_slug: string;
  plan_name: string;
  plan_price: number;
  plan_currency: string;
  ai_videos_used: number;
  ai_video_limit: number;
  created_at: string;
  expires_at: string | null;
}

interface PlanAdmin {
  id: number;
  name: string;
  slug: string;
  price: number;
  currency: string;
  duration_days: number;
  ai_video_limit: number;
  description: string;
  updated_at: string;
}

type AdminTab = "overview" | "users" | "plans";

interface AdminDashboardProps {
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [plans, setPlans] = useState<PlanAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingPlan, setEditingPlan] = useState<number | null>(null);
  const [planEdits, setPlanEdits] = useState<Record<number, Partial<PlanAdmin>>>({});
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const flash = (type: "success" | "error", text: string) => {
    setActionMsg({ type, text });
    setTimeout(() => setActionMsg(null), 3000);
  };

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users", { credentials: "include" });
    if (!res.ok) throw new Error(res.status === 403 ? "Admin access required." : "Could not load accounts.");
    const d = await res.json();
    setUsers(d.users || []);
  }, []);

  const loadPlans = useCallback(async () => {
    const res = await fetch("/api/admin/plans", { credentials: "include" });
    if (!res.ok) throw new Error(res.status === 403 ? "Admin access required." : "Could not load plans.");
    const d = await res.json();
    setPlans(d.plans || []);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadUsers(), loadPlans()])
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "Could not load admin data."))
      .finally(() => setLoading(false));
  }, [loadUsers, loadPlans]);

  // ── User Actions ──────────────────────────────────────────

  const handleRoleChange = async (userId: number, newRole: "user" | "admin") => {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) { flash("success", "Role updated."); loadUsers(); }
    else flash("error", "Failed to update role.");
  };

  const handlePlanChange = async (userId: number, planSlug: string) => {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planSlug }),
    });
    if (res.ok) { flash("success", "Plan updated."); loadUsers(); }
    else flash("error", "Failed to update plan.");
  };

  const handleDeleteUser = async (userId: number) => {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE", credentials: "include",
    });
    if (res.ok) { flash("success", "User deleted."); setConfirmDelete(null); loadUsers(); }
    else flash("error", "Failed to delete user.");
  };

  // ── Plan Actions ──────────────────────────────────────────

  const handleSavePlan = async (plan: PlanAdmin) => {
    const edits = planEdits[plan.id] || {};
    const res = await fetch(`/api/admin/plans/${plan.id}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edits),
    });
    if (res.ok) {
      flash("success", `${plan.name} plan saved.`);
      setEditingPlan(null);
      setPlanEdits((prev) => { const n = { ...prev }; delete n[plan.id]; return n; });
      loadPlans();
    } else flash("error", "Failed to save plan.");
  };

  const planSlugs = ["free", "weekly", "monthly"];
  const planColors: Record<string, string> = {
    free: "border-gray-500/30",
    weekly: "border-blue-500/30",
    monthly: "border-purple-500/30",
  };

  const metrics = useMemo(() => {
    const now = Date.now();
    const paidAccounts = users.filter((user) =>
      user.plan_slug !== "free" && (!user.expires_at || new Date(user.expires_at).getTime() > now)
    ).length;
    const aiGenerations = users.reduce((total, user) => total + (Number(user.ai_videos_used) || 0), 0);
    const admins = users.filter((user) => user.role === "admin").length;
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      const count = users.filter((user) => {
        const createdAt = new Date(`${user.created_at.replace(" ", "T")}Z`);
        return !Number.isNaN(createdAt.getTime()) && createdAt.toISOString().slice(0, 10) === key;
      }).length;
      return { label: date.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" }), count };
    });
    const planMix = plans.map((plan) => ({
      ...plan,
      count: users.filter((user) => user.plan_slug === plan.slug).length,
    }));

    return { paidAccounts, aiGenerations, admins, days, planMix };
  }, [users, plans]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query)
    );
  }, [users, userSearch]);

  return (
    <div className="min-h-screen w-full bg-[#090d12] text-slate-100">
      <div className="min-h-screen w-full max-w-[1440px] mx-auto border-x border-white/5">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Admin Dashboard</h2>
              <p className="text-xs text-gray-500">Manage users, plans & pricing</p>
            </div>
          </div>
          <button onClick={onClose} className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-slate-300 hover:border-white/20 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Return to editor
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 border-b border-white/8 bg-black/20">
          {(["overview", "users", "plans"] as AdminTab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize
                ${tab === t ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
              {t === "overview" ? <BarChart3 className="w-4 h-4" /> : t === "users" ? <Users className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
              {t}
            </button>
          ))}
          <button onClick={() => { loadUsers(); loadPlans(); }}
            className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Flash message */}
        {actionMsg && (
            <div className={`mx-6 mt-4 flex items-center gap-2 rounded-md px-4 py-2.5 text-sm
            ${actionMsg.type === "success"
              ? "bg-green-500/10 border border-green-500/30 text-green-400"
              : "bg-red-500/10 border border-red-500/30 text-red-400"}`}>
            {actionMsg.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {actionMsg.text}
          </div>
        )}

        {loadError && (
          <div className="mx-6 mt-5 flex items-center gap-2 rounded-md border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {loadError}
          </div>
        )}

        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
          ) : (

            /* ────────── USERS TAB ────────── */
            tab === "overview" ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {[
                    { label: "Total accounts", value: users.length, detail: "All registered accounts", Icon: Users, color: "text-sky-300", tone: "bg-sky-400/10" },
                    { label: "Paid-tier accounts", value: metrics.paidAccounts, detail: "Currently unexpired plans", Icon: CreditCard, color: "text-emerald-300", tone: "bg-emerald-400/10" },
                    { label: "AI generations", value: metrics.aiGenerations, detail: "Recorded across accounts", Icon: Activity, color: "text-amber-300", tone: "bg-amber-400/10" },
                    { label: "Administrators", value: metrics.admins, detail: "Accounts with admin access", Icon: Shield, color: "text-rose-300", tone: "bg-rose-400/10" },
                  ].map(({ label, value, detail, Icon, color, tone }) => (
                    <div key={label} className="min-w-0 border border-white/8 bg-[#11171e] p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
                          <p className="mt-3 text-3xl font-semibold tabular-nums text-white">{value.toLocaleString()}</p>
                        </div>
                        <span className={`flex h-9 w-9 items-center justify-center rounded-md ${tone} ${color}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">{detail}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1.45fr_1fr] gap-4">
                  <section className="border border-white/8 bg-[#11171e] p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Account growth</h3>
                        <p className="mt-1 text-xs text-slate-500">New registrations · last 7 days</p>
                      </div>
                      <CalendarDays className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="mt-6 grid h-44 grid-cols-7 gap-2 sm:gap-4" role="img" aria-label="New account registrations over the last seven days">
                      {metrics.days.map((day) => {
                        const maxCount = Math.max(1, ...metrics.days.map((item) => item.count));
                        const barHeight = day.count ? Math.max(10, (day.count / maxCount) * 100) : 3;
                        return (
                          <div key={day.label} className="flex min-w-0 flex-col items-center justify-end gap-2">
                            <span className="text-[11px] tabular-nums text-slate-400">{day.count || ""}</span>
                            <div className="flex h-32 w-full items-end border-b border-white/10">
                              <div className="w-full rounded-t-sm bg-gradient-to-t from-sky-600/70 to-cyan-300" style={{ height: `${barHeight}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-500">{day.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="border border-white/8 bg-[#11171e] p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-white">Plan distribution</h3>
                        <p className="mt-1 text-xs text-slate-500">Current accounts by plan</p>
                      </div>
                      <BarChart3 className="h-4 w-4 text-slate-500" />
                    </div>
                    <div className="mt-6 space-y-5">
                      {metrics.planMix.map((plan) => {
                        const percentage = users.length ? (plan.count / users.length) * 100 : 0;
                        const barColor = plan.slug === "monthly" ? "bg-emerald-400" : plan.slug === "weekly" ? "bg-sky-400" : "bg-slate-500";
                        return (
                          <div key={plan.slug}>
                            <div className="mb-2 flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-300">{plan.name}</span>
                              <span className="tabular-nums text-slate-400">{plan.count} <span className="text-slate-600">· {Math.round(percentage)}%</span></span>
                            </div>
                            <div className="h-1.5 overflow-hidden bg-white/5">
                              <div className={`h-full ${barColor}`} style={{ width: `${percentage}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      <p className="border-t border-white/8 pt-4 text-xs leading-relaxed text-slate-500">
                        Plan assignment is shown as account status; payment transactions are not tracked here.
                      </p>
                    </div>
                  </section>
                </div>

                <section className="overflow-hidden border border-white/8 bg-[#11171e]">
                  <div className="flex items-center justify-between border-b border-white/8 px-4 py-4 sm:px-5">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Recent accounts</h3>
                      <p className="mt-1 text-xs text-slate-500">Latest registrations</p>
                    </div>
                    <button onClick={() => setTab("users")} className="text-xs font-medium text-sky-300 hover:text-sky-200">View all accounts</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/5 text-left text-[10px] uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3 font-medium sm:px-5">Account</th>
                          <th className="px-4 py-3 font-medium">Plan</th>
                          <th className="px-4 py-3 font-medium">Role</th>
                          <th className="px-4 py-3 font-medium">Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.slice(0, 5).map((user) => (
                          <tr key={user.id} className="border-b border-white/5 last:border-0">
                            <td className="px-4 py-3 sm:px-5">
                              <p className="font-medium text-slate-200">{user.name}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>
                            </td>
                            <td className="px-4 py-3 text-slate-300">{user.plan_name || "Free"}</td>
                            <td className="px-4 py-3 text-slate-400">{user.role}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{new Date(`${user.created_at.replace(" ", "T")}Z`).toLocaleDateString()}</td>
                          </tr>
                        ))}
                        {users.length === 0 && <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">No accounts registered yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : tab === "users" ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-300">Accounts <span className="ml-1 text-slate-500">{filteredUsers.length}</span></h3>
                  <label className="relative block w-full max-w-xs">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search name or email"
                      className="w-full border border-white/10 bg-[#11171e] py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-sky-400/50 focus:outline-none" />
                  </label>
                </div>
                <div className="overflow-x-auto rounded-xl border border-white/8">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8 bg-black/20 text-gray-400 text-xs uppercase tracking-wider">
                        <th className="text-left px-4 py-3">User</th>
                        <th className="text-left px-4 py-3">Role</th>
                        <th className="text-left px-4 py-3">Plan</th>
                        <th className="text-left px-4 py-3">AI Videos</th>
                        <th className="text-left px-4 py-3">Expires</th>
                        <th className="text-right px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-white">{u.name}</div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="relative">
                              <select
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.id, e.target.value as "user" | "admin")}
                                className="appearance-none bg-[#1a1a24] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white pr-6 cursor-pointer focus:outline-none focus:border-purple-500">
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                              </select>
                              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="relative">
                              <select
                                value={u.plan_slug || "free"}
                                onChange={(e) => handlePlanChange(u.id, e.target.value)}
                                className="appearance-none bg-[#1a1a24] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white pr-6 cursor-pointer focus:outline-none focus:border-purple-500">
                                {planSlugs.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                              </select>
                              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-gray-300">{u.ai_videos_used}</span>
                            <span className="text-gray-600"> / {u.ai_video_limit >= 999999 ? "∞" : u.ai_video_limit}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {u.expires_at ? new Date(u.expires_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {confirmDelete === u.id ? (
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-xs text-red-400 mr-1">Confirm?</span>
                                <button onClick={() => handleDeleteUser(u.id)}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs text-white">Yes</button>
                                <button onClick={() => setConfirmDelete(null)}
                                  className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs text-gray-300">No</button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDelete(u.id)}
                                className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && (
                    <p className="text-center text-gray-500 text-sm py-10">No users found.</p>
                  )}
                </div>
              </div>
            ) : (

              /* ────────── PLANS TAB ────────── */
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-4">Pricing Plans</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {plans.map((plan) => {
                    const isEditing = editingPlan === plan.id;
                    const edits = planEdits[plan.id] || {};
                    const val = (key: keyof PlanAdmin) => (edits as Record<string, unknown>)[key] ?? plan[key];

                    return (
                      <div key={plan.id}
                        className={`bg-[#1a1a24] border ${planColors[plan.slug] || "border-white/10"} rounded-xl p-5 flex flex-col gap-4`}>
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-white text-base">{plan.name}</h4>
                          {isEditing ? (
                            <div className="flex gap-1">
                              <button onClick={() => handleSavePlan(plan)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-500 rounded-lg text-xs text-white transition-colors">
                                <Save className="w-3 h-3" /> Save
                              </button>
                              <button onClick={() => { setEditingPlan(null); setPlanEdits((p) => { const n = { ...p }; delete n[plan.id]; return n; }); }}
                                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-gray-300 transition-colors">
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setEditingPlan(plan.id)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-white/8 hover:bg-white/15 rounded-lg text-xs text-gray-300 transition-colors">
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                          )}
                        </div>

                        {/* Price */}
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Price (USD)</label>
                          {isEditing ? (
                            <div className="relative">
                              <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                              <input type="number" min="0" step="0.01"
                                value={String(val("price"))}
                                onChange={(e) => setPlanEdits((p) => ({ ...p, [plan.id]: { ...p[plan.id], price: parseFloat(e.target.value) } }))}
                                className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg pl-7 pr-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
                            </div>
                          ) : (
                            <p className="text-2xl font-bold text-white">
                              {plan.price === 0 ? "Free" : `$${plan.price.toFixed(2)}`}
                              {plan.price > 0 && <span className="text-sm font-normal text-gray-500 ml-1">/{plan.duration_days === 7 ? "week" : "month"}</span>}
                            </p>
                          )}
                        </div>

                        {/* AI Video Limit */}
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">AI Video Limit</label>
                          {isEditing ? (
                            <input type="number" min="0"
                              value={String(val("ai_video_limit"))}
                              onChange={(e) => setPlanEdits((p) => ({ ...p, [plan.id]: { ...p[plan.id], ai_video_limit: parseInt(e.target.value) } }))}
                              className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
                          ) : (
                            <p className="text-white text-sm">
                              {plan.ai_video_limit >= 999999 ? "Unlimited" : plan.ai_video_limit}
                            </p>
                          )}
                        </div>

                        {/* Description */}
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Description</label>
                          {isEditing ? (
                            <textarea rows={2}
                              value={String(val("description"))}
                              onChange={(e) => setPlanEdits((p) => ({ ...p, [plan.id]: { ...p[plan.id], description: e.target.value } }))}
                              className="w-full bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 resize-none" />
                          ) : (
                            <p className="text-gray-400 text-xs leading-relaxed">{plan.description}</p>
                          )}
                        </div>

                        <p className="text-xs text-gray-600">
                          Last updated: {new Date(plan.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
