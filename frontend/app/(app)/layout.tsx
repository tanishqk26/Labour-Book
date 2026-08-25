/**
 * (app) Route Group Layout
 * All authenticated pages share this layout:
 * - 280px sidebar on desktop
 * - Main scrollable content area
 */
import Sidebar from "@/components/Sidebar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "var(--color-background)" }}>
      <Sidebar />

      {/* Main content area */}
      <main
        className="flex-1 flex flex-col min-h-screen"
        style={{ marginLeft: "var(--spacing-sidebar-width)" }}
      >
        {children}
      </main>
    </div>
  );
}
