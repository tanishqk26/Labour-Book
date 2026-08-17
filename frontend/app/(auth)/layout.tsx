/**
 * (auth) Route Group Layout
 * Wraps login and other auth pages.
 * Centred, full-screen, no sidebar.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-background)]">
      {children}
    </div>
  );
}
