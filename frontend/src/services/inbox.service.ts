import axios from "axios";
import api from "../lib/api";
import type { InboxSyncResponse } from "../types/inbox";

/**
 * Pede ao backend que va a caixa do telemovel ja.
 *
 * 503 e "nao configurada": devolve null e o dashboard nao diz nada, como no
 * T212. Tudo o resto sobe -- quem chama decide que nao e grave.
 */
export async function syncInbox(): Promise<InboxSyncResponse | null> {
  try {
    const { data } = await api.post<InboxSyncResponse>("/inbox/sync");
    return data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 503) return null;
    throw err;
  }
}
