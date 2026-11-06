import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import customerRouter from "./customer";

const router: IRouter = Router();

router.use(healthRouter);
router.use(customerRouter);
router.use(adminRouter);

export default router;
