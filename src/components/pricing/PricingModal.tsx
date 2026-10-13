import React, { useEffect, useState } from "react";
import {
  X, Zap, Check, Loader2, Star, Calendar, Clock, AlertCircle
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface Plan {
  id: number;
  name: string;
  slug: string;
  price: number;
  currency: string;
  duration_days: number;
  ai_video_limit: number;
  description: string;
}

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Shown when the user hit the free limit */
  showLimitWarning?: boolean;
}

export const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, showLimitWarning }) => {
  const { currentUser, refreshUser } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch("/api/plans", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setPlans(d.plans || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpgrade = async (planSlug: string) => {
    if (planSlug === "free") return;
    setUpgrading(planSlug);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/subscription/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ planSlug }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`You've been upgraded to the ${data.plan} plan!`);
        await refreshUser();
        setTimeout(() => { setSuccessMsg(null); onClose(); }, 2500);
      } else {
        setErrorMsg(data.error || "Upgrade failed");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    }
    setUpgrading(null);
  };

  const PlanIcon = ({ slug }: { slug: string }) => {
    if (slug === "monthly") return <Star className="w-5 h-5" />;
    if (slug === "weekly") return <Calendar className="w-5 h-5" />;
    return <Clock className="w-5 h-5" />;
  };

  const planColors: Record<string, string> = {
    free: "from-gray-600/20 to-gray-700/10 border-white/10",
    weekly: "from-blue-600/20 to-indigo-600/10 border-blue-500/30",
    monthly: "from-purple-600/20 to-pink-600/10 border-purple-500/30",
  };
  const planAccent: Record<string, string> = {
    free: "text-gray-300",
    weekly: "text-blue-400",
    monthly: "text-purple-400",
  };

  const planFeatures: Record<string, string[]> = {
    free:    ["2 AI auto-video generations (lifetime)", "Unlimited manual editing", "All effects & filters", "AI captions", "Export up to 1080p"],
    weekly:  ["Unlimited AI auto-video generations", "Unlimited manual editing", "All effects & filters", "AI captions", "Export up to 4K", "Priority support"],
    monthly: ["Unlimited AI auto-video generations", "Unlimited manual editing", "All effects & filters", "AI captions", "Export up to 4K", "Priority support", "Best value — save 37%"],
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl bg-[#13131a] border border-white/8 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/8">
          <div>
            <h2 className="text-xl font-bold text-white">Choose Your Plan</h2>
            {showLimitWarning && (
              <div className="flex items-center gap-2 mt-1 text-sm text-amber-400">
                <AlertCircle className="w-4 h-4" />
                You've used all your free AI auto-video generations. Upgrade to continue.
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/8 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {successMsg && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 mb-5 text-green-400">
              <Check className="w-4 h-4" /> {successMsg}
            </div>
          )}
          {errorMsg && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-5 text-red-400">
              <AlertCircle className="w-4 h-4" /> {errorMsg}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan) => {
                const isCurrent = currentUser?.plan_slug === plan.slug;
                const isPopular = plan.slug === "monthly";
                const features = planFeatures[plan.slug] || [];

                return (
                  <div key={plan.id}
                    className={`relative bg-gradient-to-br ${planColors[plan.slug] || planColors.free} border rounded-xl p-5 flex flex-col transition-all duration-200 ${isPopular ? "scale-[1.02] shadow-lg shadow-purple-500/10" : ""}`}>
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                          BEST VALUE
                        </span>
                      </div>
                    )}

                    <div className={`flex items-center gap-2 mb-3 ${planAccent[plan.slug]}`}>
                      <PlanIcon slug={plan.slug} />
                      <span className="font-bold text-base">{plan.name}</span>
                    </div>

                    <div className="mb-4">
                      {plan.price === 0 ? (
                        <div className="text-3xl font-bold text-white">Free</div>
                      ) : (
                        <div className="flex items-end gap-1">
                          <span className="text-3xl font-bold text-white">
                            ${plan.price.toFixed(2)}
                          </span>
                          <span className="text-gray-400 text-sm mb-1">
                            /{plan.duration_days === 7 ? "week" : "month"}
                          </span>
                        </div>
                      )}
                      <p className="text-gray-500 text-xs mt-1">{plan.description}</p>
                    </div>

                    <ul className="space-y-2 flex-1 mb-5">
                      {features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                          <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleUpgrade(plan.slug)}
                      disabled={isCurrent || plan.slug === "free" || upgrading !== null}
                      className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2
                        ${isCurrent
                          ? "bg-white/8 text-gray-400 cursor-default"
                          : plan.slug === "free"
                          ? "bg-white/5 text-gray-500 cursor-default"
                          : isPopular
                          ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-600/20"
                          : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white"
                        }`}
                    >
                      {upgrading === plan.slug ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                      ) : isCurrent ? (
                        <><Check className="w-4 h-4" /> Current Plan</>
                      ) : plan.slug === "free" ? (
                        "Free Plan"
                      ) : (
                        <><Zap className="w-4 h-4" /> Upgrade Now</>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-center text-xs text-gray-600 mt-5">
            Demo mode: selecting a plan activates it immediately. No payment is collected.
          </p>
        </div>
      </div>
    </div>
  );
};
