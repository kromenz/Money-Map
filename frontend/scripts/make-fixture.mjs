// Script de uma vez (por ano). Le o .xlsx real e escreve a fixture anonimizada.
//
//   node scripts/make-fixture.mjs "<pasta do orcamento>\2026.xlsx"
//   node scripts/make-fixture.mjs "<pasta do orcamento>\2025.xlsx" src/lib/__fixtures__/budget-2025.xlsx
//
// O segundo argumento (opcional) e o caminho de saida. Sem ele, deriva-se do
// ano no nome do ficheiro de origem (ex.: "2025.xlsx" -> "budget-2025.xlsx"),
// para o script nao ficar preso a um unico ano hardcoded.
//
// A anonimizacao e um factor de escala por seccao. Escalar todos os numeros de
// uma seccao pelo mesmo factor preserva exactamente todas as somas dessa seccao
// -- os subtotais continuam a bater sem este script precisar de perceber a
// estrutura da folha -- e destroi as proporcoes entre seccoes.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { unzipSync, zipSync } from "fflate";

const SHEET = "xl/worksheets/sheet1.xml";
const CHART_FILES = ["xl/charts/chart1.xml", "xl/charts/chart2.xml"];
const CORE = "docProps/core.xml";
const WORKBOOK = "xl/workbook.xml";

// Fixos e nao aleatorios, para a fixture ser reproduzivel.
const FACTORS = { Income: 0.6137, Savings: 1.2841, Expenses: 0.8329 };

// Data e nome fixos para os metadados escrubbed -- nao interessa qual, so que
// nao sejam os reais e que sejam sempre os mesmos entre geracoes.
const FIXTURE_IDENTITY = "MoneyMap fixture";
const FIXTURE_DATE = "2020-01-01T00:00:00Z";

// LABEL_COL do backend/src/modules/budget/budget.parser.ts (coluna 2 = B). Os
// cabecalhos de seccao que o parser le vivem nesta coluna.
const LABEL_COLUMN = "B";

const source = process.argv[2];
if (!source) {
  console.error(
    "uso: node scripts/make-fixture.mjs <caminho do .xlsx real> [caminho de saida]"
  );
  process.exit(1);
}

const yearMatch = path.basename(source).match(/(\d{4})/);
const OUT =
  process.argv[3] ??
  (yearMatch
    ? `src/lib/__fixtures__/budget-${yearMatch[1]}.xlsx`
    : (() => {
        console.error(
          "nao consegui derivar o ano do nome do ficheiro de origem -- indica o caminho de saida explicitamente"
        );
        process.exit(1);
      })());

const files = unzipSync(new Uint8Array(readFileSync(source)));
const decode = (name) => new TextDecoder().decode(files[name]);

const sheetXmlIn = decode(SHEET);

