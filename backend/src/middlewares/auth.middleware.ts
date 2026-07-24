import { RequestHandler } from "express";
import { verifyAccessToken } from "../utils/tokens";

export const authMiddleware: RequestHandler = (req, res, next) => {
  const cookieToken = (req as any).cookies?.access_token;
  const headerToken =
    typeof req.headers.authorization === "string"
      ? req.headers.authorization.split(" ")[1]
      : (req.headers["x-access-token"] as string | undefined);

  const token = cookieToken ?? headerToken;

  if (!token) {
    res.status(401).json({ error: "No token" });
  }

  try {
    const payload = verifyAccessToken(token) as any;
    if (!payload?.sub) {
      res.status(401).json({ error: "Invalid token payload" });
    }

    (req as any).userId = String(payload.sub);
    next();
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") {
      res.status(401).json({ error: "Token expired" });
    }

    try {
      res.clearCookie("access_token", { path: "/" });
    } catch (_) {
      /* ignore */
    }

    console.warn("authMiddleware: invalid token:", err?.message || err);
    res.status(401).json({ error: "Invalid token" });
  }
};
