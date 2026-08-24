import { describe, expect, it } from "vitest";
import type { GridResponse, GridRow, SectionTotal } from "../types/budget";
import { deltaVsAverage, groupExpenses, monthDetail, yearMetrics } from "./budget-metrics";

/** 12 meses em que apenas alguns tem valor. */
function months(values: Record<number, number>): string[] {
  return Array.from({ length: 12 }, (_, i) => (values[i] ?? 0).toFixed(2));
}

// Constroi um GridResponse minimo com so os sectionTotals, que e tudo o que o
// yearMetrics le. As linhas ficam vazias de proposito: quem precisa delas e o
// monthDetail, que tem os seus proprios testes.
function gridWith(s: {
  income: number[];
  expenses: number[];
  savings: number[];
}): GridResponse {
  return {
    year: 2026,
    rows: [],
    sectionTotals: [
      { section: "income", months: s.income.map(String), total: "0" },
      { section: "expenses", months: s.expenses.map(String), total: "0" },
      { section: "savings", months: s.savings.map(String), total: "0" },
    ],
  };
}

function total(section: string, m: Record<number, number>): SectionTotal {
  const arr = months(m);
  return {
    section,
    months: arr,
    total: arr.reduce((s, v) => s + Number(v), 0).toFixed(2),
  };
}

function grid(sectionTotals: SectionTotal[], rows: GridRow[] = []): GridResponse {
  return { year: 2026, rows, sectionTotals };
}

function row(
  name: string,
  group: string,
  m: Record<number, number>,
  section = "expenses"
): GridRow {
  const arr = months(m);
  return {
    categoryId: `${section}-${group}-${name}`,
    section: section as GridRow["section"],
    group,
    name,
    months: arr,
    total: arr.reduce((s, v) => s + Number(v), 0).toFixed(2),
  };
}

describe("yearMetrics", () => {
  it("soma as tres seccoes e calcula unallocated", () => {
    const m = yearMetrics(
      grid([
        total("income", { 0: 1000, 1: 1000 }),
        total("expenses", { 0: 600, 1: 500 }),
        total("savings", { 0: 200, 1: 200 }),
      ])
    );

    expect(m.income).toBe(2000);
    expect(m.expenses).toBe(1100);
    expect(m.savings).toBe(400);
    expect(m.unallocated).toBe(500);
  });

  it("da unallocated negativo quando se gasta mais do que entra", () => {
    const m = yearMetrics(
      grid([total("income", { 0: 100 }), total("expenses", { 0: 250 })])
    );
    expect(m.unallocated).toBe(-150);
  });

  it("calcula a taxa de poupanca", () => {
    const m = yearMetrics(
      grid([total("income", { 0: 1000 }), total("savings", { 0: 200 })])
    );
    expect(m.savingsRate).toBeCloseTo(0.2);
  });

  it("devolve savingsRate nulo quando nao ha receitas", () => {
    const m = yearMetrics(grid([total("expenses", { 0: 300 })]));
    expect(m.savingsRate).toBeNull();
  });

  it("devolve sempre 12 pontos mensais", () => {
    const m = yearMetrics(grid([total("income", { 5: 900 })]));
    expect(m.months).toHaveLength(12);
    expect(m.months[5]).toEqual({
      month: 5,
      income: 900,
      expenses: 0,
      savings: 0,
      unallocated: 900,
    });
    expect(m.months[0].income).toBe(0);
  });

  it("trata seccoes ausentes como zero", () => {
    const m = yearMetrics(grid([total("income", { 0: 500 })]));
    expect(m.expenses).toBe(0);
    expect(m.savings).toBe(0);
  });

  it("lastActiveMonth e o ultimo mes com movimento em qualquer seccao", () => {
    const m = yearMetrics(
      grid([total("income", { 0: 100 }), total("expenses", { 7: 50 })])
    );
    expect(m.lastActiveMonth).toBe(7);
  });

  it("lastActiveMonth e nulo num ano sem movimento", () => {
    expect(yearMetrics(grid([])).lastActiveMonth).toBeNull();
    expect(yearMetrics(grid([total("income", {})])).lastActiveMonth).toBeNull();
  });
});

