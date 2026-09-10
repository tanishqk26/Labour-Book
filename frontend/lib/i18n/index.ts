import { Locale } from "./types";
import { common } from "./common";
import { sidebar } from "./sidebar";
import { settings } from "./settings";
import { dashboard } from "./dashboard";
import { labours } from "./labours";
import { teams } from "./teams";
import { plots } from "./plots";
import { attendance } from "./attendance";
import { contracts } from "./contracts";
import { payments } from "./payments";
import { statements } from "./statements";

export type { Locale };
export { LOCALES } from "./types";

const NAMESPACES = {
  common,
  sidebar,
  settings,
  dashboard,
  labours,
  teams,
  plots,
  attendance,
  contracts,
  payments,
  statements,
};

type NamespaceKey = keyof typeof NAMESPACES;

export const translations: Record<Locale, Record<NamespaceKey, Record<string, string>>> = {
  en: {} as Record<NamespaceKey, Record<string, string>>,
  hi: {} as Record<NamespaceKey, Record<string, string>>,
  mr: {} as Record<NamespaceKey, Record<string, string>>,
};

(Object.keys(NAMESPACES) as NamespaceKey[]).forEach((ns) => {
  (["en", "hi", "mr"] as Locale[]).forEach((locale) => {
    translations[locale][ns] = NAMESPACES[ns][locale];
  });
});

export function translate(locale: Locale, key: string): string {
  const [ns, ...rest] = key.split(".");
  const restKey = rest.join(".");
  const nsTable = translations[locale]?.[ns as NamespaceKey];
  const value = nsTable?.[restKey];
  if (value !== undefined) return value;
  // fall back to English if the key is missing in the active locale
  const enValue = translations.en?.[ns as NamespaceKey]?.[restKey];
  if (enValue !== undefined) return enValue;
  return key;
}
