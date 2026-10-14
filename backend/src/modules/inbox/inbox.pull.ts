import { open } from "./inbox.crypto";
import { inboxEntrySchema, toPendingInput, type PendingInput } from "./inbox.entry";

export type InboxItem = { id: string; blob: string };
export type PullFailure = { id: string; reason: string };
export type PullReport = { received: number; failures: PullFailure[] };

export type PullDeps = {
  list: () => Promise<InboxItem[]>;
  remove: (id: string) => Promise<void>;
  key: CryptoKey;
  alreadyReceived: (sourceId: string) => Promise<boolean>;
  receive: (sourceId: string, input: PendingInput) => Promise<void>;
};

/**
 * Traz da caixa para a fila tudo o que la estiver.
 *
 * A ordem por entrada e: recibo e pendente na base, so depois DELETE na
 * cloud. Ao contrario, uma falha entre os dois perdia o gasto. Assim, uma
 * falha entre os dois so deixa lixo na cloud, e o recibo trata dele no pull
 * seguinte.
 *
 * O que nao decifra ou nao valida fica na cloud. Apagar por uma falha nossa
 * (a chave trocada no .env, um schema mais apertado) perdia um gasto que o
 * utilizador registou e julga guardado.
 *
 * Uma falha da base sobe: parar a meio e seguro, porque nada do que falta foi
 * apagado.
 */
export async function pullInbox(deps: PullDeps): Promise<PullReport> {
  const items = await deps.list();
  let received = 0;
  const failures: PullFailure[] = [];

  for (const item of items) {
    let value: unknown;
    try {
      value = await open(deps.key, item.blob, item.id);
    } catch {
      failures.push({
        id: item.id,
        reason: "could not decrypt it — the phone may have been paired with a different key",
      });
      continue;
    }

    const parsed = inboxEntrySchema.safeParse(value);
    if (!parsed.success || parsed.data.id !== item.id) {
      failures.push({ id: item.id, reason: "the entry is not valid" });
      continue;
    }

    if (!(await deps.alreadyReceived(item.id))) {
      await deps.receive(item.id, toPendingInput(parsed.data));
      received += 1;
    }

    try {
      await deps.remove(item.id);
    } catch {
      // O recibo ja existe: o proximo pull salta a entrada e volta a tentar
      // apaga-la. Nada a dizer ao utilizador.
    }
  }

  return { received, failures };
}
