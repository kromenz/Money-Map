"use client";

/**
 * A pagina existe antes da chave existir. Sem isto, a primeira visita dava um
 * erro de rede e nao dizia o que fazer a seguir.
 */
export function NotConfigured() {
  return (
    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
      <p className="mb-2 font-medium text-foreground">
        Trading 212 por configurar
      </p>
      <p className="mb-3">
        Gera uma chave em Settings → API (Beta) na app do Trading 212, com as
        permissoes <code>account</code>, <code>portfolio</code>,{" "}
        <code>metadata</code> e as tres de <code>history</code>. Deixa{" "}
        <code>orders:execute</code> desligada — esta app so le.
      </p>
      <p>
        Depois poe <code>T212_API_KEY</code> e <code>T212_API_SECRET</code> em{" "}
        <code>backend/.env</code> e reinicia o backend.
      </p>
    </div>
  );
}