describe("monthDetail", () => {
  it("agrega as despesas do mes por grupo, do maior para o menor", () => {
    const d = monthDetail(
      grid(
        [total("expenses", { 0: 300 })],
        [
          row("Rent", "Home", { 0: 200 }),
          row("Bus", "Transport", { 0: 100 }),
        ]
      ),
      0
    );

    expect(d.byGroup).toEqual([
      { group: "Home", amount: 200 },
      { group: "Transport", amount: 100 },
    ]);
  });

  it("junta categorias sem grupo sob Ungrouped", () => {
    const d = monthDetail(
      grid([total("expenses", { 0: 80 })], [
        row("Misc", "", { 0: 50 }),
        row("Other bits", "", { 0: 30 }),
      ]),
      0
    );

    expect(d.byGroup).toEqual([{ group: "Ungrouped", amount: 80 }]);
  });

  it("ignora as seccoes que nao sao despesas", () => {
    const d = monthDetail(
      grid([total("expenses", { 0: 50 })], [
        row("Rent", "Home", { 0: 50 }),
        row("Salary", "", { 0: 2000 }, "income"),
      ]),
      0
    );

    expect(d.byGroup).toEqual([{ group: "Home", amount: 50 }]);
  });

  it("nao cria linha Other com cinco ou menos categorias", () => {
    const rows = [
      row("A", "G", { 0: 50 }),
      row("B", "G", { 0: 40 }),
      row("C", "G", { 0: 30 }),
      row("D", "G", { 0: 20 }),
      row("E", "G", { 0: 10 }),
    ];
    const d = monthDetail(grid([total("expenses", { 0: 150 })], rows), 0);

    expect(d.topCategories).toHaveLength(5);
    expect(d.topCategories.map((c) => c.name)).not.toContain("Other");
  });

  it("cria linha Other com a soma das restantes acima de cinco", () => {
    const rows = [
      row("A", "G", { 0: 60 }),
      row("B", "G", { 0: 50 }),
      row("C", "G", { 0: 40 }),
      row("D", "G", { 0: 30 }),
      row("E", "G", { 0: 20 }),
      row("F", "G", { 0: 7 }),
      row("H", "G", { 0: 3 }),
    ];
    const d = monthDetail(grid([total("expenses", { 0: 210 })], rows), 0);

    expect(d.topCategories).toHaveLength(6);
    expect(d.topCategories[5]).toEqual({ name: "Other", group: "", amount: 10 });
  });

  it("descarta categorias a zero nesse mes", () => {
    const d = monthDetail(
      grid([total("expenses", { 0: 50 })], [
        row("Rent", "Home", { 0: 50 }),
        row("Holiday", "Fun", { 6: 900 }),
      ]),
      0
    );

    expect(d.topCategories).toEqual([
      { name: "Rent", group: "Home", amount: 50 },
    ]);
  });

  it("devolve listas vazias num mes sem movimento", () => {
    const d = monthDetail(
      grid([total("expenses", { 6: 100 })], [row("Rent", "Home", { 6: 100 })]),
      0
    );

    expect(d.expenses).toBe(0);
    expect(d.byGroup).toEqual([]);
    expect(d.topCategories).toEqual([]);
    expect(d.savingsRate).toBeNull();
  });

  it("calcula os totais do mes escolhido", () => {
    const d = monthDetail(
      grid([
        total("income", { 3: 2000 }),
        total("expenses", { 3: 1200 }),
        total("savings", { 3: 400 }),
      ]),
      3
    );

    expect(d.month).toBe(3);
    expect(d.income).toBe(2000);
    expect(d.unallocated).toBe(400);
    expect(d.savingsRate).toBeCloseTo(0.2);
  });

  it("reembolsos (quantidades negativas) aparecem em topCategories, ordenados por ultimo", () => {
    const rows = [
      row("A", "G", { 0: 100 }),
      row("B", "G", { 0: 80 }),
      row("C", "G", { 0: 60 }),
      row("Refund", "G", { 0: -30 }),
    ];
    const d = monthDetail(
      grid([total("expenses", { 0: 210 })], rows),
      0
    );

    expect(d.topCategories).toHaveLength(4);
    expect(d.topCategories[3]).toEqual({ name: "Refund", group: "G", amount: -30 });
    expect(d.topCategories.map((c) => c.amount)).toEqual([100, 80, 60, -30]);
  });

  it("reembolsos em Other reduzem o total do Other e refletem-se no byGroup", () => {
    const rows = [
      row("A", "G", { 0: 60 }),
      row("B", "G", { 0: 50 }),
      row("C", "G", { 0: 40 }),
      row("D", "G", { 0: 30 }),
      row("E", "G", { 0: 20 }),
      row("F", "G", { 0: 7 }),
      row("Refund", "G", { 0: -5 }),
    ];
    const d = monthDetail(
      grid([total("expenses", { 0: 202 })], rows),
      0
    );

    expect(d.topCategories).toHaveLength(6);
    expect(d.topCategories[5]).toEqual({ name: "Other", group: "", amount: 2 });
    expect(d.byGroup[0]).toEqual({ group: "G", amount: 202 });
  });

  it("com mais de cinco grupos, os restantes somam-se num Other", () => {
    // A rampa de composicao tem seis cores e nao se ciclam: o sexto e ultimo
    // segmento e sempre o Other.
    const rows = ["A", "B", "C", "D", "E", "F", "G"].map((g, i) => ({
      categoryId: `c${i}`,
      section: "expenses" as const,
      group: g,
      name: `cat${i}`,
      // Decrescente, para a ordem dos grupos ser previsivel.
      months: Array.from({ length: 12 }, () => String(100 - i * 10)),
      total: "0",
    }));
    const data: GridResponse = {
      year: 2026,
      rows,
      sectionTotals: [
        { section: "expenses", months: Array(12).fill("490"), total: "0" },
      ],
    };
    const d = monthDetail(data, 0);
    expect(d.byGroup).toHaveLength(6);
    expect(d.byGroup[5].group).toBe("Other");
    // F (50) + G (40). Dobrar nao pode perder dinheiro pelo caminho.
    expect(d.byGroup[5].amount).toBeCloseTo(90, 2);
  });

  it("dobrar os grupos nao mexe no total da despesa", () => {
    // A reconciliacao entre byGroup e o total da seccao tem de sobreviver ao
    // tecto, senao a barra de composicao passa a mentir sobre a proporcao.
    const rows = ["A", "B", "C", "D", "E", "F", "G"].map((g, i) => ({
      categoryId: `c${i}`,
      section: "expenses" as const,
      group: g,
      name: `cat${i}`,
      months: Array.from({ length: 12 }, () => String(100 - i * 10)),
      total: "0",
    }));
    const data: GridResponse = {
      year: 2026,
      rows,
      sectionTotals: [
        { section: "expenses", months: Array(12).fill("490"), total: "0" },
      ],
    };
    const d = monthDetail(data, 0);
    const soma = d.byGroup.reduce((s, g) => s + g.amount, 0);
    expect(soma).toBeCloseTo(d.expenses, 2);
  });
});

