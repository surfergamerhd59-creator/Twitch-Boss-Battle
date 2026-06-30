import { Router, type IRouter } from "express";
import healthRouter from "./health";
import soundsRouter from "./sounds";
import moderationRouter from "./moderation";
import bannersRouter from "./banners";
import socialLinksRouter from "./social-links";
import authRouter from "./auth";
import streamRouter from "./stream";
import moderatorsRouter from "./moderators";

const router: IRouter = Router();

router.use(healthRouter);
router.use(soundsRouter);
router.use(moderationRouter);
router.use(bannersRouter);
router.use(socialLinksRouter);
router.use(authRouter);
router.use(streamRouter);
router.use(moderatorsRouter);

export default router;
