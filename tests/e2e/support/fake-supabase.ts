// Emulador de testes: reproduz só o subconjunto HTTP do Supabase (Auth, PostgREST, Storage) que o app usa.
// O acesso a dados roda em Postgres real, com SET ROLE e as claims do JWT, então a RLS aplicada é a verdadeira.
// NÃO substitui um teste contra o Supabase real; veja docs/PENDENCIAS.md.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import jwt from "jsonwebtoken";
import { Pool, type PoolClient } from "pg";

export const ANON_KEY = "e2e-anon-key";
export const SERVICE_KEY = "e2e-service-key";
const JWT_SECRET = "e2e-only-secret-not-used-anywhere-else";

type Claims = { role: "anon" | "authenticated" | "service_role"; sub?: string };
type FkInfo = { name: string; tbl: string; col: string; ref: string; refcol: string };
type Node = { column?: string; embed?: { rel: string; alias: string; hint?: string; nodes: Node[] } };

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const hash = (s: string) => createHash("sha256").update(s).digest("hex");

function parseSelect(input: string): Node[] {
  const out: Node[] = [];
  let depth = 0;
  let cur = "";
  const flush = () => {
    const part = cur.trim();
    cur = "";
    if (!part) return;
    const open = part.indexOf("(");
    if (open === -1) {
      out.push({ column: part.includes(":") ? part : part });
      return;
    }
    const head = part.slice(0, open);
    const inner = part.slice(open + 1, part.lastIndexOf(")"));
    const [aliasOrRel, maybeRel] = head.split(":");
    const relPart = maybeRel ?? aliasOrRel!;
    const [rel, hint] = relPart.split("!");
    out.push({ embed: { rel: rel!, alias: maybeRel ? aliasOrRel! : rel!, hint, nodes: parseSelect(inner) } });
  };
  for (const ch of input) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) flush();
    else cur += ch;
  }
  flush();
  return out;
}

