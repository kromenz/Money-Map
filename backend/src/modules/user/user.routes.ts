import { Router } from "express";
import { getAllUsers, getUser } from "./user.controller";

const usersRouter = Router();

usersRouter.get("/users", getAllUsers);
usersRouter.get("/get", getUser);

export default usersRouter;