// Os rotulos das seccoes sao shared strings, por isso a fronteira encontra-se
// pelo indice da string e nao pelo texto na folha.
const shared = decode("xl/sharedStrings.xml");
const strings = [...shared.matchAll(/<si>(?:(?!<\/si>).)*<\/si>/gs)].map((m) =>
  [...m[0].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((t) => t[1]).join("")
);

const indexOfLabel = (label) => strings.findIndex((s) => s.trim() === label);
const SECTION_IDS = new Map(
  Object.keys(FACTORS).map((label) => [String(indexOfLabel(label)), label])
);
const END_ID = String(indexOfLabel("Monthly Totals"));

// Uma passagem por linhas. A seccao corrente muda quando a linha tem, na
// coluna B, uma celula de texto cujo indice e o de "Income"/"Savings"/
// "Expenses", e termina em "Monthly Totals" -- essa linha ainda pertence a
// seccao que fecha.
//
// A folha tem uma caixa de resumo ("Yearly Summary", linhas 4-6) que repete
// os mesmos rotulos "Income"/"Savings"/"Expenses" -- o Excel deduplica shared
// strings, por isso essas celulas tem o mesmo indice que os cabecalhos reais
// de seccao, mas vivem nas colunas F/G, nao B. Sem exigir a coluna B essas
// linhas de resumo eram lidas como abertura de seccao e saiam sem escala,
// deixando os totais reais em H4/H5/H6.
//
// Linhas fora de qualquer seccao (a caixa de resumo incluida) escalam-se pelo
// factor do Expenses. O parser nunca as le, mas o XML guarda o valor em cache
// dessas formulas, e esse valor real nao pode sobreviver sem escala num
// repositorio publico.
let factor = null;
const sheetXmlOut = sheetXmlIn.replace(/<row\b[^>]*>.*?<\/row>/gs, (row) => {
  const labelCells = [
    ...row.matchAll(/<c r="([A-Z]+)\d+"[^>]*t="s"[^>]*>\s*<v>(\d+)<\/v>\s*<\/c>/g),
  ];
  const labelIds = labelCells
    .filter((m) => m[1] === LABEL_COLUMN)
    .map((m) => m[2]);

  const opens = labelIds.find((id) => SECTION_IDS.has(id));
  if (opens) {
    factor = FACTORS[SECTION_IDS.get(opens)];
    return row;
  }

  const activeFactor = factor === null ? FACTORS.Expenses : factor;
  const closes = labelIds.includes(END_ID);
  const scaled = scaleRow(row, activeFactor);
  if (closes) factor = null;
  return scaled;
});

function scaleRow(row, k) {
  return row.replace(/<c\b[^>]*>.*?<\/c>|<c\b[^>]*\/>/gs, (cell) => {
    // Celulas de texto (t="s") sao rotulos. Nao se tocam.
    if (/\bt="s"/.test(cell)) return cell;

    let next = cell;

    // Formula puramente aritmetica (so digitos, . + - * / parenteses e espacos):
    // os literais sao valores reais e escalam-se. Uma formula com letras --
    // SUM(C21:C28) e afins -- deriva o valor de outras celulas, e escalar os
    // literais partiria as referencias.
    next = next.replace(/<f\b([^>]*)>([^<]*)<\/f>/, (m, attrs, body) => {
      if (!/^[\d.+\-*/() ]+$/.test(body)) return m;
      const scaledBody = body.replace(/\d+(?:\.\d+)?/g, (n) => String(Number(n) * k));
      return `<f${attrs}>${scaledBody}</f>`;
    });

    // O valor em cache escala-se sempre.
    next = next.replace(/<v>([^<]*)<\/v>/, (m, v) => {
      const n = Number(v);
      return Number.isFinite(n) ? `<v>${n * k}</v>` : m;
    });

    return next;
  });
}

// Extrai {ref -> valor} das celulas numericas de uma folha (t="s" excluido,
// sao rotulos). Usado quer para alimentar os graficos com os novos valores,
// quer para o auto-teste de fuga de dados reais.
function numericSheetCells(xml) {
  const cells = new Map();
  // O grupo de atributos tem de ser preguicoso: um "[^>]*" guloso engole o "/"
  // de uma celula auto-fechada ("<c r="C2" s="8"/>"), a alternativa "\/>"
  // deixa de bater, e o regex cai no ramo de conteudo interno -- roubando o
  // <v> da proxima celula real da linha e atribuindo-o a esta referencia.
  for (const m of xml.matchAll(
    /<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>((?:(?!<\/c>).)*)<\/c>)/gs
  )) {
    const [, ref, attrs, inner = ""] = m;
    if (/\bt="s"/.test(attrs)) continue;
    const v = inner.match(/<v>([^<]*)<\/v>/);
    if (!v) continue;
    const n = Number(v[1]);
    if (Number.isFinite(n)) cells.set(ref, n);
  }
  return cells;
}

// Extrai {"formula#idx" -> valor} dos c:numCache dos graficos.
function numericChartPoints(xml) {
  const points = new Map();
  for (const block of xml.matchAll(
    /<c:f>([^<]*)<\/c:f><c:numCache>((?:(?!<\/c:numCache>).)*)<\/c:numCache>/gs
  )) {
    const [, formula, cache] = block;
    for (const pt of cache.matchAll(/<c:pt idx="(\d+)"><c:v>([^<]*)<\/c:v><\/c:pt>/g)) {
      const [, idx, v] = pt;
      points.set(`${formula}#${idx}`, Number(v));
    }
  }
  return points;
}

function assertNoLeaks(before, after, label) {
  const leaks = [];
  for (const [key, origVal] of before) {
    if (origVal === 0) continue;
    if (after.get(key) === origVal) leaks.push(`${label} ${key} = ${origVal}`);
  }
  if (leaks.length > 0) {
    throw new Error(
      `make-fixture: valores reais sobreviveram sem escala:\n  ${leaks.join("\n  ")}`
    );
  }
}

