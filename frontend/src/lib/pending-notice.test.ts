import { describe, it, expect } from "vitest";
import { pendingNoticeView } from "./pending-notice";

const view = (over: Partial<Parameters<typeof pendingNoticeView>[0]>) =>
  pendingNoticeView({ count: 0, rejected: 0, busy: false, discarding: false, ...over });

describe("pendingNoticeView", () => {
  it("sem nada na fila nao se mostra", () => {
    expect(view({}).visible).toBe(false);
  });

  it("as rejeitadas nao contam como a espera do Excel", () => {
    const v = view({ count: 3, rejected: 1 });
    expect(v.visible).toBe(true);
    expect(v.waiting).toBe(2);
  });

  it("so com rejeitadas continua a haver forma de tentar outra vez", () => {
    // O texto diz "acrescenta a linha e entra na proxima aplicacao". Sem o
    // botao, depois de corrigir a folha nada no ecra disparava essa aplicacao.
    const v = view({ count: 1, rejected: 1 });
    expect(v.waiting).toBe(0);
    expect(v.showApply).toBe(true);
  });

  it("rejeitadas sem contagem ainda se mostram", () => {
    // A contagem pode chegar desactualizada (vem tambem do AddEntryBar).
    const v = view({ count: 0, rejected: 2 });
    expect(v.visible).toBe(true);
    expect(v.waiting).toBe(0);
    expect(v.showApply).toBe(true);
  });

  it("nao se descarta enquanto a fila esta a ser aplicada", () => {
    // O flush pode ja ter a entrada no lote pronto: descarta-la a meio deixava
    // na folha um gasto que o utilizador mandou tirar.
    expect(view({ count: 1, rejected: 1, busy: true }).canDiscard).toBe(false);
  });

  it("nao se descarta outra enquanto uma esta a ser descartada", () => {
    expect(view({ count: 2, rejected: 2, discarding: true }).canDiscard).toBe(false);
  });

  it("parado, pode descartar-se", () => {
    expect(view({ count: 1, rejected: 1 }).canDiscard).toBe(true);
  });
});
