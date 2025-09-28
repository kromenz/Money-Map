import { prisma } from "../../db/prisma";

export async function getAllUsers() {
  return await prisma.user.findMany();
}

export async function getUser(userId?: string) {
  if (!userId) {
    console.error("getUser called with empty userId:", userId);
    throw new Error("Missing userId from request.");
  }

  const id = String(userId);

  const existing = await prisma.user.findUnique({ where: { id } });

  if (!existing) {
    throw new Error("User not found");
  }

  return { id: existing.id, email: existing.email, name: existing.name };
}

export async function getUserByEmail(email: string) {
  if (!email) {
    console.error("getUserByEmail called with empty email:", email);
    throw new Error("Missing email from request.");
  }

  email = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    throw new Error("Email not found.");
  }

  return { id: existing.id, name: existing.name };
}
