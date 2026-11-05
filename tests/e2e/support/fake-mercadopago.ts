// Mercado Pago simulado para testes. NÃO comprova o comportamento real; veja docs/CONFIGURACAO_EXTERNA.md.
import { createHmac, randomUUID } from "node:crypto";

export type FakePayment = {
  id: string;
  status: string;
  transaction_amount: number;
  external_reference?: string;
  payment_type_id?: string;
  date_approved?: string;
};

export function createFakeMercadoPago(appOrigin: string) {
  const payments = new Map<string, FakePayment>();
  const preapprovals = new Map<string, Record<string, unknown>>();
  const invoices = new Map<string, Record<string, unknown>>();
  const preferences: Record<string, unknown>[] = [];
  const refunds: string[] = [];

  async function handle(method: string, rawPath: string, body: unknown): Promise<{ status: number; json: unknown }> {
    const pathname = rawPath.replace(/\/$/, ""); // o SDK envia algumas rotas com barra no fim
    const b = (body ?? {}) as Record<string, unknown>;
    if (method === "POST" && pathname === "/checkout/preferences") {
      const pref = { ...b, id: randomUUID(), init_point: `${appOrigin}/assinatura/retorno?simulado=1` };
      preferences.push(pref);
      return { status: 201, json: pref };
    }
    if (method === "POST" && pathname === "/preapproval") {
      const id = randomUUID();
      const pre = { ...b, id, status: "pending", init_point: `${appOrigin}/assinatura/retorno?simulado=1` };
      preapprovals.set(id, pre);
      return { status: 201, json: pre };
    }
    let m = pathname.match(/^\/preapproval\/([^/]+)$/);
    if (m) {
      const pre = preapprovals.get(m[1]!);
      if (!pre) return { status: 404, json: { message: "not found" } };
      if (method === "PUT") Object.assign(pre, b);
      return { status: 200, json: pre };
    }
    m = pathname.match(/^\/v1\/payments\/([^/]+)\/refunds$/);
    if (m && method === "POST") {
      const p = payments.get(m[1]!);
      if (!p) return { status: 404, json: { message: "not found" } };
      refunds.push(m[1]!);
      return { status: 201, json: { id: Date.now(), payment_id: p.id, status: "approved" } };
    }
    m = pathname.match(/^\/v1\/payments\/([^/]+)$/);
    if (m && method === "GET") {
      const p = payments.get(m[1]!);
      return p ? { status: 200, json: p } : { status: 404, json: { message: "not found" } };
    }
    m = pathname.match(/^\/authorized_payments\/([^/]+)$/);
    if (m && method === "GET") {
      const i = invoices.get(m[1]!);
      return i ? { status: 200, json: i } : { status: 404, json: { message: "not found" } };
    }
    return { status: 404, json: { message: `rota não simulada: ${method} ${pathname}` } };
  }

  return { handle, payments, preapprovals, invoices, preferences, refunds };
}

export type FakeMercadoPago = ReturnType<typeof createFakeMercadoPago>;

/** Assina como o Mercado Pago, no formato conferido em node_modules/mercadopago/dist/utils/webhook. */
export function signWebhook(dataId: string, secret: string, requestId: string = randomUUID()) {
  const ts = String(Math.floor(Date.now() / 1000));
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  return { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": requestId };
}
