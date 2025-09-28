import { Router } from "express";
import { getTokenByUserId } from "./token.controller";

const tokenRouter = Router();

tokenRouter.get("/userToken", getTokenByUserId);

export default tokenRouter;
