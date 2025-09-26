import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";
import authRoutes from "./modules/auth/auth.routes";
import usersRouter from "./modules/user/user.routes";
import tokenRouter from "./modules/token/token.routes";
import { routeNotFound } from "./middlewares/routeNotFound";

const app = express();

app.use(morgan("dev"));

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.send("Express 5 + TypeScript API Server");
});

app.use("/auth", authRoutes);
app.use("/user", usersRouter);
app.use("/token", tokenRouter);

//Error handler(s)
app.use(routeNotFound);

app.use((err: any, req: any, res: any, next: any) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal" });
});

export default app;
