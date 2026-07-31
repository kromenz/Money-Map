"use client";

import { AuthProvider } from "../src/context/AuthContext";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Toaster position="top-center" richColors />
      {children}
    </AuthProvider>
  );
}
