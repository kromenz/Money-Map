import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { guardInboxConfigured, pairPhone, syncInbox } from "./inbox.controller";

const inboxRouter = Router();

inboxRouter.post("/sync", authMiddleware, guardInboxConfigured, syncInbox);
inboxRouter.post("/pairing", authMiddleware, guardInboxConfigured, pairPhone);

export default inboxRouter;
