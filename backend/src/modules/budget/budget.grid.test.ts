import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { toDisplay } from "./budget.grid";

describe("toDisplay", () => {
  it("mostra as receitas tal como estao guardadas", () => {
    expect(toDisplay("income", new Prisma.Decimal("1150")).toFixed(2)).toBe(
      "1150.00"
    );
  });

  it("mantem visiveis os negativos das receitas, como na folha", () => {
    expect(toDisplay("income", new Prisma.Decimal("-507")).toFixed(2)).toBe(
      "-507.00"
    );
  });

  it("volta a inverter o sinal das despesas e das poupancas", () => {
    expect(
      toDisplay("expenses", new Prisma.Decimal("-1728.89")).toFixed(2)
    ).toBe("1728.89");
    expect(toDisplay("savings", new Prisma.Decimal("-200")).toFixed(2)).toBe(
      "200.00"
    );
  });

  it("nao introduz erro de virgula flutuante ao somar centimos", () => {
    const cents = Array.from({ length: 100 }, () => new Prisma.Decimal("0.10"));
    const sum = cents.reduce((a, b) => a.plus(b), new Prisma.Decimal(0));
    expect(sum.toFixed(2)).toBe("10.00");
  });
});
