import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  importWorkbook,
  previewWorkbook,
  getGrid,
  getYears,
  queuePending,
  getPending,
  clearPendingHandler,
} from "./budget.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const budgetRouter = Router();

budgetRouter.post(
  "/import",
  authMiddleware,
  upload.single("file"),
  importWorkbook
);

// Mesma forma do /import, mas nao escreve nada.
budgetRouter.post(
  "/preview",
  authMiddleware,
  upload.single("file"),
  previewWorkbook
);

budgetRouter.get("/grid", authMiddleware, getGrid);
budgetRouter.get("/years", authMiddleware, getYears);

budgetRouter.post("/pending", authMiddleware, queuePending);
budgetRouter.get("/pending", authMiddleware, getPending);
budgetRouter.post("/pending/clear", authMiddleware, clearPendingHandler);

export default budgetRouter;
