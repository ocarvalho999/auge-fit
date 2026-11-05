import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/proxy";

const PROTECTED = [
  "/inicio",
  "/onboarding",
  "/treinos",
  "/evolucao",
  "/checkins",
  "/assinatura",
  "/configuracoes",
  "/profissional",
  "/admin",
];

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    https: (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://"),
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const { response, userId } = await updateSession(request, requestHeaders);

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));
  const final = isProtected && !userId ? NextResponse.redirect(new URL("/login", request.url)) : response;
  final.headers.set("content-security-policy", csp);
  return final;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|manifest.webmanifest|favicon.ico|api/webhooks|api/cron).*)"],
};
