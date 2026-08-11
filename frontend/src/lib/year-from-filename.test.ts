import { describe, it, expect } from "vitest";
import { yearFromFileName } from "./year-from-filename";

describe("yearFromFileName", () => {
  it("le o ano de um nome que e so o ano", () => {
    expect(yearFromFileName("2026.xlsx")).toBe(2026);
  });

  it("ignora o sufixo que o browser poe nas copias", () => {
    // Em 2026 (1).xlsx o 1 nao tem quatro digitos, por isso nao concorre.
    expect(yearFromFileName("2026 (1).xlsx")).toBe(2026);
  });

  it("encontra o ano no meio do nome", () => {
    expect(yearFromFileName("budget-2026-final.xlsx")).toBe(2026);
  });

  it("nao le um ano abaixo da gama", () => {
    expect(yearFromFileName("1999.xlsx")).toBeNull();
  });

  it("nao le um ano acima da gama", () => {
    expect(yearFromFileName("2101.xlsx")).toBeNull();
  });

  it("nao parte uma corrida de cinco digitos", () => {
    // 12026 nao pode dar 2026: o ano tem de ser a corrida toda.
    expect(yearFromFileName("12026.xlsx")).toBeNull();
  });

  it("devolve null quando o nome nao diz nada", () => {
    expect(yearFromFileName("download.xlsx")).toBeNull();
  });

  it("com dois anos validos ganha o primeiro", () => {
    // Regra arbitraria, mas fixada aqui para nao ser acidente da implementacao.
    expect(yearFromFileName("2026-2027.xlsx")).toBe(2026);
  });

  it("salta o candidato fora de gama e fica com o seguinte", () => {
    // Um candidato invalido nao interrompe a busca.
    expect(yearFromFileName("1999-2026.xlsx")).toBe(2026);
  });
});
