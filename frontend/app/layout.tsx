import type { Metadata } from "next";
import "../styles/globals.css";
import { Providers } from "./providers";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Money Map",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt" className={cn("font-sans", geist.variable)}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
