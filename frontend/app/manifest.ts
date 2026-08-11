import type { MetadataRoute } from "next";

// Sem isto, instalar a app no ambiente de trabalho ou no Android nao apanha
// marca nenhuma -- o icon.svg sozinho so cobre o separador do browser.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Money Map",
    short_name: "Money Map",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    // O --primary do tema claro. E a cor da barra do sistema na app instalada.
    theme_color: "#4f2980",
    icons: [
      {
        src: "/icon.svg",
        // "any" porque e vectorial: escala para o tamanho que o sistema pedir.
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
