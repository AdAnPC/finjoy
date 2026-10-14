import { Router, type IRouter } from "express";
import dashboardRouter from "./dashboard";
import clientsRouter from "./clients";
import loansRouter from "./loans";
import paymentsRouter from "./payments";
import apkRouter from "./apk";
import accessRouter from "./access";
import authRouter, { requireAdminApiKey } from "./auth";

const router: IRouter = Router();

router.use(authRouter);
router.use((req, res, next) => {
  if (req.path === "/admin/auth/status" || req.path === "/admin/auth/verify") {
    next();
    return;
  }
  requireAdminApiKey(req, res, next);
});
router.use(dashboardRouter);
router.use(clientsRouter);
router.use(accessRouter);
router.use(loansRouter);
router.use(paymentsRouter);
router.use(apkRouter);

export default router;
