import { useEffect, useState } from "react";
import { requireSupabase } from "../lib/supabase";

export type SubscriptionStatus = {
  loading: boolean;
  plan: "home" | "pro" | "enterprise" | "none";
  active: boolean;
};

export function useSubscription(userId: string | undefined): SubscriptionStatus {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<SubscriptionStatus["plan"]>("none");

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const client = requireSupabase();
    client
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle()
      .then(({ data }) => {
        setPlan((data?.plan as SubscriptionStatus["plan"]) ?? "none");
        setLoading(false);
      });
  }, [userId]);

  return { loading, plan, active: plan !== "none" };
}
