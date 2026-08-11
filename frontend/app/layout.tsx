import type { Metadata } from "next";
import "../styles/globals.css";
import { Providers } from "./providers";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

// Sem campo icons: o Next apanha sozinho o app/icon.svg e o app/apple-icon.tsx
// pela convencao de ficheiros. Declara-los aqui sobrepunha-se a ela.
export const metadata: Metadata = {
  title: "Money Map",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning no <html> porque o next-themes poe a classe do
    // tema antes da hidratacao, e no <body> porque extensoes do browser
    // (Bitdefender e afins) injetam atributos como bis_register antes do React
    // arrancar. So afeta os atributos destes dois elementos, nao os filhos.
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable)}>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
