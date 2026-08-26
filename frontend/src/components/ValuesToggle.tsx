"use client";

import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHiddenValuesToggle } from "@/context/HiddenValuesContext";

/**
 * Tapa os montantes e deixa so as percentagens -- para ter a app aberta ao pe
 * de outras pessoas sem anunciar quanto se ganha.
 *
 * O icone diz o estado, nao a accao: olho aberto quando os valores se leem,
 * olho fechado quando estao tapados. O aria-label e que carrega a accao.
 */
export function ValuesToggle() {
  const { hidden, toggle } = useHiddenValuesToggle();
  const Icon = hidden ? EyeOff : Eye;

  return (
    <Button
      variant="ghost"
      size="icon"
      title={hidden ? "Values hidden" : "Values visible"}
      aria-pressed={hidden}
      aria-label={hidden ? "Values hidden, click to show" : "Values visible, click to hide"}
      onClick={toggle}>
      <Icon className="size-4" />
    </Button>
  );
}
