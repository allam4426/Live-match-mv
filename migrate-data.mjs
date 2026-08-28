import pg from "pg";
const { Pool } = pg;

const OLD_DB = "postgresql://neondb_owner:npg_v7RDhy2tEXIF@ep-delicate-fog-ayhuv8ae-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const NEW_DB = "postgresql://neondb_owner:npg_HwdS3azVLml4@ep-empty-paper-aywnulgn-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const oldPool = new Pool({ connectionString: OLD_DB });
const newPool = new Pool({ connectionString: NEW_DB });

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

async function main() {
  // 1. Get schema (structure) from old DB and apply to new DB
  console.log("Fetching schema from old database...");
  const { rows: tableDefs } = await oldPool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  console.log("Tables found in old DB:", tableDefs.map(t => t.table_name).join(", "));

  for (const table of TABLES) {
    console.log(`\n--- Migrating table: ${table} ---`);
    try {
      const { rows } = await oldPool.query(`SELECT * FROM ${table}`);
      console.log(`  Read ${rows.length} rows from old DB`);
      if (rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const colList = columns.map(c => `"${c}"`).join(", ");

      for (const row of rows) {
        const values = columns.map(c => row[c]);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
        await newPool.query(
          `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values
        );
      }
      console.log(`  Inserted ${rows.length} rows into new DB`);
    } catch (err) {
      console.error(`  ERROR on table ${table}:`, err.message);
    }
  }

  console.log("\nMigration complete.");
  await oldPool.end();
  await newPool.end();
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
