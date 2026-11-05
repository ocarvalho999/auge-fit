"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { DOCUMENT_VERSION } from "@/lib/legal";
import { createClient } from "@/lib/supabase/server";
import { consentSchema } from "@/lib/validation/student";
import { assertRole } from "@/features/auth/session";

export async function setConsentAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const profile = await assertRole("student");
  const parsed = consentSchema.safeParse({ type: form.get("type") });
  if (!parsed.success) return { error: "Consentimento inválido." };
  const grant = form.get("grant") === "on";
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("consents")
    .select("id")
    .eq("profile_id", profile.id)
    .eq("type", parsed.data.type)
    .is("revoked_at", null);

  if (grant && !current?.length) {
    const { error } = await supabase
      .from("consents")
      .insert({ profile_id: profile.id, type: parsed.data.type, document_version: DOCUMENT_VERSION });
    if (error) return { error: "Não foi possível registrar agora." };
  }
  if (!grant && current?.length) {
    const { error } = await supabase
      .from("consents")
      .update({ revoked_at: new Date().toISOString() })
      .eq("profile_id", profile.id)
      .eq("type", parsed.data.type)
      .is("revoked_at", null);
    if (error) return { error: "Não foi possível revogar agora." };
  }
  if (parsed.data.type === "marketing") {
    await supabase.from("profiles").update({ marketing_emails: grant }).eq("id", profile.id);
  }
  revalidatePath("/", "layout");
  return { ok: true, message: grant ? "Consentimento registrado." : "Consentimento revogado." };
}
