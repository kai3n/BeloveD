import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { query, withTransaction, closePool } from "./db.js";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");

async function ensureTable() {
  await query(`create table if not exists schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now())`);
}

export async function migrate() {
  await ensureTable();
  const { rows } = await query("select filename from schema_migrations");
  const done = new Set(rows.map((r) => r.filename));
  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  for (const filename of files) {
    if (done.has(filename)) continue;
    const sql = await readFile(join(migrationsDir, filename), "utf8");
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query("insert into schema_migrations (filename) values ($1)", [filename]);
    });
    console.log(`applied ${filename}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => closePool());
}
