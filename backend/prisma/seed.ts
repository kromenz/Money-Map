import { Prisma, PrismaClient, Section, TxSource } from "@prisma/client";
import * as dotenv from "dotenv";
import { hashPassword } from "../src/utils/password.ts";
import jwt from "jsonwebtoken";
import crypto from "crypto";

dotenv.config();
const prisma = new PrismaClient();

/**
 * O seed corre a cada arranque do container (ver run.sh), portanto tem de ser
 * idempotente: tudo aqui e upsert por chave unica, nunca create solto.
 */

const SEED_EMAIL = "alice@example.com";
const SEED_PASSWORD = "changeme";

/** Convencao de sinal da folha: receita positiva, despesa e poupanca negativas. */
type SeedCategory = {
  section: Section;
  group: string;
  name: string;
  /** Um valor por mes, indice 0 = Janeiro. Ausente = mes sem movimento. */
  months: number[];
};

const CATEGORIES: SeedCategory[] = [
  { section: "income", group: "", name: "Salary", months: [1500, 1500, 1500] },
  { section: "income", group: "", name: "Other", months: [0, 54.7] },
  {
    section: "savings",
    group: "",
    name: "Savings and Investments",
    months: [200, 200, 200],
  },
  {
    section: "expenses",
    group: "Home",
    name: "Mortgage / Rent",
    months: [650, 650, 650],
  },
  {
    section: "expenses",
    group: "Daily Living",
    name: "Groceries",
    months: [312.4, 288.15, 301.9],
  },
  {
    section: "expenses",
    group: "Transportation",
    name: "Fuel",
    months: [60, 45.5, 72.3],
  },
];

/** Dia 1 do mes, meio-dia UTC -- a mesma convencao do importador da folha. */
function monthDate(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
}

async function main() {
  // O ano corrente para os dados aparecerem no dashboard sem trocar de ano.
  const year = new Date().getUTCFullYear();

  const user = await prisma.user.upsert({
    where: { email: SEED_EMAIL },
    update: {},
    create: {
      name: "Alice Example",
      email: SEED_EMAIL,
      password: await hashPassword(SEED_PASSWORD),
    },
  });

  let sortOrder = 0;
  for (const c of CATEGORIES) {
    sortOrder += 1;

    const category = await prisma.category.upsert({
      where: {
        userId_section_group_name: {
          userId: user.id,
          section: c.section,
          group: c.group,
          name: c.name,
        },
      },
      update: {},
      create: {
        userId: user.id,
        name: c.name,
        section: c.section,
        group: c.group,
        sortOrder,
      },
    });

    for (const [i, value] of c.months.entries()) {
      if (value === 0) continue;

      const month = i + 1;
      const amount = new Prisma.Decimal(
        (c.section === "income" ? value : -value).toFixed(2)
      );
      // externalId deterministico: reseed actualiza a linha em vez de a duplicar.
      const externalId = `seed:${year}-${String(month).padStart(2, "0")}:${
        c.section
      }/${c.group}/${c.name}`;

      await prisma.transaction.upsert({
        where: { userId_externalId: { userId: user.id, externalId } },
        update: { amount, categoryId: category.id },
        create: {
          userId: user.id,
          date: monthDate(year, month),
          amount,
          categoryId: category.id,
          source: TxSource.manual,
          externalId,
          rawDescription: `Movimento de exemplo (seed) ${year}`,
        },
      });
    }
  }

  // Refresh token para dev/testing. Só emite um novo quando nao ha nenhum
  // valido -- de outra forma cada arranque do container deixava mais uma linha.
  const REFRESH_SECRET = process.env.REFRESH_SECRET;
  if (!REFRESH_SECRET) {
    throw new Error("REFRESH_SECRET nao definido no .env");
  }

  const refreshExpiryDays = Number(process.env.REFRESH_EXPIRY_DAYS || 30);
  const existing = await prisma.refreshToken.findFirst({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
  });

  if (!existing) {
    const rawRefreshToken = jwt.sign({ sub: user.id }, REFRESH_SECRET, {
      expiresIn: `${refreshExpiryDays}d`,
    });

    await prisma.refreshToken.create({
      data: {
        tokenHash: crypto
          .createHash("sha256")
          .update(rawRefreshToken)
          .digest("hex"),
        userId: user.id,
        expiresAt: new Date(
          Date.now() + refreshExpiryDays * 24 * 60 * 60 * 1000
        ),
      },
    });
  }

  console.log(
    `Seed concluido: ${SEED_EMAIL} / ${SEED_PASSWORD}, ${CATEGORIES.length} categorias em ${year}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
