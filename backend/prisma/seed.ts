import { Prisma, PrismaClient, Recurrence } from "@prisma/client";
import * as dotenv from "dotenv";

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

  const user = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      name: "Alice Example",
      email: "alice@example.com",
      password: "changeme",
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
