import { describe, it, expect } from "vitest";
import { noteKey, suggestNotes, SUGGESTION_LIMIT } from "./note-suggestions";

const all = [
  { note: "Buenissima", uses: 4 },
  { note: "Continente", uses: 3 },
  { note: "Continente Bom Dia", uses: 1 },
  { note: "Amazon", uses: 2 },
];

describe("noteKey", () => {
  it("a caixa nao distingue duas etiquetas", () => {
    expect(noteKey("Buenissima")).toBe(noteKey("buenissima"));
    expect(noteKey("BUENISSIMA")).toBe(noteKey("Buenissima"));
  });

  it("os espacos das pontas e os repetidos do meio nao contam", () => {
    expect(noteKey("  Pingo   Doce ")).toBe(noteKey("Pingo Doce"));
  });

  it("os acentos tambem nao", () => {
    // "Mecanico" e "Mecânico" sao a mesma oficina, e a folha ja tem as duas
    // grafias porque escrever acentos a pressa e o que menos apetece.
    expect(noteKey("Mecânico")).toBe(noteKey("Mecanico"));
    expect(noteKey("Salário")).toBe(noteKey("salario"));
  });

  it("nao junta o que e mesmo diferente", () => {
    expect(noteKey("Continente")).not.toBe(noteKey("Continente Bom Dia"));
  });
});

describe("suggestNotes", () => {
  it("com o campo vazio sugere as mais usadas", () => {
    expect(suggestNotes(all, "").map((s) => s.note)).toEqual([
      "Buenissima",
      "Continente",
      "Continente Bom Dia",
      "Amazon",
    ]);
  });

  it("quem comeca pelo que foi escrito vem antes de quem so o contem", () => {
    const found = suggestNotes(
      [
        { note: "Loja do Continente", uses: 9 },
        { note: "Continente", uses: 1 },
      ],
      "cont"
    );

    // Apesar de "Loja do Continente" ser muito mais usada: quem escreve "cont"
    // esta a comecar uma palavra, e a lista tem de responder a isso primeiro.
    expect(found.map((s) => s.note)).toEqual([
      "Continente",
      "Loja do Continente",
    ]);
  });

  it("procura sem ligar a acentos nem a caixa", () => {
    const found = suggestNotes([{ note: "Mecânico", uses: 1 }], "meca");
    expect(found.map((s) => s.note)).toEqual(["Mecânico"]);
  });

  it("nao sugere o que ja esta escrito por inteiro", () => {
    // Com a etiqueta ja completa a lista nao tem nada a acrescentar, e ficar
    // aberta so tapava o botao de submeter.
    expect(suggestNotes(all, "buenissima")).toEqual([]);
    expect(suggestNotes(all, "  Buenissima  ")).toEqual([]);
  });

  it("mas continua a sugerir as outras que comecam igual", () => {
    const found = suggestNotes(all, "continente");
    expect(found.map((s) => s.note)).toEqual(["Continente Bom Dia"]);
  });

  it("nada a combinar da lista vazia", () => {
    expect(suggestNotes(all, "zzz")).toEqual([]);
  });

  it("nunca passa do tecto", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      note: `Loja ${i}`,
      uses: 1,
    }));

    expect(suggestNotes(many, "loja")).toHaveLength(SUGGESTION_LIMIT);
  });
});
