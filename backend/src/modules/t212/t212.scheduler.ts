import { prisma } from "../../db/prisma";
import { loadT212Config } from "./t212.config";
import { createClient } from "./t212.client";
import { prismaRepo } from "./t212.repo";
import { syncAll, type SyncDeps, type SyncReport } from "./t212.sync";

export function pickUserId(
  users: { id: string; email: string }[],
  configuredEmail: string | null
): { userId: string | null; reason: string } {
  if (users.length === 0) {
    return { userId: null, reason: "Nao ha utilizadores para sincronizar" };
  }

  if (configuredEmail) {
    const wanted = configuredEmail.toLowerCase();
    const matches = users.filter((u) => u.email.toLowerCase() === wanted);

    if (matches.length > 1) {
      // O registo nao normaliza a caixa do email, portanto duas contas podem
      // colidir so em minusculas. Escolher a primeira seria a mesma aposta
      // silenciosa que a ambiguidade sem T212_USER_EMAIL ja recusa.
      return {
        userId: null,
        reason: `Ha varias contas com o email ${configuredEmail} a diferir so na caixa -- sincronizacao suspensa`,
      };
    }

    return matches.length === 1
      ? { userId: matches[0].id, reason: "Utilizador escolhido por T212_USER_EMAIL" }
      : {
          userId: null,
          reason: `T212_USER_EMAIL aponta para ${configuredEmail}, que nao existe`,
        };
  }

  if (users.length === 1) {
    return { userId: users[0].id, reason: "Unico utilizador" };
  }

  return {
    userId: null,
    reason:
      "Ha mais que um utilizador e T212_USER_EMAIL nao esta definido -- sincronizacao suspensa",
  };
}

export async function resolveUserId(): Promise<{
  userId: string | null;
  reason: string;
}> {
  const cfg = loadT212Config();
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  return pickUserId(users, cfg.userEmail);
}

/**
 * A bandeira e do modulo, nao do agendador.
 *
 * Enquanto viveu dentro do startT212Scheduler, fechava o tick contra si proprio
 * e mais nada: o botao "Sincronizar agora" chama o runSyncNow directamente e
 * passava-lhe ao lado. Duas corridas em paralelo constroem dois clientes, cada
 * um com o seu governo de limites, que se ignoram -- e o limite da T212 e por
 * conta, nao por cliente. Correr as etapas em serie foi decisao explicita da
 * spec; ter duas corridas ao mesmo tempo desfazia-a por fora.
 */
let syncing = false;

/** Nao e uma falha da sincronizacao: e a outra corrida a dizer que ja vai. */
export class SyncInProgressError extends Error {
  constructor() {
    super("Ja esta uma sincronizacao a decorrer");
    this.name = "SyncInProgressError";
  }
}

export function isSyncing(): boolean {
  return syncing;
}

export async function runSyncNow(
  userId: string,
  // Existe para o teste poder correr o guarda sem rede. O controlador e o tick
  // nunca passam nada -- as dependencias reais sao as de baixo.
  overrides: Partial<SyncDeps> = {}
): Promise<SyncReport> {
  // A verificacao e a marca ficam no mesmo turno sincrono, antes do primeiro
  // await: e o que garante que duas chamadas no mesmo tick do event loop nao
  // passam ambas.
  if (syncing) throw new SyncInProgressError();
  syncing = true;

  try {
    const cfg = loadT212Config();
    return await syncAll(userId, {
      client: createClient(cfg),
      repo: prismaRepo,
      now: () => new Date(),
      cutoff: cfg.bridgeFrom,
      ...overrides,
    });
  } finally {
    syncing = false;
  }
}

/**
 * Corre ao arranque e no intervalo configurado. Nao ha cron ao fecho do mercado
 * de proposito: o stack e arrancado e fechado pelo lancador, portanto um cron
 * assumiria um servico permanente que nao existe. Os dias em que a app nao
 * correu ficam sem snapshot, e o grafico mostra a lacuna.
 */
export function startT212Scheduler(): { stop: () => void } {
  const cfg = loadT212Config();

  if (!cfg.configured) {
    console.log("[t212] sem T212_API_KEY -- sincronizacao desligada");
    return { stop: () => undefined };
  }

  const tick = async () => {
    // Uma corrida que demore mais que o intervalo nao pode sobrepor-se a
    // seguinte: duplicaria pedidos e queimaria o limite por conta. Sair aqui
    // poupa a consulta ao utilizador; quem garante mesmo a exclusao e o
    // runSyncNow, que fecha a janela entre esta leitura e a chamada.
    if (isSyncing()) return;

    try {
      const { userId, reason } = await resolveUserId();
      if (!userId) {
        console.log(`[t212] ${reason}`);
        return;
      }

      const report = await runSyncNow(userId);
      const falhadas = report.stages.filter((s) => !s.ok);
      console.log(
        `[t212] sync: ${report.stages.map((s) => `${s.kind}=${s.written}`).join(" ")}` +
          (falhadas.length ? ` | erros: ${falhadas.map((s) => s.kind).join(", ")}` : "")
      );
    } catch (err) {
      // O botao "Sincronizar agora" pode ter entrado entre a leitura de cima e
      // a chamada. Nao e uma falha da sincronizacao -- a outra corrida esta a
      // fazer o trabalho.
      if (err instanceof SyncInProgressError) {
        console.log("[t212] tick saltado: ja havia uma sincronizacao a decorrer");
        return;
      }
      console.error("[t212] sync falhou por inteiro", err);
    }
  };

  void tick();
  const timer = setInterval(tick, cfg.syncIntervalHours * 60 * 60 * 1000);
  // Sem unref, o intervalo mantinha o processo vivo e o lancador nunca fechava.
  timer.unref?.();

  return { stop: () => clearInterval(timer) };
}
