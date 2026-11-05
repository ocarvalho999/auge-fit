// Postgres real (binário do pacote embedded-postgres) para testes, sem Docker.
// As tabelas de auth e storage abaixo são um esboço mínimo das do Supabase, não as originais.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { connect } from "node:net";
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

/** Uma execução interrompida pode deixar o Postgres de teste no ar. Só atua na pasta de dados deste teste. */
function stopLeftover(dir: string) {
  if (!existsSync(path.join(dir, "postmaster.pid"))) return;
  const platform = process.platform === "win32" ? "windows" : process.platform;
  const bin = path.join(process.cwd(), "node_modules", "@embedded-postgres", `${platform}-${process.arch}`, "native", "bin", process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl");
  const pidFile = path.join(dir, "postmaster.pid");
  const pid = Number(readFileSync(pidFile, "utf8").split("\n")[0]);
  spawnSync(bin, ["stop", "-D", dir, "-m", "immediate", "-w", "-t", "10"], { stdio: "ignore" });
  // Se o pg_ctl não bastou, encerra pelo PID desta pasta de dados: apagar a pasta antes deixaria um órfão na porta.
  if (existsSync(pidFile) && pid > 0) {
    try {
      process.kill(pid);
    } catch {
      // Já tinha terminado.
    }
  }
}

/**
 * No Windows, encerrar a árvore de processos pode deixar um filho do Postgres vivo, segurando a porta.
 * Só atua em processos do binário deste projeto cujo pai já não existe; um banco de teste em uso fica intacto.
 */
function stopOrphans() {
  if (process.platform !== "win32") return;
  const binary = path.join(process.cwd(), "node_modules", "@embedded-postgres").replaceAll("\\", "/");
  const script = [
    `$all = Get-CimInstance Win32_Process -Filter "Name='postgres.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Replace('\\','/').ToLower().Contains('${binary.toLowerCase()}') }`,
    "foreach ($p in $all) { if (-not (Get-Process -Id $p.ParentProcessId -ErrorAction SilentlyContinue)) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue } }",
  ].join("; ");
  spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], { stdio: "ignore" });
}

/** No Windows, o Postgres anterior pode levar alguns segundos para soltar a porta. */
async function waitForPortFree(port: number, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const busy = await new Promise<boolean>((resolve) => {
      const socket = connect({ port, host: "127.0.0.1" });
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (!busy) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Porta ${port} continua ocupada`);
}

export interface TestPostgres {
  url: string;
  stop: () => Promise<void>;
}

export async function startPostgres(name: string, port: number): Promise<TestPostgres> {
  const base = path.join(process.cwd(), ".tmp");
  mkdirSync(base, { recursive: true });
  // Pasta única por execução: no Windows, um processo órfão prende a memória ligada ao caminho antigo.
  for (const old of readdirSync(base).filter((d) => d === name || d.startsWith(`${name}-`))) {
    const oldDir = path.join(base, old);
    stopLeftover(oldDir);
    try {
      rmSync(oldDir, { recursive: true, force: true });
    } catch {
      // Ainda em uso; a próxima execução tenta de novo.
    }
  }
  stopOrphans();
  await waitForPortFree(port);
  const dir = path.join(base, `${name}-${Date.now()}`);

  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: "postgres",
    port,
    persistent: true,
    postgresFlags: ["-c", "io_method=sync"],
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
