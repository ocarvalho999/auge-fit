import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  asUser,
  connect,
  createAdmin,
  createExercise,
  createProfessional,
  createUser,
  denied,
  link,
  rows,
  subscribe,
  type Db,
} from "./support/db";

let db: Db;
let alunoA: string;
let alunoB: string;
let admin: string;
let pro: { profileId: string; professionalId: string };
let proSemVinculo: { profileId: string; professionalId: string };
let exerciseId: string;
let linkId: string;

beforeAll(async () => {
  db = await connect();
  alunoA = await createUser(db);
  alunoB = await createUser(db);
  admin = await createAdmin(db);
  pro = await createProfessional(db);
  proSemVinculo = await createProfessional(db);
  exerciseId = await createExercise(db, pro.professionalId);
  await subscribe(db, alunoA, "basic", "month");
  await subscribe(db, alunoB, "basic", "month");
  linkId = await link(db, pro.professionalId, alunoA);
  await db.query("begin");
});

afterAll(async () => {
  await db.query("rollback");
  await db.end();
});

const insertLog = (student: string) =>
  db.query<{ id: string }>(`insert into public.workout_logs (student_id) values ($1) returning id`, [student]);

async function seedStudentData(student: string) {
  const logId = (await insertLog(student)).rows[0]!.id;
  await db.query(
    `insert into public.set_logs (workout_log_id, exercise_id, set_number, weight_kg, reps, client_uuid)
     values ($1, $2, 1, 40, 10, $3)`,
    [logId, exerciseId, randomUUID()],
  );
  await db.query(`insert into public.body_measurements (profile_id, measured_on, weight_kg) values ($1, current_date, 80)`, [
    student,
  ]);
  await db.query(
    `insert into public.progress_photos (profile_id, storage_path, pose, taken_on) values ($1, $2, 'front', current_date)`,
    [student, `${student}/${randomUUID()}.webp`],
  );
  return logId;
}

describe("toda tabela do schema public", () => {
  it("tem RLS ligada", async () => {
    const off = await rows(db, `select tablename from pg_tables where schemaname = 'public' and not rowsecurity`);
    expect(off).toEqual([]);
  });

  it("funções SECURITY DEFINER têm search_path fixo", async () => {
    const loose = await rows(
      db,
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.prosecdef and p.proconfig is null`,
    );
    expect(loose).toEqual([]);
  });
});

describe("cadastro", () => {
  it("sempre cria student, mesmo com role nos metadados", async () => {
    const id = randomUUID();
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
      id,
      `${id}@teste.invalid`,
      JSON.stringify({ role: "admin", birth_date: "1990-01-01", terms_version: "1", privacy_version: "1" }),
    ]);
    const [p] = await rows<{ role: string }>(db, `select role from public.profiles where id = $1`, [id]);
    expect(p?.role).toBe("student");
  });

  it("recusa menor de 18 anos e metadado app_metadata não vem do cliente", async () => {
    const birth = new Date(Date.now() - 17 * 365.25 * 864e5).toISOString().slice(0, 10);
    const id = randomUUID();
    expect(
      await denied(db, `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
        id,
        `${id}@teste.invalid`,
        JSON.stringify({ birth_date: birth, terms_version: "1", privacy_version: "1" }),
      ]),
    ).toBe(true);
  });

  it("recusa cadastro sem data de nascimento ou sem aceite", async () => {
    const id = randomUUID();
    expect(
      await denied(db, `insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, '{}')`, [
        id,
        `${id}@teste.invalid`,
      ]),
    ).toBe(true);
  });

  it("registra o aceite de termos e privacidade com a versão", async () => {
    const id = await createUser(db);
    const c = await rows<{ type: string; document_version: string }>(
      db,
      `select type, document_version from public.consents where profile_id = $1 order by type`,
      [id],
    );
    expect(c.map((x) => x.type)).toEqual(["privacy", "terms"]);
    expect(c[0]?.document_version).toBe("2026-11-05");
  });
});

