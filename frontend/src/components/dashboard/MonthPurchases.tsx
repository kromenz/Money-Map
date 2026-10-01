"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { formatEur, formatPercent } from "@/lib/format";
import { useHiddenValues } from "@/context/HiddenValuesContext";
import { fetchMonthParcels } from "@/services/parcels.service";
import { purchasesView, type PurchaseCategory } from "@/lib/purchases";
import { slotOfGroup } from "@/lib/group-slots";

/** Sem segmento na barra do mes nao ha cor a herdar; ver o slotOfGroup. */
const NO_SLOT = "var(--muted-foreground)";

/** A moldura e o titulo, iguais nos tres estados do cartao. */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
        What was bought
      </h3>
      {children}
    </div>
  );
}

function Tile({
  category,
  slot,
  selected,
  onSelect,
  onNudge,
}: {
  category: PurchaseCategory;
  slot: string;
  selected: boolean;
  onSelect: () => void;
  onNudge: (step: -1 | 1) => void;
}) {
  const hidden = useHiddenValues();

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : null;
        if (step === null) return;
        e.preventDefault();
        onNudge(step);
      }}
      // A largura fixa e o snap-start sao o que faz isto ler-se como um
      // carrossel e nao como uma lista que por acaso transborda: o card seguinte
      // fica meio a espreitar e diz que ha mais para o lado.
      className="flex w-[172px] shrink-0 snap-start cursor-pointer flex-col gap-2 rounded-md border p-3 text-left transition-colors hover:border-muted-foreground/40"
      style={
        selected
          ? { borderColor: slot, boxShadow: `0 0 0 1px ${slot}` }
          : undefined
      }>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
          {category.group === "" ? "no group" : category.group}
        </span>
        <span className="truncate text-sm font-medium">{category.name}</span>
      </span>

      <span className="text-lg font-medium tabular-nums">
        {/* Tapado, o total vira a quota do mes -- que e o que a barra por baixo
            ja desenha. E o mesmo negocio que o GroupComposition faz. */}
        {hidden ? formatPercent(category.share) : formatEur(category.total)}
      </span>

      <span className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>{category.items === 1 ? "1 item" : `${category.items} items`}</span>
        {!hidden && <span>{formatPercent(category.share)}</span>}
      </span>

      {/* Quota do mes, na mesma quantidade que a percentagem ao lado: uma barra
          medida por uma coisa e rotulada por outra e uma barra que mente. */}
      <span className="block h-[3px] overflow-hidden rounded-sm bg-muted">
        <span
          className="block h-full rounded-sm"
          style={{ width: `${category.share * 100}%`, background: slot }}
        />
      </span>
    </button>
  );
}

