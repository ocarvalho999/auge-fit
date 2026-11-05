import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Redes móveis colocam muita gente atrás do mesmo IP, então o limite por IP é mais folgado que o por pessoa.
export const LIMITS = {
  login: { max: 10, ipMax: 60, windowSeconds: 300 },
  signup: { max: 5, ipMax: 40, windowSeconds: 3600 },
  recovery: { max: 5, ipMax: 40, windowSeconds: 3600 },
  upload: { max: 30, ipMax: 120, windowSeconds: 3600 },
  coupon: { max: 15, ipMax: 60, windowSeconds: 3600 },
  checkout: { max: 15, ipMax: 60, windowSeconds: 3600 },
  waitlist: { max: 5, ipMax: 40, windowSeconds: 3600 },
} as const;

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
}

/** Conta por IP e, quando houver, por usuário ou e-mail. Em falha do contador, nega só a ação limitada. */
export async function isRateLimited(action: keyof typeof LIMITS, subject?: string): Promise<boolean> {
  const { max, ipMax, windowSeconds } = LIMITS[action];
  const admin = createAdminClient();
  const checks: [string, number][] = [[`${action}:ip:${await clientIp()}`, ipMax]];
  if (subject) checks.push([`${action}:sub:${subject}`, max]);
  for (const [key, limit] of checks) {
    const { data, error } = await admin.rpc("rate_limit_hit", { p_key: key, p_window_seconds: windowSeconds });
    if (error || (data ?? 0) > limit) return true;
  }
  return false;
}
