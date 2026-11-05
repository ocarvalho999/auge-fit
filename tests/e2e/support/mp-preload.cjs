// Só no ambiente E2E: desvia as chamadas do SDK do Mercado Pago para o simulador local.
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (href.startsWith("https://api.mercadopago.com/")) {
    const target = href.replace("https://api.mercadopago.com", "http://127.0.0.1:54399/__mp");
    return realFetch(target, init);
  }
  return realFetch(input, init);
};
