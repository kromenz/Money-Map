import { describe, expect, it } from "vitest";
import { MONTH_LABELS, formatEur, formatPercent } from "./format";

describe("MONTH_LABELS", () => {
  it("tem 12 meses de JAN a DEC", () => {
    expect(MONTH_LABELS).toHaveLength(12);
    expect(MONTH_LABELS[0]).toBe("JAN");
    expect(MONTH_LABELS[11]).toBe("DEC");
  });
});

describe("formatEur", () => {
  it("formata em euros com locale ingles", () => {
    expect(formatEur(1234.5)).toBe("€1,234.50");
  });

  it("formata negativos", () => {
    expect(formatEur(-42)).toBe("-€42.00");
  });
});

describe("formatPercent", () => {
  it("formata uma fracao com uma casa decimal", () => {
    expect(formatPercent(0.199)).toBe("19.9%");
  });

  it("devolve travessao quando o valor e nulo", () => {
    expect(formatPercent(null)).toBe("—");
  });
});
