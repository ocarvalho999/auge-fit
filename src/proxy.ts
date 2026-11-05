import { NextResponse, type NextRequest } from "next/server";
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
  const { response, userId } = await updateSession(request, new Headers(request.headers));

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));
  if (isProtected && !userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|manifest.webmanifest|sw.js|favicon.ico|api/webhooks|api/cron).*)"],
};
