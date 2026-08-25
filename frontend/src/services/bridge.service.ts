import type { BridgeFlushResponse } from "@/types/bridge";

/**
 * Pede ao lado servidor do Next para descarregar na folha o que a ponte do
 * Trading 212 ainda lhe deve.
 *
 * Rota do Next e nao do backend: a pasta do orcamento so existe deste lado.
 */
export async function flushBridge(): Promise<BridgeFlushResponse> {
  const res = await fetch("/api/bridge/flush", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`bridge flush failed (${res.status})`);
  return res.json();
}
