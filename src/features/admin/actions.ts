"use server";

import { revalidatePath } from "next/cache";
import { fieldErrorsFrom, formValues, type ActionState } from "@/lib/action-state";
import { notify } from "@/lib/email";
import { publicEnv } from "@/lib/env";
import { audit, createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  couponSchema,
  couponToggleSchema,
  endLinkSchema,
  exerciseCreateSchema,
  exercisePublishSchema,
  inviteProfessionalSchema,
  linkSchema,
  priceUpdateSchema,
  professionalUpdateSchema,
  userStatusSchema,
} from "@/lib/validation/admin";
import { assertRole } from "@/features/auth/session";

/** Link próprio do app: funciona igual em qualquer provedor de e-mail. Leva à criação da senha. */
async function sendInvite(profileId: string, email: string): Promise<"sent" | "skipped" | "failed"> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.properties?.hashed_token) return "failed";
  const url = `${publicEnv.appUrl()}/auth/confirm?token_hash=${data.properties.hashed_token}&type=recovery&next=/recuperar-senha/nova`;
  const result = await notify({ profileId, template: "professional_invite", actionUrl: url });
  return result === "duplicate" ? "failed" : result;
}

export async function inviteProfessionalAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertRole("admin");
  const parsed = inviteProfessionalSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const d = parsed.data;
  const admin = createAdminClient();

  // Registrado antes de criar a conta: é o que autoriza o cadastro sem data de nascimento.
  const { error: inviteError } = await admin.from("staff_invites").upsert({ email: d.email });
  if (inviteError) return { error: "Não foi possível registrar o convite." };

  const { data: created, error } = await admin.auth.admin.createUser({
    email: d.email,
    email_confirm: true,
    user_metadata: { full_name: d.fullName },
  });
  if (error || !created.user) {
    await admin.from("staff_invites").delete().eq("email", d.email);
    return { error: "Não foi possível criar a conta. Confira se o e-mail já está em uso." };
  }
  const profileId = created.user.id;

  const { error: roleError } = await admin.from("profiles").update({ role: "professional" }).eq("id", profileId);
  const { data: pro, error: proError } = await admin
    .from("professionals")
    .insert({
      profile_id: profileId,
      cref_number: d.crefNumber,
      cref_uf: d.crefUf,
      cref_verified_at: new Date().toISOString(),
      verified_by: me.id,
      capacity: d.capacity,
      status: "active",
    })
    .select("id")
    .single();
  if (roleError || proError || !pro) {
    await admin.auth.admin.deleteUser(profileId);
    return { error: "Não foi possível concluir o convite. Nada foi criado." };
  }

  await audit({ actorId: me.id, action: "professional.invite", entity: "professionals", entityId: pro.id, metadata: { cref_uf: d.crefUf } });
  const sent = await sendInvite(profileId, d.email);
  revalidatePath("/admin/profissionais");
  if (sent !== "sent") {
    return { ok: true, message: "Profissional criado, mas o e-mail não foi enviado: confira a configuração de e-mail e use \"Reenviar convite\"." };
  }
  return { ok: true, message: "Convite enviado." };
}

export async function resendInviteAction(form: FormData): Promise<void> {
  const me = await assertRole("admin");
  const profileId = String(form.get("profileId") ?? "");
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(profileId);
  if (!data.user?.email) return;
  await sendInvite(profileId, data.user.email);
  await audit({ actorId: me.id, action: "professional.invite_resend", entity: "profiles", entityId: profileId });
  revalidatePath("/admin/profissionais");
}

export async function updateProfessionalAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertRole("admin");
  const parsed = professionalUpdateSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("professionals")
    .update({ capacity: parsed.data.capacity, status: parsed.data.status })
    .eq("id", parsed.data.id);
  if (error) return { error: "Não foi possível salvar." };
  await audit({ actorId: me.id, action: "professional.update", entity: "professionals", entityId: parsed.data.id, metadata: { capacity: parsed.data.capacity, status: parsed.data.status } });
  revalidatePath("/admin/profissionais");
  return { ok: true, message: "Salvo." };
}

