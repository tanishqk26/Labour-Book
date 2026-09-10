"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { LOCALES, Locale } from "@/lib/i18n";

function loadPref<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function savePref(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function SectionCard({ icon, title, description, children }: { icon: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--color-surface-container-lowest)", border: "1px solid var(--color-outline-variant)" }}>
      <div className="flex items-start gap-4 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--color-primary-fixed)" }}>
          <span className="material-symbols-outlined icon-fill" style={{ fontSize: 20, color: "var(--color-primary)" }}>{icon}</span>
        </div>
        <div>
          <p className="text-body-md font-semibold" style={{ color: "var(--color-on-surface)" }}>{title}</p>
          {description && <p style={{ fontSize: 13, color: "var(--color-on-surface-variant)", marginTop: 2 }}>{description}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-0">{children}</div>
    </div>
  );
}

function SettingRow({ label, sublabel, children, divider = true }: { label: string; sublabel?: string; children: React.ReactNode; divider?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4" style={divider ? { borderBottom: "1px solid var(--color-outline-variant)" } : {}}>
      <div className="flex flex-col gap-0.5 pr-4">
        <span className="text-body-md" style={{ color: "var(--color-on-surface)" }}>{label}</span>
        {sublabel && <span style={{ fontSize: 13, color: "var(--color-on-surface-variant)" }}>{sublabel}</span>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function Toast({ msg, onClose }: { msg: string; onClose: () => void }) {
  useEffect(() => { const timer = setTimeout(onClose, 2400); return () => clearTimeout(timer); }, [onClose]);
  return (
    <div className="fixed bottom-24 md:bottom-8 left-1/2" style={{ transform: "translateX(-50%)", zIndex: 9999, backgroundColor: "var(--color-primary-container)", color: "var(--color-on-primary)", padding: "12px 24px", borderRadius: 12, fontWeight: 600, fontSize: 14, boxShadow: "0 8px 32px rgba(1,45,29,0.18)", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
      <span className="material-symbols-outlined icon-fill" style={{ fontSize: 18 }}>check_circle</span>
      {msg}
    </div>
  );
}

export default function SettingsPage() {
  const { t, locale, setLocale } = useLanguage();
  const { user, logout } = useAuth();
  const router = useRouter();

  const [farmerName, setFarmerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailId, setEmailId] = useState("");
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    await logout();
    router.replace("/login");
  }

  useEffect(() => {
    setFarmerName(loadPref("lb_farmerName", ""));
    setPhoneNumber(loadPref("lb_phoneNumber", ""));
    setEmailId(loadPref("lb_emailId", ""));
  }, []);

  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--color-outline-variant)", backgroundColor: "var(--color-surface-container-low)", color: "var(--color-on-surface)", fontSize: 15, outline: "none", fontFamily: "inherit", transition: "border-color 0.15s ease" };

  const handleSaveProfile = () => {
    savePref("lb_farmerName", farmerName);
    savePref("lb_phoneNumber", phoneNumber);
    savePref("lb_emailId", emailId);
    setSaved(true);
    setToast(t("settings.settingsSaved"));
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <>
      <title>{`${t("settings.title")} | LabourBook`}</title>
      <style>{`.settings-input:focus { border-color: var(--color-primary) !important; box-shadow: 0 0 0 3px var(--color-primary-fixed); }`}</style>

      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      <header className="px-4 md:px-8 py-6 md:py-8 flex flex-col md:flex-row md:items-end justify-between gap-4" style={{ borderBottom: "1px solid var(--color-outline-variant)" }}>
        <div>
          <h1 className="text-headline-lg" style={{ color: "var(--color-primary)", fontSize: "clamp(24px,5vw,32px)" }}>{t("settings.title")}</h1>
          <p className="text-body-md mt-1" style={{ color: "var(--color-on-surface-variant)" }}>{t("settings.subtitle")}</p>
        </div>
        <button id="save-settings-btn" onClick={handleSaveProfile}
          className="h-11 px-6 rounded-xl font-semibold text-body-md flex items-center gap-2 transition-all hover:opacity-90 flex-shrink-0"
          style={{ backgroundColor: saved ? "#166534" : "var(--color-primary)", color: "#fff" }}>
          <span className="material-symbols-outlined icon-fill" style={{ fontSize: 18 }}>{saved ? "check" : "save"}</span>
          {saved ? t("common.saved") : t("common.saveChanges")}
        </button>
      </header>

      <div className="px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full">
        <SectionCard icon="person" title={t("settings.profileTitle")} description={t("settings.profileDesc")}>
          <SettingRow label={t("settings.farmerName")} sublabel={t("settings.farmerNameSub")}>
            <div className="w-full sm:w-[280px]">
              <input id="setting-farmer-name" className="settings-input" style={inputStyle} placeholder={t("settings.farmerNamePlaceholder")} value={farmerName} onChange={e => setFarmerName(e.target.value)} />
            </div>
          </SettingRow>
          <SettingRow label={t("settings.phoneNumber")} sublabel={t("settings.phoneNumberSub")}>
            <div className="w-full sm:w-[280px]">
              <input id="setting-phone-number" className="settings-input" style={inputStyle} type="tel" placeholder={t("settings.phoneNumberPlaceholder")} value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
            </div>
          </SettingRow>
          <SettingRow label={t("settings.emailId")} sublabel={t("settings.emailIdSub")} divider={false}>
            <div className="w-full sm:w-[280px]">
              <input id="setting-email-id" className="settings-input" style={inputStyle} type="email" placeholder={t("settings.emailIdPlaceholder")} value={emailId} onChange={e => setEmailId(e.target.value)} />
            </div>
          </SettingRow>
        </SectionCard>

        <SectionCard icon="account_circle" title="Account" description="Signed in with Google">
          <SettingRow label={user?.name ?? ""} sublabel={user?.email} divider={false}>
            <button
              id="logout-btn"
              onClick={handleLogout}
              disabled={signingOut}
              className="h-10 px-4 rounded-lg font-semibold text-body-md flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{
                border: "1px solid var(--color-outline-variant)",
                color: "var(--color-on-surface-variant)",
                backgroundColor: "transparent",
                opacity: signingOut ? 0.6 : 1,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>logout</span>
              Sign out
            </button>
          </SettingRow>
        </SectionCard>

        <SectionCard icon="translate" title={t("settings.languageTitle")} description={t("settings.languageDesc")}>
          <SettingRow label={t("settings.languageLabel")} sublabel={t("settings.languageSub")} divider={false}>
            <div className="flex flex-wrap gap-2">
              {LOCALES.map((l) => (
                <button
                  key={l.value}
                  id={`language-option-${l.value}`}
                  onClick={() => setLocale(l.value as Locale)}
                  className="px-4 py-2 rounded-xl text-body-md font-medium transition-all"
                  style={{
                    border: `1.5px solid ${locale === l.value ? "var(--color-primary)" : "var(--color-outline-variant)"}`,
                    backgroundColor: locale === l.value ? "var(--color-primary-fixed)" : "transparent",
                    color: locale === l.value ? "var(--color-primary)" : "var(--color-on-surface)",
                    fontWeight: locale === l.value ? 600 : 400,
                  }}
                >
                  {l.native}
                </button>
              ))}
            </div>
          </SettingRow>
        </SectionCard>
      </div>
    </>
  );
}
