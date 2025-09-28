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
  if (!user) throw new Error("Invalid credentials");

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
    user: { id: user.id, email: user.email },
    accessToken,
    refreshToken,
  };
}

export async function refreshTokens(refreshToken: string) {
  // verify token
  const payload: any = verifyRefreshToken(refreshToken) as any;
  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findFirst({
    where: { tokenHash, userId: String(payload.sub) },
  });
  if (!stored) throw new Error("Invalid refresh token");

  await prisma.refreshToken.delete({ where: { id: stored.id } });

  const newAccess = signAccessToken({ sub: payload.sub });
  const newRefresh = signRefreshToken({ sub: payload.sub });

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(newRefresh),
      userId: String(payload.sub),
      expiresAt: new Date(
        Date.now() + config.refreshExpiryDays * 24 * 60 * 60 * 1000
      ),
    },
  });

  return { accessToken: newAccess, refreshToken: newRefresh };
}

export async function logout(refreshToken?: string) {
  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await prisma.refreshToken
      .deleteMany({ where: { tokenHash } })
      .catch(() => {});
  }
}
