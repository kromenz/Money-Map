"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const ORDER = ["system", "light", "dark"] as const;
type Mode = (typeof ORDER)[number];

const ICON: Record<Mode, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const LABEL: Record<Mode, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // O tema so e conhecido no browser. Ate montar, servidor e cliente
  // renderizam o mesmo icone neutro, senao ha mismatch na hidratacao.
  useEffect(() => setMounted(true), []);

  const mode: Mode =
    mounted && ORDER.includes(theme as Mode) ? (theme as Mode) : "system";
  const Icon = ICON[mode];

  return (
    <Button
      variant="ghost"
      size="icon"
      title={LABEL[mode]}
      aria-label={`${LABEL[mode]}, click to change`}
      onClick={() => setTheme(ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length])}>
      <Icon className="size-4" />
    </Button>
  );
}
