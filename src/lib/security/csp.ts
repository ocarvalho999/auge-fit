/** CSP por requisição. Scripts só com nonce; estilo inline é necessário para os gráficos. */
export function buildCsp(options: { nonce: string; isDev: boolean; supabaseUrl?: string; https: boolean }): string {
  const supabase = options.supabaseUrl ? new URL(options.supabaseUrl).origin : "";
  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": `'self' 'nonce-${options.nonce}' 'strict-dynamic'${options.isDev ? " 'unsafe-eval'" : ""}`,
    "style-src": "'self' 'unsafe-inline'",
    "img-src": `'self' data: blob: ${supabase}`.trim(),
    "font-src": "'self'",
    "connect-src": `'self' ${supabase} https://*.ingest.sentry.io https://*.ingest.us.sentry.io`.trim(),
    "frame-ancestors": "'none'",
    "form-action": "'self' https://*.mercadopago.com.br https://*.mercadopago.com",
    "base-uri": "'self'",
    "object-src": "'none'",
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v}`);
  if (options.https) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}
