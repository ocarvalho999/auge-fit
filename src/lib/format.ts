const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const formatCents = (cents: number) => BRL.format(cents / 100);

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  // Data pura (AAAA-MM-DD) não muda de dia por causa do fuso.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(iso));
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export const INTERVAL_LABEL: Record<string, string> = {
  month: "por mês",
  quarter: "por trimestre",
  package: "por 8 semanas",
};
