/**
 * (app) Route Group Layout
 * All authenticated pages share this layout:
 * - 280px sidebar on desktop
 * - Bottom tab nav on mobile
 * - Main scrollable content area
 *
 * The sidebar and nav will be built as components once feature work begins.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "var(--color-background)" }}>
      {/* Sidebar placeholder — will become <Sidebar /> component */}
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
        <div className="px-4 mb-8">
          <h1
            className="text-headline-md font-extrabold"
            style={{ color: "var(--color-primary)" }}
          >
            LabourBook
          </h1>
          <p className="text-label-caps mt-1" style={{ color: "var(--color-on-surface-variant)" }}>
            Modern Ledger
          </p>
        </div>
        {/* Navigation items will be built here */}
      </nav>

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
