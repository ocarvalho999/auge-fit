import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Feature = "log_workouts" | "progress" | "library" | "programs" | "individual_plan" | "checkins";

/** Segunda camada de autorização. A RLS confere de novo no banco. */
export const hasEntitlement = cache(async (userId: string, feature: Feature): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_entitlement", { p_user_id: userId, p_feature: feature });
  return !error && data === true;
});

export const getCurrentSubscription = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select(
      "id, status, current_period_end, grace_until, cancelled_at, provider_id, expected_amount_cents, created_at, plan_prices(id, interval, amount_cents, plans(code, name))",
    )
    .eq("profile_id", userId)
    .in("status", ["active", "past_due", "cancelled", "expired", "refunded"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
});
