import { Prisma, PrismaClient, Recurrence } from "@prisma/client";
import * as dotenv from "dotenv";
import { hashPassword } from "../src/utils/password.ts";
import jwt from "jsonwebtoken";
import crypto from "crypto";

dotenv.config();
const prisma = new PrismaClient();

async function main() {
  const categories = await Promise.all(
    ["Food", "Transport", "Housing", "Entertainment"].map((name) =>
      prisma.category.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  );

  const hashedpass = await hashPassword("changeme");
  const user = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      name: "Alice Example",
      email: "alice@example.com",
      password: hashedpass,
    },
  });

  await prisma.expense.createMany({
    data: [
      {
        userId: user.id,
        amount: new Prisma.Decimal(12.5),
        categoryId: categories.find((c) => c.name === "Food")!.id,
        description: "Lunch at café",
        recurrence: Recurrence.none,
      },
      {
        userId: user.id,
        amount: new Prisma.Decimal(2.75),
        categoryId: categories.find((c) => c.name === "Transport")!.id,
        description: "Bus ticket",
        recurrence: Recurrence.daily,
      },
    ],
  });

  await prisma.income.createMany({
    data: [
      {
        userId: user.id,
        amount: new Prisma.Decimal(1500),
        description: "Salary",
      },
    ],
  });

  // --- Refresh token seeding ---
  // Use REFRESH_SECRET from env (como na tua app)
  const REFRESH_SECRET = process.env.REFRESH_SECRET;
  if (!REFRESH_SECRET) {
    throw new Error("REFRESH_SECRET não definido no .env");
  }

  const refreshExpiryDays = Number(process.env.REFRESH_EXPIRY_DAYS || 30);

  // gera um refresh token JWT (apenas para dev/testing)
  const rawRefreshToken = jwt.sign({ sub: user.id }, REFRESH_SECRET, {
    expiresIn: `${refreshExpiryDays}d`,
  });

  // guarda o hash no DB (sha256)
  const tokenHash = crypto
    .createHash("sha256")
    .update(rawRefreshToken)
    .digest("hex");
  const expiresAt = new Date(
    Date.now() + refreshExpiryDays * 24 * 60 * 60 * 1000
  );

  // upsert (se já existir não duplica)
  await prisma.refreshToken
    .upsert({
      where: {
        // upsert precisa de um unique identifier — se não tens um unique field para tokenHash
        // usa createMany ou create. Aqui assumimos que tokenHash é único (poderias adicionar @unique se quiseres)
        // Para segurança, na ausência de unique, vamos criar sem upsert:
        id: -1 as any, // placeholder para evitar erro; em alternativa, usa create()
      },
      update: {},
      create: {
        tokenHash,
        userId: user.id,
        expiresAt,
      },
    })
    .catch(async () => {
      // se upsert falhar por não existir um unique apropriado, faz create normalmente
      await prisma.refreshToken.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt,
        },
      });
    });

  console.log("✅ Seed concluído");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
