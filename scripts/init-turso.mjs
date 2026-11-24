// Initialize a new Turso database atomically from the app's built-in demo data.
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("Set TURSO_DATABASE_URL before initializing Turso.");
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  const existing = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
  );
  if (existing.rows.length) {
    console.log("Database already initialized.");
  } else {
    process.env.DB_PATH = ":memory:";
    const { db } = await import("../server/db.js");
    try {
      const schema = db
        .prepare(
          "SELECT name,type,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY rowid",
        )
        .all();
      const batch = schema.map(({ sql }) => sql);
      for (const { name, type } of schema) {
        if (type !== "table") continue;
        const rows = db.prepare(`SELECT * FROM "${name}"`).all();
        for (let offset = 0; offset < rows.length; offset += 40) {
          const chunk = rows.slice(offset, offset + 40).map(Object.values);
          const placeholders = chunk.map(
            (row) => "(" + row.map(() => "?").join(",") + ")",
          );
          batch.push({
            sql: `INSERT INTO "${name}" VALUES ${placeholders.join(",")}`,
            args: chunk.flat(),
          });
        }
      }
      await client.batch(batch, "write");
      console.log("Initialized Turso with sample data.");
    } finally {
      db.close();
    }
  }
} finally {
  client.close();
}
