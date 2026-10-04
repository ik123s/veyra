import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accountsRouter from "./accounts";
import activityRouter from "./activity";
import transfersRouter from "./transfers";
import walletRouter from "./wallet";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accountsRouter);
router.use(activityRouter);
router.use(transfersRouter);
router.use(walletRouter);

export default router;
