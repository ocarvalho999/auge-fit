import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database, Json } from "./database.types";

/** Único ponto com a chave de serviço. Exclusivo do servidor; ignora RLS. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Variável de ambiente ausente: SUPABASE_SERVICE_ROLE_KEY");
  return createClient<Database>(publicEnv.supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function audit(entry: {
  actorId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Json;
}) {
  const { error } = await createAdminClient().from("audit_logs").insert({
    actor_id: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId ?? null,
    metadata: entry.metadata ?? {},
  });
  if (error) throw new Error(`Falha ao gravar auditoria: ${error.code}`);
}
