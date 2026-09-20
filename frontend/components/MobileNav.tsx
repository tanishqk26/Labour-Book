"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";

const MOBILE_NAV_ITEMS = [
  { href: "/dashboard", labelKey: "sidebar.home", icon: "dashboard" },
  { href: "/labours", labelKey: "sidebar.labour", icon: "groups" },
  { href: "/attendance", labelKey: "sidebar.attendance", icon: "checklist" },
  { href: "/operations", labelKey: "sidebar.operations", icon: "agriculture" },
  { href: "/contracts", labelKey: "sidebar.contracts", icon: "description" },
  { href: "/teams", labelKey: "sidebar.teams", icon: "group_work" },
];

export default function MobileNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center"
      style={{
        backgroundColor: "var(--color-surface)",
        borderTop: "1px solid var(--color-outline-variant)",
        height: "64px",
      }}
    >
      {MOBILE_NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full"
            style={{
              color: isActive
                ? "var(--color-primary)"
                : "var(--color-on-surface-variant)",
            }}
          >
            <span
              className={`material-symbols-outlined ${isActive ? "icon-fill" : ""}`}
              style={{ fontSize: "22px" }}
            >
              {item.icon}
            </span>
            <span
              style={{
                fontSize: "10px",
                lineHeight: "12px",
                fontWeight: isActive ? 600 : 400,
                letterSpacing: "0.02em",
              }}
            >
              {t(item.labelKey)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
