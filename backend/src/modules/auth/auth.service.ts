import { prisma } from "../../db/prisma";
import bcrypt from "bcrypt";
import {
  signAccessToken,
  signRefreshToken,
  hashToken,
  verifyRefreshToken,
} from "../../utils/tokens";
import config from "../../config";

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
