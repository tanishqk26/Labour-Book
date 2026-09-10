"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { getInitials } from "@/lib/utils";

interface NavItem {
  href: string;
  labelKey: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "sidebar.dashboard", icon: "dashboard" },
  { href: "/labours", labelKey: "sidebar.labours", icon: "groups" },
  { href: "/teams", labelKey: "sidebar.teams", icon: "group_work" },
  { href: "/plots", labelKey: "sidebar.plots", icon: "landscape" },
  { href: "/attendance", labelKey: "sidebar.attendance", icon: "checklist" },
  { href: "/contracts", labelKey: "sidebar.contracts", icon: "description" },
  { href: "/payments", labelKey: "sidebar.payments", icon: "payments" },
  { href: "/statements", labelKey: "sidebar.statements", icon: "receipt_long" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const [avatarError, setAvatarError] = useState(false);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <nav
      className="hidden md:flex flex-col py-8 px-3 border-r"
      style={{
        width: "var(--spacing-sidebar-width)",
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-outline-variant)",
        zIndex: 30,
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 mb-10">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center hover-grow"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          <span
            className="material-symbols-outlined icon-fill"
            style={{ color: "#ffffff", fontSize: "18px" }}
          >
            agriculture
          </span>
        </div>
        <div>
          <h1
            className="text-headline-md font-extrabold"
            style={{ color: "var(--color-primary)" }}
          >
            LabourBook
          </h1>
          <p
            className="text-label-caps"
            style={{ color: "var(--color-on-surface-variant)" }}
          >
            {t("sidebar.tagline")}
          </p>
        </div>
      </div>

      {/* Navigation items */}
      <div className="flex-1 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl sidebar-item-hover"
              style={{
                color: isActive
                  ? "var(--color-primary)"
                  : "var(--color-on-surface-variant)",
                backgroundColor: isActive
                  ? "var(--color-primary-fixed)"
                  : "transparent",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <span
                className={`material-symbols-outlined ${isActive ? "icon-fill" : ""}`}
                style={{ fontSize: "20px" }}
              >
                {item.icon}
              </span>
              <span className="text-body-md">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className="pt-4 flex flex-col gap-0.5"
        style={{ borderTop: "1px solid var(--color-outline-variant)" }}
      >
        <Link
          href="/settings"
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl sidebar-item-hover"
          style={{
            color: pathname === "/settings" ? "var(--color-primary)" : "var(--color-on-surface-variant)",
            backgroundColor: pathname === "/settings" ? "var(--color-primary-fixed)" : "transparent",
            fontWeight: pathname === "/settings" ? 600 : 400,
          }}
        >
          <span className={`material-symbols-outlined ${pathname === "/settings" ? "icon-fill" : ""}`} style={{ fontSize: "20px" }}>
            settings
          </span>
          <span className="text-body-md">{t("sidebar.settings")}</span>
        </Link>

        {user && (
          <div className="flex items-center gap-3 px-4 py-2.5 mt-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
              style={{ backgroundColor: "var(--color-primary-fixed)" }}
            >
              {user.picture_url && !avatarError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.picture_url}
                  alt={user.name}
                  className="w-full h-full object-cover"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <span className="text-label-caps font-bold" style={{ color: "var(--color-primary)" }}>
                  {getInitials(user.name)}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body-md font-semibold truncate" style={{ color: "var(--color-on-surface)" }}>
                {user.name}
              </p>
              <p className="text-label-caps truncate" style={{ color: "var(--color-on-surface-variant)" }}>
                {user.email}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 hover-grow"
              style={{ color: "var(--color-on-surface-variant)" }}
              aria-label="Log out"
              title="Log out"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                logout
              </span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
