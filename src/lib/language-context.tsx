"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Language, translations, TranslationKeys } from "./translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKeys) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("English");

  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem("nutriai_lang") as Language;
      if (saved && (saved === "English" || saved === "Hindi")) {
        setLanguageState(saved);
      }
    };
    init();
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("nutriai_lang", lang);
  };

  const t = (key: TranslationKeys): string => {
    const langTranslations = translations[language] || translations.English;
    return (langTranslations as Record<string, string>)[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
