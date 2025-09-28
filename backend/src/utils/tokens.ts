import jwt, { SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import config from "../config";

if (!config.accessSecret) {
  throw new Error("❌ ACCESS_SECRET not defined in config");
}
if (!config.refreshSecret) {
  throw new Error("❌ REFRESH_SECRET not defined in config");
}

export function signAccessToken(payload: object) {
  const options: SignOptions = {
    expiresIn: config.accessExpiry || "15m",
  };

  return jwt.sign(payload, config.accessSecret as string, options);
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, config.accessSecret as string);
}

export function signRefreshToken(payload: object) {
  const options: SignOptions = {
    expiresIn: `${config.refreshExpiryDays || 7}d`,
  };

  return jwt.sign(payload, config.refreshSecret as string, options);
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, config.refreshSecret as string);
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
