import { prisma } from "../../db/prisma";
import { loadT212Config } from "./t212.config";
import { createClient } from "./t212.client";
import { prismaRepo } from "./t212.repo";
import { syncAll, type SyncReport } from "./t212.sync";

export function pickUserId(
  users: { id: string; email: string }[],
  configuredEmail: string | null
): { userId: string | null; reason: string } {
  if (users.length === 0) {
    return { userId: null, reason: "Nao ha utilizadores para sincronizar" };
  }

  if (configuredEmail) {
    const wanted = configuredEmail.toLowerCase();
    const match = users.find((u) => u.email.toLowerCase() === wanted);
    return match
      ? { userId: match.id, reason: "Utilizador escolhido por T212_USER_EMAIL" }
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

export async function runSyncNow(userId: string): Promise<SyncReport> {
  const cfg = loadT212Config();
  return syncAll(userId, {
    client: createClient(cfg),
    repo: prismaRepo,
    now: () => new Date(),
    cutoff: cfg.bridgeFrom,
  });
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

  let running = false;

  const tick = async () => {
    // Uma corrida que demore mais que o intervalo nao pode sobrepor-se a
    // seguinte: duplicaria pedidos e queimaria o limite por conta.
    if (running) return;
    running = true;

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
      console.error("[t212] sync falhou por inteiro", err);
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(tick, cfg.syncIntervalHours * 60 * 60 * 1000);
  // Sem unref, o intervalo mantinha o processo vivo e o lancador nunca fechava.
  timer.unref?.();

  return { stop: () => clearInterval(timer) };
}
