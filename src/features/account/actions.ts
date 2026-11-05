"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fieldErrorsFrom, formValues, type ActionState } from "@/lib/action-state";
import { createAdminClient, audit } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { deleteAccountSchema, onboardingProfileSchema, profileUpdateSchema } from "@/lib/validation/student";
import { newPasswordSchema } from "@/lib/validation/auth";
import { notify } from "@/lib/email";
import { assertRole, getCurrentProfile } from "@/features/auth/session";
import { hasEntitlement } from "@/features/billing/entitlements";
import { cancelProviderSubscriptionsFor } from "@/features/billing/cancel";
import { PHOTOS_BUCKET } from "@/features/progress/photo-constants";

export async function saveOnboardingProfileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const profile = await assertRole("student");
  const parsed = onboardingProfileSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("student_profiles")
    .update({ goal: parsed.data.goal, experience_level: parsed.data.experience })
    .eq("profile_id", profile.id);
  if (error) return { error: "Não foi possível salvar. Tente de novo." };
  redirect("/onboarding?passo=2");
}

/** Último passo: conclui o onboarding e leva ao primeiro treino ou à escolha do plano. */
export async function finishOnboardingAction(): Promise<void> {
  const profile = await assertRole("student");
  const supabase = await createClient();
  await supabase
    .from("student_profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("profile_id", profile.id)
    .is("onboarded_at", null);
  await notify({ profileId: profile.id, template: "welcome", dedupeKey: `welcome:${profile.id}` });
  const canLog = await hasEntitlement(profile.id, "log_workouts");
  redirect(canLog ? "/treinos/novo" : "/assinatura");
}

export async function updateProfileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Sessão expirada." };
  const parsed = profileUpdateSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", profile.id);
  if (error) return { error: "Não foi possível salvar." };
  revalidatePath("/configuracoes");
  return { ok: true, message: "Perfil atualizado." };
}

export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Não foi possível alterar a senha. Escolha outra." };
  return { ok: true, message: "Senha alterada." };
}

/** Exclusão em autoatendimento: cancela a cobrança, apaga os arquivos e só então a conta. */
export async function deleteAccountAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const profile = await assertRole("student");
  const parsed = deleteAccountSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);

  const admin = createAdminClient();
  const cancelled = await cancelProviderSubscriptionsFor(profile.id);
  if (!cancelled) {
    return { error: "Não foi possível cancelar sua assinatura agora. Nada foi excluído. Tente de novo em instantes." };
  }

  const { data: files, error: listError } = await admin.storage.from(PHOTOS_BUCKET).list(profile.id, { limit: 1000 });
  if (listError) return { error: "Não foi possível excluir agora. Nada foi apagado. Tente de novo." };
  if (files?.length) {
    const { error: removeError } = await admin.storage
      .from(PHOTOS_BUCKET)
      .remove(files.map((f) => `${profile.id}/${f.name}`));
    if (removeError) return { error: "Não foi possível apagar suas fotos. A conta não foi excluída. Tente de novo." };
  }

  // Com acesso ativo no FitBrother, o registro fica sem vínculo até a remoção manual; sem acesso, sai agora.
  const { data: nutrition } = await admin
    .from("nutrition_access")
    .select("id, granted_at, revoked_at")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (nutrition && (!nutrition.granted_at || nutrition.revoked_at)) {
    await admin.from("nutrition_access").delete().eq("id", nutrition.id);
  }

  await audit({ actorId: profile.id, action: "account.delete", entity: "profiles", entityId: profile.id });
  const { error } = await admin.auth.admin.deleteUser(profile.id);
  if (error) return { error: "Suas fotos foram apagadas, mas a conta não pôde ser excluída. Tente de novo." };

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?conta=excluida");
}
