import { describe, it, expect } from "vitest";
import { purchasesView } from "./purchases";
import type { MonthParcels, CategoryParcels } from "../types/parcels";

/** Uma categoria com as parcelas escritas como a API as manda: decimais em string. */
function category(
  name: string,
  group: string,
  parcels: [number, string | null][]
): CategoryParcels {
  return {
    categoryId: `${group}:${name}`,
    section: "expenses",
    group,
    name,
    total: parcels.reduce((s, [v]) => s + v, 0).toFixed(2),
    parcels: parcels.map(([amount, note], i) => ({
      seq: i,
      amount: amount.toFixed(2),
      note,
    })),
  };
}

function month(categories: CategoryParcels[]): MonthParcels {
  return { year: 2026, month: 8, categories };
}

describe("purchasesView", () => {
  it("poe as categorias da maior para a menor", () => {
    // A API devolve pela ordem da folha; o cartao quer pela ordem do dinheiro.
    const view = purchasesView(
      month([
        category("Supplies", "Home", [[42.88, "Amazon"]]),
        category("Games", "Leisure", [[499.99, "PS5"]]),
        category("Transport", "", [[47.1, null]]),
      ])
    );

    expect(view.categories.map((c) => c.name)).toEqual([
      "Games",
      "Transport",
      "Supplies",
    ]);
  });

  it("dentro da categoria, tambem a maior primeiro", () => {
    const view = purchasesView(
      month([
        category("Groceries", "Home", [
          [88.0, "Pingo Doce"],
          [212.4, "Continente"],
          [52.2, null],
        ]),
      ])
    );

    expect(view.categories[0].parcels.map((p) => p.amount)).toEqual([
      212.4, 88.0, 52.2,
    ]);
  });

  it("empates ficam pela ordem em que a folha os escreveu", () => {
    // Sem isto a ordem dependia do sort do motor e a lista dancava entre
    // renderizacoes com os mesmos dados.
    const view = purchasesView(
      month([
        category("Subs", "", [
          [10.0, "Netflix"],
          [10.0, "Spotify"],
        ]),
      ])
    );

    expect(view.categories[0].parcels.map((p) => p.note)).toEqual([
      "Netflix",
      "Spotify",
    ]);
  });

  it("parcelas com o mesmo nome juntam-se numa linha, com a soma e a contagem", () => {
    // O mes real: dois "Marvel-Must-Have" de 11,95 e dois "Risky packs".
    const view = purchasesView(
      month([
        category("Subs", "Leisure", [
          [11.95, "Marvel-Must-Have"],
          [8.97, "Risky packs"],
          [11.95, "Marvel-Must-Have"],
          [5.98, "risky packs "],
          [40.99, "30th Booster Bundle"],
        ]),
      ])
    );

    const c = view.categories[0];
    expect(c.parcels.map((p) => [p.note, p.amount, p.count])).toEqual([
      ["30th Booster Bundle", 40.99, 1],
      ["Marvel-Must-Have", 23.9, 2],
      ["Risky packs", 14.95, 2],
    ]);
    // O numero de compras nao muda por se agruparem.
    expect(c.items).toBe(5);
  });

  it("as parcelas sem nome nunca se juntam", () => {
    // Duas compras sem etiqueta nao sao a mesma coisa so por nao terem nome.
    const view = purchasesView(
      month([category("Transport", "", [[47.1, null], [20, null]])])
    );

    expect(view.categories[0].parcels.map((p) => p.count)).toEqual([1, 1]);
  });

  it("a quota e a fatia do total do mes", () => {
    const view = purchasesView(
      month([
        category("Games", "Leisure", [[750, "PS5"]]),
        category("Transport", "", [[250, null]]),
      ])
    );

    expect(view.total).toBe(1000);
    expect(view.categories.map((c) => c.share)).toEqual([0.75, 0.25]);
  });

  it("um reembolso nao desenha uma barra ao contrario", () => {
    // Uma categoria pode fechar o mes negativa (devolucao maior do que a
    // compra). O valor mostra-se como e -- e o comprimento da barra e zero,
    // porque um segmento de comprimento negativo nao existe.
    const view = purchasesView(
      month([
        category("Games", "Leisure", [[500, "PS5"]]),
        category("Returns", "Home", [[-30, "devolucao"]]),
      ])
    );

    const returns = view.categories[1];
    expect(returns.total).toBe(-30);
    expect(returns.share).toBe(0);
  });

  it("um mes sem despesa nenhuma nao divide por zero", () => {
    const view = purchasesView(month([category("Games", "Leisure", [[0, "x"]])]));

    expect(view.total).toBe(0);
    expect(view.categories[0].share).toBe(0);
  });

  it("o rotulo junta grupo e nome, e dispensa o separador quando nao ha grupo", () => {
    const view = purchasesView(
      month([
        category("Groceries", "Home", [[10, null]]),
        category("Health", "", [[5, null]]),
      ])
    );

    expect(view.categories.map((c) => c.label)).toEqual([
      "Home · Groceries",
      "Health",
    ]);
  });

  it("um mes vazio da uma vista vazia e nao rebenta", () => {
    const view = purchasesView(month([]));

    expect(view.total).toBe(0);
    expect(view.categories).toEqual([]);
  });
});