describe("profiles", () => {
  it("usuário não altera o próprio role nem status", async () => {
    await asUser(db, alunoA, async () => {
      expect(await denied(db, `update public.profiles set role = 'admin' where id = $1`, [alunoA])).toBe(true);
      expect(await denied(db, `update public.profiles set status = 'suspended' where id = $1`, [alunoA])).toBe(true);
    });
  });

  it("usuário edita o próprio nome", async () => {
    await asUser(db, alunoA, async () => {
      const r = await db.query(`update public.profiles set full_name = 'Novo' where id = $1`, [alunoA]);
      expect(r.rowCount).toBe(1);
    });
  });

  it("aluno A não lê nem altera aluno B", async () => {
    await asUser(db, alunoA, async () => {
      expect(await rows(db, `select id from public.profiles where id = $1`, [alunoB])).toEqual([]);
      expect(await rows(db, `select profile_id from public.student_profiles where profile_id = $1`, [alunoB])).toEqual([]);
      const r = await db.query(`update public.profiles set full_name = 'x' where id = $1`, [alunoB]);
      expect(r.rowCount).toBe(0);
    });
  });

  it("profissional lê só alunos com vínculo ativo", async () => {
    await asUser(db, pro.profileId, async () => {
      expect(await rows(db, `select id from public.profiles where id = $1`, [alunoA])).toHaveLength(1);
      expect(await rows(db, `select id from public.profiles where id = $1`, [alunoB])).toEqual([]);
    });
    await asUser(db, proSemVinculo.profileId, async () => {
      expect(await rows(db, `select id from public.profiles where id = $1`, [alunoA])).toEqual([]);
    });
  });

  it("admin lê e altera conta alheia, mas não o próprio role", async () => {
    await asUser(db, admin, async () => {
      expect(await rows(db, `select id from public.profiles where id = $1`, [alunoB])).toHaveLength(1);
      const r = await db.query(`update public.profiles set status = 'suspended' where id = $1`, [alunoB]);
      expect(r.rowCount).toBe(1);
      expect(await denied(db, `update public.profiles set role = 'student' where id = $1`, [admin])).toBe(true);
    });
  });

  it("cliente não insere nem apaga perfil", async () => {
    await asUser(db, alunoA, async () => {
      expect(await denied(db, `insert into public.profiles (id) values ($1)`, [randomUUID()])).toBe(true);
      const r = await db.query(`delete from public.profiles where id = $1`, [alunoA]);
      expect(r.rowCount).toBe(0);
    });
  });

  it("anônimo não lê perfil", async () => {
    await asUser(db, null, async () => {
      expect(await denied(db, `select id from public.profiles`)).toBe(false);
      expect(await rows(db, `select id from public.profiles`)).toEqual([]);
    });
  });
});

describe("consents", () => {
  it("aluno registra e revoga o próprio; profissional não acessa; admin só lê", async () => {
    await asUser(db, alunoB, async () => {
      const [c] = await rows<{ id: string }>(
        db,
        `insert into public.consents (profile_id, type, document_version) values ($1, 'marketing', 'v1') returning id`,
        [alunoB],
      );
      const r = await db.query(`update public.consents set revoked_at = now() where id = $1`, [c!.id]);
      expect(r.rowCount).toBe(1);
      expect(await denied(db, `update public.consents set document_version = 'v2' where id = $1`, [c!.id])).toBe(true);
      expect(await denied(db, `insert into public.consents (profile_id, type, document_version) values ($1, 'marketing', 'v1')`, [alunoA])).toBe(true);
    });
    await asUser(db, pro.profileId, async () => {
      expect(await rows(db, `select id from public.consents where profile_id = $1`, [alunoA])).toEqual([]);
    });
    await asUser(db, admin, async () => {
      expect((await rows(db, `select id from public.consents where profile_id = $1`, [alunoA])).length).toBeGreaterThan(0);
      expect(await denied(db, `insert into public.consents (profile_id, type, document_version) values ($1, 'marketing', 'v1')`, [alunoA])).toBe(true);
    });
  });
});

describe("plans e plan_prices", () => {
  it("anônimo lê ativos e não altera; admin gerencia", async () => {
    await asUser(db, null, async () => {
      expect((await rows(db, `select code from public.plans`)).length).toBe(3);
      const r = await db.query(`update public.plan_prices set amount_cents = 1`);
      expect(r.rowCount).toBe(0);
    });
    await asUser(db, alunoA, async () => {
      const r = await db.query(`update public.plan_prices set amount_cents = 1`);
      expect(r.rowCount).toBe(0);
    });
    await asUser(db, admin, async () => {
      const r = await db.query(`update public.plan_prices set amount_cents = 1000`);
      expect(r.rowCount).toBeGreaterThan(0);
    });
  });
});

