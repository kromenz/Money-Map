import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  cashflows,
  chart,
  dividends,
  guardConfigured,
  orders,
  overview,
  sheetPending,
  sheetWritten,
  syncNow,
} from "./t212.controller";

const t212Router = Router();

t212Router.get("/overview", authMiddleware, overview);
t212Router.get("/chart", authMiddleware, guardConfigured, chart);
t212Router.get("/dividends", authMiddleware, guardConfigured, dividends);
t212Router.get("/orders", authMiddleware, guardConfigured, orders);
t212Router.get("/cashflows", authMiddleware, guardConfigured, cashflows);
t212Router.post("/sync", authMiddleware, guardConfigured, syncNow);
t212Router.get("/sheet/pending", authMiddleware, sheetPending);
t212Router.post("/sheet/written", authMiddleware, sheetWritten);

export default t212Router;
