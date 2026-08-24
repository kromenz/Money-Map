import { describe, it, expect } from "vitest";
import { applyEdits, SheetWriteError } from "./sheet-write";

/**
 * Uma folha minima com uma linha e as celulas que o teste precisa.
 *
 * `row` tem de coincidir com o numero de linha embutido nas refs das
 * celulas (ex.: "C30" precisa de `row: 30`) -- e assim que applyEdits
 * localiza o bloco `<row>` certo.
 */
function sheet(cells: string, row = 26): string {
  return `<worksheet><sheetData><row r="${row}" spans="1:16">${cells}</row></sheetData></worksheet>`;
}

describe("applyEdits, modo formula", () => {
  it("anexa a formula e actualiza o valor em cache", () => {
    const out = applyEdits(
      sheet(`<c r="E26" s="37"><f>4.7+114.93</f><v>119.63</v></c>`),
      [{ ref: "E26", delta: 12.5, mode: "formula" }]
    );

    expect(out).toContain("<f>4.7+114.93+12.5</f>");
    expect(out).toContain("<v>132.13</v>");
  });

  it("mantem o estilo da celula", () => {
    const out = applyEdits(
      sheet(`<c r="E26" s="37"><f>10</f><v>10</v></c>`),
      [{ ref: "E26", delta: 5, mode: "formula" }]
    );

    expect(out).toContain(`<c r="E26" s="37">`);
  });

  it("uma celula so com valor passa a ter formula", () => {
    const out = applyEdits(
      sheet(`<c r="L26" s="37"><v>1400</v></c>`),
      [{ ref: "L26", delta: 12.5, mode: "formula" }]
    );

    expect(out).toContain(`<c r="L26" s="37"><f>1400+12.5</f><v>1412.5</v></c>`);
  });

  it("uma forma com parenteses e menos unario continua correcta", () => {
    // -(106.66+78.58) vale -185.24. Anexar +12.5 tem de dar -172.74, e nao
    // -(106.66+78.58+12.5).
    const out = applyEdits(
      sheet(`<c r="I26" s="37"><f>-(106.66+78.58)</f><v>-185.24</v></c>`),
      [{ ref: "I26", delta: 12.5, mode: "formula" }]
    );

    expect(out).toContain("<f>-(106.66+78.58)+12.5</f>");
    expect(out).toContain("<v>-172.74</v>");
  });

  it("cria a celula em falta na posicao certa da linha", () => {
    const out = applyEdits(
      sheet(
        `<c r="C26" s="37"><v>1</v></c><c r="E26" s="37"><v>3</v></c>`
      ),
      [{ ref: "D26", delta: 12.5, mode: "formula" }]
    );

    // Entre C26 e E26, com o estilo herdado do vizinho, e sem tocar em nenhuma
    // das duas.
    expect(out).toContain(
      `<c r="C26" s="37"><v>1</v></c>` +
        `<c r="D26" s="37"><f>12.5</f><v>12.5</v></c>` +
        `<c r="E26" s="37"><v>3</v></c>`
    );
  });

  it("recusa escrever numa celula com formula partilhada", () => {
    expect(() =>
      applyEdits(
        sheet(`<c r="E26" s="37"><f t="shared" si="1">SUM(C1:C2)</f><v>5</v></c>`),
        [{ ref: "E26", delta: 1, mode: "formula" }]
      )
    ).toThrow(SheetWriteError);
  });

  it("recusa uma linha que nao existe", () => {
    expect(() =>
      applyEdits(sheet(`<c r="E26" s="37"><v>1</v></c>`), [
        { ref: "E99", delta: 1, mode: "formula" },
      ])
    ).toThrow(SheetWriteError);
  });
});

