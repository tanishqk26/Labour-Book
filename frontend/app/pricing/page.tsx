import Link from "next/link";

const CONTACT_PHONE = "+917385990561";
const CONTACT_EMAIL = "tanishqkokane@gmail.com";

const plans = [
  {
    name: "Basic",
    price: "₹499",
    period: "per month",
    description: "Perfect for small farms managing a handful of labourers.",
    cta: "Get started",
    ctaHref: `mailto:${CONTACT_EMAIL}?subject=LabourBook Basic Plan`,
    highlight: false,
  },
  {
    name: "Pro",
    price: "₹999",
    period: "per month",
    description: "For growing farms that need more power and team management.",
    cta: "Get started",
    ctaHref: `mailto:${CONTACT_EMAIL}?subject=LabourBook Pro Plan`,
    highlight: true,
  },
  {
    name: "FPO",
    price: "Contact us",
    period: "enterprise pricing",
    description: "For Farmer Producer Organisations managing large workforces across multiple farms.",
    cta: "Contact sales",
    ctaHref: `mailto:${CONTACT_EMAIL}?subject=LabourBook FPO Plan`,
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", minHeight: "100vh", background: "#f7fdf9" }}>

      {/* NAV */}
      <nav style={{ background: "#012d1a", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ padding: "0 28px", height: 64, display: "flex", alignItems: "center", gap: 32 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none", flexShrink: 0 }}>
            <img src="/LabourBook%20Farm-Inspired%20Logo.png" alt="LabourBook" style={{ height: 52 }} />
          </a>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/login" style={{ color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: 15, fontWeight: 600 }}>Log in</Link>
            <Link href="/signup" style={{
              background: "white", color: "#012d1a", textDecoration: "none",
              fontSize: 14, fontWeight: 700, padding: "9px 20px", borderRadius: 10,
            }}>Get started free</Link>
          </div>
        </div>
      </nav>

      {/* HEADER */}
      <div style={{ textAlign: "center", padding: "72px 24px 56px" }}>
        <p style={{ color: "#52b788", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Pricing</p>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 52px)", fontWeight: 800, color: "#012d1a", lineHeight: 1.15, margin: "0 0 16px" }}>
          Simple, honest pricing
        </h1>
        <p style={{ color: "#4a7a5a", fontSize: 17, lineHeight: 1.6, maxWidth: 480, margin: "0 auto" }}>
          Choose the plan that fits your farm. No hidden fees, no contracts.
        </p>
      </div>

      {/* CARDS */}
      <div style={{
        maxWidth: 1000, margin: "0 auto", padding: "0 24px 96px",
        display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center", alignItems: "stretch",
      }}>
        {plans.map(({ name, price, period, description, cta, ctaHref, highlight }) => (
          <div key={name} style={{
            flex: "1 1 260px", maxWidth: 320,
            background: highlight ? "#012d1a" : "white",
            border: highlight ? "none" : "1.5px solid #d4edda",
            borderRadius: 20,
            padding: "36px 32px",
            display: "flex", flexDirection: "column", gap: 0,
            position: "relative",
            boxShadow: highlight
              ? "0 20px 60px rgba(1,45,26,0.3)"
              : "0 4px 24px rgba(1,45,26,0.06)",
          }}>
            {highlight && (
              <div style={{
                position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
                background: "#52b788", color: "white", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                padding: "5px 18px", borderRadius: 100,
              }}>Most Popular</div>
            )}

            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: highlight ? "#6bcf8e" : "#52b788", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{name}</span>
            </div>

            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: name === "FPO" ? 28 : 44, fontWeight: 800, color: highlight ? "white" : "#012d1a", lineHeight: 1 }}>{price}</span>
              {name !== "FPO" && (
                <span style={{ fontSize: 15, color: highlight ? "#a8d5b5" : "#6a9a7a", marginLeft: 6 }}>{period}</span>
              )}
              {name === "FPO" && (
                <div style={{ fontSize: 14, color: highlight ? "#a8d5b5" : "#6a9a7a", marginTop: 4 }}>{period}</div>
              )}
            </div>

            <p style={{ fontSize: 15, color: highlight ? "#a8d5b5" : "#4a7a5a", lineHeight: 1.6, marginBottom: 32, flexGrow: 1 }}>
              {description}
            </p>

            <a href={ctaHref} style={{
              display: "block", textAlign: "center", textDecoration: "none",
              padding: "13px 24px", borderRadius: 10, fontWeight: 700, fontSize: 15,
              background: highlight ? "white" : "#012d1a",
              color: highlight ? "#012d1a" : "white",
            }}>{cta}</a>
          </div>
        ))}
      </div>

      {/* CONTACT STRIP */}
      <div style={{ background: "#012d1a", padding: "48px 24px", textAlign: "center" }}>
        <p style={{ color: "#a8d5b5", fontSize: 16, marginBottom: 20 }}>
          Have questions? Reach us directly.
        </p>
        <div style={{ display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" as const }}>
          <a href={`tel:${CONTACT_PHONE}`} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.08)", color: "white", textDecoration: "none",
            fontWeight: 600, fontSize: 15, padding: "11px 24px", borderRadius: 10,
            border: "1.5px solid rgba(255,255,255,0.15)",
          }}>📞 {CONTACT_PHONE}</a>
          <a href={`mailto:${CONTACT_EMAIL}`} style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.08)", color: "white", textDecoration: "none",
            fontWeight: 600, fontSize: 15, padding: "11px 24px", borderRadius: 10,
            border: "1.5px solid rgba(255,255,255,0.15)",
          }}>✉️ {CONTACT_EMAIL}</a>
        </div>
      </div>

      {/* FOOTER */}
      <footer style={{ background: "#010f08", padding: "24px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 12 }}>
        <img src="/LabourBook%20Farm-Inspired%20Logo.png" alt="LabourBook" style={{ height: 26, filter: "brightness(0) invert(1) opacity(0.5)" }} />
        <p style={{ color: "#1e3a28", fontSize: 13, margin: 0 }}>© 2026 LabourBook. All rights reserved.</p>
      </footer>
    </div>
  );
}
