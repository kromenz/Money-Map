import { Router } from "express";
import multer from "multer";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { importWorkbook } from "./budget.controller";

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

export default budgetRouter;