function Detail({ category, slot }: { category: PurchaseCategory; slot: string }) {
  const hidden = useHiddenValues();
  // Escala comum a todas as linhas, como no CategoryDeltas: barras com escalas
  // diferentes por linha sao comparaveis a olho e nao o sao de facto.
  const widest = Math.max(...category.parcels.map((p) => Math.abs(p.amount)), 0);

  return (
    <div className="mt-4 border-t pt-3">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span
            className="size-2 shrink-0 rounded-[3px]"
            style={{ background: slot }}
          />
          {category.label}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {category.items === 1 ? "1 item" : `${category.items} items`}{" "}
          · {formatEur(category.total, hidden)}
        </span>
      </div>

      <ul>
        {category.parcels.map((p) => (
          <li
            key={p.seq}
            className="grid grid-cols-[5rem_5.5rem_1fr] items-center gap-3 border-b py-1.5 text-sm last:border-0">
            <span className="text-right tabular-nums">
              {formatEur(p.amount, hidden)}
            </span>
            {/* A barra continua a dizer o tamanho relativo com os valores
                tapados -- e a unica leitura que sobrevive a mascara. */}
            <span className="block h-1 overflow-hidden rounded-sm bg-muted">
              <span
                className="block h-full rounded-sm"
                style={{
                  width: widest === 0 ? "0%" : `${(Math.abs(p.amount) / widest) * 100}%`,
                  background: slot,
                }}
              />
            </span>
            {/* O travessao nao e falta de dados: e uma parcela que a folha ja
                tinha antes de haver etiquetas, e continua a ser uma compra
                verdadeira com valor verdadeiro. */}
            <span
              className={`truncate ${p.note === null ? "text-muted-foreground" : ""}`}
              title={p.note ?? undefined}>
              {p.note ?? "—"}
              {/* A linha junta as compras com o mesmo nome; o valor ao lado e
                  a soma delas, nao o preco de cada uma. */}
              {p.count > 1 && (
                <span className="ml-1.5 text-muted-foreground tabular-nums">
                  ×{p.count}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * O que foi comprado no mes em foco: um carrossel de categorias, da maior para
 * a menor, com o detalhe da que esta em foco por baixo.
 *
 * As celulas da folha ja eram somas de compras (`=42.88+11.39`); o que faltava
 * era mostra-las desmontadas. As parcelas sem etiqueta -- tudo o que ja estava
 * escrito antes de as etiquetas existirem -- aparecem na mesma, porque dizem
 * quantas compras houve e de que valor mesmo sem dizer o que foram.
 *
 * A cor de cada card e a do grupo na barra do "Where it went" logo acima: na
 * mesma pagina, a mesma cor tem de querer dizer a mesma coisa. Quem nao tem la
 * segmento fica em cinzento.
 */
export function MonthPurchases({
  year,
  month,
  monthLabel,
  byGroup,
}: {
  year: number;
  /** 1 = Janeiro. */
  month: number;
  monthLabel: string;
  /** O mesmo que alimenta o GroupComposition, so para herdar as cores. */
  byGroup: { group: string; amount: number }[];
}) {
  const hidden = useHiddenValues();
  const railRef = useRef<HTMLDivElement>(null);
  // Guardado por id e nao por indice: trocar de mes muda o comprimento da lista,
  // e um indice preso apontava para outra categoria qualquer.
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ["budget-parcels", year, month],
    queryFn: () => fetchMonthParcels(year, month),
  });

  if (isPending) {
    return (
      <Card>
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      </Card>
    );
  }

  // Um erro aqui nao pode derrubar o painel do mes: isto e detalhe por cima do
  // que a grelha ja diz, e a grelha continua correcta sem ele.
  if (isError || !data || data.categories.length === 0) {
    return (
      <Card>
        <p className="mt-3 text-sm text-muted-foreground">
          {isError
            ? "The itemised list could not be loaded."
            : `Nothing itemised for ${monthLabel} yet. Amounts added from now on carry a name; older cells only show a breakdown when the sheet stores them as a sum.`}
        </p>
      </Card>
    );
  }

  const view = purchasesView(data);
  const activeIndex = Math.max(
    0,
    view.categories.findIndex((c) => c.categoryId === activeId)
  );
  const active = view.categories[activeIndex];
  const slotOf = (c: PurchaseCategory) => slotOfGroup(byGroup, c.group) ?? NO_SLOT;

  // O foco anda com a seta e leva a seleccao atras: um carrossel em que o
  // teclado so move o foco obriga a carregar em Enter em cada paragem.
  const nudge = (step: -1 | 1) => {
    const next = activeIndex + step;
    if (next < 0 || next >= view.categories.length) return;
    setActiveId(view.categories[next].categoryId);
    const rail = railRef.current;
    (rail?.children[next] as HTMLElement | undefined)?.focus();
  };

  const scrollBy = (step: -1 | 1) =>
    railRef.current?.scrollBy({ left: step * 364, behavior: "smooth" });

  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {view.categories.length === 1
            ? "1 category"
            : `${view.categories.length} categories`}{" "}
          · {formatEur(view.total, hidden)}
        </span>
      </div>

      <div className="group/rail relative">
        <div
          ref={railRef}
          role="tablist"
          aria-label={`Categories bought in ${monthLabel}`}
          className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto p-px">
          {view.categories.map((c) => (
            <Tile
              key={c.categoryId}
              category={c}
              slot={slotOf(c)}
              selected={c.categoryId === active.categoryId}
              onSelect={() => setActiveId(c.categoryId)}
              onNudge={nudge}
            />
          ))}
        </div>

        {/* Só no hover: a existencia de mais cards ja e evidente pelo card
            cortado na margem, e duas pastilhas sempre acesas roubavam a atencao
            ao que interessa. O teclado nao depende delas. */}
        <button
          type="button"
          aria-label="Previous categories"
          tabIndex={-1}
          onClick={() => scrollBy(-1)}
          className="absolute -left-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full border bg-background text-muted-foreground opacity-0 transition-opacity group-hover/rail:opacity-100">
          <ChevronLeftIcon className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="More categories"
          tabIndex={-1}
          onClick={() => scrollBy(1)}
          className="absolute -right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full border bg-background text-muted-foreground opacity-0 transition-opacity group-hover/rail:opacity-100">
          <ChevronRightIcon className="size-3.5" />
        </button>
      </div>

      <Detail category={active} slot={slotOf(active)} />
    </Card>
  );
}
