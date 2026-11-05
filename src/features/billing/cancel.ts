import "server-only";

/** Implementado na fase de pagamentos. Enquanto não há integração, não existe cobrança a cancelar. */
export async function cancelProviderSubscriptionsFor(_profileId: string): Promise<boolean> {
  return true;
}
