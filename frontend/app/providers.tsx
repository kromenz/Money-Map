"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "../src/context/AuthContext";
import { HiddenValuesProvider } from "../src/context/HiddenValuesContext";
import { makeQueryClient } from "../src/lib/query-client";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <HiddenValuesProvider>
            <Toaster position="top-center" richColors theme="system" />
            {children}
          </HiddenValuesProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
