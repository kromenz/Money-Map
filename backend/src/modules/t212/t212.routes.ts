import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import {
  cashflows,
  chart,
  dividends,
  guardConfigured,
  orders,
  overview,
  syncNow,
} from "./t212.controller";

const t212Router = Router();

t212Router.get("/overview", authMiddleware, overview);
t212Router.get("/chart", authMiddleware, guardConfigured, chart);
t212Router.get("/dividends", authMiddleware, guardConfigured, dividends);
t212Router.get("/orders", authMiddleware, guardConfigured, orders);
t212Router.get("/cashflows", authMiddleware, guardConfigured, cashflows);
t212Router.post("/sync", authMiddleware, guardConfigured, syncNow);

export default t212Router;
