"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { audit, createAdminClient } from "@/lib/supabase/admin";
import { assertRole } from "@/features/auth/session";
import { hasEntitlement } from "@/features/billing/entitlements";
import { normalizeWhatsapp } from "./queue";

export async function saveWhatsappAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const profile = await assertRole("student");
  if (!(await hasEntitlement(profile.id, "nutrition_app"))) return { error: "Seu plano não inclui o app FitBrother." };
  const whatsapp = normalizeWhatsapp(String(form.get("whatsapp") ?? ""));
  if (!whatsapp) return { fieldErrors: { whatsapp: "Informe o WhatsApp com DDD. Exemplo: 11 91234-5678." } };
  const { error } = await createAdminClient()
    .from("nutrition_access")
    .upsert({ profile_id: profile.id, whatsapp }, { onConflict: "profile_id" });
  if (error) return { error: "Não foi possível salvar. Tente de novo." };
  revalidatePath("/assinatura");
  return { ok: true, message: "Número salvo." };
}

const idSchema = z.uuid();

export async function markGrantedAction(form: FormData): Promise<void> {
  const me = await assertRole("admin");
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success) return;
  const { error } = await createAdminClient()
    .from("nutrition_access")
    .update({ granted_at: new Date().toISOString(), granted_by: me.id, revoked_at: null })
    .eq("id", id.data);
  if (!error) await audit({ actorId: me.id, action: "fitbrother.grant", entity: "nutrition_access", entityId: id.data });
  revalidatePath("/admin/fitbrother");
}

export async function markRevokedAction(form: FormData): Promise<void> {
  const me = await assertRole("admin");
  const id = idSchema.safeParse(form.get("id"));
  if (!id.success) return;
  const admin = createAdminClient();
  const { data: row } = await admin.from("nutrition_access").select("profile_id").eq("id", id.data).maybeSingle();
  if (!row) return;
  // Conta excluída: removido o acesso, o número não tem mais motivo para ficar guardado.
  const { error } = row.profile_id
    ? await admin.from("nutrition_access").update({ revoked_at: new Date().toISOString() }).eq("id", id.data)
    : await admin.from("nutrition_access").delete().eq("id", id.data);
  if (!error) await audit({ actorId: me.id, action: "fitbrother.revoke", entity: "nutrition_access", entityId: id.data });
  revalidatePath("/admin/fitbrother");
}
