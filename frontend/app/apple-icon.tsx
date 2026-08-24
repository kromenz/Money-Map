import { ImageResponse } from "next/og";

// O iOS nao aceita SVG no ecra inicial, so PNG, e tambem nao respeita
// transparencia -- compoe o que receber sobre preto. Por isso este e o unico
// sitio onde a marca leva fundo cheio. Os cantos ficam a direito: o iOS aplica
// a mascara dele por cima.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// O mesmo traco do icon.svg, redesenhado para dentro de um quadrado cheio: mais
// margem e traco mais fino, porque aqui nao ha 16px para defender.
const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#4f2980"/>
  <path d="M6.5 24.5 L11.8 9.8 L16 18.4 L20.2 9.8 L25.5 24.5"
        fill="none" stroke="#ffffff" stroke-width="3"
        stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="20.2" cy="9.8" r="3" fill="#34d399"/>
</svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    (
      <img
        width={size.width}
        height={size.height}
        src={`data:image/svg+xml;utf8,${encodeURIComponent(MARK)}`}
        alt=""
      />
    ),
    size
  );
}
