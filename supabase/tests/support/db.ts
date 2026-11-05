import { randomUUID } from "node:crypto";
import { Client, type QueryResultRow } from "pg";

const DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:54329/postgres";

export async function connect(): Promise<Client> {
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? DATABASE_URL });
  await client.connect();
  return client;
}

export type Db = Client;

/** Executa como um usuário autenticado, igual ao que o PostgREST faz, sempre revertendo no fim. */
export async function asUser<T>(db: Db, userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.query("savepoint as_user");
  try {
    await db.query(`set local role ${userId ? "authenticated" : "anon"}`);
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(userId ? { sub: userId, role: "authenticated" } : { role: "anon" }),
    ]);
    return await fn();
  } finally {
    await db.query("rollback to savepoint as_user");
    await db.query("reset role");
    await db.query("select set_config('request.jwt.claims', '', true)");
  }
}

export async function rows<R extends QueryResultRow>(db: Db, sql: string, params: unknown[] = []): Promise<R[]> {
  return (await db.query<R>(sql, params)).rows;
}

/** Espera que o comando seja recusado (erro de permissão, RLS ou gatilho). */
export async function denied(db: Db, sql: string, params: unknown[] = []): Promise<boolean> {
  await db.query("savepoint attempt");
  try {
    await db.query(sql, params);
    await db.query("release savepoint attempt");
    return false;
  } catch {
    await db.query("rollback to savepoint attempt");
    return true;
  }
}

export async function createUser(db: Db, overrides: { invited?: boolean; birthDate?: string; name?: string } = {}) {
  const id = randomUUID();
  await db.query(
    `insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values ($1, $2, $3, $4)`,
    [
      id,
      `${id}@teste.invalid`,
      JSON.stringify(overrides.invited ? { invited: true } : {}),
      JSON.stringify(
        overrides.invited
          ? { full_name: overrides.name ?? "Convidado" }
          : {
              full_name: overrides.name ?? "Pessoa de Teste",
              birth_date: overrides.birthDate ?? "1990-01-01",
              terms_version: "2026-11-05",
              privacy_version: "2026-11-05",
            },
      ),
    ],
  );
  return id;
}

export async function createAdmin(db: Db) {
  const id = await createUser(db, { invited: true, name: "Admin" });
  await db.query("update public.profiles set role = 'admin' where id = $1", [id]);
  return id;
}

export async function createProfessional(db: Db, capacity = 15) {
  const profileId = await createUser(db, { invited: true, name: "Profissional" });
  await db.query("update public.profiles set role = 'professional' where id = $1", [profileId]);
  const { rows: r } = await db.query<{ id: string }>(
    `insert into public.professionals (profile_id, cref_number, cref_uf, cref_verified_at, capacity, status)
     values ($1, '000000-G', 'SP', now(), $2, 'active') returning id`,
    [profileId, capacity],
  );
  return { profileId, professionalId: r[0]!.id };
}

export async function priceId(db: Db, code: string, interval: string) {
  const { rows: r } = await db.query<{ id: string }>(
    `select pp.id from public.plan_prices pp join public.plans p on p.id = pp.plan_id
     where p.code = $1 and pp.interval = $2`,
    [code, interval],
  );
  return r[0]!.id;
}

export async function subscribe(
  db: Db,
  userId: string,
  code = "basic",
  interval = "month",
  { status = "active", days = 30 }: { status?: string; days?: number } = {},
) {
  const { rows: r } = await db.query<{ id: string }>(
    `insert into public.subscriptions (profile_id, plan_price_id, status, expected_amount_cents, current_period_end, grace_until)
     values ($1, $2, $3, 100, now() + make_interval(days => $4), now() + make_interval(days => $4))
     returning id`,
    [userId, await priceId(db, code, interval), status, days],
  );
  return r[0]!.id;
}

export async function link(
  db: Db,
  professionalId: string,
  studentId: string,
  { photosAllowed = false }: { photosAllowed?: boolean } = {},
) {
  if (photosAllowed) {
    await db.query(
      `insert into public.consents (profile_id, type, document_version) values ($1, 'photos_professional', 'v1')`,
      [studentId],
    );
  }
  const { rows: r } = await db.query<{ id: string }>(
    `insert into public.professional_students (professional_id, student_id, photos_allowed)
     values ($1, $2, false) returning id`,
    [professionalId, studentId],
  );
  if (photosAllowed) {
    await db.query("update public.professional_students set photos_allowed = true where id = $1", [r[0]!.id]);
  }
  return r[0]!.id;
}

export async function createExercise(db: Db, reviewedBy: string) {
  const { rows: r } = await db.query<{ id: string }>(
    `insert into public.exercises (name, muscle_group, reviewed_by, published)
     values ('Exercício de teste', 'Teste', $1, true) returning id`,
    [reviewedBy],
  );
  return r[0]!.id;
}
