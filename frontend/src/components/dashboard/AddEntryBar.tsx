"use client";

import { useState } from "react";
import { CalendarIcon, PencilIcon, PlusIcon, TagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MONTH_LABELS } from "@/lib/format";
import { groupCategories } from "@/lib/category-groups";
import {
  addLabel,
  defaultSection,
  sectionsPresent,
  SECTION_LABELS,
  type Section,
} from "@/lib/entry-sections";
import { addExpense } from "@/services/expense.service";
import type { GridRow } from "@/types/budget";

/**
 * Registar um lancamento sem abrir o Excel.
 *
 * As categorias saem da grelha que ja esta carregada -- nenhum pedido novo. As
 * tres seccoes da folha servem-se aqui: a fila de botoes escolhe qual, e tudo
 * o que esta a jusante -- a rota, o localizador da celula, a fila de pendentes
 * -- ja era agnostico a seccao desde o inicio.
 *
 * Os dois campos de escolha sao o <Select> da casa e nao <select> nativos. O
 * nativo deixa a lista ao sistema operativo, que a desenha com as cores dele --
 * no tema escuro abria um painel branco no meio de uma pagina escura. O da casa
 * usa os tokens --popover e acompanha o tema.
 */
export function AddEntryBar({
  year,
  rows,
  onWritten,
  onPending,
}: {
  year: number;
  rows: GridRow[];
  onWritten: () => void;
  onPending: (count: number) => void;
}) {
  // null e nao "": e assim que o <Select.Value> sabe que ainda nao ha escolha e
  // mostra o placeholder em vez de uma linha vazia.
  const [categoryId, setCategoryId] = useState<string | null>(null);
  // A seccao ESCOLHIDA, que nao e a mesma coisa que a seccao em vigor la em
  // baixo. Comeca nula porque as linhas so chegam depois da primeira pintura.
  const [chosenSection, setChosenSection] = useState<Section | null>(null);
  const [amount, setAmount] = useState("");
  // O que foi comprado -- ou de onde veio o dinheiro. Vai para dentro da
  // formula da celula como N("..."), e e o que a lista do mes mostra depois --
  // sem ele a parcela fica anonima.
  const [note, setNote] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const present = sectionsPresent(rows);
  // A escolha so vale enquanto a folha em vista tiver essa seccao. Trocar para
  // um ano cuja folha nao tem Savings deixava a barra presa numa lista vazia,
  // sem nada a dizer porque. Cair no defaultSection resolve-o sem por um efeito
  // a correr atras das linhas.
  const section =
    chosenSection !== null && present.includes(chosenSection)
      ? chosenSection
      : defaultSection(rows);

  const categories = section === null ? [] : rows.filter((r) => r.section === section);

  if (section === null || categories.length === 0) return null;

  // O `items` do Select serve so para o botao saber que texto mostrar depois de
  // escolhido -- sem isto o gatilho imprimia o categoryId cru.
  const categoryItems = categories.map((c) => ({
    value: c.categoryId,
    label: c.group === "" ? c.name : `${c.group} · ${c.name}`,
  }));

  // Agrupadas para a lista, pela ordem da primeira aparicao de cada grupo. Uma
  // lista plana de trinta e tal linhas com o grupo repetido em cada uma
  // ("Transportation · Fuel", "Transportation · Auto Insurance", ...) e comprida
  // de mais para ler e desperdica a largura toda a repetir a mesma palavra. Com
  // o grupo em cabecalho, cada linha fica so com o nome.
  const grouped = groupCategories(categories);
  const monthItems = MONTH_LABELS.map((label, i) => ({ value: i + 1, label }));

  const normalizedAmount = amount.replace(",", ".");
  const value = Number(normalizedAmount);
  // Mais de duas casas decimais: a rota arredonda antes de escrever, mas
  // arredondar em silencio aqui deixava o utilizador sem saber que o valor
  // digitado nao e o que vai ficar na folha. Recusa-se em vez de arredondar.
  const tooManyDecimals = /\.\d{3,}/.test(normalizedAmount);
  const ready = categoryId !== null && value > 0 && !tooManyDecimals && !busy;

  // Mudar de seccao larga a categoria escolhida. Sem isto ficava um id da
  // seccao anterior em vigor: o `categories.find` la em baixo devolvia
  // undefined e o submit saia em silencio -- um clique que nao faz nada nem
  // diz porque.
  function pickSection(next: Section) {
    if (next === section) return;
    setChosenSection(next);
    setCategoryId(null);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const category = categories.find((c) => c.categoryId === categoryId);
    if (!category || !(value > 0) || tooManyDecimals) return;

    setBusy(true);
    setError(null);
    try {
      const result = await addExpense({
        year,
        month,
        // Da linha e nao do estado: e a seccao da categoria que de facto foi
        // escolhida, portanto nao ha maneira de as duas discordarem.
        section: category.section,
        group: category.group,
        name: category.name,
        amount: value,
        note: note.trim() === "" ? undefined : note.trim(),
      });

      if (result.status === "written") {
        setAmount("");
        setNote("");
        onWritten();
      } else if (result.status === "pending") {
        setAmount("");
        setNote("");
        onPending(result.count);
      } else {
        setError(result.reason);
      }
    } catch {
      setError("the entry could not be saved");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-start gap-3 rounded-xl border bg-card p-3 shadow-sm">
      {/* Uma folha so com despesas nao ganha nada com um filtro de um botao so
          -- nesse caso a barra fica exactamente como sempre esteve. */}
      {present.length > 1 && (
        <div
          role="group"
          aria-label="Section"
          // 40px de altura, os mesmos dos campos ao lado: 36 do botao (h-9),
          // 2 do padding e 2 da borda. Com p-0.5 dava 42 -- a borda conta.
          className="flex items-center gap-0.5 rounded-md border bg-background p-px">
          {present.map((s) => (
            <Button
              key={s}
              // Sem isto o botao herda o type="submit" do <form> e escolher a
              // seccao submetia o formulario.
              type="button"
              variant={s === section ? "default" : "ghost"}
              size="sm"
              aria-pressed={s === section}
              onClick={() => pickSection(s)}
              className="h-9">
              {SECTION_LABELS[s]}
            </Button>
          ))}
        </div>
      )}

      <Select
        items={categoryItems}
        value={categoryId}
        onValueChange={(v) => setCategoryId(v)}>
        {/* data-[size=default]:h-10 e nao h-10: a altura do gatilho vem de uma
            regra com data-attribute, que ganha a uma classe simples. Um h-10 a
            seco era ignorado e o campo ficava 8px mais baixo do que o valor e o
            botao ao lado. */}
        <SelectTrigger
          aria-label="Category"
          className="min-w-56 px-3 data-[size=default]:h-10">
          <TagIcon className="text-muted-foreground" />
          <SelectValue placeholder="Category…" />
        </SelectTrigger>
        {/*
          alignItemWithTrigger a false: por omissao o painel sobrepoe-se ao
          gatilho a alinhar a opcao escolhida por cima dele, o que com trinta e
          tal categorias o punha a tapar metade da pagina. Assim cai por baixo,
          como um menu normal.

          A largura deixa de ser a do gatilho (w-(--anchor-width) no
          ui/select.tsx) e passa a acompanhar o conteudo ate um tecto, porque os
          nomes desta folha sao longos ("Utilities (electric, gas, water,
          etc.)") e estavam a ser cortados a direito, sem sequer reticencias.
        */}
        <SelectContent
          alignItemWithTrigger={false}
          align="start"
          className="max-h-[22rem] w-auto min-w-(--anchor-width) max-w-[min(30rem,92vw)]">
          {grouped.map((g, i) => (
            <SelectGroup key={g.group || "__sem-grupo"}>
              {i > 0 && <SelectSeparator />}
              {g.group !== "" && <SelectLabel>{g.group}</SelectLabel>}
              {g.items.map((c) => (
                <SelectItem key={c.value} value={c.value} className="py-1.5">
                  <span className="truncate">{c.label}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      <div className="flex flex-col gap-1">
        <div className="relative">
          {/* O simbolo dentro do campo e nao ao lado: o valor e o unico numero
              da barra e sem ele lia-se como uma quantidade qualquer. */}
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
            €
          </span>
          <Input
            aria-label="Amount"
            inputMode="decimal"
            placeholder="12,50"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-10 w-32 pl-7 tabular-nums"
          />
        </div>
        {tooManyDecimals && (
          <p className="text-xs text-destructive">Use at most two decimal places</p>
        )}
      </div>

      <div className="relative">
        <PencilIcon className="pointer-events-none absolute inset-y-0 left-3 my-auto size-3.5 text-muted-foreground" />
        <Input
          aria-label="What was it"
          placeholder="What was it? (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          // 60 e o mesmo limite que a rota impoe. Cortar aqui tambem evita
          // que o utilizador escreva 200 caracteres e so depois descubra que
          // a folha guardou 60.
          maxLength={60}
          className="h-10 w-56 pl-9"
        />
      </div>

      <Select
        items={monthItems}
        value={month}
        onValueChange={(v) => {
          if (v !== null) setMonth(v);
        }}>
        <SelectTrigger
          aria-label="Month"
          className="min-w-28 px-3 data-[size=default]:h-10">
          <CalendarIcon className="text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {monthItems.map((m) => (
            <SelectItem key={m.value} value={m.value} className="py-1.5">
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="submit" size="lg" disabled={!ready} className="h-10 px-4">
        <PlusIcon />
        {busy ? "Adding…" : addLabel(section)}
      </Button>

      {error && (
        <p role="alert" className="self-center text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
