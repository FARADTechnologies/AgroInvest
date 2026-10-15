"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { az, type Messages } from "@/messages/az";
import { en } from "@/messages/en";

export type Lang = "az" | "en";

const CATALOGUES: Record<Lang, Messages> = { az, en };
const KEY = "ui-lang";

type LangState = { lang: Lang; setLang: (lang: Lang) => void };

const LangContext = createContext<LangState>({ lang: "az", setLang: () => {} });

/**
 * Interface language. Azerbaijani is the default; the visitor's choice is kept
 * in the browser (a convenience, not a profile setting).
 */
export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("az");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved === "en" || saved === "az") setLangState(saved);
    } catch {
      // Storage blocked: stay in Azerbaijani.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // The choice still applies to this page view.
    }
  }, []);

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangState {
  return useContext(LangContext);
}

/** Returns the active message catalogue. */
export function useT(): Messages {
  return CATALOGUES[useContext(LangContext).lang];
}

/** Inline bilingual copy: L("Xəritə", "Map"). */
export function useL(): (azText: string, enText: string) => string {
  const { lang } = useContext(LangContext);
  return useCallback((azText: string, enText: string) => (lang === "en" ? enText : azText), [lang]);
}
