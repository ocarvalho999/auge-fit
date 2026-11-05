import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Role = "student" | "professional" | "admin";

export const homeForRole = (role: string) =>
  role === "admin" ? "/admin" : role === "professional" ? "/profissional" : "/inicio";

export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
  return data;
});

/** Primeira camada: a rota confere o perfil. A ação confere de novo e a RLS decide no banco. */
export async function requireRole(role: Role): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "active") redirect("/login?suspensa=1");
  if (profile.role !== role) redirect(homeForRole(profile.role));
  return profile;
}

export class NotAuthorizedError extends Error {
  constructor() {
    super("Sem permissão.");
  }
}

/** Para ações de servidor: lança erro em vez de redirecionar. */
export async function assertRole(role: Role): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || profile.status !== "active" || profile.role !== role) throw new NotAuthorizedError();
  return profile;
}
