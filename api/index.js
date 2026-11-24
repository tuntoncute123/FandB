export default async function handler(req, res) {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).json({ error: "Đang chờ kết nối cơ sở dữ liệu Turso." });
  }
  const { app } = await import("../server/index.js");
  return app(req, res);
}
