import { DatabaseSync, backup } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const source = process.env.DB_PATH || resolve("data/la-fnb.sqlite");
if (!existsSync(source))
  throw new Error("Chưa có cơ sở dữ liệu. Hãy chạy ứng dụng trước.");
const folder = resolve("data/backups");
mkdirSync(folder, { recursive: true });
const target = resolve(
  folder,
  `la-fnb-${new Date().toISOString().replaceAll(":", "-")}.sqlite`,
);
const database = new DatabaseSync(source, { readOnly: true });
try {
  await backup(database, target);
  console.log(`Đã sao lưu nhất quán: ${target}`);
} finally {
  database.close();
}
