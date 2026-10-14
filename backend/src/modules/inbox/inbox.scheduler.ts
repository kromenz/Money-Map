import { loadInboxConfig } from "./inbox.config";
import { runInboxSync } from "./inbox.service";
import { resolveUserId } from "../t212/t212.scheduler";

/**
 * Um tick ao arrancar e outro a cada intervalo, enquanto o stack esta ligado.
 * Como no T212, nao ha cron: o stack so existe enquanto o lancador o tem
 * aberto. O utilizador e resolvido da mesma maneira (o unico, ou o do
 * T212_USER_EMAIL).
 */
export function startInboxScheduler(): { stop: () => void } {
  const cfg = loadInboxConfig();
  if (!cfg.configured) {
    console.log("[inbox] sem INBOX_URL/INBOX_DESKTOP_TOKEN/INBOX_KEY -- caixa do telemovel desligada");
    return { stop: () => undefined };
  }

  const tick = async () => {
    try {
      const { userId, reason } = await resolveUserId();
      if (!userId) {
        console.log(`[inbox] ${reason}`);
        return;
      }
      const result = await runInboxSync(userId);
      if (result.received > 0 || result.failures.length > 0) {
        console.log(`[inbox] recebidos=${result.received} falhas=${result.failures.length}`);
      }
    } catch (err) {
      console.warn("[inbox] tick falhou", err);
    }
  };

  void tick();
  const timer = setInterval(tick, cfg.intervalMinutes * 60 * 1000);
  // Sem unref, o intervalo mantinha o processo vivo e o lancador nunca fechava.
  timer.unref?.();
  return { stop: () => clearInterval(timer) };
}