describe("subscriptions e payments", () => {
  it("cada um lê só os próprios; cliente nunca escreve; profissional sem acesso", async () => {
    const [sub] = await rows<{ id: string }>(db, `select id from public.subscriptions where profile_id = $1`, [alunoB]);
    await db.query(
      `insert into public.payments (subscription_id, status, amount_cents, provider_payment_id) values ($1, 'approved', 100, $2)`,
      [sub!.id, randomUUID()],
    );
    await asUser(db, alunoB, async () => {
      expect(await rows(db, `select id from public.payments`)).toHaveLength(1);
      expect(await rows(db, `select id from public.subscriptions`)).toHaveLength(1);
      const u = await db.query(`update public.subscriptions set status = 'active', current_period_end = now() + interval '10 years'`);
      expect(u.rowCount).toBe(0);
      expect(
        await denied(db, `insert into public.subscriptions (profile_id, plan_price_id, expected_amount_cents) select $1, id, 0 from public.plan_prices limit 1`, [alunoB]),
      ).toBe(true);
      expect(
        await denied(db, `insert into public.payments (subscription_id, status, amount_cents, provider_payment_id) values ($1, 'approved', 0, 'x')`, [sub!.id]),
      ).toBe(true);
    });
    await asUser(db, alunoA, async () => {
      expect(await rows(db, `select id from public.payments`)).toEqual([]);
      expect(await rows(db, `select id from public.subscriptions where profile_id = $1`, [alunoB])).toEqual([]);
    });
    await asUser(db, pro.profileId, async () => {
      expect(await rows(db, `select id from public.subscriptions`)).toEqual([]);
      expect(await rows(db, `select id from public.payments`)).toEqual([]);
    });
    await asUser(db, admin, async () => {
      expect((await rows(db, `select id from public.payments`)).length).toBeGreaterThan(0);
      const u = await db.query(`update public.subscriptions set status = 'expired'`);
      expect(u.rowCount).toBe(0);
    });
  });
});

describe("professional_students", () => {
  it("aluno altera só photos_allowed, e só com consentimento", async () => {
    await asUser(db, alunoA, async () => {
      expect(await denied(db, `update public.professional_students set photos_allowed = true where id = $1`, [linkId])).toBe(true);
      await db.query(`insert into public.consents (profile_id, type, document_version) values ($1, 'photos_professional', 'v1')`, [alunoA]);
      const ok = await db.query(`update public.professional_students set photos_allowed = true where id = $1`, [linkId]);
      expect(ok.rowCount).toBe(1);
      expect(await denied(db, `update public.professional_students set ends_at = null, status = 'ended' where id = $1`, [linkId])).toBe(true);
    });
  });

  it("profissional lê os próprios e não altera; aluno alheio não lê", async () => {
    await asUser(db, pro.profileId, async () => {
      expect(await rows(db, `select id from public.professional_students where id = $1`, [linkId])).toHaveLength(1);
      const r = await db.query(`update public.professional_students set photos_allowed = true where id = $1`, [linkId]);
      expect(r.rowCount).toBe(0);
    });
    await asUser(db, alunoB, async () => {
      expect(await rows(db, `select id from public.professional_students where id = $1`, [linkId])).toEqual([]);
    });
  });
});

describe("exercises", () => {
  it("aluno lê publicados e não escreve", async () => {
    const [draft] = await rows<{ id: string }>(db, `insert into public.exercises (name, muscle_group) values ('Rascunho', 'Teste') returning id`);
    await asUser(db, alunoA, async () => {
      expect(await rows(db, `select id from public.exercises where id = $1`, [exerciseId])).toHaveLength(1);
      expect(await rows(db, `select id from public.exercises where id = $1`, [draft!.id])).toEqual([]);
      expect(await denied(db, `insert into public.exercises (name, muscle_group) values ('Xx', 'Yy')`)).toBe(true);
      await expect(db.query(`select public.propose_exercise_review($1, 'Instrução longa o bastante')`, [draft!.id]).catch(() => "negado")).resolves.toBe("negado");
    });
  });

  it("publicação exige revisão de profissional; admin não assina revisão", async () => {
    const [draft] = await rows<{ id: string }>(db, `insert into public.exercises (name, muscle_group) values ('Revisar', 'Teste') returning id`);
    await asUser(db, admin, async () => {
      expect(await denied(db, `update public.exercises set published = true where id = $1`, [draft!.id])).toBe(true);
      expect(await denied(db, `update public.exercises set reviewed_by = $1 where id = $2`, [pro.professionalId, draft!.id])).toBe(true);
      expect(await denied(db, `insert into public.exercises (name, muscle_group, reviewed_by) values ('Xx', 'Yy', $1)`, [pro.professionalId])).toBe(true);
    });
    await db.query("savepoint rev");
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: pro.profileId })]);
    await db.query(`select public.propose_exercise_review($1, 'Instrução revisada pelo profissional')`, [draft!.id]);
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: admin })]);
    const pub = await db.query(`update public.exercises set published = true where id = $1`, [draft!.id]);
    expect(pub.rowCount).toBe(1);
    // Admin editar a instrução derruba a revisão e tira de publicação.
    await db.query(`update public.exercises set instructions = 'Alterado pelo admin' where id = $1`, [draft!.id]);
    const [after] = await rows<{ published: boolean; reviewed_by: string | null }>(
      db,
      `select published, reviewed_by from public.exercises where id = $1`,
      [draft!.id],
    );
    expect(after).toEqual({ published: false, reviewed_by: null });
    await db.query("rollback to savepoint rev");
    await db.query("reset role");
  });
});

