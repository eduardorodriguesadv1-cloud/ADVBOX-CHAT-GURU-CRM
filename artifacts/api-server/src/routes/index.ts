import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatguruRouter from "./chatguru";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/chatguru", chatguruRouter);

export default router;
