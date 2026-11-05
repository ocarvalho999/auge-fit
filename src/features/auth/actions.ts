"use server";

import { redirect } from "next/navigation";
import { fieldErrorsFrom, formValues, type ActionState } from "@/lib/action-state";
import { publicEnv } from "@/lib/env";
import { DOCUMENT_VERSION } from "@/lib/legal";
import { isRateLimited } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { newPasswordSchema, resetRequestSchema, signInSchema, signUpSchema } from "@/lib/validation/auth";
import { homeForRole } from "./session";

const TOO_MANY = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
const LOGIN_ERROR = "E-mail ou senha incorretos, ou e-mail ainda não confirmado.";
const RESET_SENT = "Se houver uma conta com esse e-mail, enviamos um link para criar uma nova senha.";

export async function signUpAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  if (await isRateLimited("signup", parsed.data.email)) return { error: TOO_MANY };

  const supabase = await createClient();
  // Papel nunca é enviado: o gatilho do banco sempre cria student e registra os aceites.
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${publicEnv.appUrl()}/auth/confirm?next=/onboarding`,
      data: {
        full_name: parsed.data.fullName,
        birth_date: parsed.data.birthDate,
        terms_version: DOCUMENT_VERSION,
        privacy_version: DOCUMENT_VERSION,
      },
    },
  });
  // Erro de senha fraca é útil para a pessoa; os demais não revelam se o e-mail existe.
  if (error?.code === "weak_password") {
    return { fieldErrors: { password: "Essa senha é muito fraca. Escolha outra." } };
  }
  if (error && error.code !== "user_already_exists" && error.code !== "email_exists") {
    return { error: "Não foi possível concluir o cadastro. Tente de novo em instantes." };
  }
  redirect("/cadastro/confirme");
}

export async function signInAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(formValues(form));
  if (!parsed.success) return { error: LOGIN_ERROR };
  if (await isRateLimited("login", parsed.data.email)) return { error: TOO_MANY };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { error: LOGIN_ERROR };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  redirect(homeForRole(profile?.role ?? "student"));
}

export async function requestPasswordResetAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = resetRequestSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  // Mesma resposta em todos os casos, inclusive no limite de uso.
  if (!(await isRateLimited("recovery", parsed.data.email))) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${publicEnv.appUrl()}/auth/confirm?next=/recuperar-senha/nova`,
    });
  }
  return { ok: true, message: RESET_SENT };
}

export async function updatePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Link expirado. Peça um novo link de recuperação." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Não foi possível alterar a senha. Escolha outra e tente de novo." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  redirect(homeForRole(profile?.role ?? "student"));
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