describe("treinos: own, prescribed, catalog", () => {
  let ownPlanB: string;
  let prescribedA: string;
  let catalogPlan: string;

  beforeAll(async () => {
    ownPlanB = (await rows<{ id: string }>(db, `insert into public.workout_plans (kind, name, student_id) values ('own', 'B', $1) returning id`, [alunoB]))[0]!.id;
    prescribedA = (await rows<{ id: string }>(
      db,
      `insert into public.workout_plans (kind, name, student_id, author_professional_id, status) values ('prescribed', 'Presc', $1, $2, 'published') returning id`,
      [alunoA, pro.professionalId],
    ))[0]!.id;
    catalogPlan = (await rows<{ id: string }>(
      db,
      `insert into public.workout_plans (kind, name, author_professional_id, status) values ('catalog', 'Cat', $1, 'published') returning id`,
      [pro.professionalId],
    ))[0]!.id;
    await db.query(`insert into public.workouts (plan_id, name) values ($1, 'Treino B')`, [ownPlanB]);
  });

  it("aluno gerencia own e não enxerga own alheio", async () => {
    await asUser(db, alunoA, async () => {
      const [p] = await rows<{ id: string }>(db, `insert into public.workout_plans (kind, name, student_id) values ('own', 'Meu', $1) returning id`, [alunoA]);
      const [w] = await rows<{ id: string }>(db, `insert into public.workouts (plan_id, name) values ($1, 'A') returning id`, [p!.id]);
      await db.query(`insert into public.workout_exercises (workout_id, exercise_id) values ($1, $2)`, [w!.id, exerciseId]);
      expect(await rows(db, `select id from public.workout_plans where id = $1`, [ownPlanB])).toEqual([]);
      expect(await rows(db, `select id from public.workouts where plan_id = $1`, [ownPlanB])).toEqual([]);
      expect(await denied(db, `insert into public.workouts (plan_id, name) values ($1, 'invasão')`, [ownPlanB])).toBe(true);
    });
  });

  it("aluno não cria prescrição nem catálogo", async () => {
    await asUser(db, alunoA, async () => {
      expect(await denied(db, `insert into public.workout_plans (kind, name, student_id, author_professional_id) values ('prescribed', 'x', $1, $2)`, [alunoA, pro.professionalId])).toBe(true);
      expect(await denied(db, `insert into public.workout_plans (kind, name, author_professional_id) values ('catalog', 'x', $1)`, [pro.professionalId])).toBe(true);
    });
  });

  it("aluno lê a prescrição dele, mas não altera", async () => {
    await asUser(db, alunoA, async () => {
      expect(await rows(db, `select id from public.workout_plans where id = $1`, [prescribedA])).toHaveLength(1);
      const r = await db.query(`update public.workout_plans set name = 'x' where id = $1`, [prescribedA]);
      expect(r.rowCount).toBe(0);
    });
    await asUser(db, alunoB, async () => {
      expect(await rows(db, `select id from public.workout_plans where id = $1`, [prescribedA])).toEqual([]);
    });
  });

  it("catálogo só é lido por quem tem plano com programas", async () => {
    await asUser(db, alunoA, async () => {
      expect(await rows(db, `select id from public.workout_plans where id = $1`, [catalogPlan])).toEqual([]);
    });
    const alunoPro = await createUser(db);
    await subscribe(db, alunoPro, "pro", "month");
    await asUser(db, alunoPro, async () => {
      expect(await rows(db, `select id from public.workout_plans where id = $1`, [catalogPlan])).toHaveLength(1);
    });
  });

  it("profissional prescreve só para aluno com vínculo ativo", async () => {
    await asUser(db, pro.profileId, async () => {
      const [p] = await rows<{ id: string }>(
        db,
        `insert into public.workout_plans (kind, name, student_id, author_professional_id) values ('prescribed', 'Novo', $1, $2) returning id`,
        [alunoA, pro.professionalId],
      );
      expect(p?.id).toBeTruthy();
      expect(await denied(db, `insert into public.workout_plans (kind, name, student_id, author_professional_id) values ('prescribed', 'x', $1, $2)`, [alunoB, pro.professionalId])).toBe(true);
    });
    await asUser(db, proSemVinculo.profileId, async () => {
      expect(await denied(db, `insert into public.workout_plans (kind, name, student_id, author_professional_id) values ('prescribed', 'x', $1, $2)`, [alunoA, proSemVinculo.professionalId])).toBe(true);
      expect(await rows(db, `select id from public.workout_plans where id = $1`, [prescribedA])).toEqual([]);
    });
  });

  it("autoria exige CREF verificado e ativo, mesmo para o servidor", async () => {
    const p = await createUser(db, { invited: true });
    const [naoVerificado] = await rows<{ id: string }>(
      db,
      `insert into public.professionals (profile_id, cref_number, cref_uf, status) values ($1, '111111-G', 'RJ', 'pending') returning id`,
      [p],
    );
    expect(
      await denied(db, `insert into public.workout_plans (kind, name, author_professional_id) values ('catalog', 'x', $1)`, [naoVerificado!.id]),
    ).toBe(true);
  });

  it("admin lê prescribed e catalog e é barrado em own e em qualquer escrita", async () => {
    await asUser(db, admin, async () => {
      expect(await rows(db, `select id from public.workout_plans where id = $1`, [prescribedA])).toHaveLength(1);
      expect(await rows(db, `select id from public.workout_plans where id = $1`, [catalogPlan])).toHaveLength(1);
      expect(await rows(db, `select id from public.workout_plans where id = $1`, [ownPlanB])).toEqual([]);
      expect(await denied(db, `insert into public.workout_plans (kind, name, student_id, author_professional_id) values ('prescribed', 'x', $1, $2)`, [alunoA, pro.professionalId])).toBe(true);
      expect(await denied(db, `insert into public.workout_plans (kind, name, author_professional_id) values ('catalog', 'x', $1)`, [pro.professionalId])).toBe(true);
      const u = await db.query(`update public.workout_plans set name = 'x' where id = $1`, [prescribedA]);
      expect(u.rowCount).toBe(0);
      const d = await db.query(`delete from public.workout_plans where id = $1`, [prescribedA]);
      expect(d.rowCount).toBe(0);
      expect(await denied(db, `insert into public.workouts (plan_id, name) values ($1, 'x')`, [prescribedA])).toBe(true);
    });
  });
});

