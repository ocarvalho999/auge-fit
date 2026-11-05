import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const LIMITS = {
  login: { max: 10, windowSeconds: 300 },
  signup: { max: 5, windowSeconds: 3600 },
  recovery: { max: 5, windowSeconds: 3600 },
  upload: { max: 30, windowSeconds: 3600 },
  coupon: { max: 15, windowSeconds: 3600 },
  checkout: { max: 15, windowSeconds: 3600 },
  waitlist: { max: 5, windowSeconds: 3600 },
} as const;

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "desconhecido";
}

/** Conta por IP e, quando houver, por usuário ou e-mail. Em falha do contador, nega só a ação limitada. */
export async function isRateLimited(action: keyof typeof LIMITS, subject?: string): Promise<boolean> {
  const { max, windowSeconds } = LIMITS[action];
  const admin = createAdminClient();
  const keys = [`${action}:ip:${await clientIp()}`];
  if (subject) keys.push(`${action}:sub:${subject}`);
  for (const key of keys) {
    const { data, error } = await admin.rpc("rate_limit_hit", { p_key: key, p_window_seconds: windowSeconds });
    if (error || (data ?? 0) > max) return true;
  }
  return false;
}
