// Gera src/lib/supabase/database.types.ts a partir das migrations, num Postgres real e sem Docker.
// Uso: npm run db:types
import { writeFileSync } from "node:fs";
import { Client } from "pg";
import { startPostgres } from "../supabase/tests/support/postgres";

const TS: Record<string, string> = {
  uuid: "string", text: "string", date: "string", "timestamp with time zone": "string",
  integer: "number", bigint: "number", numeric: "number", boolean: "boolean", jsonb: "Json", void: "undefined",
};
const tsType = (t: string) => TS[t] ?? "unknown";

async function main() {
  const pg = await startPostgres("pg-types", 54330);
  const db = new Client({ connectionString: pg.url });
  await db.connect();

  const cols = (await db.query<{
    table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null;
  }>(`select table_name, column_name, data_type, is_nullable, column_default
      from information_schema.columns where table_schema = 'public' order by table_name, ordinal_position`)).rows;

  const fks = (await db.query<{ name: string; tbl: string; col: string; ref: string; refcol: string; one: boolean }>(`
    select c.conname as name, t.relname as tbl, a.attname as col, rt.relname as ref, ra.attname as refcol,
      exists (select 1 from pg_index i where i.indrelid = t.oid and i.indisunique and i.indpred is null
              and i.indkey::int2[] = array[a.attnum]::int2[]) as one
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_class rt on rt.oid = c.confrelid
    join pg_namespace rn on rn.oid = rt.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum = c.conkey[1]
    join pg_attribute ra on ra.attrelid = rt.oid and ra.attnum = c.confkey[1]
    where c.contype = 'f' and n.nspname = 'public' and rn.nspname = 'public' order by 1`)).rows;

  const fns = (await db.query<{ name: string; args: string; ret: string; retset: boolean; table_out: string | null }>(`
    select p.proname as name, pg_get_function_arguments(p.oid) as args,
      pg_catalog.format_type(p.prorettype, null) as ret, p.proretset as retset,
      case when p.proretset then pg_get_function_result(p.oid) end as table_out
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and pg_catalog.format_type(p.prorettype, null) <> 'trigger' order by 1`)).rows;

  const tables = [...new Set(cols.map((c) => c.table_name))];
  let out = `// Arquivo gerado por scripts/gen-db-types.ts. Não edite à mão.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
`;
  for (const t of tables) {
    const c = cols.filter((x) => x.table_name === t);
    const row = c.map((x) => `          ${x.column_name}: ${tsType(x.data_type)}${x.is_nullable === "YES" ? " | null" : ""};`);
    const ins = c.map((x) => {
      const optional = x.is_nullable === "YES" || x.column_default !== null;
      return `          ${x.column_name}${optional ? "?" : ""}: ${tsType(x.data_type)}${x.is_nullable === "YES" ? " | null" : ""};`;
    });
    const upd = c.map((x) => `          ${x.column_name}?: ${tsType(x.data_type)}${x.is_nullable === "YES" ? " | null" : ""};`);
    const rel = fks.filter((f) => f.tbl === t).map(
      (f) => `          { foreignKeyName: "${f.name}"; columns: ["${f.col}"]; isOneToOne: ${f.one}; referencedRelation: "${f.ref}"; referencedColumns: ["${f.refcol}"] },`,
    );
    out += `      ${t}: {
        Row: {
${row.join("\n")}
        };
        Insert: {
${ins.join("\n")}
        };
        Update: {
${upd.join("\n")}
        };
        Relationships: [
${rel.join("\n")}
        ];
      };
`;
  }
  out += `    };
    Views: { [_ in never]: never };
    Functions: {
`;
  const parseArgs = (s: string) =>
    s.split(",").map((a) => a.trim()).filter(Boolean).map((a) => {
      const hasDefault = /\sDEFAULT\s/i.test(a);
      const [name, ...type] = a.replace(/\sDEFAULT\s.*$/i, "").split(" ");
      return `${name}${hasDefault ? "?" : ""}: ${tsType(type.join(" "))}`;
    });
  for (const f of fns) {
    let ret = tsType(f.ret);
    if (f.retset && f.table_out?.startsWith("TABLE(")) {
      const inner = f.table_out.slice(6, -1);
      ret = `{ ${parseArgs(inner).join("; ")} }[]`;
    }
    const fnArgs = parseArgs(f.args);
    const argsType = fnArgs.length ? `{ ${fnArgs.join("; ")} }` : "Record<PropertyKey, never>";
    out += `      ${f.name}: { Args: ${argsType}; Returns: ${ret} };\n`;
  }
  out += `    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
`;
  writeFileSync("src/lib/supabase/database.types.ts", out);
  await db.end();
  await pg.stop();
  console.log(`Tipos gerados: ${tables.length} tabelas, ${fns.length} funções.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
