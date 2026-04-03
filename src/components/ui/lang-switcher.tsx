"use client";

import { useI18n } from "@/lib/i18n";

export function LangSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="lang-switcher" role="group" aria-label="Language / 語言">
      <button
        type="button"
        className={`lang-switcher__btn${locale === "zh" ? " lang-switcher__btn--active" : ""}`}
        onClick={() => setLocale("zh")}
        aria-pressed={locale === "zh"}
      >
        中
      </button>
      <button
        type="button"
        className={`lang-switcher__btn${locale === "en" ? " lang-switcher__btn--active" : ""}`}
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
      >
        EN
      </button>
    </div>
  );
}