export async function setUserStatusAction(form: FormData): Promise<void> {
  const me = await assertRole("admin");
  const parsed = userStatusSchema.safeParse(formValues(form));
  if (!parsed.success || parsed.data.id === me.id) return;
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (!error) {
    await audit({ actorId: me.id, action: "user.status", entity: "profiles", entityId: parsed.data.id, metadata: { status: parsed.data.status } });
  }
  revalidatePath("/admin/usuarios");
}

export async function linkBlackAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertRole("admin");
  const parsed = linkSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const { error } = await createAdminClient().rpc("link_black_student", {
    p_subscription_id: parsed.data.subscriptionId,
    p_professional_id: parsed.data.professionalId,
    p_actor: me.id,
  });
  if (error) return { error: "Não foi possível vincular. Confira as vagas do profissional." };
  revalidatePath("/admin/vinculos");
  return { ok: true, message: "Vínculo criado. As 8 semanas começaram agora." };
}

export async function endLinkAction(form: FormData): Promise<void> {
  const me = await assertRole("admin");
  const parsed = endLinkSchema.safeParse(formValues(form));
  if (!parsed.success) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("professional_students")
    .update({ status: "ended", ends_at: new Date().toISOString(), photos_allowed: false })
    .eq("id", parsed.data.id);
  if (!error) await audit({ actorId: me.id, action: "link.end", entity: "professional_students", entityId: parsed.data.id });
  revalidatePath("/admin/vinculos");
}

export async function updatePriceAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertRole("admin");
  const parsed = priceUpdateSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("plan_prices")
    .update({ amount_cents: parsed.data.amount, active: parsed.data.active === "on" })
    .eq("id", parsed.data.id);
  if (error) return { error: "Não foi possível salvar." };
  await audit({ actorId: me.id, action: "price.update", entity: "plan_prices", entityId: parsed.data.id, metadata: { amount_cents: parsed.data.amount } });
  revalidatePath("/admin/planos");
  revalidatePath("/");
  return { ok: true, message: "Preço salvo." };
}

export async function createCouponAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertRole("admin");
  const parsed = couponSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coupons")
    .insert({
      code: d.code,
      discount_percent: d.discountPercent,
      campaign: d.campaign || null,
      expires_at: d.expiresAt ? `${d.expiresAt}T23:59:59-03:00` : null,
      max_uses: d.maxUses === "" ? null : d.maxUses,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.code === "23505" ? "Esse código já existe." : "Não foi possível criar." };
  await audit({ actorId: me.id, action: "coupon.create", entity: "coupons", entityId: data.id });
  revalidatePath("/admin/cupons");
  return { ok: true, message: "Cupom criado." };
}

export async function toggleCouponAction(form: FormData): Promise<void> {
  const me = await assertRole("admin");
  const parsed = couponToggleSchema.safeParse(formValues(form));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("coupons").update({ active: parsed.data.active === "true" }).eq("id", parsed.data.id);
  await audit({ actorId: me.id, action: "coupon.toggle", entity: "coupons", entityId: parsed.data.id, metadata: { active: parsed.data.active } });
  revalidatePath("/admin/cupons");
}

/** O admin cadastra o exercício; instruções só com revisão do profissional. */
export async function createExerciseAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const me = await assertRole("admin");
  const parsed = exerciseCreateSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercises")
    .insert({ name: parsed.data.name, muscle_group: parsed.data.muscleGroup })
    .select("id")
    .single();
  if (error || !data) return { error: "Não foi possível cadastrar." };
  await audit({ actorId: me.id, action: "exercise.create", entity: "exercises", entityId: data.id });
  revalidatePath("/admin/exercicios");
  return { ok: true, message: "Exercício cadastrado. Aguardando revisão de um profissional." };
}

export async function setExercisePublishedAction(form: FormData): Promise<void> {
  const me = await assertRole("admin");
  const parsed = exercisePublishSchema.safeParse(formValues(form));
  if (!parsed.success) return;
  const supabase = await createClient();
  const { error } = await supabase.from("exercises").update({ published: parsed.data.published === "true" }).eq("id", parsed.data.id);
  if (!error) {
    await audit({ actorId: me.id, action: "exercise.publish", entity: "exercises", entityId: parsed.data.id, metadata: { published: parsed.data.published } });
  }
  revalidatePath("/admin/exercicios");
}
