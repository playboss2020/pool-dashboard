import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2, Lock, X } from "lucide-react";
import { requireSupabase } from "../lib/supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const plans = [
  {
    key: "home",
    name: "Home",
    price: "$9",
    period: "per month",
    description: "Simple, reliable pool control.",
    items: ["Mobile dashboard", "Pump and heater control", "Schedules", "Alerts", "Energy tracking"],
    priceId: "price_1TW30oQXONGhI04M7KKJtcLx",
  },
  {
    key: "pro",
    name: "Pro",
    price: "$19",
    period: "per month",
    description: "For property managers and pros.",
    items: ["Fleet dashboard", "Heat reservations", "Team roles", "Map view", "Priority support"],
    priceId: "price_1TW31LQXONGhI04MM9mwzG1Z",
    highlighted: true as const,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "multi-site",
    description: "Larger fleets and custom needs.",
    items: ["Custom onboarding", "Bulk provisioning", "SLA options", "API integrations"],
    priceId: "price_1TW326QXONGhI04MDgRi3AVH",
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

  async function handleChoose(priceId: string, planKey: string) {
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

        <div className="sub-sheet-plans">
          {plans.map(plan => (
            <article
              key={plan.key}
              className={`sub-sheet-plan${"highlighted" in plan && plan.highlighted ? " highlighted" : ""}`}
            >
              {"highlighted" in plan && plan.highlighted && <div className="sub-sheet-popular">MOST POPULAR</div>}
              <span className="sub-sheet-plan-label">{plan.name}</span>
              <div className="sub-sheet-price">
                <h3>{plan.price}</h3>
                <small>{plan.period}</small>
              </div>
              <p className="sub-sheet-desc">{plan.description}</p>
              <button
                type="button"
                className={`sub-sheet-cta${"highlighted" in plan && plan.highlighted ? " primary" : ""}`}
                disabled={!!busy}
                onClick={() => handleChoose(plan.priceId, plan.key)}
              >
                {busy === plan.key
                  ? <><Loader2 size={14} className="spin" /> Redirecting…</>
                  : <>Choose {plan.name}<ArrowRight size={14} /></>}
              </button>
              <ul>
                {plan.items.map(item => (
                  <li key={item}><Check size={13} />{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <footer className="sub-sheet-footer">
          <small>Cancel anytime · Secure checkout by Stripe</small>
        </footer>
      </div>
    </div>
  );
}
