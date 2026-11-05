// Webhook e rotinas de verdade, com Postgres real. Só o Mercado Pago é simulado.
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { connect, createProfessional, createUser, priceId, rows, type Db } from "../../supabase/tests/support/db";
import { ANON_KEY, SERVICE_KEY, startFakeSupabase } from "../e2e/support/fake-supabase";
import { createFakeMercadoPago, signWebhook, type FakeMercadoPago } from "../e2e/support/fake-mercadopago";

const SECRET = "segredo-de-teste";
const PORT = 54398;
let db: Db;
let mp: FakeMercadoPago;
let fake: { stop: () => Promise<void> };
let POST: (request: NextRequest) => Promise<Response>;
let cronGET: (request: NextRequest) => Promise<Response>;

beforeAll(async () => {
  db = await connect();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `http://127.0.0.1:${PORT}`);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_KEY);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY);
  vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "token-de-teste");
  vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("CRON_SECRET", "cron-de-teste");
  fake = await startFakeSupabase(process.env.TEST_DATABASE_URL!, PORT, "http://localhost:3100");
  mp = createFakeMercadoPago("http://localhost:3100");

  const realFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== "api.mercadopago.com") return realFetch(input, init);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    const { status, json } = await mp.handle(init?.method ?? "GET", url.pathname, body);
    return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
  });

  POST = (await import("@/app/api/webhooks/mercadopago/route")).POST;
  cronGET = (await import("@/app/api/cron/daily/route")).GET;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await fake.stop();
  await db.end();
});

