// Ativa a varredura de segredos antes de cada commit. Silencioso fora de um repositório Git (ex.: Vercel).
import { spawnSync } from "node:child_process";
spawnSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "ignore" });
