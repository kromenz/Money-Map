import { prisma } from "../../db/prisma";
import bcrypt from "bcrypt";
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  verifyRefreshToken,
} from "../../utils/tokens";
import config from "../../config";
import axios from "axios";

export async function registerUser(
  email: string,
  password: string,
  name?: string
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("User exists");

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hashed, name: name ?? null },
  });
  return { id: user.id, email: user.email, name: user.name };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("User does not exist.");

  if (!user.password)
    throw new Error(
      "Account created via OAuth — set a password or login with provider."
    );

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new Error("Invalid credentials");

  const accessToken = signAccessToken({ sub: user.id });
  const refreshToken = signRefreshToken({ sub: user.id });

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(
        Date.now() + config.refreshExpiryDays * 24 * 60 * 60 * 1000
      ),
    },
  });

  return {
    user: { id: user.id, email: user.email, name: user.name ?? null },
    accessToken,
    refreshToken,
  };
}

export async function refreshTokens(refreshToken: string) {
  if (!refreshToken) throw new Error("No refresh token provided");

  const payload: any = verifyRefreshToken(refreshToken) as any;
  const userId = String(payload?.sub);
  if (!userId) throw new Error("Invalid token payload");

  const tokenHash = hashToken(refreshToken);

  const stored = await prisma.refreshToken.findFirst({
    where: {
      tokenHash,
      userId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!stored) throw new Error("Invalid or expired refresh token");

  const newRefresh = signRefreshToken({ sub: userId });
  const newHash = hashToken(newRefresh);
  const newExpiry = new Date(
    Date.now() + config.refreshExpiryDays * 24 * 60 * 60 * 1000
  );

  await prisma.$transaction([
    prisma.refreshToken.create({
      data: {
        tokenHash: newHash,
        userId,
        expiresAt: newExpiry,
      },
    }),
    prisma.refreshToken.delete({ where: { id: stored.id } }),
  ]);

  const newAccess = signAccessToken({ sub: userId });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });

  if (!user) throw new Error("User not found");

  return { accessToken: newAccess, refreshToken: newRefresh, user };
}

export async function logout(refreshToken?: string, userId?: string) {
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await prisma.refreshToken
      .deleteMany({ where: { tokenHash } })
      .catch(() => {});
    return;
  }
  if (userId) {
    await prisma.refreshToken.deleteMany({ where: { userId } }).catch(() => {});
  }
}

export async function githubCallback(code: string) {
  const tokenResponse = await axios.post(
    "https://github.com/login/oauth/access_token",
    {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    },
    {
      headers: { Accept: "application/json" },
    }
  );

  const token = tokenResponse.data?.access_token;
  if (!token) throw new Error("No access token from GitHub");

  const userResponse = await axios.get("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const emailResponse = await axios.get("https://api.github.com/user/emails", {
    headers: { Authorization: `Bearer ${token}` },
  });

  const primaryEmailObj =
    (emailResponse.data || []).find((e: any) => e.primary) ||
    emailResponse.data[0];
  const email = primaryEmailObj?.email;

  return {
    token,
    user: userResponse.data,
    email,
    emails: emailResponse.data,
  };
}

export async function setPassword(
  userId: string,
  password: string,
  currentPassword?: string
) {
  if (!userId) {
    const e: any = new Error("Missing userId");
    e.status = 401;
    throw e;
  }
  if (!password || password.length < 8) {
    const e: any = new Error("Password too short (min 8 chars)");
    e.status = 400;
    throw e;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const e: any = new Error("User not found");
    e.status = 404;
    throw e;
  }

  if (user.password) {
    if (!currentPassword) {
      const e: any = new Error("Current password required");
      e.status = 403;
      throw e;
    }
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      const e: any = new Error("Current password is incorrect");
      e.status = 403;
      throw e;
    }
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed, authProvider: "local" },
  });

  return { ok: true };
}