function webhook(topic: string, dataId: string, opts: { headers?: Record<string, string>; notificationId?: string | number; requestId?: string } = {}) {
  const headers = opts.headers ?? signWebhook(dataId, SECRET, opts.requestId);
  return new NextRequest(`http://localhost/api/webhooks/mercadopago?data.id=${dataId}&type=${topic}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ id: opts.notificationId ?? randomUUID(), type: topic, action: "payment.updated", data: { id: dataId } }),
  });
}

async function pendingSubscription(code = "basic", interval = "quarter", cents = 9990) {
  const user = await createUser(db);
  const [sub] = await rows<{ id: string }>(
    db,
    `insert into public.subscriptions (profile_id, plan_price_id, status, expected_amount_cents) values ($1, $2, 'pending', $3) returning id`,
    [user, await priceId(db, code, interval), cents],
  );
  return { user, subId: sub!.id };
}

function pay(subId: string, status: string, amount = 99.9, id: string = randomUUID()) {
  mp.payments.set(id, {
    id,
    status,
    transaction_amount: amount,
    external_reference: subId,
    payment_type_id: "pix",
    date_approved: new Date().toISOString(),
  });
  return id;
}

const subOf = async (id: string) =>
  (await rows<{ status: string; current_period_end: string | null; grace_until: string | null }>(db, `select status, current_period_end::text, grace_until::text from public.subscriptions where id = $1`, [id]))[0]!;

const entitled = async (user: string, feature = "log_workouts") =>
  (await rows<{ v: boolean }>(db, `select public.has_entitlement($1, $2) as v`, [user, feature]))[0]!.v;

describe("assinatura do webhook", () => {
  it("assinatura inválida: 401, nada gravado, nenhuma consulta muda acesso", async () => {
    const { user, subId } = await pendingSubscription();
    const id = pay(subId, "approved");
    const before = (await rows(db, `select id from public.webhook_events`)).length;
    const forged = signWebhook(id, "segredo-errado");
    const r = await POST(webhook("payment", id, { headers: forged }));
    expect(r.status).toBe(401);
    expect((await rows(db, `select id from public.webhook_events`)).length).toBe(before);
    expect(await entitled(user)).toBe(false);
  });

  it("sem cabeçalho de assinatura: 401", async () => {
    const r = await POST(webhook("payment", "123", { headers: {} }));
    expect(r.status).toBe(401);
  });

  it("assinatura de outro data.id: 401", async () => {
    const { subId } = await pendingSubscription();
    const id = pay(subId, "approved");
    const r = await POST(webhook("payment", id, { headers: signWebhook("outro-id", SECRET) }));
    expect(r.status).toBe(401);
  });
});

describe("pagamento único", () => {
  it("aprovado libera acesso com trimestre e 5 dias de carência", async () => {
    const { user, subId } = await pendingSubscription();
    expect(await entitled(user)).toBe(false);
    const id = pay(subId, "approved");
    expect((await POST(webhook("payment", id))).status).toBe(200);
    const sub = await subOf(subId);
    expect(sub.status).toBe("active");
    const days = (new Date(sub.grace_until!).getTime() - new Date(sub.current_period_end!).getTime()) / 864e5;
    expect(days).toBe(5);
    expect(await entitled(user)).toBe(true);
    const [row] = await rows<{ status: string; amount_cents: number; method: string }>(db, `select status, amount_cents, method from public.payments where provider_payment_id = $1`, [id]);
    expect(row).toEqual({ status: "approved", amount_cents: 9990, method: "pix" });
  });

  it("evento repetido é descartado: sem efeito em dobro", async () => {
    const { subId } = await pendingSubscription();
    const id = pay(subId, "approved");
    const notificationId = randomUUID();
    await POST(webhook("payment", id, { notificationId }));
    const first = await subOf(subId);
    const r = await POST(webhook("payment", id, { notificationId }));
    expect(await r.json()).toMatchObject({ duplicate: true });
    expect((await subOf(subId)).current_period_end).toBe(first.current_period_end);
    expect(await rows(db, `select id from public.payments where provider_payment_id = $1`, [id])).toHaveLength(1);
    expect(await rows(db, `select id from public.webhook_events where provider_event_key = $1`, [`notification:${notificationId}`])).toHaveLength(1);
  });

  it("outra notificação do mesmo pagamento também não estende o período", async () => {
    const { subId } = await pendingSubscription();
    const id = pay(subId, "approved");
    await POST(webhook("payment", id));
    const first = await subOf(subId);
    await POST(webhook("payment", id));
    expect((await subOf(subId)).current_period_end).toBe(first.current_period_end);
    const notes = await rows(db, `select id from public.notifications where dedupe_key = $1`, [`payment_confirmed:${id}`]);
    expect(notes).toHaveLength(1);
  });

  it("evento fora de ordem: aviso antigo de 'pendente' depois do aprovado não regride", async () => {
    const { user, subId } = await pendingSubscription();
    const id = pay(subId, "approved");
    await POST(webhook("payment", id));
    // A notificação antiga chega depois, mas a API já diz "approved": é a API que vale.
    await POST(webhook("payment", id, { notificationId: "antiga-pendente" }));
    expect((await subOf(subId)).status).toBe("active");
    expect(await entitled(user)).toBe(true);
  });

  it("fora de ordem: reembolso processado não volta a aprovado com aviso atrasado", async () => {
    const { user, subId } = await pendingSubscription();
    const id = pay(subId, "approved");
    await POST(webhook("payment", id));
    mp.payments.get(id)!.status = "refunded";
    await POST(webhook("payment", id));
    await POST(webhook("payment", id, { notificationId: "aprovado-atrasado" }));
    expect((await subOf(subId)).status).toBe("refunded");
    expect(await entitled(user)).toBe(false);
  });

  it("valor adulterado: aprovado no provedor, mas sem acesso e com auditoria", async () => {
    const { user, subId } = await pendingSubscription();
    const id = pay(subId, "approved", 1.0);
    expect((await POST(webhook("payment", id))).status).toBe(200);
    expect((await subOf(subId)).status).toBe("pending");
    expect(await entitled(user)).toBe(false);
    const [row] = await rows<{ id: string; status: string }>(db, `select id, status from public.payments where provider_payment_id = $1`, [id]);
    expect(row?.status).toBe("amount_mismatch");
    expect(await rows(db, `select id from public.audit_logs where action = 'payment.amount_mismatch' and entity_id = $1`, [row!.id])).toHaveLength(1);
  });

  it("recusado não libera e registra aviso", async () => {
    const { user, subId } = await pendingSubscription();
    const id = pay(subId, "rejected");
    await POST(webhook("payment", id));
    expect(await entitled(user)).toBe(false);
    expect(await rows(db, `select id from public.notifications where template = 'payment_failed' and profile_id = $1`, [user])).toHaveLength(1);
  });

  it("referência desconhecida é ignorada sem erro", async () => {
    const id = randomUUID();
    mp.payments.set(id, { id, status: "approved", transaction_amount: 1, external_reference: "nao-e-uuid" });
    expect((await POST(webhook("payment", id))).status).toBe(200);
    expect(await rows(db, `select id from public.payments where provider_payment_id = $1`, [id])).toEqual([]);
  });

  it("falha na API do provedor devolve 500 e permite reprocessar", async () => {
    const { user, subId } = await pendingSubscription();
    const id = randomUUID();
    const notificationId = randomUUID();
    const first = await POST(webhook("payment", id, { notificationId }));
    expect(first.status).toBe(500);
    pay(subId, "approved", 99.9, id);
    const retry = await POST(webhook("payment", id, { notificationId }));
    expect(retry.status).toBe(200);
    expect(await entitled(user)).toBe(true);
  });
});

describe("reembolso", () => {
  it("só termina o acesso quando o webhook confirma, e corta o vínculo", async () => {
    const { user, subId } = await pendingSubscription("black", "package", 69700);
    const pro = await createProfessional(db);
    const id = pay(subId, "approved", 697);
    await POST(webhook("payment", id));
    expect((await subOf(subId)).current_period_end).toBeNull();
    expect(await entitled(user, "checkins")).toBe(true);
    await db.query(`select public.link_black_student($1, $2, $3)`, [subId, pro.professionalId, user]);
    const after = await subOf(subId);
    expect(Math.round((new Date(after.current_period_end!).getTime() - Date.now()) / 864e5)).toBe(56);

    // Pedir o reembolso no provedor ainda não muda nada aqui.
    expect(await entitled(user, "checkins")).toBe(true);
    mp.payments.get(id)!.status = "refunded";
    await POST(webhook("payment", id));
    expect((await subOf(subId)).status).toBe("refunded");
    expect(await entitled(user, "checkins")).toBe(false);
    const [link] = await rows<{ status: string }>(db, `select status from public.professional_students where subscription_id = $1`, [subId]);
    expect(link?.status).toBe("ended");
    const [payment] = await rows<{ refunded_at: string | null }>(db, `select refunded_at from public.payments where provider_payment_id = $1`, [id]);
    expect(payment?.refunded_at).not.toBeNull();
  });
});

describe("assinatura mensal", () => {
  async function monthly() {
    const { user, subId } = await pendingSubscription("basic", "month", 3990);
    const preId = randomUUID();
    await db.query(`update public.subscriptions set provider_id = $2 where id = $1`, [subId, preId]);
    mp.preapprovals.set(preId, {
      id: preId, status: "authorized", external_reference: subId,
      auto_recurring: { transaction_amount: 39.9 }, next_payment_date: new Date(Date.now() + 30 * 864e5).toISOString(),
    });
    return { user, subId, preId };
  }

  it("autorização sozinha não libera acesso; a cobrança aprovada libera", async () => {
    const { user, subId, preId } = await monthly();
    await POST(webhook("subscription_preapproval", preId));
    expect(await entitled(user)).toBe(false);
    const paymentId = pay(subId, "approved", 39.9);
    const invoiceId = randomUUID();
    mp.invoices.set(invoiceId, { id: invoiceId, preapproval_id: preId, payment: { id: paymentId, status: "approved" } });
    expect((await POST(webhook("subscription_authorized_payment", invoiceId))).status).toBe(200);
    expect(await entitled(user)).toBe(true);
    expect((await subOf(subId)).status).toBe("active");
  });

  it("valor da assinatura diferente do contratado é auditado", async () => {
    const { user, preId, subId } = await monthly();
    mp.preapprovals.get(preId)!.auto_recurring = { transaction_amount: 1 };
    await POST(webhook("subscription_preapproval", preId));
    expect(await entitled(user)).toBe(false);
    expect(await rows(db, `select id from public.audit_logs where action = 'subscription.amount_mismatch' and entity_id = $1`, [subId])).toHaveLength(1);
  });

  it("falha de cobrança deixa em past_due com carência; cancelada no provedor mantém até o fim do período", async () => {
    const { user, subId, preId } = await monthly();
    const ok = pay(subId, "approved", 39.9);
    await POST(webhook("payment", ok));
    const failed = pay(subId, "rejected", 39.9);
    await POST(webhook("payment", failed));
    expect((await subOf(subId)).status).toBe("past_due");
    expect(await entitled(user)).toBe(true);

    mp.preapprovals.get(preId)!.status = "canceled";
    await POST(webhook("subscription_preapproval", preId));
    const sub = await subOf(subId);
    expect(sub.status).toBe("cancelled");
    expect(sub.grace_until).toBe(sub.current_period_end);
    expect(await entitled(user)).toBe(true);
  });
});

describe("carência e vencimento", () => {
  const cron = (auth?: string) =>
    cronGET(new NextRequest("http://localhost/api/cron/daily", { headers: auth ? { authorization: auth } : {} }));

  it("rotina exige o segredo", async () => {
    expect((await cron()).status).toBe(401);
    expect((await cron("Bearer errado")).status).toBe(401);
  });

  it("dentro da carência segue liberado; passada a carência vence e a rotina é idempotente", async () => {
    const { user, subId } = await pendingSubscription();
    await POST(webhook("payment", pay(subId, "approved")));

    await db.query(`update public.subscriptions set current_period_end = now() - interval '2 days', grace_until = now() + interval '3 days' where id = $1`, [subId]);
    expect((await cron("Bearer cron-de-teste")).status).toBe(200);
    expect((await subOf(subId)).status).toBe("active");
    expect(await entitled(user)).toBe(true);

    await db.query(`update public.subscriptions set current_period_end = now() - interval '6 days', grace_until = now() - interval '1 day' where id = $1`, [subId]);
    expect(await entitled(user)).toBe(false);
    await cron("Bearer cron-de-teste");
    expect((await subOf(subId)).status).toBe("expired");
    const second = await (await cron("Bearer cron-de-teste")).json();
    expect(second.ok).toBe(true);
    expect((await subOf(subId)).status).toBe("expired");
  });

  it("aviso do trimestre sai 7 dias antes, uma única vez", async () => {
    const { user, subId } = await pendingSubscription();
    await POST(webhook("payment", pay(subId, "approved")));
    await db.query(`update public.subscriptions set current_period_end = now() + interval '6 days 12 hours', grace_until = now() + interval '11 days' where id = $1`, [subId]);
    await cron("Bearer cron-de-teste");
    await cron("Bearer cron-de-teste");
    expect(await rows(db, `select id from public.notifications where template = 'quarter_expiring_7' and profile_id = $1`, [user])).toHaveLength(1);
  });

  it("vínculo com prazo vencido é encerrado pela rotina", async () => {
    const user = await createUser(db);
    const pro = await createProfessional(db);
    const [link] = await rows<{ id: string }>(db, `insert into public.professional_students (professional_id, student_id, ends_at) values ($1, $2, now() - interval '1 hour') returning id`, [pro.professionalId, user]);
    await cron("Bearer cron-de-teste");
    const [after] = await rows<{ status: string }>(db, `select status from public.professional_students where id = $1`, [link!.id]);
    expect(after?.status).toBe("ended");
  });
});

describe("vagas do Black", () => {
  it("corrida pela última vaga: entre 12 conexões simultâneas, só uma leva", async () => {
    await db.query(`update public.professionals set status = 'inactive'`);
    const pro = await createProfessional(db, 1);
    const students = await Promise.all(Array.from({ length: 12 }, () => createUser(db)));
    const connections = await Promise.all(students.map(() => connect()));
    const results = await Promise.all(
      students.map((s, i) => connections[i]!.query<{ id: string | null }>(`select public.reserve_black_slot($1) as id`, [s])),
    );
    await Promise.all(connections.map((c) => c.end()));
    const won = results.map((r) => r.rows[0]?.id).filter(Boolean);
    expect(won).toHaveLength(1);
    const [count] = await rows<{ n: string }>(db, `select count(*) as n from public.black_slot_reservations where professional_id = $1 and status = 'pending'`, [pro.professionalId]);
    expect(Number(count?.n)).toBe(1);
  });

  it("reserva vencida libera a vaga; a mesma pessoa não pega duas", async () => {
    await db.query(`update public.professionals set status = 'inactive'`);
    const pro = await createProfessional(db, 1);
    const a = await createUser(db);
    const b = await createUser(db);
    const [first] = await rows<{ id: string }>(db, `select public.reserve_black_slot($1) as id`, [a]);
    const [again] = await rows<{ id: string }>(db, `select public.reserve_black_slot($1) as id`, [a]);
    expect(again?.id).toBe(first?.id);
    const [blocked] = await rows<{ id: string | null }>(db, `select public.reserve_black_slot($1) as id`, [b]);
    expect(blocked?.id).toBeNull();
    await db.query(`update public.black_slot_reservations set expires_at = now() - interval '1 minute' where id = $1`, [first!.id]);
    const [freed] = await rows<{ id: string | null }>(db, `select public.reserve_black_slot($1) as id`, [b]);
    expect(freed?.id).toBeTruthy();
    expect(pro.professionalId).toBeTruthy();
  });

  it("pagamento depois de a reserva expirar volta a ocupar a vaga", async () => {
    await db.query(`update public.professionals set status = 'inactive'`);
    await createProfessional(db, 1);
    const { user, subId } = await pendingSubscription("black", "package", 69700);
    const [r] = await rows<{ id: string }>(db, `select public.reserve_black_slot($1) as id`, [user]);
    await db.query(`update public.black_slot_reservations set subscription_id = $2, status = 'expired', expires_at = now() - interval '1 hour' where id = $1`, [r!.id, subId]);
    await POST(webhook("payment", pay(subId, "approved", 697)));
    const [after] = await rows<{ status: string }>(db, `select status from public.black_slot_reservations where id = $1`, [r!.id]);
    expect(after?.status).toBe("paid");
    const [blocked] = await rows<{ id: string | null }>(db, `select public.reserve_black_slot($1) as id`, [await createUser(db)]);
    expect(blocked?.id).toBeNull();
  });

  it("vaga paga e ainda sem vínculo continua ocupada", async () => {
    await db.query(`update public.professionals set status = 'inactive'`);
    await createProfessional(db, 1);
    const a = await createUser(db);
    const b = await createUser(db);
    const [r] = await rows<{ id: string }>(db, `select public.reserve_black_slot($1) as id`, [a]);
    await db.query(`update public.black_slot_reservations set status = 'paid', expires_at = now() - interval '1 hour' where id = $1`, [r!.id]);
    const [blocked] = await rows<{ id: string | null }>(db, `select public.reserve_black_slot($1) as id`, [b]);
    expect(blocked?.id).toBeNull();
  });
});
