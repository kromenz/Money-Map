import { describe, it, expect } from "vitest";
import { parseParcels, parcelsMatch, cellParcels } from "./budget.parcels";

describe("parseParcels", () => {
  it("uma soma simples da uma parcela por termo", () => {
    // Isto e o que as celulas do utilizador ja sao hoje, sem etiqueta nenhuma:
    // duas compras naquele mes, nao um valor unico.
    expect(parseParcels("=42.88+11.39")).toEqual([
      { value: 42.88, note: null },
      { value: 11.39, note: null },
    ]);
  });

  it("le a formula com ou sem o = a frente", () => {
    expect(parseParcels("42.88+11.39")).toHaveLength(2);
  });

  it("a etiqueta cola-se a parcela anterior, que e onde foi escrita", () => {
    expect(parseParcels('=12.5+499.99+N("PS5")')).toEqual([
      { value: 12.5, note: null },
      { value: 499.99, note: "PS5" },
    ]);
  });

  it("cada parcela fica com a sua etiqueta", () => {
    expect(parseParcels('=42.88+N("Amazon")+11.39+N("PS5")')).toEqual([
      { value: 42.88, note: "Amazon" },
      { value: 11.39, note: "PS5" },
    ]);
  });

  it("um unico valor tambem e uma parcela", () => {
    expect(parseParcels("=650")).toEqual([{ value: 650, note: null }]);
  });

  it("o zero inicial que a escrita deixa numa celula vazia conta como parcela", () => {
    // O editFormulaCell escreve "0+5" numa celula que nao tinha nada. O zero
    // nao e uma compra, mas tambem nao mente sobre o total -- filtra-se na
    // apresentacao e nao aqui, para o parseParcels nao ter de adivinhar.
    expect(parseParcels('=0+1.31+N("AAPL_US_EQ 2026-09-15")')).toEqual([
      { value: 0, note: null },
      { value: 1.31, note: "AAPL_US_EQ 2026-09-15" },
    ]);
  });

  it("uma parcela negativa mantem o sinal", () => {
    expect(parseParcels("=100-25")).toEqual([
      { value: 100, note: null },
      { value: -25, note: null },
    ]);
  });

  it("as aspas duplicadas voltam a ser uma so", () => {
    // E a escapagem inversa da que o sheet-write aplicou ao escrever.
    expect(parseParcels('=5+N("o ""grande""")')).toEqual([
      { value: 5, note: 'o "grande"' },
    ]);
  });

  it("os espacos a volta nao contam", () => {
    expect(parseParcels("= 42.88 + 11.39 ")).toHaveLength(2);
  });

  describe("recusa tudo o que nao e uma soma simples", () => {
    // Inventar uma leitura para estes dava uma lista de compras que nunca
    // existiu. Mais vale nao mostrar nada do que mostrar errado.
    it("um SUM de subtotal nao tem parcelas", () => {
      expect(parseParcels("=SUM(C21:C28)")).toEqual([]);
    });

    it("uma referencia a outra celula nao tem parcelas", () => {
      expect(parseParcels("=C26+12.5")).toEqual([]);
    });

    it("uma multiplicacao nao tem parcelas", () => {
      expect(parseParcels("=12.5*3")).toEqual([]);
    });

    it("parenteses nao tem parcelas", () => {
      expect(parseParcels("=-(12.5+3)")).toEqual([]);
    });

    it("uma formula truncada no operador nao tem parcelas", () => {
      expect(parseParcels("=12.5+")).toEqual([]);
    });

    it("null e vazio nao rebentam", () => {
      expect(parseParcels(null)).toEqual([]);
      expect(parseParcels("")).toEqual([]);
      expect(parseParcels("=")).toEqual([]);
    });
  });
});

describe("parcelsMatch", () => {
  it("aceita quando as parcelas somam ao valor da celula", () => {
    expect(parcelsMatch(parseParcels("=42.88+11.39"), 54.27)).toBe(true);
  });

  it("a etiqueta nao entra na soma -- o N() de texto vale zero", () => {
    expect(parcelsMatch(parseParcels('=12.5+499.99+N("PS5")'), 512.49)).toBe(true);
  });

  it("recusa quando nao bate", () => {
    // Uma lista de compras que nao soma ao total do mes e pior do que lista
    // nenhuma: o utilizador nao a pode usar para reconciliar.
    expect(parcelsMatch(parseParcels("=42.88+11.39"), 99)).toBe(false);
  });

  it("aguenta o ruido da virgula flutuante", () => {
    // 4.7+114.93+12.5 da 132.13000000000002 em binario.
    expect(parcelsMatch(parseParcels("=4.7+114.93+12.5"), 132.13)).toBe(true);
  });

  it("sem parcelas nunca bate", () => {
    expect(parcelsMatch([], 0)).toBe(false);
  });
});

describe("cellParcels", () => {
  it("uma soma legivel passa tal e qual", () => {
    expect(cellParcels("=42.88+11.39", 54.27)).toEqual([
      { value: 42.88, note: null },
      { value: 11.39, note: null },
    ]);
  });

  it("um numero escrito a mao conta como uma parcela", () => {
    // 83 das 145 celulas da folha real sao assim. Deixa-las de fora fazia a
    // lista do mes perder a maioria das categorias.
    expect(cellParcels(null, 650)).toEqual([{ value: 650, note: null }]);
  });

  it("uma formula que nao se le conta como uma parcela do valor da celula", () => {
    // Diz "uma entrada deste valor" onde podem ter sido duas. Nao mente sobre
    // dinheiro: o valor esta certo.
    expect(cellParcels("=95.83*2", 191.66)).toEqual([
      { value: 191.66, note: null },
    ]);
    expect(cellParcels("=-(106.66+78.58)", -185.24)).toEqual([
      { value: -185.24, note: null },
    ]);
  });

  it("a rede nunca mexe no total", () => {
    for (const [f, v] of [
      ["=42.88+11.39", 54.27],
      [null, 650],
      ["=95.83*2", 191.66],
    ] as [string | null, number][]) {
      const soma = cellParcels(f, v).reduce((a, p) => a + p.value, 0);
      expect(Math.abs(soma - v)).toBeLessThan(0.005);
    }
  });
});
