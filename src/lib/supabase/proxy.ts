import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { sessionCookieOptions } from "./cookies";
import type { Database } from "./database.types";

/** Renova a sessão nos cookies e devolve a resposta junto do usuário atual. */
export async function updateSession(request: NextRequest, requestHeaders: Headers) {
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  if (!isSupabaseConfigured()) return { response, userId: null };

  const supabase = createServerClient<Database>(publicEnv.supabaseUrl(), publicEnv.supabaseAnonKey(), {
    cookieOptions: sessionCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  return { response, userId: data.user?.id ?? null };
}
