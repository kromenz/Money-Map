"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { AuthField, type AuthFieldProps } from "./AuthField";

type PasswordFieldProps = Omit<
  AuthFieldProps,
  "icon" | "type" | "trailing" | "label"
> & { label?: string };

export function PasswordField({
  label = "Password",
  ...props
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <AuthField
      label={label}
      icon={Lock}
      type={visible ? "text" : "password"}
      trailing={
        /*
          O botao e um quadrado de tamanho fixo com grid+place-items-center, num
          pai que ja e flex items-center. E isso que o centra. A versao anterior
          usava top-1/2 e -translate-y-1/2 -- classes de posicionamento absoluto
          -- num elemento relative, o que o empurrava metade da altura para cima.
        */
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="-mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {visible ? (
            <EyeOff className="size-4" aria-hidden />
          ) : (
            <Eye className="size-4" aria-hidden />
          )}
        </button>
      }
      {...props}
    />
  );
}
