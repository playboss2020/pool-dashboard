import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { requireSupabase } from "../lib/supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const plans = [
  {
    key: "home",
    name: "Home",
    price: "$9",
    period: "per hub / month",
    description: "Simple, reliable pool control for homeowners.",
    items: ["Mobile dashboard", "Pump and heater control", "Schedules", "Alerts", "Energy tracking"],
    priceId: "price_1TW30oQXONGhI04M7KKJtcLx",
  },
  {
    key: "pro",
    name: "Pro",
    price: "$19",
    period: "per property / month",
    description: "For vacation rental operators and service companies.",
    items: ["Fleet dashboard", "Reservation heat calendar", "Team roles", "Map view", "Priority support"],
    priceId: "price_1TW31LQXONGhI04MM9mwzG1Z",
    highlighted: true as const,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "Custom",
    period: "multi-site operators",
    description: "For larger fleets that need rollout support and custom terms.",
    items: ["Custom onboarding", "Bulk provisioning", "Advanced reporting", "SLA options", "API integrations"],
    priceId: "price_1TW326QXONGhI04MDgRi3AVH",
  },
];

type Plan = typeof plans[number];

export function PaywallPage({ onSignOut }: { onSignOut: () => void }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

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
    <div className="paywall-screen">
      <div className="paywall-header">
        <h1>Choose your plan</h1>
        <p>Start controlling your pool today. Cancel anytime.</p>
        {error && <div className="error-box">{error}</div>}
      </div>

      <div className="paywall-grid">
        {plans.map(plan => (
          <article
            key={plan.key}
            className={`paywall-card${"highlighted" in plan && plan.highlighted ? " highlighted" : ""}`}
          >
            {"highlighted" in plan && plan.highlighted && <div className="paywall-popular">MOST POPULAR</div>}
            <span className="paywall-plan-label">{plan.name}</span>
            <h2>{plan.price}</h2>
            <p className="paywall-period">{plan.period}</p>
            <p className="paywall-desc">{plan.description}</p>
            <button
              type="button"
              className={`paywall-cta${"highlighted" in plan && plan.highlighted ? " primary" : ""}`}
              disabled={!!busy}
              onClick={() => handleChoose(plan.priceId, plan.key)}
            >
              {busy === plan.key
                ? <><Loader2 size={16} className="spin" /> Redirecting…</>
                : <>{`Choose ${plan.name}`}<ArrowRight size={15} /></>}
            </button>
            <ul>
              {plan.items.map(item => (
                <li key={item}><Check size={14} />{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <button type="button" className="paywall-signout" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}