describe("yearMetrics averages", () => {
  it("a media ignora os meses sem actividade nenhuma", () => {
    // Dois meses activos em doze: dividir por doze dava uma media falsa e
    // todos os meses apareceriam acima do normal.
    const data = gridWith({
      income: [1000, 2000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      expenses: [400, 600, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      savings: [100, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    const m = yearMetrics(data);
    expect(m.averages.activeMonths).toBe(2);
    expect(m.averages.income).toBeCloseTo(1500, 2);
    expect(m.averages.expenses).toBeCloseTo(500, 2);
    expect(m.averages.savings).toBeCloseTo(100, 2);
  });

  it("um mes conta como activo se so tiver poupanca", () => {
    // Mesma regra do lastActiveMonth: receita OU despesa OU poupanca.
    const data = gridWith({
      income: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      expenses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      savings: [0, 250, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(yearMetrics(data).averages.activeMonths).toBe(1);
    expect(yearMetrics(data).averages.savings).toBeCloseTo(250, 2);
  });

  it("um ano completamente vazio nao divide por zero", () => {
    const data = gridWith({
      income: Array(12).fill(0),
      expenses: Array(12).fill(0),
      savings: Array(12).fill(0),
    });
    const m = yearMetrics(data);
    expect(m.averages.activeMonths).toBe(0);
    expect(m.averages.income).toBe(0);
    expect(m.averages.expenses).toBe(0);
    expect(Number.isNaN(m.averages.savings)).toBe(false);
  });

  it("a media do que sobra e a media das sobras, nao a sobra das medias", () => {
    // Neste caso os dois dao o mesmo, mas fixa-se a definicao.
    const data = gridWith({
      income: [1000, 2000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      expenses: [400, 600, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      savings: [100, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
    expect(yearMetrics(data).averages.unallocated).toBeCloseTo(900, 2);
  });
});

describe("deltaVsAverage", () => {
  it("um valor igual a media da exactamente zero", () => {
    expect(deltaVsAverage(500, 500)).toBe(0);
  });

  it("acima da media da positivo", () => {
    expect(deltaVsAverage(600, 500)).toBeCloseTo(0.2, 6);
  });

  it("abaixo da media da negativo", () => {
    expect(deltaVsAverage(400, 500)).toBeCloseTo(-0.2, 6);
  });

  it("contra media zero nao ha variacao possivel", () => {
    // Nao e 0 nem Infinity: e a ausencia de resposta, e quem desenha decide.
    expect(deltaVsAverage(500, 0)).toBeNull();
  });

  it("com media negativa o sinal do desvio continua a ler-se", () => {
    // O que sobra pode ter media negativa (ano em defice). Sobrar -50 quando a
    // media e -100 e MELHOR que a media, logo desvio positivo.
    expect(deltaVsAverage(-50, -100)).toBeCloseTo(0.5, 6);
  });
});

describe("groupExpenses", () => {
  it("soma as linhas do mesmo grupo", () => {
    expect(
      groupExpenses([
        { group: "Home", amount: 100 },
        { group: "Home", amount: 50 },
        { group: "Car", amount: 30 },
      ])
    ).toEqual([
      { group: "Home", amount: 150 },
      { group: "Car", amount: 30 },
    ]);
  });

  it("ordena por valor descendente", () => {
    expect(
      groupExpenses([
        { group: "Small", amount: 10 },
        { group: "Big", amount: 90 },
      ]).map((g) => g.group)
    ).toEqual(["Big", "Small"]);
  });

  it("corta nos cinco maiores e soma o resto em Other", () => {
    const rows = [
      { group: "A", amount: 60 },
      { group: "B", amount: 50 },
      { group: "C", amount: 40 },
      { group: "D", amount: 30 },
      { group: "E", amount: 20 },
      { group: "F", amount: 7 },
      { group: "G", amount: 3 },
    ];
    const out = groupExpenses(rows);
    expect(out).toHaveLength(6);
    expect(out[5]).toEqual({ group: "Other", amount: 10 });
  });

  it("nao inventa Other quando cabe tudo", () => {
    const out = groupExpenses([
      { group: "A", amount: 1 },
      { group: "B", amount: 2 },
    ]);
    expect(out.map((g) => g.group)).not.toContain("Other");
  });

  it("mantem o total: cortar nao pode perder dinheiro", () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({
      group: `G${i}`,
      amount: (i + 1) * 10,
    }));
    const sum = (xs: { amount: number }[]) =>
      xs.reduce((s, x) => s + x.amount, 0);
    expect(sum(groupExpenses(rows))).toBe(sum(rows));
  });

  it("devolve lista vazia sem linhas", () => {
    expect(groupExpenses([])).toEqual([]);
  });
});
