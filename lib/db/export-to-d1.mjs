import pg from "pg";
import fs from "fs";
const { Pool } = pg;

const OLD_DB = "postgresql://neondb_owner:npg_v7RDhy2tEXIF@ep-delicate-fog-ayhuv8ae-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const pool = new Pool({ connectionString: OLD_DB });

// Order matters: parents before children (foreign key dependencies)
const TABLES = [
  "teams",
  "tournaments",
  "matches",
  "streams",
  "match_events",
  "highlights",
  "lineups",
  "squads",
  "banners",
  "admin_users",
  "spotlights",
  "push_subscriptions",
  "trophies",
];

function sqlEscape(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "1" : "0";
  if (typeof val === "number") return String(val);
  if (val instanceof Date) return String(Math.floor(val.getTime() / 1000));
  if (typeof val === "object") return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
  let allSql = "";

  for (const table of TABLES) {
    console.log(`Reading ${table}...`);
    const { rows } = await pool.query(`SELECT * FROM ${table}`);
    console.log(`  ${rows.length} rows`);
    if (rows.length === 0) continue;

    const columns = Object.keys(rows[0]);
    const colList = columns.map(c => `"${c}"`).join(", ");

    for (const row of rows) {
      const values = columns.map(c => sqlEscape(row[c])).join(", ");
      allSql += `INSERT INTO ${table} (${colList}) VALUES (${values});\n`;
    }
  }

  fs.writeFileSync("d1-import.sql", allSql);
  console.log("\nWrote d1-import.sql");
  await pool.end();
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
