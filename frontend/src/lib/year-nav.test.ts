import { describe, it, expect } from "vitest";
import { yearNav } from "./year-nav";

describe("yearNav", () => {
  it("mostra os anos com dados por ordem crescente", () => {
    const nav = yearNav([2026, 2024, 2025], 2025);
    expect(nav.years).toEqual([2024, 2025, 2026]);
    expect(nav.active).toBe(2025);
  });

  it("inclui o ano activo mesmo que ele ainda nao tenha dados", () => {
    // Sem isto, escolher um ano novo para importar fazia a pastilha activa
    // desaparecer enquanto o import nao acabasse.
    const nav = yearNav([2024, 2025], 2026);
    expect(nav.years).toEqual([2024, 2025, 2026]);
  });

  it("nao duplica o ano activo quando ele ja tem dados", () => {
    expect(yearNav([2025, 2026], 2026).years).toEqual([2025, 2026]);
  });

  it("aponta as setas para os anos vizinhos que existem", () => {
    const nav = yearNav([2023, 2025, 2026], 2025);
    expect(nav.prev).toBe(2023);
    expect(nav.next).toBe(2026);
    expect(nav.canGoPrev).toBe(true);
    expect(nav.canGoNext).toBe(true);
  });

  it("desactiva as setas nos extremos", () => {
    const nav = yearNav([2025, 2026], 2026);
    expect(nav.canGoNext).toBe(false);
    expect(nav.next).toBeNull();
    expect(nav.canGoPrev).toBe(true);
    expect(nav.prev).toBe(2025);
  });

  it("um unico ano nao tem para onde ir", () => {
    const nav = yearNav([], 2026);
    expect(nav.years).toEqual([2026]);
    expect(nav.canGoPrev).toBe(false);
    expect(nav.canGoNext).toBe(false);
  });
});
