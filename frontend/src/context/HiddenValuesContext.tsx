"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "moneymap.hide-values";

type HiddenValuesCtx = {
  /** Verdadeiro quando os montantes estao tapados e so as % se leem. */
  hidden: boolean;
  toggle: () => void;
};

const HiddenValuesContext = createContext<HiddenValuesCtx | undefined>(
  undefined,
);

export function HiddenValuesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Arranca sempre a mostrar, tal como o servidor renderiza: ler o
  // localStorage no initializer daria um estado diferente do da hidratacao.
  // Nao ha risco de piscar montantes -- as paginas so tem numeros depois de o
  // react-query responder, e ate la ja passamos por este efeito.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      // Modo privado ou armazenamento bloqueado: fica a mostrar, que e o
      // predefinido. A opcao continua a funcionar dentro desta sessao.
    }
  }, []);

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Ver acima: sem persistencia, mas a sessao actual respeita a escolha.
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ hidden, toggle }), [hidden, toggle]);

  return (
    <HiddenValuesContext.Provider value={value}>
      {children}
    </HiddenValuesContext.Provider>
  );
}

/**
 * A bandeira que os formatadores do lib/format.ts recebem. Fora do provider
 * devolve "a mostrar" em vez de rebentar: um componente isolado num teste ou
 * numa pagina sem provider deve continuar a desenhar-se.
 */
export function useHiddenValues(): boolean {
  return useContext(HiddenValuesContext)?.hidden ?? false;
}

export function useHiddenValuesToggle(): HiddenValuesCtx {
  const ctx = useContext(HiddenValuesContext);
  if (!ctx) {
    throw new Error("useHiddenValuesToggle precisa do HiddenValuesProvider");
  }
  return ctx;
}
