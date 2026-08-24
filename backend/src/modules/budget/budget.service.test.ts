import { describe, it, expect } from "vitest";
import { externalIdFor, monthDate } from "./budget.service";

describe("monthDate", () => {
  it("data no dia 1 do mes, ao meio-dia UTC", () => {
    const d = monthDate(2026, 7);
    expect(d.toISOString()).toBe("2026-07-01T12:00:00.000Z");
  });

  it("nunca cai no mes anterior por causa de fusos", () => {
    for (let m = 1; m <= 12; m += 1) {
      expect(monthDate(2026, m).getUTCMonth()).toBe(m - 1);
    }
  });
});

describe("externalIdFor", () => {
  it("e determinístico e inclui seccao, grupo e nome", () => {
    const id = externalIdFor(2026, 3, {
      section: "expenses",
      group: "Personal and Family",
      name: "Tecnology",
    });
    expect(id).toBe("excel:2026-03:expenses/Personal and Family/Tecnology");
  });

  it("distingue duas categorias Other de seccoes diferentes", () => {
    const a = externalIdFor(2026, 1, { section: "income", group: "", name: "Other" });
    const b = externalIdFor(2026, 1, { section: "savings", group: "", name: "Other" });
    expect(a).not.toBe(b);
  });

  it("preenche o mes com zero a esquerda para ordenar bem", () => {
    const id = externalIdFor(2026, 1, { section: "income", group: "", name: "X" });
    expect(id).toContain("2026-01:");
  });
});
