// Postgres real (binário do pacote embedded-postgres) para testes, sem Docker.
// As tabelas de auth e storage abaixo são um esboço mínimo das do Supabase, não as originais.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { Client } from "pg";

export const SUPABASE_STUB_SQL = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    encrypted_password text,
    email_confirmed_at timestamptz,
    raw_app_meta_data jsonb not null default '{}',
    raw_user_meta_data jsonb not null default '{}',
    created_at timestamptz not null default now()
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
  $$;

  create schema storage;
  create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    content bytea,
    content_type text,
    unique (bucket_id, name)
  );
  alter table storage.objects enable row level security;

  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant all on all tables in schema storage to authenticated, service_role;
  -- Mesmos privilégios padrão do Supabase: quem decide o acesso é a RLS.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

export function migrationFiles(root = process.cwd()): string[] {
  const dir = path.join(root, "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => path.join(dir, f));
}

export interface TestPostgres {
  url: string;
  stop: () => Promise<void>;
}

export async function startPostgres(name: string, port: number): Promise<TestPostgres> {
  const dir = path.join(process.cwd(), ".tmp", name);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(path.dirname(dir), { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();

  const url = `postgres://postgres:postgres@127.0.0.1:${port}/postgres`;
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(SUPABASE_STUB_SQL);
  for (const file of migrationFiles()) {
    await client.query(readFileSync(file, "utf8"));
  }
  await client.query(readFileSync(path.join(process.cwd(), "supabase", "seed.sql"), "utf8"));
  await client.end();

  return { url, stop: () => pg.stop() };
}