assertNoLeaks(numericSheetCells(sheetXmlIn), numericSheetCells(sheetXmlOut), SHEET);

// Os graficos guardam a sua propria copia em cache (c:numCache) dos valores
// de H4:H6 -- independente da folha. Escalar a folha nao actualiza essa
// copia; sem isto os totais reais ficavam legiveis dentro do XML do grafico
// mesmo depois de a folha estar limpa.
function expandRange(fromRef, toRef) {
  const from = fromRef.match(/^([A-Z]+)(\d+)$/);
  const to = toRef.match(/^([A-Z]+)(\d+)$/);
  if (!from || !to || from[1] !== to[1]) {
    throw new Error(`make-fixture: intervalo de grafico nao suportado: ${fromRef}:${toRef}`);
  }
  const col = from[1];
  const refs = [];
  for (let r = Number(from[2]); r <= Number(to[2]); r += 1) refs.push(`${col}${r}`);
  return refs;
}

function scaleChartCache(chartXml, scaledCells) {
  return chartXml.replace(
    /<c:f>'Personal Budget'!\$([A-Z]+)\$(\d+)(?::\$([A-Z]+)\$(\d+))?<\/c:f><c:numCache>((?:(?!<\/c:numCache>).)*)<\/c:numCache>/gs,
    (whole, col1, row1, col2, row2, cache) => {
      const refs = col2
        ? expandRange(`${col1}${row1}`, `${col2}${row2}`)
        : [`${col1}${row1}`];

      let newCache = cache;
      refs.forEach((ref, idx) => {
        const value = scaledCells.get(ref);
        if (value === undefined) return;
        newCache = newCache.replace(
          new RegExp(`(<c:pt idx="${idx}"><c:v>)[^<]*(<\/c:v><\/c:pt>)`),
          `$1${value}$2`
        );
      });
      const rangeSuffix = col2 ? `:$${col2}$${row2}` : "";
      return `<c:f>'Personal Budget'!$${col1}$${row1}${rangeSuffix}</c:f><c:numCache>${newCache}</c:numCache>`;
    }
  );
}

const scaledCells = numericSheetCells(sheetXmlOut);
for (const chartFile of CHART_FILES) {
  if (!files[chartFile]) continue;
  const chartXmlIn = decode(chartFile);
  const chartXmlOut = scaleChartCache(chartXmlIn, scaledCells);
  assertNoLeaks(numericChartPoints(chartXmlIn), numericChartPoints(chartXmlOut), chartFile);
  files[chartFile] = new TextEncoder().encode(chartXmlOut);
}

// docProps/core.xml guarda a identidade real de quem criou/editou o ficheiro
// (dc:creator, cp:lastModifiedBy) e datas reais. Substitui-se por valores
// fixos, nao pelos reais.
function scrubCoreProps(xml) {
  return xml
    .replace(/<dc:creator>[^<]*<\/dc:creator>/, `<dc:creator>${FIXTURE_IDENTITY}</dc:creator>`)
    .replace(
      /<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/,
      `<cp:lastModifiedBy>${FIXTURE_IDENTITY}</cp:lastModifiedBy>`
    )
    .replace(/<cp:lastPrinted>[^<]*<\/cp:lastPrinted>/, `<cp:lastPrinted>${FIXTURE_DATE}</cp:lastPrinted>`)
    .replace(
      /(<dcterms:created[^>]*>)[^<]*(<\/dcterms:created>)/,
      `$1${FIXTURE_DATE}$2`
    )
    .replace(
      /(<dcterms:modified[^>]*>)[^<]*(<\/dcterms:modified>)/,
      `$1${FIXTURE_DATE}$2`
    );
}

if (files[CORE]) {
  files[CORE] = new TextEncoder().encode(scrubCoreProps(decode(CORE)));
}

// xl/workbook.xml guarda o caminho local de quem gerou o ficheiro
// (x15ac:absPath). O Excel reconstroi este elemento sozinho; o resto do
// ficheiro (calcPr incluido, usado pela Task 4) fica intacto.
function scrubWorkbook(xml) {
  return xml.replace(/<x15ac:absPath\b[^>]*\/>/, "");
}

if (files[WORKBOOK]) {
  files[WORKBOOK] = new TextEncoder().encode(scrubWorkbook(decode(WORKBOOK)));
}

files[SHEET] = new TextEncoder().encode(sheetXmlOut);

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, zipSync(files));
console.log(`fixture escrita em ${OUT}`);
