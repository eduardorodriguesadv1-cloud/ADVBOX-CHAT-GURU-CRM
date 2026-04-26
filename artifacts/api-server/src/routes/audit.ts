import { Router } from "express";
import { runFullDiagnostics, buildRecommendations } from "@workspace/db/services/analytics";
import { syncAllAudiences } from "@workspace/db/services/meta-audiences";
import { logger } from "../lib/logger";

const router = Router();

// GET /api/audit/run — run full diagnostics and return everything
router.get("/run", async (_req, res) => {
  try {
    const { issues, overview, audiencesWithIssues } = await runFullDiagnostics();
    const recommendations = await buildRecommendations(issues);
    res.json({ overview, issues, audiencesWithIssues, recommendations });
  } catch (err) {
    logger.error({ err }, "GET /audit/run failed");
    res.status(500).json({ error: "internal_error", message: err instanceof Error ? err.message : String(err) });
  }
});

// GET /api/audit/sync/audiences — sync custom audiences from Meta
router.get("/sync/audiences", async (_req, res) => {
  try {
    const result = await syncAllAudiences();
    logger.info(result, "Custom audiences sync triggered");
    res.json({ ok: true, ...result });
  } catch (err) {
    logger.error({ err }, "Audience sync failed");
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
