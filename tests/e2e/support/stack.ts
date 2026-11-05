// Sobe o ambiente E2E: Postgres real, emulador HTTP do Supabase e build de produção do Next.
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { startPostgres } from "../../../supabase/tests/support/postgres";
import { ANON_KEY, SERVICE_KEY, startFakeSupabase } from "./fake-supabase";

const SUPABASE_PORT = 54399;
const APP_PORT = 3100;

mkdirSync(".tmp", { recursive: true });
const trace = (message: string) => appendFileSync(".tmp/stack.log", `${new Date().toISOString()} ${message}\n`);

process.on("uncaughtException", (e) => trace(`uncaughtException: ${e.stack ?? e}`));
process.on("unhandledRejection", (e) => trace(`unhandledRejection: ${e instanceof Error ? e.stack : String(e)}`));
process.on("exit", (code) => trace(`stack exit: ${code}`));

async function main() {
  trace("stack start");
  const pg = await startPostgres("pg-e2e", 54331);
  const fake = await startFakeSupabase(pg.url, SUPABASE_PORT, `http://localhost:${APP_PORT}`);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NEXT_DIST_DIR: ".next-e2e",
    NEXT_PUBLIC_APP_URL: `http://localhost:${APP_PORT}`,
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${SUPABASE_PORT}`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    CRON_SECRET: "e2e-cron-secret",
    MERCADOPAGO_WEBHOOK_SECRET: "e2e-webhook-secret",
    MERCADOPAGO_ACCESS_TOKEN: "e2e-token",
  };

  const next = process.platform === "win32" ? "node_modules\\.bin\\next.cmd" : "node_modules/.bin/next";
  const build = spawnSync(next, ["build"], { env, stdio: "inherit", shell: true });
  if (build.status !== 0) throw new Error("Falha no build E2E");

  const preload = path.join(process.cwd(), "tests", "e2e", "support", "mp-preload.cjs").replaceAll("\\", "/");
  const app = spawn(next, ["start", "-p", String(APP_PORT)], {
    env: { ...env, NODE_OPTIONS: `--require ${preload}` },
    stdio: "inherit",
    shell: true,
  });
  app.on("exit", (code, signal) => trace(`next exit: code=${code} signal=${signal}`));
  trace("next started");

  const stop = async (reason: string) => {
    trace(`stop: ${reason}`);
    app.kill();
    await fake.stop();
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
