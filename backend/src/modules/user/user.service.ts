import { prisma } from "../../db/prisma";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function getAllUsers() {
  return await prisma.user.findMany();
}

export async function getUser(identifier?: string) {
  if (!identifier) {
    console.error("getUser called with empty param:", identifier);
    throw new Error("Missing param from request.");
  }

  let user;

  if (uuidRegex.test(identifier)) {
    user = await prisma.user.findUnique({ where: { id: identifier } });
  } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
    user = await prisma.user.findUnique({ where: { email: identifier } });
  } else {
    throw new Error("Invalid identifier format");
  }

  if (!user) {
    throw new Error("User not found");
  }

  return { id: user.id, email: user.email, name: user.name };
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