export async function startFakeSupabase(databaseUrl: string, port: number, appOrigin: string) {
  const pool = new Pool({ connectionString: databaseUrl, max: 8 });
  pool.on("error", () => {}); // conexões caem de propósito ao desligar o Postgres no fim dos testes
  const fks = (
    await pool.query<FkInfo>(`
      select c.conname as name, t.relname as tbl, a.attname as col, rt.relname as ref, ra.attname as refcol
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
      join pg_class rt on rt.oid = c.confrelid join pg_namespace rn on rn.oid = rt.relnamespace
      join pg_attribute a on a.attrelid = t.oid and a.attnum = c.conkey[1]
      join pg_attribute ra on ra.attrelid = rt.oid and ra.attnum = c.confkey[1]
      where c.contype = 'f' and n.nspname = 'public' and rn.nspname = 'public'`)
  ).rows;

  const tokens = new Map<string, { email: string; type: string }>();
  const lastLinks = new Map<string, string>();
  const refreshTokens = new Map<string, string>();

  function issueToken(email: string, type: string) {
    const token = randomBytes(16).toString("hex");
    tokens.set(token, { email, type });
    lastLinks.set(`${email}:${type}`, token);
    return token;
  }

  const publicUser = (u: Record<string, unknown>) => ({
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_confirmed_at: u.email_confirmed_at,
    created_at: u.created_at,
    app_metadata: u.raw_app_meta_data,
    user_metadata: u.raw_user_meta_data,
    identities: [],
  });

  function sessionFor(u: Record<string, unknown>) {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const access = jwt.sign({ sub: u.id, role: "authenticated", aud: "authenticated", email: u.email, exp: expiresAt }, JWT_SECRET);
    const refresh = randomBytes(16).toString("hex");
    refreshTokens.set(refresh, String(u.id));
    return { access_token: access, token_type: "bearer", expires_in: 3600, expires_at: expiresAt, refresh_token: refresh, user: publicUser(u) };
  }

  function claimsOf(req: IncomingMessage): Claims {
    const bearer = req.headers.authorization?.replace(/^Bearer /, "");
    if (bearer === SERVICE_KEY) return { role: "service_role" };
    if (!bearer || bearer === ANON_KEY) return { role: "anon" };
    try {
      const d = jwt.verify(bearer, JWT_SECRET) as { sub: string };
      return { role: "authenticated", sub: d.sub };
    } catch {
      return { role: "anon" };
    }
  }

  async function withRole<T>(claims: Claims, fn: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await pool.connect();
    try {
      await c.query("begin");
      await c.query(`set local role ${claims.role}`);
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      const r = await fn(c);
      await c.query("commit");
      return r;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  }

  function projection(table: string, alias: string, nodes: Node[], depth = 0): string {
    const parts: string[] = [];
    for (const n of nodes) {
      if (n.column) {
        if (n.column === "*") parts.push(`${alias}.*`);
        else {
          const [a, b] = n.column.split(":");
          parts.push(b ? `${alias}.${q(b)} as ${q(a!)}` : `${alias}.${q(a!)}`);
        }
      } else if (n.embed) {
        const { rel, alias: outName, hint, nodes: inner } = n.embed;
        const sub = `e${depth}_${parts.length}`;
        const x = `x${depth}_${parts.length}`;
        const toOne = fks.find((f) => f.tbl === table && f.ref === rel && (!hint || f.name === hint || f.col === hint));
        const toMany = fks.find((f) => f.tbl === rel && f.ref === table && (!hint || f.name === hint || f.col === hint));
        const innerCols = projection(rel, sub, inner, depth + 1);
        if (toOne) {
          parts.push(`(select row_to_json(${x}) from (select ${innerCols} from public.${q(rel)} ${sub} where ${sub}.${q(toOne.refcol)} = ${alias}.${q(toOne.col)} limit 1) ${x}) as ${q(outName)}`);
        } else if (toMany) {
          parts.push(`(select coalesce(json_agg(row_to_json(${x})), '[]'::json) from (select ${innerCols} from public.${q(rel)} ${sub} where ${sub}.${q(toMany.col)} = ${alias}.${q(toMany.refcol)}) ${x}) as ${q(outName)}`);
        } else {
          throw Object.assign(new Error(`sem relação entre ${table} e ${rel}`), { code: "PGRST200" });
        }
      }
    }
    return parts.join(", ");
  }

  const OPS: Record<string, string> = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", ilike: "ilike", like: "like" };
  const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

  function whereClause(params: URLSearchParams, values: unknown[], alias: string): string {
    const conds: string[] = [];
    for (const [key, raw] of params.entries()) {
      if (RESERVED.has(key)) continue;
      let v = raw;
      let neg = "";
      if (v.startsWith("not.")) {
        neg = "not ";
        v = v.slice(4);
      }
      const dot = v.indexOf(".");
      const op = v.slice(0, dot);
      const arg = v.slice(dot + 1);
      const col = `${alias}.${q(key)}`;
      if (op === "is") {
        conds.push(`${col} is ${neg}${arg === "null" ? "null" : arg}`);
      } else if (op === "in") {
        const items = arg.slice(1, -1).split(",").filter(Boolean).map((s) => s.replace(/^"|"$/g, ""));
        values.push(items);
        conds.push(`${neg}(${col}::text = any($${values.length}::text[]))`);
      } else if (OPS[op]) {
        values.push(arg.replace(/\*/g, "%"));
        const textOp = ["eq", "neq", "ilike", "like"].includes(op);
        conds.push(`${neg}(${col}${textOp ? "::text" : ""} ${OPS[op]} $${values.length})`);
      } else {
        throw Object.assign(new Error(`operador não suportado: ${op}`), { code: "PGRST100" });
      }
    }
    return conds.length ? `where ${conds.join(" and ")}` : "";
  }

  function orderClause(params: URLSearchParams, alias: string): string {
    const raw = params.get("order");
    if (!raw) return "";
    const parts = raw.split(",").map((p) => {
      const [col, ...mods] = p.split(".");
      const dir = mods.includes("desc") ? "desc" : "asc";
      const nulls = mods.includes("nullsfirst") ? " nulls first" : mods.includes("nullslast") ? " nulls last" : "";
      return `${alias}.${q(col!)} ${dir}${nulls}`;
    });
    return `order by ${parts.join(", ")}`;
  }

  const read = (req: IncomingMessage) =>
    new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks)));
      req.on("error", reject);
    });

  function send(res: ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}) {
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(body === undefined ? undefined : JSON.stringify(body));
  }

  const pgStatus = (code?: string) =>
    code === "42501" ? 403 : code === "23505" ? 409 : code === "P0002" ? 404 : code?.startsWith("PGRST") ? 400 : 400;

  async function handleRest(req: IncomingMessage, res: ServerResponse, url: URL, claims: Claims, body: Buffer) {
    const name = decodeURIComponent(url.pathname.replace("/rest/v1/", ""));
    const prefer = String(req.headers.prefer ?? "");
    const accept = String(req.headers.accept ?? "");
    const single = accept.includes("vnd.pgrst.object");

    if (name.startsWith("rpc/")) {
      const fn = name.slice(4);
      const args = body.length ? (JSON.parse(body.toString()) as Record<string, unknown>) : {};
      const keys = Object.keys(args);
      const call = `public.${q(fn)}(${keys.map((k, i) => `${q(k)} => $${i + 1}`).join(", ")})`;
      const { rows: meta } = await pool.query<{ proretset: boolean }>(
        `select p.proretset from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1`,
        [fn],
      );
      const values = keys.map((k) => args[k]);
      const out = await withRole(claims, async (c) => {
        if (meta[0]?.proretset) return (await c.query(`select * from ${call}`, values)).rows;
        return (await c.query(`select ${call} as v`, values)).rows[0]?.v ?? null;
      });
      return send(res, 200, out);
    }

    const table = q(name);
    const params = url.searchParams;
    const nodes = parseSelect(params.get("select") ?? "*");
    const wantsRow = prefer.includes("return=representation");
    const values: unknown[] = [];

    const finish = (rows: Record<string, unknown>[], count?: number) => {
      const headers: Record<string, string> = {};
      if (count !== undefined) headers["content-range"] = `0-${Math.max(rows.length - 1, 0)}/${count}`;
      if (single) {
        if (rows.length !== 1) {
          return send(res, 406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `${rows.length} rows`, hint: null });
        }
        return send(res, 200, rows[0], headers);
      }
      return send(res, 200, rows, headers);
    };

    if (req.method === "GET" || req.method === "HEAD") {
      const where = whereClause(params, values, "a");
      const limit = params.get("limit") ? `limit ${Number(params.get("limit"))}` : "limit 1000";
      const offset = params.get("offset") ? `offset ${Number(params.get("offset"))}` : "";
      const sql = `select ${projection(name, "a", nodes)} from public.${table} a ${where} ${orderClause(params, "a")} ${limit} ${offset}`;
      const { rows, count } = await withRole(claims, async (c) => {
        const r = (await c.query(sql, values)).rows as Record<string, unknown>[];
        let total: number | undefined;
        if (prefer.includes("count=exact")) {
          total = Number((await c.query(`select count(*) from public.${table} a ${where}`, values)).rows[0].count);
        }
        return { rows: r, count: total };
      });
      if (req.method === "HEAD") {
        res.writeHead(200, count !== undefined ? { "content-range": `*/${count}` } : {});
        return res.end();
      }
      return finish(rows, count);
    }

    if (req.method === "POST") {
      const parsed = JSON.parse(body.toString()) as Record<string, unknown> | Record<string, unknown>[];
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const cols = [...new Set(list.flatMap((r) => Object.keys(r)))];
      values.push(JSON.stringify(list));
      const colList = cols.map(q).join(", ");
      let conflict = "";
      if (prefer.includes("resolution=")) {
        const target = params.get("on_conflict");
        const tgt = target ? `(${target.split(",").map(q).join(", ")})` : "";
        if (prefer.includes("ignore-duplicates")) conflict = `on conflict ${tgt} do nothing`;
        else conflict = `on conflict ${tgt} do update set ${cols.map((c) => `${q(c)} = excluded.${q(c)}`).join(", ")}`;
      }
      const insert = `insert into public.${table} (${colList}) select ${colList} from json_populate_recordset(null::public.${table}, $1::json) ${conflict}`;
      if (!wantsRow) {
        await withRole(claims, (c) => c.query(insert, values));
        res.writeHead(201);
        return res.end();
      }
      const sql = `with a as (${insert} returning *) select ${projection(name, "a", nodes)} from a`;
      const rows = await withRole(claims, async (c) => (await c.query(sql, values)).rows as Record<string, unknown>[]);
      res.statusCode = 201;
      return finish(rows);
    }

    if (req.method === "PATCH") {
      const patch = JSON.parse(body.toString()) as Record<string, unknown>;
      values.push(JSON.stringify(patch));
      const sets = Object.keys(patch).map((c) => `${q(c)} = r.${q(c)}`).join(", ");
      const where = whereClause(params, values, "t");
      const update = `update public.${table} t set ${sets} from json_populate_record(null::public.${table}, $1::json) r ${where}`;
      if (!wantsRow) {
        await withRole(claims, (c) => c.query(update, values));
        res.writeHead(204);
        return res.end();
      }
      const sql = `with a as (${update} returning t.*) select ${projection(name, "a", nodes)} from a`;
      return finish(await withRole(claims, async (c) => (await c.query(sql, values)).rows as Record<string, unknown>[]));
    }

    if (req.method === "DELETE") {
      const where = whereClause(params, values, "t");
      const del = `delete from public.${table} t ${where}`;
      if (!wantsRow) {
        await withRole(claims, (c) => c.query(del, values));
        res.writeHead(204);
        return res.end();
      }
      const sql = `with a as (${del} returning t.*) select ${projection(name, "a", nodes)} from a`;
      return finish(await withRole(claims, async (c) => (await c.query(sql, values)).rows as Record<string, unknown>[]));
    }
    return send(res, 405, { message: "método não suportado" });
  }

  const userById = async (id: string) =>
    (await pool.query<Record<string, unknown>>(`select * from auth.users where id = $1`, [id])).rows[0];
  const userByEmail = async (email: string) =>
    (await pool.query<Record<string, unknown>>(`select * from auth.users where email = $1`, [email])).rows[0];

  async function handleAuth(req: IncomingMessage, res: ServerResponse, url: URL, claims: Claims, body: Buffer) {
    const path = url.pathname.replace("/auth/v1", "");
    const data = body.length ? (JSON.parse(body.toString()) as Record<string, never>) : ({} as Record<string, never>);

    if (path === "/signup" && req.method === "POST") {
      const email = String(data.email).toLowerCase();
      const existing = await userByEmail(email);
      if (existing) {
        // Igual ao Supabase com confirmação ligada: resposta ofuscada, sem revelar que o e-mail existe.
        return send(res, 200, { id: randomUUID(), aud: "authenticated", email, identities: [] });
      }
      const id = randomUUID();
      try {
        await pool.query(`insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values ($1, $2, $3, $4)`, [
          id, email, hash(String(data.password)), JSON.stringify(data.data ?? {}),
        ]);
      } catch {
        return send(res, 500, { code: 500, error_code: "unexpected_failure", msg: "Database error saving new user" });
      }
      issueToken(email, "signup");
      return send(res, 200, publicUser((await userById(id))!));
    }

    if (path === "/token" && req.method === "POST") {
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") {
        const u = await userByEmail(String(data.email).toLowerCase());
        if (!u || u.encrypted_password !== hash(String(data.password))) {
          return send(res, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
        }
        if (!u.email_confirmed_at) return send(res, 400, { code: 400, error_code: "email_not_confirmed", msg: "Email not confirmed" });
        return send(res, 200, sessionFor(u));
      }
      if (grant === "refresh_token") {
        const id = refreshTokens.get(String(data.refresh_token));
        const u = id ? await userById(id) : undefined;
        if (!u) return send(res, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
        return send(res, 200, sessionFor(u));
      }
    }

    if (path === "/recover" && req.method === "POST") {
      const email = String(data.email).toLowerCase();
      if (await userByEmail(email)) issueToken(email, "recovery");
      return send(res, 200, {});
    }

    if (path === "/verify" && req.method === "POST") {
      const entry = tokens.get(String(data.token_hash));
      if (!entry) return send(res, 403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" });
      tokens.delete(String(data.token_hash));
      await pool.query(`update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where email = $1`, [entry.email]);
      return send(res, 200, sessionFor((await userByEmail(entry.email))!));
    }

    if (path === "/user") {
      if (!claims.sub) return send(res, 401, { code: 401, error_code: "no_authorization", msg: "no valid token" });
      if (req.method === "PUT" && data.password) {
        await pool.query(`update auth.users set encrypted_password = $2 where id = $1`, [claims.sub, hash(String(data.password))]);
      }
      const u = await userById(claims.sub);
      if (!u) return send(res, 403, { code: 403, error_code: "user_not_found", msg: "User not found" });
      return send(res, 200, publicUser(u));
    }

    if (path === "/logout") {
      res.writeHead(204);
      return res.end();
    }

    if (path.startsWith("/admin/")) {
      if (claims.role !== "service_role") return send(res, 403, { code: 403, msg: "forbidden" });
      if (path === "/admin/users" && req.method === "POST") {
        const id = randomUUID();
        const email = String(data.email).toLowerCase();
        await pool.query(
          `insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data) values ($1, $2, $3, $4, $5, $6)`,
          [id, email, data.password ? hash(String(data.password)) : null, data.email_confirm ? new Date() : null,
           JSON.stringify(data.app_metadata ?? {}), JSON.stringify(data.user_metadata ?? {})],
        );
        return send(res, 200, publicUser((await userById(id))!));
      }
      if (path === "/admin/generate_link" && req.method === "POST") {
        const email = String(data.email).toLowerCase();
        const token = issueToken(email, String(data.type));
        const u = await userByEmail(email);
        return send(res, 200, {
          ...publicUser(u ?? {}),
          action_link: `${appOrigin}/auth/confirm?token_hash=${token}&type=${data.type}`,
          email_otp: "000000", hashed_token: token, redirect_to: appOrigin, verification_type: data.type,
        });
      }
      const m = path.match(/^\/admin\/users\/([0-9a-f-]+)$/);
      if (m) {
        if (req.method === "GET") {
          const u = await userById(m[1]!);
          return u ? send(res, 200, publicUser(u)) : send(res, 404, { code: 404, msg: "User not found" });
        }
        if (req.method === "DELETE") {
          await pool.query(`delete from auth.users where id = $1`, [m[1]]);
          return send(res, 200, {});
        }
      }
    }
    return send(res, 404, { code: 404, msg: `rota de auth não emulada: ${path}` });
  }

  async function handleStorage(req: IncomingMessage, res: ServerResponse, url: URL, claims: Claims, body: Buffer) {
    const path = decodeURIComponent(url.pathname.replace("/storage/v1", ""));
    const batch = path.match(/^\/object\/sign\/([^/]+)$/);
    if (batch && req.method === "POST") {
      const { expiresIn, paths } = JSON.parse(body.toString()) as { expiresIn: number; paths: string[] };
      const bucket = batch[1]!;
      const visible = await withRole(claims, async (c) =>
        (await c.query<{ name: string }>(`select name from storage.objects where bucket_id = $1 and name = any($2)`, [bucket, paths])).rows.map((r) => r.name),
      );
      return send(
        res,
        200,
        paths.map((name) =>
          visible.includes(name)
            ? { path: name, error: null, signedURL: `/object/sign/${bucket}/${name}?token=${jwt.sign({ bucket, name }, JWT_SECRET, { expiresIn })}` }
            : { path: name, error: "Object not found", signedURL: null },
        ),
      );
    }
    let m = path.match(/^\/object\/sign\/([^/]+)\/(.+)$/);
    if (m && req.method === "POST") {
      const [, bucket, name] = m;
      const found = await withRole(claims, async (c) =>
        (await c.query(`select 1 from storage.objects where bucket_id = $1 and name = $2`, [bucket, name])).rowCount,
      );
      if (!found) return send(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
      const { expiresIn } = JSON.parse(body.toString()) as { expiresIn: number };
      const token = jwt.sign({ bucket, name }, JWT_SECRET, { expiresIn });
      return send(res, 200, { signedURL: `/object/sign/${bucket}/${name}?token=${token}` });
    }
    if (m && req.method === "GET") {
      try {
        jwt.verify(url.searchParams.get("token") ?? "", JWT_SECRET);
      } catch {
        return send(res, 400, { message: "token expirado" });
      }
      const { rows } = await pool.query<{ content: Buffer; content_type: string }>(
        `select content, content_type from storage.objects where bucket_id = $1 and name = $2`, [m[1], m[2]],
      );
      if (!rows[0]) return send(res, 404, { message: "não encontrado" });
      res.writeHead(200, { "content-type": rows[0].content_type ?? "application/octet-stream" });
      return res.end(rows[0].content);
    }
    m = path.match(/^\/object\/list\/([^/]+)$/);
    if (m && req.method === "POST") {
      const { prefix } = JSON.parse(body.toString()) as { prefix: string };
      const rows = await withRole(claims, async (c) =>
        (await c.query(`select name from storage.objects where bucket_id = $1 and name like $2`, [m![1], `${prefix}/%`])).rows,
      );
      return send(res, 200, rows.map((r: { name: string }) => ({ name: r.name.slice(prefix.length + 1) })));
    }
    m = path.match(/^\/object\/([^/]+)$/);
    if (m && req.method === "DELETE") {
      const { prefixes } = JSON.parse(body.toString()) as { prefixes: string[] };
      const rows = await withRole(claims, async (c) =>
        (await c.query(`delete from storage.objects where bucket_id = $1 and name = any($2) returning name`, [m![1], prefixes])).rows,
      );
      return send(res, 200, rows);
    }
    m = path.match(/^\/object\/([^/]+)\/(.+)$/);
    if (m && req.method === "POST") {
      try {
        await withRole(claims, (c) =>
          c.query(`insert into storage.objects (bucket_id, name, content, content_type) values ($1, $2, $3, $4)`, [
            m![1], m![2], body, req.headers["content-type"] ?? "application/octet-stream",
          ]),
        );
      } catch {
        return send(res, 403, { statusCode: "403", error: "Unauthorized", message: "new row violates row-level security policy" });
      }
      return send(res, 200, { Id: randomUUID(), Key: `${m[1]}/${m[2]}` });
    }
    return send(res, 404, { message: `rota de storage não emulada: ${path}` });
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    try {
      const body = await read(req);
      const claims = claimsOf(req);
      if (url.pathname === "/__test/sql") {
        const { sql, params } = JSON.parse(body.toString()) as { sql: string; params?: unknown[] };
        return send(res, 200, (await pool.query(sql, params)).rows);
      }
      if (url.pathname === "/__test/link") {
        const key = `${url.searchParams.get("email")}:${url.searchParams.get("type")}`;
        return send(res, 200, { token: lastLinks.get(key) ?? null });
      }
      if (url.pathname.startsWith("/rest/v1/")) return await handleRest(req, res, url, claims, body);
      if (url.pathname.startsWith("/auth/v1/")) return await handleAuth(req, res, url, claims, body);
      if (url.pathname.startsWith("/storage/v1/")) return await handleStorage(req, res, url, claims, body);
      return send(res, 404, { message: "rota não emulada" });
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (!res.headersSent) {
        return send(res, pgStatus(err.code), { code: err.code ?? "XX000", message: err.message, details: null, hint: null });
      }
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    stop: async () => {
      server.close();
      await pool.end();
    },
  };
}
