import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { toDisplay, toStored } from "./budget.grid";

describe("toStored", () => {
  it("inverte poupancas e despesas, e deixa as receitas em paz", () => {
    expect(toStored("savings", 500)).toBe(-500);
    expect(toStored("expenses", 45.9)).toBe(-45.9);
    expect(toStored("income", 1150)).toBe(1150);
  });

  it("aceita Decimal para quem escreve dinheiro sem passar por float", () => {
    expect(toStored("savings", new Prisma.Decimal("500.00")).toFixed(2)).toBe(
      "-500.00"
    );
    expect(toStored("income", new Prisma.Decimal("1.31")).toFixed(2)).toBe(
      "1.31"
    );
  });

  it("toDisplay e a inversa exacta de toStored, seccao a seccao", () => {
    // Esta e a propriedade que a app inteira assume: o que se le e o que se
    // escreveu. Se um dia deixar de ser verdade, os numeros deixam de bater
    // com a folha ao centimo.
    for (const section of ["income", "savings", "expenses"]) {
      for (const value of ["1150.00", "-507.00", "0.00", "0.01"]) {
        const original = new Prisma.Decimal(value);
        expect(toDisplay(section, toStored(section, original)).toFixed(2)).toBe(
          original.toFixed(2)
        );
      }
    }
  });
});

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
