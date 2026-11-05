"use client";

import { ActionForm, CheckboxField, Field, SubmitButton } from "@/components/ui/form";
import { joinWaitlistAction } from "@/features/billing/waitlist-actions";

export function WaitlistForm({ source, planCode }: { source: "landing" | "black_sold_out"; planCode?: string }) {
  return (
    <ActionForm action={joinWaitlistAction} resetOnSuccess>
      <input type="hidden" name="source" value={source} />
      {planCode ? <input type="hidden" name="planCode" value={planCode} /> : null}
      <Field name="email" label="Seu e-mail" type="email" autoComplete="email" inputMode="email" required />
      <CheckboxField name="consent">Autorizo o contato por e-mail sobre a abertura de vagas.</CheckboxField>
      <SubmitButton>Entrar na lista de espera</SubmitButton>
    </ActionForm>
  );
}