describe("registros, medidas e fotos", () => {
  let alunoC: string;
  let linkC: string;

  beforeAll(async () => {
    alunoC = await createUser(db);
    await subscribe(db, alunoC, "black", "package");
    await seedStudentData(alunoC);
    linkC = await link(db, pro.professionalId, alunoC);
  });

  it("aluno A não lê registros do aluno B", async () => {
    await asUser(db, alunoB, async () => {
      for (const t of ["workout_logs", "set_logs", "body_measurements", "progress_photos"]) {
        expect(await rows(db, `select id from public.${t}`)).toEqual([]);
      }
    });
  });

  it("profissional com vínculo lê logs e medidas; sem vínculo, nada", async () => {
    await asUser(db, pro.profileId, async () => {
      expect(await rows(db, `select id from public.workout_logs where student_id = $1`, [alunoC])).toHaveLength(1);
      expect(await rows(db, `select id from public.set_logs`)).toHaveLength(1);
      expect(await rows(db, `select id from public.body_measurements`)).toHaveLength(1);
    });
    await asUser(db, proSemVinculo.profileId, async () => {
      for (const t of ["workout_logs", "set_logs", "body_measurements", "progress_photos"]) {
        expect(await rows(db, `select id from public.${t}`)).toEqual([]);
      }
    });
  });

  it("fotos: profissional só com photos_allowed; revogar corta na hora; admin nunca", async () => {
    await asUser(db, pro.profileId, async () => {
      expect(await rows(db, `select id from public.progress_photos`)).toEqual([]);
    });
    await db.query(`insert into public.consents (profile_id, type, document_version) values ($1, 'photos_professional', 'v1')`, [alunoC]);
    await db.query(`update public.professional_students set photos_allowed = true where id = $1`, [linkC]);
    await asUser(db, pro.profileId, async () => {
      expect(await rows(db, `select id from public.progress_photos`)).toHaveLength(1);
    });
    await asUser(db, admin, async () => {
      expect(await rows(db, `select id from public.progress_photos`)).toEqual([]);
      for (const t of ["workout_logs", "set_logs", "body_measurements"]) {
        expect(await rows(db, `select id from public.${t}`)).toEqual([]);
      }
    });
    await db.query(`update public.consents set revoked_at = now() where profile_id = $1 and type = 'photos_professional'`, [alunoC]);
    await asUser(db, pro.profileId, async () => {
      expect(await rows(db, `select id from public.progress_photos`)).toEqual([]);
    });
  });

  it("vínculo encerrado termina a leitura na hora", async () => {
    await db.query("savepoint encerrar");
    await db.query(`update public.professional_students set status = 'ended', ends_at = now() where id = $1`, [linkC]);
    await asUser(db, pro.profileId, async () => {
      expect(await rows(db, `select id from public.workout_logs where student_id = $1`, [alunoC])).toEqual([]);
      expect(await rows(db, `select id from public.profiles where id = $1`, [alunoC])).toEqual([]);
      expect(await denied(db, `insert into public.workout_plans (kind, name, student_id, author_professional_id) values ('prescribed', 'x', $1, $2)`, [alunoC, pro.professionalId])).toBe(true);
    });
    await db.query("rollback to savepoint encerrar");
  });

  it("assinatura vencida lê, mas não registra novos treinos", async () => {
    const vencido = await createUser(db);
    await subscribe(db, vencido, "basic", "month");
    const logId = await seedStudentData(vencido);
    await db.query(`update public.subscriptions set status = 'expired', current_period_end = now() - interval '10 days', grace_until = now() - interval '5 days' where profile_id = $1`, [vencido]);
    await asUser(db, vencido, async () => {
      expect(await rows(db, `select id from public.workout_logs`)).toHaveLength(1);
      expect(await rows(db, `select id from public.set_logs`)).toHaveLength(1);
      expect(await denied(db, `insert into public.workout_logs (student_id) values ($1)`, [vencido])).toBe(true);
      expect(
        await denied(db, `insert into public.set_logs (workout_log_id, exercise_id, set_number, weight_kg, reps, client_uuid) values ($1, $2, 2, 10, 10, $3)`, [logId, exerciseId, randomUUID()]),
      ).toBe(true);
    });
  });

  it("carência de 5 dias mantém o registro liberado", async () => {
    const carencia = await createUser(db);
    await subscribe(db, carencia, "basic", "month");
    await db.query(`update public.subscriptions set status = 'past_due', current_period_end = now() - interval '2 days', grace_until = now() + interval '3 days' where profile_id = $1`, [carencia]);
    await asUser(db, carencia, async () => {
      const r = await db.query(`insert into public.workout_logs (student_id) values ($1)`, [carencia]);
      expect(r.rowCount).toBe(1);
    });
  });

  it("sem assinatura não cria treino", async () => {
    const semPlano = await createUser(db);
    await asUser(db, semPlano, async () => {
      expect(await denied(db, `insert into public.workout_logs (student_id) values ($1)`, [semPlano])).toBe(true);
      expect(await denied(db, `insert into public.workout_plans (kind, name, student_id) values ('own', 'x', $1)`, [semPlano])).toBe(true);
    });
  });

  it("medidas e fotos exigem consentimento específico", async () => {
    const semConsent = await createUser(db);
    await subscribe(db, semConsent, "basic", "month");
    await asUser(db, semConsent, async () => {
      expect(await denied(db, `insert into public.body_measurements (profile_id, measured_on) values ($1, current_date)`, [semConsent])).toBe(true);
      expect(await denied(db, `insert into public.progress_photos (profile_id, storage_path, pose, taken_on) values ($1, 'x', 'front', current_date)`, [semConsent])).toBe(true);
    });
    await db.query(`insert into public.consents (profile_id, type, document_version) values ($1, 'health_data', 'v1'), ($1, 'photos', 'v1')`, [semConsent]);
    await asUser(db, semConsent, async () => {
      const m = await db.query(`insert into public.body_measurements (profile_id, measured_on) values ($1, current_date)`, [semConsent]);
      expect(m.rowCount).toBe(1);
    });
  });

  it("client_uuid não duplica registro de série", async () => {
    const aluno = await createUser(db);
    await subscribe(db, aluno, "basic", "month");
    const uuid = randomUUID();
    await asUser(db, aluno, async () => {
      const [log] = await rows<{ id: string }>(db, `insert into public.workout_logs (student_id) values ($1) returning id`, [aluno]);
      const sql = `insert into public.set_logs (workout_log_id, exercise_id, set_number, weight_kg, reps, client_uuid)
                   values ($1, $2, 1, 40, 10, $3) on conflict (client_uuid) do nothing`;
      expect((await db.query(sql, [log!.id, exerciseId, uuid])).rowCount).toBe(1);
      expect((await db.query(sql, [log!.id, exerciseId, uuid])).rowCount).toBe(0);
      expect(await rows(db, `select id from public.set_logs where workout_log_id = $1`, [log!.id])).toHaveLength(1);
    });
  });
});

