import "server-only";
import { Resend } from "resend";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderTemplate, type TemplateName } from "./templates";

export interface EmailSender {
  send(input: { to: string; subject: string; html: string }): Promise<{ id: string | null }>;
}

class ResendSender implements EmailSender {
  constructor(
    private readonly client: Resend,
    private readonly from: string,
  ) {}
  async send({ to, subject, html }: { to: string; subject: string; html: string }) {
    const { data, error } = await this.client.emails.send({ from: this.from, to, subject, html });
    if (error) throw new Error(`Resend: ${error.name}`);
    return { id: data?.id ?? null };
  }
}

export function getEmailSender(): EmailSender | null {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  return key && from ? new ResendSender(new Resend(key), from) : null;
}

/**
 * Registra em notifications e envia. A chave de deduplicação torna as rotinas idempotentes.
 * Sem provedor configurado, o registro fica como "skipped": nada é dado como enviado.
 * Nunca lança erro: falha de e-mail não pode derrubar pagamento nem cadastro.
 */
export async function notify(input: {
  profileId: string;
  template: TemplateName;
  dedupeKey?: string;
  actionUrl?: string;
}): Promise<"sent" | "skipped" | "failed" | "duplicate"> {
  const admin = createAdminClient();
  try {
    const { data: row, error } = await admin
      .from("notifications")
      .insert({ profile_id: input.profileId, template: input.template, dedupe_key: input.dedupeKey ?? null })
      .select("id")
      .single();
    if (error?.code === "23505") return "duplicate";
    if (error || !row) return "failed";

    const sender = getEmailSender();
    if (!sender) {
      await admin.from("notifications").update({ status: "skipped" }).eq("id", row.id);
      return "skipped";
    }
    try {
      const { data: user } = await admin.auth.admin.getUserById(input.profileId);
      if (!user.user?.email) throw new Error("Usuário sem e-mail");
      const { subject, html } = renderTemplate(input.template, {
        appUrl: publicEnv.appUrl(),
        actionUrl: input.actionUrl,
      });
      const { id } = await sender.send({ to: user.user.email, subject, html });
      await admin
        .from("notifications")
        .update({ status: "sent", sent_at: new Date().toISOString(), provider_message_id: id })
        .eq("id", row.id);
      return "sent";
    } catch {
      await admin.from("notifications").update({ status: "failed" }).eq("id", row.id);
      return "failed";
    }
  } catch {
    return "failed";
  }
}
