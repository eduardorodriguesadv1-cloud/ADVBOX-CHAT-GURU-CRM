import { Router, Request, Response } from "express";
import { db, agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const AgentBody = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  team: z.enum(["COMERCIAL_TRAFEGO", "ATENDIMENTO"]),
  active: z.boolean().optional(),
});

const AgentPatch = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  team: z.enum(["COMERCIAL_TRAFEGO", "ATENDIMENTO"]).optional(),
  active: z.boolean().optional(),
});

router.get("/", async (_req: Request, res: Response) => {
  const agents = await db.select().from(agentsTable).orderBy(agentsTable.team, agentsTable.name);
  res.json({ agents });
});

router.post("/", async (req: Request, res: Response) => {
  const parsed = AgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.message });
    return;
  }
  const [agent] = await db.insert(agentsTable).values(parsed.data).returning();
  res.json({ ok: true, agent });
});

router.patch("/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ ok: false }); return; }
  const parsed = AgentPatch.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ ok: false, error: parsed.error.message }); return; }
  const [agent] = await db.update(agentsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(agentsTable.id, id))
    .returning();
  res.json({ ok: true, agent });
});

router.delete("/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ ok: false }); return; }
  await db.delete(agentsTable).where(eq(agentsTable.id, id));
  res.json({ ok: true });
});

export default router;
