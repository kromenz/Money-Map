"use client";

/**
 * A pagina existe antes da chave existir. Sem isto, a primeira visita dava um
 * erro de rede e nao dizia o que fazer a seguir.
 */
export function NotConfigured() {
  return (
    <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
      <p className="mb-2 font-medium text-foreground">
        Trading 212 is not configured
      </p>
      <p className="mb-3">
        Generate a key under Settings → API (Beta) in the Trading 212 app,
        with the <code>account</code>, <code>portfolio</code>,{" "}
        <code>metadata</code> permissions and the three <code>history</code>{" "}
        ones. Leave <code>orders:execute</code> off — this app only reads.
      </p>
      <p>
        Then put <code>T212_API_KEY</code> and <code>T212_API_SECRET</code> in{" "}
        <code>backend/.env</code> and restart the backend.
      </p>
    </div>
  );
}
