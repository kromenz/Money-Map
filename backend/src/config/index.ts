import dotenv from "dotenv";
dotenv.config();

type StringValue = `${number}${"ms" | "s" | "m" | "h" | "d" | "w" | "y"}`;

export default {
  port: process.env.PORT || 5000,
  accessSecret: process.env.ACCESS_SECRET || "supersecret",
  refreshSecret: process.env.REFRESH_SECRET || "refreshsecret",
  accessExpiry: (process.env.ACCESS_EXPIRY || "15m") as StringValue,
  refreshExpiryDays: Number(process.env.REFRESH_EXPIRY_DAYS || 30),
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
  },
};