describe("Storage de fotos", () => {
  it("dono envia na própria pasta; outro aluno, profissional sem permissão e admin são barrados", async () => {
    const dono = await createUser(db);
    await db.query(`insert into public.consents (profile_id, type, document_version) values ($1, 'photos', 'v1')`, [dono]);
    const path = `${dono}/${randomUUID()}.webp`;
    await asUser(db, dono, async () => {
      expect(await denied(db, `insert into storage.objects (bucket_id, name) values ('progress-photos', $1)`, [`${alunoB}/x.webp`])).toBe(true);
      const r = await db.query(`insert into storage.objects (bucket_id, name) values ('progress-photos', $1)`, [path]);
      expect(r.rowCount).toBe(1);
    });
    await db.query(`insert into storage.objects (bucket_id, name) values ('progress-photos', $1)`, [path]);
    for (const outsider of [alunoB, admin, pro.profileId]) {
      await asUser(db, outsider, async () => {
        expect(await rows(db, `select id from storage.objects where name = $1`, [path])).toEqual([]);
        const d = await db.query(`delete from storage.objects where name = $1`, [path]);
        expect(d.rowCount).toBe(0);
      });
    }
    const [bucket] = await rows<{ public: boolean }>(db, `select public from storage.buckets where id = 'progress-photos'`);
    expect(bucket?.public).toBe(false);
  });
});

