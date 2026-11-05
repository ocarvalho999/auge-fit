"use client";

import { ActionForm, CheckboxField, SubmitButton } from "@/components/ui/form";
import { setConsentAction } from "@/features/account/consent-actions";

/** Cada consentimento tem caixa própria, nunca marcada por padrão até a pessoa autorizar. */
export function ConsentToggle({ type, granted, label }: { type: string; granted: boolean; label: string }) {
  return (
    <ActionForm action={setConsentAction} className="space-y-2">
      <input type="hidden" name="type" value={type} />
      <CheckboxField name="grant" defaultChecked={granted} key={String(granted)}>
        {label}
      </CheckboxField>
      <SubmitButton variant="secondary" pendingLabel="Salvando...">
        Salvar autorização
      </SubmitButton>
    </ActionForm>
  );
}
