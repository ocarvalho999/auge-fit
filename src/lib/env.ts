import { z } from "zod";

// Variáveis lidas sob demanda: o build não depende de credenciais reais.
const required = (name: string, value: string | undefined) => {
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
};

export const publicEnv = {
  appUrl: () => z.url().parse(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
};

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
