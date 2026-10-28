"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Fade-in on scroll
function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(28px)",
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      ...style,
    }}>{children}</div>
  );
}

// ─── Phone Frame ──────────────────────────────────────────────────────────────

function PhoneFrame({ src, alt, style }: { src: string; alt: string; style?: React.CSSProperties }) {
  return (
    <div style={{
      position: "relative",
      background: "linear-gradient(160deg, #222 0%, #0d0d0d 45%, #1c1c1c 100%)",
      borderRadius: 38,
      padding: "10px 8px 12px",
      boxShadow: [
        "0 32px 80px rgba(0,0,0,0.65)",
        "0 0 0 1px rgba(255,255,255,0.1)",
        "inset 0 1px 0 rgba(255,255,255,0.12)",
        "inset 0 -1px 0 rgba(0,0,0,0.5)",
      ].join(", "),
      ...style,
    }}>
      {/* Top specular highlight */}
      <div style={{
        position: "absolute", top: 0, left: "25%", right: "25%", height: 1,
        background: "linear-gradient(to right, transparent, rgba(255,255,255,0.22), transparent)",
      }} />
      {/* Volume buttons */}
      <div style={{ position: "absolute", left: -3, top: 72, width: 3, height: 26, background: "linear-gradient(to right, #111, #2a2a2a)", borderRadius: "2px 0 0 2px", boxShadow: "-1px 0 2px rgba(0,0,0,0.4)" }} />
      <div style={{ position: "absolute", left: -3, top: 106, width: 3, height: 26, background: "linear-gradient(to right, #111, #2a2a2a)", borderRadius: "2px 0 0 2px", boxShadow: "-1px 0 2px rgba(0,0,0,0.4)" }} />
      {/* Power button */}
      <div style={{ position: "absolute", right: -3, top: 92, width: 3, height: 42, background: "linear-gradient(to left, #111, #2a2a2a)", borderRadius: "0 2px 2px 0", boxShadow: "1px 0 2px rgba(0,0,0,0.4)" }} />
      {/* Screen */}
      <div style={{ position: "relative", borderRadius: 28, overflow: "hidden", background: "#000" }}>
        {/* Status bar with punch-hole camera */}
        <div style={{
          background: "#000", height: 26,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: 10, height: 10, background: "#1c1c1c", borderRadius: "50%",
            boxShadow: "0 0 0 1px #2d2d2d, inset 0 1px 2px rgba(0,0,0,0.6)",
          }} />
        </div>
        <img src={src} alt={alt} style={{ width: "100%", display: "block" }} />
        {/* Screen glare overlay */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 50%)",
        }} />
        {/* Inner shadow */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          boxShadow: "inset 0 0 24px rgba(0,0,0,0.2)",
        }} />
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

  const [activeSection, setActiveSection] = useState("");
  useEffect(() => {
    const ids = ["features", "how-it-works", "mobile-app"];
    const observers = ids.map(id => {
      const el = document.getElementById(id);
      if (!el) return null;
      const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setActiveSection(id); }, { threshold: 0.25 });
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach(o => o?.disconnect());
  }, []);

  function smoothScroll(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (!href.startsWith("#")) return;
    e.preventDefault();
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#1a2e1a", overflowX: "hidden", maxWidth: "100vw" }}>
      <style>{`
        html, body { overflow-x: hidden; max-width: 100vw; }
        html { scroll-behavior: smooth; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(32px); } to { opacity:1; transform:translateY(0); } }
        @keyframes float { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-10px); } }
        @keyframes floatL { 0%,100% { transform:rotate(-7deg) translateY(0); } 50% { transform:rotate(-7deg) translateY(-8px); } }
        @keyframes floatR { 0%,100% { transform:rotate(7deg) translateY(0); } 50% { transform:rotate(7deg) translateY(-8px); } }
        @keyframes pulse { 0%,100% { box-shadow:0 0 0 0 rgba(82,183,136,0.4); } 50% { box-shadow:0 0 0 8px rgba(82,183,136,0); } }
        @keyframes navDot { from { transform:scaleX(0); opacity:0; } to { transform:scaleX(1); opacity:1; } }
        .hero-badge { animation: fadeUp 0.6s ease 0.1s both; }
        .hero-h1    { animation: fadeUp 0.7s ease 0.25s both; }
        .hero-sub   { animation: fadeUp 0.7s ease 0.4s both; }
        .hero-btns  { animation: fadeUp 0.7s ease 0.55s both; }
        .phone-c    { animation: float 4s ease-in-out 0s infinite; }
        .phone-l    { animation: floatL 4.5s ease-in-out 0.5s infinite; }
        .phone-r    { animation: floatR 4.2s ease-in-out 1s infinite; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.18); transition: all 0.2s; }
        .card-hover:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(1,45,26,0.12); transition: all 0.25s; }
        .apk-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,0.3); transition: all 0.2s; }
        .nav-link { position: relative; transition: color 0.2s; }
        .nav-link::after { content:""; position:absolute; bottom:-4px; left:0; right:0; height:2px; background:#52b788; border-radius:2px; transform:scaleX(0); transition:transform 0.25s cubic-bezier(0.4,0,0.2,1); transform-origin:center; }
        .nav-link:hover::after, .nav-link.active::after { transform:scaleX(1); }
        .nav-link:hover { color:white !important; }
        .nav-link.active { color:white !important; }
        @media (max-width: 768px) {
          .nav-center-links { display: none !important; }
          .nav-signup-text { display: none !important; }
          .hero-cluster { display: none !important; }
          .hero-copy { padding-bottom: 48px !important; }
          .showcase-phones { display: none !important; }
          .lang-photo { display: none !important; }
          .cta-phone { display: none !important; }
          .footer-links { flex-direction: column !important; align-items: flex-start !important; gap: 16px !important; }
        }
      `}</style>

      {/* HERO (nav merged inside) */}
      <section style={{ background: "linear-gradient(155deg, #012d1a 0%, #1b4332 55%, #2d6a4f 100%)", overflow: "hidden" }}>
        <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(1,45,26,0.92)", backdropFilter: "blur(12px)" }}>
          <div style={{ padding: "0 28px", height: 64, display: "flex", alignItems: "center", gap: 32 }}>
            <a href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none", flexShrink: 0 }}>
              <img src="/LabourBook%20Farm-Inspired%20Logo.png" alt="LabourBook" style={{ height: 52 }} />
            </a>
            <div className="nav-center-links" style={{ display: "flex", alignItems: "center", gap: 28, flex: 1, justifyContent: "center" }}>
              {[
                { label: "Features", href: "#features", section: "features" },
                { label: "How it works", href: "#how-it-works", section: "how-it-works" },
                { label: "Mobile App", href: "#mobile-app", section: "mobile-app" },
                { label: "Pricing", href: "/pricing", section: "" },
              ].map(({ label, href, section }) => (
                <a key={label} href={href}
                  onClick={href.startsWith("#") ? (e) => smoothScroll(e, href) : undefined}
                  className={`nav-link${section && activeSection === section ? " active" : ""}`}
                  style={{ color: activeSection === section && section ? "white" : "rgba(255,255,255,0.75)", textDecoration: "none", fontSize: 15, fontWeight: 500 }}>{label}</a>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Link href="/login" style={{
                color: "white", textDecoration: "none", fontSize: 14, fontWeight: 600,
                padding: "8px 18px", borderRadius: 10,
                border: "1.5px solid rgba(255,255,255,0.3)",
                background: "rgba(255,255,255,0.08)",
              }}>Log in</Link>
              <Link href="/signup" className="nav-signup-text" style={{
                background: "white", color: "#012d1a", textDecoration: "none",
                fontSize: 14, fontWeight: 700, padding: "9px 20px", borderRadius: 10,
              }}>Get started free</Link>
            </div>
          </div>
        </nav>

        <div style={{ padding: "72px 24px 96px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 48, flexWrap: "wrap" }}>
            {/* Left copy */}
            <div style={{ flex: "1 1 380px", minWidth: 0, paddingBottom: 72 }}>
              <div className="hero-badge" style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "rgba(107,207,142,0.12)", border: "1px solid rgba(107,207,142,0.28)",
                borderRadius: 100, padding: "5px 16px 5px 6px", marginBottom: 28,
              }}>
                <span style={{ background: "#1b5e35", borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🌿</span>
                <span style={{ color: "#6bcf8e", fontSize: 13, fontWeight: 600 }}>Built for Indian farm owners</span>
              </div>
              <h1 className="hero-h1" style={{ fontSize: "clamp(34px, 5vw, 58px)", fontWeight: 800, color: "white", lineHeight: 1.1, margin: "0 0 20px" }}>
                Manage your<br />farm labour,<br />effortlessly.
              </h1>
              <p className="hero-sub" style={{ color: "#a8d5b5", fontSize: 17, lineHeight: 1.65, margin: "0 0 36px", maxWidth: 440 }}>
                Track attendance, calculate wages, record farm operations and keep your entire workforce organised — all in one place. Works in English, हिंदी and मराठी.
              </p>
              <div className="hero-btns" style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                <Link href="/signup" className="btn-primary" style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "white", color: "#012d1a", textDecoration: "none",
                  fontWeight: 700, fontSize: 15, padding: "12px 28px", borderRadius: 10,
                  transition: "all 0.2s",
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
            <div className="hero-cluster" style={{ flex: "0 1 500px", position: "relative", height: 460, minWidth: 300 }}>
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

        </div>
      </section>

      {/* APP SHOWCASE */}
      <section id="how-it-works" style={{ background: "#f0fdf4", padding: "88px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <FadeIn>
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

          </FadeIn>
          {/* 3 phones with real screenshots */}
          <div className="showcase-phones" style={{ display: "flex", gap: 32, justifyContent: "center", alignItems: "flex-start", flexWrap: "wrap" as const, marginBottom: 52 }}>
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
              <div key={title} className="card-hover" style={{ background: "#f8fef9", border: "1px solid #e2f0e7", borderRadius: 16, padding: "24px 22px", transition: "all 0.25s" }}>
                <div style={{ width: 46, height: 46, background: "#d4edda", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#012d1a", marginBottom: 16 }}>{icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#012d1a", marginBottom: 8 }}>{title}</h3>
                <p style={{ color: "#4a7a5a", fontSize: 14, lineHeight: 1.65, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MOBILE APP */}
      <section id="mobile-app" style={{ background: "#012d1a", padding: "88px 24px", overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", left: -60, top: -40, fontSize: 280, opacity: 0.03, lineHeight: 1, pointerEvents: "none" as const }}>📱</div>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", gap: 56, alignItems: "center", flexWrap: "wrap" as const }}>
          <div style={{ flex: "1 1 340px" }}>
            <p style={{ color: "#6bcf8e", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 16 }}>Mobile App</p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, color: "white", lineHeight: 1.15, marginBottom: 16 }}>
              Manage your farm<br />from anywhere
            </h2>
            <p style={{ color: "#a8d5b5", fontSize: 16, lineHeight: 1.65, marginBottom: 36, maxWidth: 400 }}>
              The LabourBook mobile app works on Android. Mark attendance, record payments and track operations right from your field.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" as const }}>
              <a
                href="https://expo.dev/artifacts/eas/xKHfPRFuhPrf9QKxv3xmNNs8c17n30BvF41sTKGEswQ.apk"
                download
                className="apk-btn"
                style={{ transition: "all 0.2s",
                  display: "inline-flex", alignItems: "center", gap: 10,
                  background: "white", color: "#012d1a", textDecoration: "none",
                  fontWeight: 700, fontSize: 15, padding: "13px 28px", borderRadius: 12,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                }}>
                <span style={{ fontSize: 20 }}>⬇</span>
                Download APK for Android
              </a>
            </div>
            <p style={{ color: "#4a7a5a", fontSize: 13, marginTop: 14 }}>
              Direct download · No Play Store required
            </p>
          </div>
          {/* Phone preview */}
          <div className="cta-phone" style={{ flex: "0 1 200px", transform: "rotate(-3deg)", opacity: 0.92 }}>
            <PhoneFrame src={IMG.dashboard} alt="LabourBook mobile app" />
          </div>
        </div>
      </section>

      {/* LANGUAGE SECTION */}
      <section style={{ background: "#f7fdf9", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "stretch", flexWrap: "wrap" as const }}>
          {/* Photo — full bleed left */}
          <div className="lang-photo" style={{ flex: "1 1 420px", minHeight: 400, position: "relative" }}>
            <img
              src="/Farmer%20Using%20LabourBook%20in%20Vineyard.png"
              alt="Farmer using LabourBook in vineyard"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            {/* Fade edges into background */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: "linear-gradient(to right, rgba(247,253,249,0.18) 0%, transparent 15%, transparent 50%, rgba(247,253,249,0.6) 75%, rgba(247,253,249,0.97) 100%)",
            }} />
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: "linear-gradient(to bottom, rgba(247,253,249,0.4) 0%, transparent 15%, transparent 80%, rgba(247,253,249,0.4) 100%)",
            }} />
          </div>
          {/* Text — right panel */}
          <div style={{ flex: "1 1 380px", padding: "72px 56px 72px 52px", position: "relative", overflow: "hidden", background: "#f7fdf9" }}>
            {/* Leaf decoration */}
            <div style={{ position: "absolute", right: -20, bottom: -20, fontSize: 160, opacity: 0.12, lineHeight: 1, pointerEvents: "none" as const, transform: "rotate(-20deg)" }}>🍃</div>
            <div style={{ position: "absolute", right: 40, top: -10, fontSize: 100, opacity: 0.08, lineHeight: 1, pointerEvents: "none" as const, transform: "rotate(15deg)" }}>🌿</div>
            <p style={{ color: "#52b788", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", marginBottom: 16, textTransform: "uppercase" as const }}>Designed for Indian Farms</p>
            <h2 style={{ fontSize: "clamp(24px, 3vw, 36px)", fontWeight: 800, color: "#012d1a", lineHeight: 1.2, marginBottom: 16 }}>
              Simple, practical and<br />available in your language
            </h2>
            <p style={{ color: "#4a7a5a", fontSize: 16, lineHeight: 1.65, marginBottom: 32, maxWidth: 400 }}>
              LabourBook is designed for Indian farm owners, with support for English, हिंदी and मराठी. A clean and easy-to-use interface that works for farms of all sizes.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const }}>
              {[["English", true], ["हिंदी", false], ["मराठी", false]].map(([lang, active]) => (
                <div key={String(lang)} style={{
                  padding: "10px 24px", borderRadius: 10,
                  background: active ? "#d4edda" : "transparent",
                  border: active ? "none" : "1.5px solid #b2d8bb",
                  color: "#012d1a",
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
          <div className="cta-phone" style={{ flex: "0 1 210px", transform: "rotate(3deg)" }}>
            <PhoneFrame src={IMG.dashboard} alt="LabourBook Dashboard" />
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#010f08", padding: "36px 24px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap" as const, gap: 32, marginBottom: 28 }}>
            <div>
              <p style={{ color: "#4a7a5a", fontSize: 13, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 12px" }}>Contact</p>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                <a href="tel:+917385990561" style={{ color: "#6a9a7a", textDecoration: "none", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>📞</span> +91 73859 90561
                </a>
                <a href="mailto:tanishqkokane@gmail.com" style={{ color: "#6a9a7a", textDecoration: "none", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>✉️</span> tanishqkokane@gmail.com
                </a>
              </div>
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" as const, alignItems: "flex-start" }}>
              {[
                { label: "Features", href: "#features" },
                { label: "How it works", href: "#how-it-works" },
                { label: "Mobile App", href: "#mobile-app" },
                { label: "Pricing", href: "/pricing" },
              ].map(({ label, href }) => (
                <a key={label} href={href} style={{ color: "#2d5038", textDecoration: "none", fontSize: 14 }}>{label}</a>
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
