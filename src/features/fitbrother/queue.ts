// Regras da fila manual de acesso ao FitBrother, sem dependências externas.

export type AccessRow = {
  id: string;
  profile_id: string | null;
  whatsapp: string | null;
  granted_at: string | null;
  revoked_at: string | null;
};

/** Aceita o número como a pessoa digita e devolve com o código do Brasil. Null se for inválido. */
export function normalizeWhatsapp(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  // DDD de 11 a 99 e número fixo (8 dígitos) ou celular (9 dígitos, começando com 9).
  if (!/^[1-9][1-9]/.test(digits)) return null;
  if (digits.length === 11 && digits[2] !== "9") return null;
  if (digits.length !== 10 && digits.length !== 11) return null;
  return `55${digits}`;
}

/** Separa quem precisa de ação. Quem perde o direito precisa ser removido do app à mão. */
export function classifyAccess(rows: AccessRow[], entitledIds: Set<string>) {
  const isActive = (r: AccessRow) => Boolean(r.granted_at) && !r.revoked_at;
  const withNumber = new Set(rows.filter((r) => r.profile_id && r.whatsapp).map((r) => r.profile_id));
  const covered = (r: AccessRow) => Boolean(r.profile_id) && entitledIds.has(r.profile_id!);
  return {
    toGrant: rows.filter((r) => covered(r) && r.whatsapp && !isActive(r)),
    toRevoke: rows.filter((r) => isActive(r) && !covered(r)),
    active: rows.filter((r) => isActive(r) && covered(r)),
    awaitingNumber: [...entitledIds].filter((id) => !withNumber.has(id)),
  };
}
