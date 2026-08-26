import { describe, expect, it } from "vitest";
import {
  HIDDEN,
  MONTH_LABELS,
  formatAmount,
  formatEur,
  formatPercent,
} from "./format";

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

describe("formatAmount", () => {
  it("nao escreve o simbolo da moeda", () => {
    expect(formatAmount(1234.5)).toBe("1,234.50");
  });

  it("mantem sempre duas casas decimais", () => {
    expect(formatAmount(8)).toBe("8.00");
  });

  it("formata negativos", () => {
    expect(formatAmount(-42)).toBe("-42.00");
  });

  it("agrupa os milhares como o formatEur", () => {
    expect(formatAmount(1234567.89)).toBe("1,234,567.89");
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

describe("valores escondidos", () => {
  it("o formatEur tapa o montante", () => {
    expect(formatEur(1234.5, true)).toBe(HIDDEN);
  });

  it("o formatEur tapa tambem os negativos, sem deixar escapar o sinal", () => {
    expect(formatEur(-42, true)).toBe(HIDDEN);
  });

  it("o formatAmount tapa o montante", () => {
    expect(formatAmount(1234.5, true)).toBe(HIDDEN);
  });

  it("nao tapa nada quando a bandeira e falsa", () => {
    expect(formatEur(8, false)).toBe("€8.00");
    expect(formatAmount(8, false)).toBe("8.00");
  });

  it("a percentagem sobrevive -- e para isso que a opcao existe", () => {
    expect(formatPercent(0.199)).toBe("19.9%");
  });
});