describe("applyEdits, modo valor", () => {
  it("soma ao valor em cache e nao toca na formula partilhada", () => {
    const cell = `<c r="C30" s="40"><f t="shared" ref="C30:N30" si="1">SUM(C21:C28)</f><v>1348.78</v></c>`;
    const out = applyEdits(sheet(cell, 30), [
      { ref: "C30", delta: 12.5, mode: "value" },
    ]);

    expect(out).toContain(`<f t="shared" ref="C30:N30" si="1">SUM(C21:C28)</f>`);
    expect(out).toContain("<v>1361.28</v>");
  });

  it("ignora em silencio uma celula de subtotal que nao existe", () => {
    // O parser salta os meses sem valor em cache, por isso um subtotal ausente
    // nao e comparado e nao ha nada a corrigir.
    const xml = sheet(`<c r="C30" s="40"><v>1</v></c>`, 30);
    expect(applyEdits(xml, [{ ref: "H30", delta: 5, mode: "value" }])).toBe(xml);
  });

  it("nao corrompe uma formula com referencias absolutas ($)", () => {
    // String.prototype.replace com uma string de substituicao interpreta "$&",
    // "$1", etc. Uma formula como SUM($C$21:$C$28) tem de sobreviver
    // byte-a-byte; so o valor em cache pode mudar.
    const cell = `<c r="C30" s="40"><f>SUM($C$21:$C$28)</f><v>1348.78</v></c>`;
    const out = applyEdits(sheet(cell, 30), [
      { ref: "C30", delta: 12.5, mode: "value" },
    ]);

    expect(out).toContain(`<f>SUM($C$21:$C$28)</f>`);
    expect(out).toContain("<v>1361.28</v>");
  });
});

describe("applyEdits, celulas de texto (t=\"s\"/\"str\"/\"inlineStr\")", () => {
  // A folha real usa "-" (shared string) como marcador de mes sem movimento
  // em varias categorias. O indice guardado em <v> (ex.: 59 para a string
  // "-") nao e um montante -- tratar essa celula como se tivesse valor 59 fazia
  // a categoria crescer 59+delta enquanto os subtotais so cresciam delta, e o
  // "t=\"s\"" ficava, sem sentido, numa celula agora numerica.
  it("t=\"s\" em modo formula ignora o indice e produz uma formula nova", () => {
    const out = applyEdits(
      sheet(`<c r="C44" s="57" t="s"><v>59</v></c>`, 44),
      [{ ref: "C44", delta: 5, mode: "formula" }]
    );

    expect(out).toContain(`<c r="C44" s="57"><f>5</f><v>5</v></c>`);
    expect(out).not.toContain('t="s"');
  });

  it("t=\"s\" em modo valor nao herda o indice", () => {
    const out = applyEdits(
      sheet(`<c r="C44" s="57" t="s"><v>59</v></c>`, 44),
      [{ ref: "C44", delta: 5, mode: "value" }]
    );

    expect(out).toContain("<v>5</v>");
    expect(out).not.toContain("<v>64</v>");
  });

  it("t=\"str\" em modo formula comporta-se como t=\"s\"", () => {
    const out = applyEdits(
      sheet(`<c r="C44" s="57" t="str"><f>"-"</f><v>-</v></c>`, 44),
      [{ ref: "C44", delta: 5, mode: "formula" }]
    );

    expect(out).toContain(`<c r="C44" s="57"><f>5</f><v>5</v></c>`);
    expect(out).not.toContain('t="str"');
  });

  it("t=\"inlineStr\" em modo formula comporta-se como t=\"s\"", () => {
    const out = applyEdits(
      sheet(`<c r="C44" s="57" t="inlineStr"><is><t>-</t></is></c>`, 44),
      [{ ref: "C44", delta: 5, mode: "formula" }]
    );

    expect(out).toContain(`<c r="C44" s="57"><f>5</f><v>5</v></c>`);
    expect(out).not.toContain('t="inlineStr"');
  });
});

describe("applyEdits, varias de uma vez", () => {
  it("aplica todas as edicoes ao mesmo XML", () => {
    // C26 (categoria) e C30 (subtotal) vivem em linhas diferentes, como numa
    // folha real -- por isso duas linhas <row>, nao uma so.
    const xml =
      `<worksheet><sheetData>` +
      `<row r="26" spans="1:16"><c r="C26" s="37"><f>10</f><v>10</v></c></row>` +
      `<row r="30" spans="1:16"><c r="C30" s="40"><f>SUM(C26:C26)</f><v>10</v></c></row>` +
      `</sheetData></worksheet>`;

    const out = applyEdits(xml, [
      { ref: "C26", delta: 5, mode: "formula" },
      { ref: "C30", delta: 5, mode: "value" },
    ]);

    expect(out).toContain("<f>10+5</f>");
    expect(out).toContain(`<f>SUM(C26:C26)</f><v>15</v>`);
  });
});
