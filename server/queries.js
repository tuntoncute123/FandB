import { AsyncLocalStorage } from "node:async_hooks";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
if (process.env.VERCEL && !url) {
  throw new Error("TURSO_DATABASE_URL is required on Vercel.");
}
const client = createClient(
  url
    ? {
        url,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }
    : {
        url: pathToFileURL((await import("./db.js")).databasePath).href,
      },
);
const activeTransaction = new AsyncLocalStorage();

export function run(sql, ...args) {
  return (activeTransaction.getStore() ?? client).execute({ sql, args });
}
export async function all(sql, ...args) {
  return (await run(sql, ...args)).rows;
}
export async function one(sql, ...args) {
  return (await all(sql, ...args))[0];
}
export async function transaction(fn) {
  const tx = await client.transaction("write");
  try {
    const value = await activeTransaction.run(tx, fn);
    await tx.commit();
    return value;
  } finally {
    if (!tx.closed) await tx.rollback();
  }
}
