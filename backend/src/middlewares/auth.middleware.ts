import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import config from "../config";

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token =
    req.cookies["access_token"] ||
    (req.headers.authorization && req.headers.authorization.split(" ")[1]);
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const payload: any = jwt.verify(token, config.accessSecret);
    (req as any).userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
