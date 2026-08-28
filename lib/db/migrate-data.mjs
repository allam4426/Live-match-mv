import pg from "pg";
const { Pool } = pg;

const OLD_DB = "postgresql://neondb_owner:npg_v7RDhy2tEXIF@ep-delicate-fog-ayhuv8ae-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const NEW_DB = "postgresql://neondb_owner:npg_HwdS3azVLml4@ep-empty-paper-aywnulgn-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const oldPool = new Pool({ connectionString: OLD_DB });
const newPool = new Pool({ connectionString: NEW_DB });

const TABLES = [
  "tournaments",
  "matches",
  "streams",
  "match_events",
  "lineups",
];

const JSON_COLUMNS = {
  tournaments: ["qualification_zones"],
};

async function main() {
  for (const table of TABLES) {
    console.log(`\n--- Migrating table: ${table} ---`);
    try {
      const { rows } = await oldPool.query(`SELECT * FROM ${table}`);
      console.log(`  Read ${rows.length} rows from old DB`);
      if (rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const colList = columns.map(c => `"${c}"`).join(", ");
      const jsonCols = JSON_COLUMNS[table] || [];

      for (const row of rows) {
        const values = columns.map(c => {
          const val = row[c];
          if (jsonCols.includes(c) && val !== null && typeof val === "object") {
            return JSON.stringify(val);
          }
          return val;
        });
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
