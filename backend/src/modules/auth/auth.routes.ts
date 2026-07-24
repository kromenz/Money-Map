import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
  github,
  githubCallback,
  setPassword,
} from "./auth.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", authMiddleware, logout);
authRouter.get("/github", github);
authRouter.get("/github/callback", githubCallback);
authRouter.get("/set-password", authMiddleware, setPassword);

export default authRouter;
