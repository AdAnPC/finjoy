import { Router, type IRouter } from "express";
import dashboardRouter from "./dashboard";
import clientsRouter from "./clients";
import loansRouter from "./loans";
import paymentsRouter from "./payments";
import apkRouter from "./apk";

const router: IRouter = Router();

router.use(dashboardRouter);
router.use(clientsRouter);
router.use(loansRouter);
router.use(paymentsRouter);
router.use(apkRouter);

export default router;
