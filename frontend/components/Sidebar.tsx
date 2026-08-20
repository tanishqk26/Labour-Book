"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/labours", label: "Labours", icon: "groups" },
  { href: "/teams", label: "Teams", icon: "group_work" },
  { href: "/contracts", label: "Contracts", icon: "description" },
  { href: "/payments", label: "Payments", icon: "payments" },
  { href: "/statements", label: "Statements", icon: "receipt_long" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      className="hidden md:flex flex-col py-8 px-4 border-r"
      style={{
        width: "var(--spacing-sidebar-width)",
        position: "fixed",
        top: 0,
        left: 0,
        height: "100vh",
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-outline-variant)",
        zIndex: 50,
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 mb-12">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "var(--color-primary-container)" }}
        >
          <span
            className="material-symbols-outlined icon-fill"
            style={{ color: "var(--color-on-primary)", fontSize: "20px" }}
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
            Modern Ledger
          </p>
        </div>
      </div>

      {/* Navigation items */}
      <div className="flex-1 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors"
              style={{
                color: isActive
                  ? "var(--color-primary)"
                  : "var(--color-on-surface-variant)",
                backgroundColor: isActive
                  ? "var(--color-surface-container-low)"
                  : "transparent",
                fontWeight: isActive ? 600 : 400,
                borderRight: isActive
                  ? "3px solid var(--color-primary)"
                  : "3px solid transparent",
              }}
            >
              <span
                className={`material-symbols-outlined ${isActive ? "icon-fill" : ""}`}
                style={{ fontSize: "22px" }}
              >
                {item.icon}
              </span>
              <span className="text-body-md">{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div
        className="pt-4 flex flex-col gap-1"
        style={{ borderTop: "1px solid var(--color-outline-variant)" }}
      >
        <Link
          href="/settings"
          className="flex items-center gap-3 px-4 py-2 rounded-lg transition-colors"
          style={{ color: "var(--color-on-surface-variant)" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
            settings
          </span>
          <span className="text-body-md">Settings</span>
        </Link>
        <Link
          href="/support"
          className="flex items-center gap-3 px-4 py-2 rounded-lg transition-colors"
          style={{ color: "var(--color-on-surface-variant)" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
            help_outline
          </span>
          <span className="text-body-md">Support</span>
        </Link>
      </div>
    </nav>
  );
}
