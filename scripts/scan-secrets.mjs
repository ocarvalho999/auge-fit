// Varredura simples de segredos nos arquivos rastreados pelo Git (e nos novos ainda não ignorados).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const rules = [
  ["Token do Mercado Pago", /\b(APP_USR|TEST)-\d{10,}-[\w-]{10,}/],
  ["Chave do Resend", /\bre_[A-Za-z0-9]{16,}_[A-Za-z0-9]+/],
  ["JWT", /\beyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
  ["Chave secreta do Supabase", /\bsb_secret_[A-Za-z0-9_-]{10,}/],
  ["Chave privada", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Token do GitHub", /\bgh[pousr]_[A-Za-z0-9]{30,}/],
];
const envExampleValue =
  /^(SUPABASE_SERVICE_ROLE_KEY|MERCADOPAGO_ACCESS_TOKEN|MERCADOPAGO_WEBHOOK_SECRET|RESEND_API_KEY|CRON_SECRET)=.+$/m;
const publicSecret = /NEXT_PUBLIC_[A-Z_]*(SECRET|SERVICE_ROLE|ACCESS_TOKEN|PRIVATE)/;

const files = execFileSync("git", ["ls-files", "-c", "-o", "--exclude-standard"], { encoding: "utf8" })
  .split("\n")
  .filter(
    (f) =>
      f &&
      !f.endsWith("package-lock.json") &&
      !/\.(png|webp|ico|jpg)$/.test(f) &&
      f !== "scripts/scan-secrets.mjs",
  );

const findings = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const [name, re] of rules) if (re.test(text)) findings.push(`${file}: ${name}`);
  if (file === ".env.example" && envExampleValue.test(text)) findings.push(`${file}: valor preenchido`);
  if (publicSecret.test(text)) findings.push(`${file}: segredo em variável NEXT_PUBLIC_`);
}
if (findings.length) {
  console.error("Possíveis segredos encontrados:\n" + findings.join("\n"));
  process.exit(1);
}
console.log(`Varredura concluída: ${files.length} arquivos, nenhum segredo encontrado.`);
