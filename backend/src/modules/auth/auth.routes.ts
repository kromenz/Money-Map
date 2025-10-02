import { Router } from "express";
import {
  register,
  login,
  refresh,
  logout,
  github,
  githubCallback,
} from "./auth.controller";

const authRouter = Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);
authRouter.get("/github", github);
authRouter.get("/github/callback", githubCallback);

export default authRouter;