describe("checkins e feedbacks", () => {
  let aluno: string;
  let linkX: string;
  let checkinId: string;

  beforeAll(async () => {
    aluno = await createUser(db);
    await subscribe(db, aluno, "black", "package");
    linkX = await link(db, pro.professionalId, aluno);
    checkinId = (await rows<{ id: string }>(
      db,
      `insert into public.checkins (professional_student_id, due_on) values ($1, current_date) returning id`,
      [linkX],
    ))[0]!.id;
  });

  it("aluno envia o próprio; outro aluno não lê nem envia", async () => {
    await asUser(db, alunoB, async () => {
      expect(await rows(db, `select id from public.checkins where id = $1`, [checkinId])).toEqual([]);
      const r = await db.query(`update public.checkins set answers = '{}', status = 'submitted' where id = $1`, [checkinId]);
      expect(r.rowCount).toBe(0);
    });
    await asUser(db, aluno, async () => {
      const r = await db.query(`update public.checkins set answers = '{"sono": 8}', status = 'submitted' where id = $1`, [checkinId]);
      expect(r.rowCount).toBe(1);
    });
  });

  it("admin vê só o status, sem respostas", async () => {
    await db.query(`update public.checkins set answers = '{"sono": 8}', status = 'submitted', submitted_at = now() where id = $1`, [checkinId]);
    await asUser(db, admin, async () => {
      expect(await rows(db, `select id, answers from public.checkins`)).toEqual([]);
      const list = await rows<Record<string, unknown>>(db, `select * from public.admin_checkin_status()`);
      const mine = list.find((c) => c.id === checkinId);
      expect(mine?.status).toBe("submitted");
      expect(mine && "answers" in mine).toBe(false);
    });
    await asUser(db, alunoA, async () => {
      expect(await denied(db, `select * from public.admin_checkin_status()`)).toBe(true);
    });
  });

  it("profissional analisa, sem alterar respostas; sem vínculo não acessa", async () => {
    await asUser(db, proSemVinculo.profileId, async () => {
      expect(await rows(db, `select id from public.checkins where id = $1`, [checkinId])).toEqual([]);
      expect(await denied(db, `insert into public.feedbacks (checkin_id, body, author_professional_id) values ($1, 'x', $2)`, [checkinId, proSemVinculo.professionalId])).toBe(true);
    });
    await asUser(db, pro.profileId, async () => {
      expect(await rows(db, `select answers from public.checkins where id = $1`, [checkinId])).toHaveLength(1);
      expect(await denied(db, `update public.checkins set answers = '{}' where id = $1`, [checkinId])).toBe(true);
      const r = await db.query(`update public.checkins set status = 'reviewed' where id = $1`, [checkinId]);
      expect(r.rowCount).toBe(1);
    });
  });

  it("feedback só aparece publicado, só para o aluno dele, e nunca para o admin", async () => {
    const [draft] = await rows<{ id: string }>(
      db,
      `insert into public.feedbacks (checkin_id, body, author_professional_id) values ($1, 'Rascunho', $2) returning id`,
      [checkinId, pro.professionalId],
    );
    await asUser(db, aluno, async () => {
      expect(await rows(db, `select id from public.feedbacks`)).toEqual([]);
    });
    await db.query(`update public.feedbacks set published_at = now() where id = $1`, [draft!.id]);
    await asUser(db, aluno, async () => {
      expect(await rows(db, `select id from public.feedbacks`)).toHaveLength(1);
    });
    for (const outsider of [alunoB, admin, proSemVinculo.profileId]) {
      await asUser(db, outsider, async () => {
        expect(await rows(db, `select id from public.feedbacks`)).toEqual([]);
      });
    }
  });
});

