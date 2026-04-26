import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatguruRouter from "./chatguru";
import agentsRouter from "./agents";
import whatsappNumbersRouter from "./whatsapp-numbers";
import tagsRouter from "./tags";
import conversationsExtraRouter from "./conversations-extra";
import summariesRouter from "./summaries";
import campaignsRouter from "./campaigns";
import auditRouter from "./audit";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/chatguru", chatguruRouter);
router.use("/agents", agentsRouter);
router.use("/whatsapp-numbers", whatsappNumbersRouter);
router.use("/tags", tagsRouter);
router.use("/conversations", conversationsExtraRouter);
router.use("/summaries", summariesRouter);
router.use("/campaigns", campaignsRouter);
router.use("/audit", auditRouter);

export default router;
