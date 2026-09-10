export type Locale = "en" | "hi" | "mr";

export const LOCALES: { value: Locale; label: string; native: string }[] = [
  { value: "en", label: "English", native: "English" },
  { value: "hi", label: "Hindi", native: "हिंदी" },
  { value: "mr", label: "Marathi", native: "मराठी" },
];

export type Namespace = Record<Locale, Record<string, string>>;
