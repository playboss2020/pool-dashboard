import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2, Lock, X } from "lucide-react";
import { requireSupabase } from "../lib/supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

type BillingPeriod = "monthly" | "annual";

type PlanPricing = { price: string; periodLabel: string; priceId: string | null; savings?: string };

type PlanConfig = {
  key: string;
  name: string;
  description: string;
  items: string[];
  monthly: PlanPricing;
  annual: PlanPricing;
  comingSoon?: boolean;
  highlighted?: true;
};

const plans: PlanConfig[] = [
  {
    key: "home",
    name: "Home",
    description: "Simple, reliable pool control.",
    items: ["Mobile dashboard", "Pump and heater control", "Schedules", "Alerts", "Energy tracking"],
    monthly: { price: "$9", periodLabel: "per month", priceId: "price_1TW30oQXONGhI04M7KKJtcLx" },
    annual:  { price: "$7", periodLabel: "per month, billed yearly", priceId: import.meta.env.VITE_STRIPE_PRICE_HOME_ANNUAL ?? null, savings: "Save $24" },
  },
  {
    key: "pro",
    name: "Pro",
    description: "For property managers and pros.",
    items: ["Fleet dashboard", "Heat reservations", "Team roles", "Map view", "Priority support"],
    highlighted: true,
    monthly: { price: "$19", periodLabel: "per month", priceId: "price_1TW31LQXONGhI04MM9mwzG1Z" },
    annual:  { price: "$15", periodLabel: "per month, billed yearly", priceId: import.meta.env.VITE_STRIPE_PRICE_PRO_ANNUAL ?? null, savings: "Save $48" },
  },
  {
    key: "enterprise",
    name: "Enterprise",
    description: "Larger fleets and custom needs.",
    items: ["Custom onboarding", "Bulk provisioning", "SLA options", "API integrations"],
    comingSoon: true,
    monthly: { price: "Coming Soon", periodLabel: "", priceId: null },
    annual:  { price: "Coming Soon", periodLabel: "", priceId: null },
  },
];

export type SubscriptionSheetProps = {
  open: boolean;
  onClose: () => void;
  triggerReason?: string;
};

export function SubscriptionSheet({ open, onClose, triggerReason }: SubscriptionSheetProps) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  useEffect(() => {
    if (!open) {
      setBusy("");
      setError("");
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  async function handleChoose(priceId: string | null, planKey: string) {
    if (!priceId) return;
    setBusy(planKey);
    setError("");
    try {
      const client = requireSupabase();
      const { data: { session } } = await client.auth.getSession();
      if (!session) throw new Error("Not signed in");

      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-create-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          price_id: priceId,
          success_url: `${window.location.origin}?checkout=success`,
          cancel_url: `${window.location.origin}?checkout=cancelled`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed. Please try again.");
      setBusy("");
    }
  }

  return (
    <div className="sub-sheet-backdrop" onClick={onClose}>
      <div className="sub-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sub-sheet-grabber" />
        <button className="sub-sheet-close" type="button" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <header className="sub-sheet-header">
          <div className="sub-sheet-lock">
            <Lock size={18} />
          </div>
          <h2>{triggerReason ? `Subscribe to ${triggerReason}` : "Choose your plan"}</h2>
          <p>Your account is signed in. Pick a plan to start controlling your pool.</p>
        </header>

        {error && <div className="sub-sheet-error">{error}</div>}

        <div className="sub-sheet-toggle" role="tablist" aria-label="Billing period">
          <button
            type="button"
            role="tab"
            aria-selected={period === "monthly"}
            className={period === "monthly" ? "active" : ""}
            onClick={() => setPeriod("monthly")}
          >
            Monthly
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={period === "annual"}
            className={period === "annual" ? "active" : ""}
            onClick={() => setPeriod("annual")}
          >
            Annual <span className="sub-sheet-toggle-badge">−18%</span>
          </button>
        </div>

        <div className="sub-sheet-plans">
          {plans.map(plan => {
            const pricing = plan[period];
            const isDisabled = plan.comingSoon || !pricing.priceId;
            return (
              <article
                key={plan.key}
                className={`sub-sheet-plan${plan.highlighted ? " highlighted" : ""}${plan.comingSoon ? " coming-soon" : ""}`}
              >
                {plan.highlighted && !plan.comingSoon && <div className="sub-sheet-popular">MOST POPULAR</div>}
                {pricing.savings && period === "annual" && !plan.comingSoon && (
                  <div className="sub-sheet-savings">{pricing.savings}</div>
                )}
                <span className="sub-sheet-plan-label">{plan.name}</span>
                <div className="sub-sheet-price">
                  <h3>{pricing.price}</h3>
                  {pricing.periodLabel && <small>{pricing.periodLabel}</small>}
                </div>
                <p className="sub-sheet-desc">{plan.description}</p>
                <button
                  type="button"
                  className={`sub-sheet-cta${plan.highlighted && !plan.comingSoon ? " primary" : ""}${plan.comingSoon ? " soon" : ""}`}
                  disabled={!!busy || isDisabled}
                  onClick={() => pricing.priceId && handleChoose(pricing.priceId, plan.key)}
                >
                  {plan.comingSoon
                    ? <>Coming Soon</>
                    : !pricing.priceId
                      ? <>Annual not configured</>
                      : busy === plan.key
                        ? <><Loader2 size={14} className="spin" /> Redirecting…</>
                        : <>Choose {plan.name}<ArrowRight size={14} /></>}
                </button>
                <ul>
                  {plan.items.map(item => (
                    <li key={item}><Check size={13} />{item}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <footer className="sub-sheet-footer">
          <small>Cancel anytime · Secure checkout by Stripe</small>
        </footer>
      </div>
    </div>
  );
}
