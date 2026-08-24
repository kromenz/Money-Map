export type YearNav = {
  /** Pastilhas a mostrar, por ordem crescente. */
  years: number[];
  active: number;
  prev: number | null;
  next: number | null;
  canGoPrev: boolean;
  canGoNext: boolean;
};

/**
 * O ano activo entra sempre na lista, mesmo sem dados: de outra forma escolher
 * um ano novo para importar fazia a propria pastilha activa desaparecer.
 */
export function yearNav(withData: number[], active: number): YearNav {
  const years = [...new Set([...withData, active])].sort((a, b) => a - b);
  const i = years.indexOf(active);

  const prev = i > 0 ? years[i - 1] : null;
  const next = i < years.length - 1 ? years[i + 1] : null;

  return {
    years,
    active,
    prev,
    next,
    canGoPrev: prev !== null,
    canGoNext: next !== null,
  };
}
