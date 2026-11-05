/** Só aceita caminho interno: evita redirecionamento aberto. */
export function safeNext(next: string | null): string {
  return next && /^\/[A-Za-z0-9/_-]*$/.test(next) && !next.startsWith("//") ? next : "/inicio";
}
