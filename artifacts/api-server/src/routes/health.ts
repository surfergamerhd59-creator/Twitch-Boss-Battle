import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

// ── GET /api/healthz — liveness only (fast, no DB) ───────────────────────────
router.get("/healthz", (_req, res) => {
  res.json({ status: "ok", uptime: Math.floor(process.uptime()) });
});

// ── GET /api/health — full check: server + DB (used by Render) ───────────────
router.get("/health", async (_req, res) => {
  const start = Date.now();

  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }

    res.json({
      status: "ok",
      db: "ok",
      latencyMs: Date.now() - start,
      uptime: Math.floor(process.uptime()),
    });
  } catch (err) {
    res.status(503).json({
      status: "error",
      db: "unreachable",
      error: err instanceof Error ? err.message : "Unknown error",
      latencyMs: Date.now() - start,
    });
  }
});

export default router;
