"use server";

import { z } from "zod";
import { fieldErrorsFrom, formValues, type ActionState } from "@/lib/action-state";
import { isRateLimited } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")),
  source: z.enum(["landing", "black_sold_out"]),
  planCode: z.enum(["basic", "pro", "black"]).optional(),
  consent: z.literal("on", { error: "É preciso autorizar o contato." }),
});

export async function joinWaitlistAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(formValues(form));
  if (!parsed.success) return fieldErrorsFrom(parsed.error);
  if (await isRateLimited("waitlist")) return { error: "Muitas tentativas. Tente mais tarde." };

  const { error } = await createAdminClient().from("waitlist_entries").upsert(
    {
      email: parsed.data.email,
      source: parsed.data.source,
      plan_code: parsed.data.planCode ?? null,
      consented_at: new Date().toISOString(),
    },
    { onConflict: "email,source" },
  );
  if (error) return { error: "Não foi possível registrar agora. Tente de novo." };
  return { ok: true, message: "Pronto. Avisaremos por e-mail quando houver novidade." };
}
