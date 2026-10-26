import Link from "next/link";

// ─── Phone Frame ──────────────────────────────────────────────────────────────

function PhoneFrame({ src, alt, style }: { src: string; alt: string; style?: React.CSSProperties }) {
  return (
    <div style={{
      position: "relative",
      background: "#0d1f14",
      borderRadius: 40,
      padding: "12px 9px 16px",
      boxShadow: "0 28px 64px rgba(1,45,26,0.55), inset 0 0 0 1.5px #2d4a35",
      ...style,
    }}>
      {/* Side buttons */}
      <div style={{ position: "absolute", left: -3, top: 80, width: 3, height: 32, background: "#1a3a22", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", left: -3, top: 122, width: 3, height: 32, background: "#1a3a22", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", right: -3, top: 100, width: 3, height: 48, background: "#1a3a22", borderRadius: "0 2px 2px 0" }} />
      {/* Notch */}
      <div style={{
        position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
        width: 64, height: 14, background: "#0d1f14", borderRadius: 7, zIndex: 2,
      }} />
      {/* Screen */}
      <div style={{ borderRadius: 30, overflow: "hidden", background: "#f0fdf4" }}>
        <img src={src} alt={alt} style={{ width: "100%", display: "block" }} />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const IMG = {
    dashboard: "/Screenshot%202026-10-26%20135715.png",
    labour:    "/Screenshot%202026-10-26%20135725.png",
    attendance:"/Screenshot%202026-10-26%20135732.png",
  };

  return (
    <div style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#1a2e1a", overflowX: "hidden" }}>

      {/* HERO (nav merged inside) */}
      <section style={{ background: "linear-gradient(155deg, #012d1a 0%, #1b4332 55%, #2d6a4f 100%)", overflow: "hidden" }}>
        <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(1,45,26,0.92)", backdropFilter: "blur(12px)" }}>
          <div style={{ padding: "0 28px", height: 64, display: "flex", alignItems: "center", gap: 32 }}>
            <a href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none", flexShrink: 0 }}>
              <img src="/LabourBook%20Farm-Inspired%20Logo.png" alt="LabourBook" style={{ height: 34, filter: "brightness(0) invert(1)" }} />
            </a>
            <div style={{ display: "flex", alignItems: "center", gap: 28, flex: 1, justifyContent: "center" }}>
              {["Features", "How it works", "Mobile App", "Pricing"].map(l => (
                <a key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`}
                  style={{ color: "rgba(255,255,255,0.75)", textDecoration: "none", fontSize: 15, fontWeight: 500 }}>{l}</a>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Link href="/login" style={{ color: "rgba(255,255,255,0.85)", textDecoration: "none", fontSize: 15, fontWeight: 600 }}>Log in</Link>
              <Link href="/signup" style={{
                background: "white", color: "#012d1a", textDecoration: "none",
                fontSize: 14, fontWeight: 700, padding: "9px 20px", borderRadius: 10,
              }}>Get started free</Link>
            </div>
          </div>
        </nav>

        <div style={{ padding: "72px 24px 0" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 48, flexWrap: "wrap" }}>
            {/* Left copy */}
            <div style={{ flex: "1 1 380px", minWidth: 0, paddingBottom: 72 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "rgba(107,207,142,0.12)", border: "1px solid rgba(107,207,142,0.28)",
                borderRadius: 100, padding: "5px 16px 5px 6px", marginBottom: 28,
              }}>
                <span style={{ background: "#1b5e35", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🌿</span>
                <span style={{ color: "#6bcf8e", fontSize: 13, fontWeight: 600 }}>Built for Indian farm owners</span>
              </div>
              <h1 style={{ fontSize: "clamp(34px, 5vw, 58px)", fontWeight: 800, color: "white", lineHeight: 1.1, margin: "0 0 20px" }}>
                Manage your<br />farm labour,<br />effortlessly.
              </h1>
              <p style={{ color: "#a8d5b5", fontSize: 17, lineHeight: 1.65, margin: "0 0 36px", maxWidth: 440 }}>
                Track attendance, calculate wages, record farm operations and keep your entire workforce organised — all in one place. Works in English, हिंदी and मराठी.
              </p>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <Link href="/signup" style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "white", color: "#012d1a", textDecoration: "none",
                  fontWeight: 700, fontSize: 15, padding: "12px 28px", borderRadius: 10,
                }}>Start for free →</Link>
                <a href="#how-it-works" style={{
                  display: "inline-flex", alignItems: "center",
                  background: "transparent", color: "white", textDecoration: "none",
                  fontWeight: 600, fontSize: 15, padding: "12px 28px", borderRadius: 10,
                  border: "1.5px solid rgba(255,255,255,0.32)",
                }}>See how it works</a>
              </div>
            </div>

            {/* Phone cluster */}
            <div style={{ flex: "0 1 500px", position: "relative", height: 460, minWidth: 300 }}>
              <div style={{ position: "absolute", left: 0, top: 48, width: 158, transform: "rotate(-7deg)", opacity: 0.88 }}>
                <PhoneFrame src={IMG.attendance} alt="Attendance" />
              </div>
              <div style={{ position: "absolute", left: "50%", top: 0, width: 205, transform: "translateX(-50%)", zIndex: 2 }}>
                <PhoneFrame src={IMG.dashboard} alt="Dashboard" />
              </div>
              <div style={{ position: "absolute", right: 0, top: 56, width: 152, transform: "rotate(7deg)", opacity: 0.88 }}>
                <PhoneFrame src={IMG.labour} alt="Labour" />
              </div>
            </div>
          </div>

          {/* Feature strip */}
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", paddingBottom: 32, paddingTop: 24 }}>
            {[
              { icon: "📅", label: "Attendance\nTracking" },
              { icon: "💰", label: "Wage & Payment\nManagement" },
              { icon: "🤝", label: "Teams & Contract\nLabour" },
              { icon: "🌾", label: "Farm Operations\n& Activity Records" },
            ].map(({ icon, label }) => (
              <div key={label} style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                padding: "14px 22px", background: "rgba(255,255,255,0.07)", borderRadius: 12,
                minWidth: 128, textAlign: "center",
              }}>
                <span style={{ fontSize: 26 }}>{icon}</span>
                <span style={{ color: "#a8d5b5", fontSize: 11, fontWeight: 600, whiteSpace: "pre-line", lineHeight: 1.4 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* APP SHOWCASE */}
      <section id="how-it-works" style={{ background: "#f0fdf4", padding: "88px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <p style={{ color: "#52b788", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 10, textTransform: "uppercase" as const }}>Simple. Powerful. Made for farms.</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" as const, gap: 16, marginBottom: 52 }}>
            <div>
              <h2 style={{ fontSize: "clamp(26px, 3.8vw, 42px)", fontWeight: 800, color: "#012d1a", lineHeight: 1.15, margin: 0 }}>
                Everything you need<br />to manage farm labour
              </h2>
              <p style={{ color: "#4a7a5a", fontSize: 16, marginTop: 12, maxWidth: 420, lineHeight: 1.6 }}>
                From daily attendance to wages and farm operations, LabourBook helps you stay organised and in control.
              </p>
            </div>
            <div style={{ color: "#1b4332", opacity: 0.65, textAlign: "right" as const, paddingTop: 8 }}>
              <div style={{ fontSize: 22, fontStyle: "italic", fontFamily: "Georgia, serif", lineHeight: 1.45 }}>Your farm</div>
              <div style={{ fontSize: 22, fontStyle: "italic", fontFamily: "Georgia, serif", lineHeight: 1.45 }}>in your hands</div>
              <div style={{ fontSize: 26, marginTop: 4 }}>🌿</div>
            </div>
          </div>

          {/* 3 phones with real screenshots */}
          <div style={{ display: "flex", gap: 32, justifyContent: "center", alignItems: "flex-start", flexWrap: "wrap" as const, marginBottom: 52 }}>
            <div style={{ flex: "0 1 220px" }}><PhoneFrame src={IMG.dashboard} alt="Dashboard screen" /></div>
            <div style={{ flex: "0 1 220px" }}><PhoneFrame src={IMG.labour} alt="Labour screen" /></div>
            <div style={{ flex: "0 1 220px" }}><PhoneFrame src={IMG.attendance} alt="Attendance screen" /></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 28 }}>
            {[
              { icon: "📊", title: "Dashboard", desc: "See attendance, payments and farm activity summary at a glance." },
              { icon: "👥", title: "People", desc: "Manage individual labourers, teams, wages and balances easily." },
              { icon: "📅", title: "Attendance", desc: "Mark daily attendance for individuals or teams with one tap." },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 38, height: 38, background: "#d4edda", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#012d1a", margin: 0 }}>{title}</h3>
                </div>
                <p style={{ color: "#4a7a5a", fontSize: 14, lineHeight: 1.65, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section id="features" style={{ background: "white", padding: "88px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <p style={{ color: "#52b788", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 10, textTransform: "uppercase" as const }}>Why farm owners choose LabourBook</p>
          <h2 style={{ fontSize: "clamp(26px, 3.8vw, 42px)", fontWeight: 800, color: "#012d1a", marginBottom: 44 }}>Built for real farm needs</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
            {[
              { icon: "📅", title: "Attendance Tracking", desc: "Mark daily attendance for individual labourers or teams in seconds." },
              { icon: "₹", title: "Wage & Payment Management", desc: "Set daily wages, track balances and record payments easily." },
              { icon: "🌿", title: "Farm Operations", desc: "Keep a record of spraying, fertigation, labour work and more, by plot and season." },
              { icon: "🤝", title: "Teams & Contract Work", desc: "Manage labour teams, contract work and seasonal workers without confusion." },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ background: "#f8fef9", border: "1px solid #e2f0e7", borderRadius: 16, padding: "24px 22px" }}>
                <div style={{ width: 46, height: 46, background: "#d4edda", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#012d1a", marginBottom: 16 }}>{icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#012d1a", marginBottom: 8 }}>{title}</h3>
                <p style={{ color: "#4a7a5a", fontSize: 14, lineHeight: 1.65, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LANGUAGE SECTION */}
      <section style={{ background: "linear-gradient(135deg, #022518 0%, #0d3d22 40%, #155234 100%)", padding: "88px 24px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -40, bottom: -20, fontSize: 200, opacity: 0.04, lineHeight: 1, pointerEvents: "none" as const }}>🌿</div>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 64, alignItems: "center", flexWrap: "wrap" as const }}>
          <div style={{
            flex: "1 1 300px", minHeight: 280, borderRadius: 20,
            background: "linear-gradient(160deg, #1b5e35 0%, #2d7a4f 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column" as const, gap: 16,
          }}>
            <div style={{ fontSize: 80 }}>🧑‍🌾</div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, fontWeight: 600 }}>Indian Farm Owner</div>
          </div>
          <div style={{ flex: "1 1 360px" }}>
            <p style={{ color: "#6bcf8e", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 16, textTransform: "uppercase" as const }}>Designed for Indian Farms</p>
            <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 800, color: "white", lineHeight: 1.2, marginBottom: 16 }}>
              Simple, practical and<br />available in your language
            </h2>
            <p style={{ color: "#a8d5b5", fontSize: 16, lineHeight: 1.65, marginBottom: 32, maxWidth: 420 }}>
              LabourBook is designed for Indian farm owners, with support for English, हिंदी and मराठी. A clean and easy-to-use interface that works for farms of all sizes.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const }}>
              {[["English", true], ["हिंदी", false], ["मराठी", false]].map(([lang, active]) => (
                <div key={String(lang)} style={{
                  padding: "10px 24px", borderRadius: 10,
                  background: active ? "white" : "transparent",
                  border: active ? "none" : "1.5px solid rgba(107,207,142,0.35)",
                  color: active ? "#012d1a" : "#a8d5b5",
                  fontWeight: 600, fontSize: 15,
                }}>{String(lang)}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "#011d10", padding: "88px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 60, alignItems: "center", flexWrap: "wrap" as const }}>
          <div style={{ flex: "1 1 380px" }}>
            <p style={{ color: "#6bcf8e", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 20, textTransform: "uppercase" as const }}>Get started today</p>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 44px)", fontWeight: 800, color: "white", lineHeight: 1.2, marginBottom: 20 }}>
              Your farm runs better<br />when everything is<br />organised.
            </h2>
            <p style={{ color: "#a8d5b5", fontSize: 16, lineHeight: 1.65, marginBottom: 36 }}>
              Start using LabourBook for free and make farm labour management simple, transparent and hassle-free.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" as const, marginBottom: 28 }}>
              <Link href="/signup" style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "white", color: "#012d1a", textDecoration: "none",
                fontWeight: 700, fontSize: 15, padding: "12px 28px", borderRadius: 10,
              }}>Start for free →</Link>
              <Link href="/login" style={{
                display: "inline-flex", alignItems: "center",
                background: "rgba(255,255,255,0.07)", color: "white", textDecoration: "none",
                fontWeight: 600, fontSize: 15, padding: "12px 28px", borderRadius: 10,
                border: "1.5px solid rgba(255,255,255,0.16)",
              }}>Log in to your account</Link>
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" as const }}>
              {["No credit card required", "Free to get started", "Works on mobile and web", "English · हिंदी · मराठी"].map(b => (
                <div key={b} style={{ display: "flex", alignItems: "center", gap: 6, color: "#7ab898", fontSize: 13 }}>
                  <span style={{ color: "#52b788", fontWeight: 700 }}>✓</span> {b}
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: "0 1 210px", transform: "rotate(3deg)" }}>
            <PhoneFrame src={IMG.dashboard} alt="LabourBook Dashboard" />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#010f08", padding: "28px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 20, marginBottom: 20 }}>
            <a href="/" style={{ textDecoration: "none" }}>
              <img src="/LabourBook%20Farm-Inspired%20Logo.png" alt="LabourBook" style={{ height: 28, filter: "brightness(0) invert(1) opacity(0.6)" }} />
            </a>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" as const }}>
              {["Features", "How it works", "Mobile App", "Pricing", "Contact"].map(l => (
                <a key={l} href="#" style={{ color: "#2d5038", textDecoration: "none", fontSize: 14 }}>{l}</a>
              ))}
            </div>
          </div>
          <div style={{ borderTop: "1px solid #0e2e18", paddingTop: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 8 }}>
            <p style={{ color: "#1e3a28", fontSize: 13, margin: 0 }}>Farm labour management, made simple.</p>
            <p style={{ color: "#1e3a28", fontSize: 13, margin: 0 }}>© 2026 LabourBook. All rights reserved.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
