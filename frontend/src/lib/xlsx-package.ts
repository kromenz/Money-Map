import { unzipSync, zipSync } from "fflate";
import { locateCells } from "./sheet-locate";
import { applyEdits, type Edit } from "./sheet-write";
import type { NewExpense } from "@/types/expense";

const SHEET = "xl/worksheets/sheet1.xml";
const WORKBOOK = "xl/workbook.xml";
const CALC_CHAIN = "xl/calcChain.xml";
const CONTENT_TYPES = "[Content_Types].xml";
const WORKBOOK_RELS = "xl/_rels/workbook.xml.rels";

const decode = (b: Uint8Array) => new TextDecoder().decode(b);
const encode = (s: string) => new TextEncoder().encode(s);

/**
 * O workbook.xml nao tem exactamente uma folha.
 *
 * SHEET aponta sempre para xl/worksheets/sheet1.xml, e locateCells resolve a
 * celula por wb.worksheets[0] -- a ordem dos separadores, via relacoes. Os
 * dois coincidem hoje porque a folha so tem um separador, mas nada o garante:
 * se um separador novo for acrescentado e ordenar primeiro, locateCells
 * encontraria a celula numa folha e applyExpenses escrevia noutra parte do
 * zip. A rede do import (verificacao de totais, 422 se nao baterem) apanhava
 * isto sempre, mas so depois de gravar no disco. Falhar aqui, antes de tocar
 * em nada, e mais cedo e mais claro.
 */
export class MultiSheetError extends Error {}

function assertSingleWorksheet(workbookXml: string): void {
  const count = (workbookXml.match(/<sheet\b/g) ?? []).length;
  if (count !== 1) {
    throw new MultiSheetError(
      `O workbook tem ${count} folhas, esperava-se exactamente 1`
    );
  }
}

/**
 * O Excel recalcula tudo ao abrir.
 *
 * Depois de mexer numa celula, todos os valores em cache que dependem dela --
 * a coluna O dos totais anuais, o Potential to Save, as series dos graficos --
 * ficam desactualizados. Isto faz o Excel recalcula-los, portanto o utilizador
 * nunca ve um numero velho. Nao afecta o import: o parser so le as colunas C..N,
 * que esta reescrita ja deixa correctas.
 */
function withFullCalc(workbookXml: string): string {
  if (/<calcPr[^>]*fullCalcOnLoad="1"/.test(workbookXml)) return workbookXml;
  if (/<calcPr\b/.test(workbookXml)) {
    return workbookXml.replace(/<calcPr\b([^>]*?)\s*\/>/, '<calcPr$1 fullCalcOnLoad="1"/>');
  }
  return workbookXml.replace("</workbook>", '<calcPr fullCalcOnLoad="1"/></workbook>');
}

/**
 * O calcChain descreve a ordem de calculo celula a celula. Deixa-lo
 * desactualizado depois de mexer numa formula e a causa classica do aviso de
 * ficheiro corrompido. O Excel reconstroi-o sozinho.
 */
function dropCalcChain(types: string): string {
  return types.replace(/<Override[^>]*calcChain[^>]*\/>/g, "");
}

/**
 * O workbook.xml.rels tem uma Relationship a apontar para o calcChain.xml que
 * acabamos de apagar. Deixa-la la e uma referencia pendente -- viola o OPC e e
 * o gatilho classico do aviso "encontramos um problema com algum conteudo" do
 * Excel ao abrir. O match e pelo Type, nao pelo Id: o Id (ex.: rId6) e
 * incidental a este workbook e pode ser outro noutro ficheiro. Sem
 * calcChain.xml no zip nao ha nenhuma Relationship a apagar, e a funcao nao
 * mexe em mais nada -- os outros ids nao precisam de ser contiguos.
 */
function dropCalcChainRel(rels: string): string {
  return rels.replace(/<Relationship[^>]*Type="[^"]*\/calcChain"[^>]*\/>/g, "");
}

/**
 * Escreve os gastos na folha e devolve os bytes do .xlsx novo.
 *
 * Todas as partes do zip que nao sejam a folha, o workbook, o calcChain, o
 * Content_Types e o workbook.xml.rels saem exactamente como entraram -- em
 * particular os dois graficos, que uma regravacao com ExcelJS destruiria.
 */
export async function applyExpenses(
  file: Uint8Array,
  expenses: NewExpense[]
): Promise<Uint8Array> {
  const files = unzipSync(file);
  if (!files[SHEET]) throw new Error("O .xlsx nao tem xl/worksheets/sheet1.xml");
  if (!files[WORKBOOK]) throw new Error("O .xlsx nao tem xl/workbook.xml");
  assertSingleWorksheet(decode(files[WORKBOOK]));

  const edits: Edit[] = [];
  for (const expense of expenses) {
    // Localiza-se sempre sobre o ficheiro original: as linhas nao se movem, e
    // so mudam valores.
    const found = await locateCells(file, expense);
    // A etiqueta so na celula da categoria: os subtotais escrevem-se em modo
    // valor, que nao tem formula onde a por, e repeti-la la seria ruido.
    edits.push({
      ref: found.cell,
      delta: expense.amount,
      mode: "formula",
      note: expense.note,
    });
    if (found.groupSubtotal) {
      edits.push({ ref: found.groupSubtotal, delta: expense.amount, mode: "value" });
    }
    if (found.sectionTotal) {
      edits.push({ ref: found.sectionTotal, delta: expense.amount, mode: "value" });
    }
  }

  files[SHEET] = encode(applyEdits(decode(files[SHEET]), edits));

  if (files[WORKBOOK]) files[WORKBOOK] = encode(withFullCalc(decode(files[WORKBOOK])));
  if (files[CONTENT_TYPES]) {
    files[CONTENT_TYPES] = encode(dropCalcChain(decode(files[CONTENT_TYPES])));
  }
  if (files[WORKBOOK_RELS]) {
    files[WORKBOOK_RELS] = encode(dropCalcChainRel(decode(files[WORKBOOK_RELS])));
  }
  delete files[CALC_CHAIN];

  return zipSync(files);
}
