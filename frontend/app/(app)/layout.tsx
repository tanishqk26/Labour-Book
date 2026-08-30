/**
 * (app) Route Group Layout
 * All authenticated pages share this layout:
 * - 280px sidebar on desktop (md+)
 * - Bottom navigation bar on mobile
 * - Main scrollable content area
 */
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";

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
        style={{
          marginLeft: "0px",
        }}
      >
        {/* Responsive sidebar offset — only on desktop */}
        <style>{`
          @media (min-width: 768px) {
            main { margin-left: var(--spacing-sidebar-width) !important; }
          }
        `}</style>
        {/* Bottom padding on mobile to account for bottom nav */}
        <div className="pb-16 md:pb-0">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </div>
  );
}
