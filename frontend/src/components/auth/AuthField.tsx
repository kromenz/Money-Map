"use client";

import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AuthFieldProps = Omit<React.ComponentProps<"input">, "id"> & {
  label: string;
  icon: LucideIcon;
  error?: string;
  /** Renderizado dentro da moldura, a seguir ao input (ex.: o olho da password). */
  trailing?: React.ReactNode;
  id?: string;
};

export function AuthField({
  label,
  icon: Icon,
  error,
  trailing,
  className,
  id,
  ...props
}: AuthFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>

      {/*
        O anel de foco vive na moldura, via focus-within, e nao no input. Assim
        envolve o icone e o botao do olho em vez de so a caixa de texto.
      */}
      <div
        className={cn(
          "flex h-11 items-center gap-2.5 rounded-xl border border-input bg-background px-3",
          "transition-[color,box-shadow,border-color]",
          "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40",
          error &&
            "border-destructive focus-within:border-destructive focus-within:ring-destructive/30"
        )}>
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />

        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none",
            "placeholder:text-muted-foreground",
            className
          )}
          {...props}
        />

        {trailing}
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