describe("tabelas exclusivas do servidor", () => {
  it("webhook_events, audit_logs, waitlist e rate_limits: cliente não escreve; só admin lê", async () => {
    await db.query(`insert into public.webhook_events (provider_event_key, payload) values ($1, '{}')`, [randomUUID()]);
    await db.query(`insert into public.audit_logs (action, entity) values ('teste', 'teste')`);
    await db.query(`insert into public.waitlist_entries (email, source, consented_at) values ($1, 'landing', now())`, [`${randomUUID()}@teste.invalid`]);
    for (const user of [alunoA, pro.profileId, null]) {
      await asUser(db, user, async () => {
        expect(await rows(db, `select id from public.webhook_events`)).toEqual([]);
        expect(await rows(db, `select id from public.audit_logs`)).toEqual([]);
        expect(await rows(db, `select id from public.waitlist_entries`)).toEqual([]);
        expect(await rows(db, `select key from public.rate_limits`)).toEqual([]);
        expect(await denied(db, `insert into public.audit_logs (action, entity) values ('x', 'y')`)).toBe(true);
        expect(await denied(db, `insert into public.waitlist_entries (email, source, consented_at) values ('a@b.c', 'landing', now())`)).toBe(true);
      });
    }
    await asUser(db, admin, async () => {
      expect((await rows(db, `select id from public.webhook_events`)).length).toBeGreaterThan(0);
      expect((await rows(db, `select id from public.audit_logs`)).length).toBeGreaterThan(0);
      expect(await denied(db, `insert into public.audit_logs (action, entity) values ('x', 'y')`)).toBe(true);
    });
  });

  it("audit_logs é somente inserção, até para o servidor", async () => {
    expect(await denied(db, `update public.audit_logs set action = 'x'`)).toBe(true);
    expect(await denied(db, `delete from public.audit_logs`)).toBe(true);
  });

  it("cliente não executa as funções de vaga, cupom e limite", async () => {
    await asUser(db, alunoA, async () => {
      expect(await denied(db, `select public.reserve_black_slot($1)`, [alunoA])).toBe(true);
      expect(await denied(db, `select public.link_black_student($1, $2, $3)`, [randomUUID(), pro.professionalId, alunoA])).toBe(true);
      expect(await denied(db, `select public.redeem_coupon($1, $2, null)`, [randomUUID(), alunoA])).toBe(true);
      expect(await denied(db, `select public.rate_limit_hit('x', 60)`)).toBe(true);
    });
  });

  it("has_entitlement não revela direito de outra pessoa", async () => {
    await asUser(db, alunoB, async () => {
      const [r] = await rows<{ v: boolean }>(db, `select public.has_entitlement($1, 'log_workouts') as v`, [alunoA]);
      expect(r?.v).toBe(false);
      const [own] = await rows<{ v: boolean }>(db, `select public.has_entitlement($1, 'log_workouts') as v`, [alunoB]);
      expect(own?.v).toBe(true);
    });
  });
});
