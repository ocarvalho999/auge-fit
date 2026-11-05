import "server-only";
import { mercadoPago } from "@/lib/mercadopago/client";
import { createAdminClient } from "@/lib/supabase/admin";

/** Encerra a cobrança recorrente no provedor. Devolve false se alguma falhar, para nada ser excluído pela metade. */
export async function cancelProviderSubscriptionsFor(profileId: string): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("subscriptions")
    .select("provider_id")
    .eq("profile_id", profileId)
    .in("status", ["pending", "active", "past_due"])
    .not("provider_id", "is", null);
  if (error) return false;
  for (const sub of data ?? []) {
    try {
      await mercadoPago.preApproval().update({ id: sub.provider_id!, body: { status: "cancelled" } });
    } catch {
      return false;
    }
  }
  return true;
}
