import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { compareScope, matches } from "./budget.verify";

const D = (n: string | number) => new Prisma.Decimal(n);
const twelve = (v: number) => Array(12).fill(D(v));

describe("matches", () => {
  it("aceita diferencas ate meio centimo", () => {
    expect(matches(D("10.000"), D("10.004"))).toBe(true);
    expect(matches(D("10.000"), D("10.006"))).toBe(false);
  });
});

describe("compareScope", () => {
  it("compara mes a mes e marca os que batem", () => {
    const sheet = [100, 200, ...Array(10).fill(0)];
    const imported = [D(100), D(200), ...Array(10).fill(D(0))];
    const { rows, made, skipped } = compareScope("expenses/Home", sheet, imported);

    expect(made).toBe(12);
    expect(skipped).toBe(0);
    expect(rows.every((r) => r.ok)).toBe(true);
    expect(rows[1]).toMatchObject({ month: 2, sheet: "200.00", imported: "200.00" });
  });

  it("apanha uma categoria atribuida ao grupo errado", () => {
    // A folha diz 446.94 em fevereiro; nos so importamos 205.07 para este
    // grupo porque uma categoria foi parar a outro sitio.
    const sheet = [0, 446.94, ...Array(10).fill(0)];
    const imported = [D(0), D("205.07"), ...Array(10).fill(D(0))];
    const { rows } = compareScope("expenses/Transportation", sheet, imported);

    expect(rows[1].ok).toBe(false);
    expect(rows.filter((r) => !r.ok)).toHaveLength(1);
  });

  it("salta os meses sem valor em cache em vez de os tratar como zero", () => {
    const sheet = [null, 50, null, ...Array(9).fill(null)];
    const { rows, made, skipped } = compareScope("expenses/Home", sheet, twelve(0));

    expect(made).toBe(1);
    expect(skipped).toBe(11);
    expect(rows).toHaveLength(1);
    expect(rows[0].month).toBe(2);
    // 50 declarado contra 0 importado: nao bate, e tem de dizer isso.
    expect(rows[0].ok).toBe(false);
  });

  it("um escopo inteiro sem cache produz zero comparacoes, nao um falso sucesso", () => {
    const { rows, made, skipped } = compareScope("x", Array(12).fill(null), twelve(0));
    expect(made).toBe(0);
    expect(skipped).toBe(12);
    expect(rows).toHaveLength(0);
  });

  it("trata um mes importado em falta como zero", () => {
    const { rows } = compareScope("x", [10, ...Array(11).fill(null)], []);
    expect(rows[0]).toMatchObject({ imported: "0.00", ok: false });
  });
});
