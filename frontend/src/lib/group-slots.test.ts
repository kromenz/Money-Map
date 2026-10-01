import { describe, it, expect } from "vitest";
import { SLOTS, slotOfGroup } from "./group-slots";

const byGroup = [
  { group: "Home", amount: 400 },
  { group: "Leisure", amount: 300 },
  { group: "", amount: 200 },
  { group: "Other", amount: 100 },
];

describe("slotOfGroup", () => {
  it("da a cada grupo a cor da sua posicao na barra", () => {
    // E a mesma indexacao que o GroupComposition usa para desenhar os
    // segmentos: e dai que vem a promessa de um grupo ter a mesma cor nos dois
    // sitios da mesma pagina.
    expect(slotOfGroup(byGroup, "Home")).toBe(SLOTS[0]);
    expect(slotOfGroup(byGroup, "Leisure")).toBe(SLOTS[1]);
  });

  it("o grupo vazio tambem tem lugar na barra", () => {
    // Categorias sem grupo nao sao um caso de excepcao: sao uma fatia como as
    // outras, e o GroupComposition ja lhes desenha um segmento.
    expect(slotOfGroup(byGroup, "")).toBe(SLOTS[2]);
  });

  it("um grupo que nao esta na barra nao tem cor", () => {
    // Cai no "Other" agregado, e pintar-lhe a cor do agregado dizia que era o
    // agregado. Sem cor e mais honesto do que com a cor errada.
    expect(slotOfGroup(byGroup, "Health")).toBeNull();
  });

  it("nao inventa cor para alem das que a rampa tem", () => {
    const wide = Array.from({ length: SLOTS.length + 2 }, (_, i) => ({
      group: `g${i}`,
      amount: 1,
    }));

    expect(slotOfGroup(wide, `g${SLOTS.length}`)).toBeNull();
  });
});
