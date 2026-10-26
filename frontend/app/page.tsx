import Link from "next/link";

// ─── Phone SVG Components ─────────────────────────────────────────────────────

function PhoneDashboard({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 220 450" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "auto", filter: "drop-shadow(0 24px 48px rgba(1,45,26,0.4))", ...style }}>
      <rect x="2" y="2" width="216" height="446" rx="30" fill="#0d1f14" stroke="#2a4a33" strokeWidth="2"/>
      <rect x="10" y="10" width="200" height="430" rx="24" fill="#f8fef9"/>
      <rect x="82" y="14" width="56" height="11" rx="5.5" fill="#0d1f14"/>
      <text x="20" y="34" fontSize="9" fill="#555" fontFamily="system-ui,sans-serif" fontWeight="600">9:41</text>
      <rect x="10" y="10" width="200" height="72" rx="24" fill="#012d1a"/>
      <rect x="10" y="46" width="200" height="36" fill="#012d1a"/>
      <text x="130" y="28" fontSize="7" fill="rgba(255,255,255,0.45)" fontFamily="system-ui,sans-serif" fontWeight="600">LABOURBOOK</text>
      <text x="130" y="38" fontSize="7.5" fill="rgba(255,255,255,0.6)" fontFamily="system-ui,sans-serif">Dashboard</text>
      <text x="22" y="58" fontSize="8.5" fill="#6bcf8e" fontFamily="system-ui,sans-serif">26 October 2026</text>
      <text x="22" y="74" fontSize="12" fill="white" fontFamily="system-ui,sans-serif" fontWeight="700">Good afternoon, Deepak</text>
      <rect x="18" y="94" width="184" height="34" rx="8" fill="#fff8e1"/>
      <rect x="18" y="94" width="5" height="34" rx="2" fill="#ffc107"/>
      <text x="30" y="108" fontSize="8" fill="#7a5c00" fontFamily="system-ui,sans-serif" fontWeight="600">&#8377;36,400 pending</text>
      <text x="30" y="120" fontSize="7" fill="#9a7a00" fontFamily="system-ui,sans-serif">Pending awaiting payment &#8211; tap to record</text>
      <rect x="18" y="134" width="184" height="28" rx="8" fill="#e8f5e9"/>
      <rect x="18" y="134" width="5" height="28" rx="2" fill="#4caf50"/>
      <text x="30" y="147" fontSize="8" fill="#2e7d32" fontFamily="system-ui,sans-serif" fontWeight="600">ATTENDANCE MARKED</text>
      <text x="30" y="157" fontSize="7" fill="#388e3c" fontFamily="system-ui,sans-serif">Today&#39;s attendance is recorded</text>
      <rect x="18" y="168" width="184" height="24" rx="7" fill="#012d1a"/>
      <text x="110" y="184" fontSize="9" fill="white" fontFamily="system-ui,sans-serif" textAnchor="middle">Edit Attendance</text>
      <text x="22" y="212" fontSize="7.5" fill="#888" fontFamily="system-ui,sans-serif">TOTAL PAID</text>
      <text x="128" y="212" fontSize="7.5" fill="#888" fontFamily="system-ui,sans-serif">PRESENT TODAY</text>
      <text x="22" y="232" fontSize="20" fill="#012d1a" fontFamily="system-ui,sans-serif" fontWeight="800">&#8377;750</text>
      <text x="128" y="232" fontSize="20" fill="#012d1a" fontFamily="system-ui,sans-serif" fontWeight="800">2</text>
      <text x="128" y="244" fontSize="7" fill="#aaa" fontFamily="system-ui,sans-serif">2 teams &#183; 2 attn</text>
      <line x1="18" y1="254" x2="202" y2="254" stroke="#e8f5e9" strokeWidth="1"/>
      <text x="22" y="270" fontSize="9" fill="#222" fontFamily="system-ui,sans-serif" fontWeight="700">Today&#39;s Attendance</text>
      <text x="165" y="270" fontSize="7.5" fill="#4a9b6f" fontFamily="system-ui,sans-serif">3 present</text>
      <rect x="18" y="276" width="184" height="30" rx="7" fill="white" stroke="#e8f5e9" strokeWidth="1"/>
      <circle cx="33" cy="291" r="9" fill="#4a9b6f"/>
      <text x="33" y="294.5" fontSize="8" fill="white" fontFamily="system-ui,sans-serif" textAnchor="middle" fontWeight="700">D</text>
      <text x="48" y="288" fontSize="8.5" fill="#222" fontFamily="system-ui,sans-serif" fontWeight="600">Deepak Bhangre</text>
      <text x="48" y="298" fontSize="7" fill="#888" fontFamily="system-ui,sans-serif">Present</text>
      <text x="196" y="293" fontSize="9.5" fill="#222" fontFamily="system-ui,sans-serif" fontWeight="700" textAnchor="end">&#8377;400</text>
      <rect x="18" y="310" width="184" height="30" rx="7" fill="white" stroke="#e8f5e9" strokeWidth="1"/>
      <circle cx="33" cy="325" r="9" fill="#7b4f9e"/>
      <text x="33" y="328.5" fontSize="8" fill="white" fontFamily="system-ui,sans-serif" textAnchor="middle" fontWeight="700">V</text>
      <text x="48" y="322" fontSize="8.5" fill="#222" fontFamily="system-ui,sans-serif" fontWeight="600">Vanita Bhangre</text>
      <text x="48" y="332" fontSize="7" fill="#888" fontFamily="system-ui,sans-serif">Present</text>
      <text x="196" y="327" fontSize="9.5" fill="#222" fontFamily="system-ui,sans-serif" fontWeight="700" textAnchor="end">&#8377;350</text>
      <rect x="10" y="400" width="200" height="40" fill="white"/>
      <line x1="10" y1="400" x2="210" y2="400" stroke="#e8e8e8" strokeWidth="1"/>
      <rect x="22" y="408" width="30" height="24" rx="6" fill="#e8f5e9"/>
      <text x="37" y="425" fontSize="16" fontFamily="system-ui,sans-serif" textAnchor="middle">&#127968;</text>
      <text x="75" y="425" fontSize="16" fill="#ccc" fontFamily="system-ui,sans-serif" textAnchor="middle">&#128101;</text>
      <text x="110" y="425" fontSize="16" fill="#ccc" fontFamily="system-ui,sans-serif" textAnchor="middle">&#128203;</text>
      <text x="148" y="425" fontSize="16" fill="#ccc" fontFamily="system-ui,sans-serif" textAnchor="middle">&#128202;</text>
      <text x="185" y="425" fontSize="16" fill="#ccc" fontFamily="system-ui,sans-serif" textAnchor="middle">&#9881;</text>
    </svg>
  );
}

function PhoneLabour({ style }: { style?: React.CSSProperties }) {
  const rows = [
    { l: "A", name: "Anjali", color: "#e91e63", bal: "-₹600", red: true },
    { l: "D", name: "Deepak Bhangre", color: "#4a9b6f", bal: "-₹1,000", red: true },
    { l: "O", name: "Omkar", color: "#ff5722", bal: "-₹800", red: true },
    { l: "T", name: "Tanuj", color: "#2196f3", bal: "₹6,400", red: false },
    { l: "V", name: "Vanita Bhangre", color: "#7b4f9e", bal: "+₹1,400", red: false },
  ];
  return (
    <svg viewBox="0 0 220 450" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "auto", filter: "drop-shadow(0 24px 48px rgba(1,45,26,0.4))", ...style }}>
      <rect x="2" y="2" width="216" height="446" rx="30" fill="#0d1f14" stroke="#2a4a33" strokeWidth="2"/>
      <rect x="10" y="10" width="200" height="430" rx="24" fill="#f8fef9"/>
      <rect x="82" y="14" width="56" height="11" rx="5.5" fill="#0d1f14"/>
      <text x="20" y="34" fontSize="9" fill="#555" fontFamily="system-ui,sans-serif" fontWeight="600">9:41</text>
      <rect x="10" y="10" width="200" height="54" rx="24" fill="#012d1a"/>
      <rect x="10" y="36" width="200" height="28" fill="#012d1a"/>
      <text x="130" y="28" fontSize="7" fill="rgba(255,255,255,0.45)" fontFamily="system-ui,sans-serif" fontWeight="600">LABOURBOOK</text>
      <text x="22" y="52" fontSize="13" fill="white" fontFamily="system-ui,sans-serif" fontWeight="700">Labour Directory</text>
      <rect x="158" y="42" width="44" height="20" rx="6" fill="#4a9b6f"/>
      <text x="180" y="55" fontSize="8.5" fill="white" fontFamily="system-ui,sans-serif" textAnchor="middle" fontWeight="600">+ Add Labour</text>
      <rect x="18" y="70" width="184" height="26" rx="8" fill="#e8f5e9"/>
      <rect x="20" y="72" width="88" height="22" rx="6" fill="#012d1a"/>
      <text x="64" y="86" fontSize="8.5" fill="white" fontFamily="system-ui,sans-serif" textAnchor="middle" fontWeight="600">Individual (5)</text>
      <text x="155" y="86" fontSize="8.5" fill="#4a7a5a" fontFamily="system-ui,sans-serif" textAnchor="middle">Teams (3)</text>
      <rect x="18" y="102" width="184" height="24" rx="8" fill="#f0fdf4" stroke="#c8e6c9" strokeWidth="1"/>
      <text x="30" y="118" fontSize="9" fill="#aaa" fontFamily="system-ui,sans-serif">&#128269; Search by name or hometown...</text>
      {rows.map(({ l, name, color, bal, red }, i) => (
        <g key={i}>
          <rect x="18" y={132 + i * 40} width="184" height="34" rx="7" fill="white" stroke="#e8f5e9" strokeWidth="1"/>
          <circle cx="33" cy={132 + i * 40 + 17} r="9" fill={color}/>
          <text x="33" y={132 + i * 40 + 20.5} fontSize="8" fill="white" fontFamily="system-ui,sans-serif" textAnchor="middle" fontWeight="700">{l}</text>
          <text x="48" y={132 + i * 40 + 13} fontSize="8.5" fill="#222" fontFamily="system-ui,sans-serif" fontWeight="600">{name}</text>
          <text x="48" y={132 + i * 40 + 24} fontSize="7" fill="#888" fontFamily="system-ui,sans-serif">&#8377;400/day</text>
          <text x="196" y={132 + i * 40 + 20} fontSize="9" fill={red ? "#e53935" : "#2e7d32"} fontFamily="system-ui,sans-serif" fontWeight="700" textAnchor="end">{bal}</text>
        </g>
      ))}
      <text x="110" y="358" fontSize="7.5" fill="#aaa" fontFamily="system-ui,sans-serif" textAnchor="middle">5 active agricultural workers</text>
      <circle cx="192" cy="380" r="18" fill="#012d1a"/>
      <text x="192" y="386" fontSize="22" fill="white" fontFamily="system-ui,sans-serif" textAnchor="middle">+</text>
      <rect x="10" y="400" width="200" height="40" fill="white"/>
      <line x1="10" y1="400" x2="210" y2="400" stroke="#e8e8e8" strokeWidth="1"/>
      <text x="37" y="425" fontSize="16" fill="#ccc" fontFamily="system-ui,sans-serif" textAnchor="middle">&#127968;</text>
      <rect x="57" y="408" width="30" height="24" rx="6" fill="#e8f5e9"/>
      <text x="75" y="425" fontSize="16" fontFamily="system-ui,sans-serif" textAnchor="middle">&#128101;</text>
      <text x="110" y="425" fontSize="16" fill="#ccc" fontFamily="system-ui,sans-serif" textAnchor="middle">&#128203;</text>
      <text x="148" y="425" fontSize="16" fill="#ccc" fontFamily="system-ui,sans-serif" textAnchor="middle">&#128202;</text>
      <text x="185" y="425" fontSize="16" fill="#ccc" fontFamily="system-ui,sans-serif" textAnchor="middle">&#9881;</text>
    </svg>
  );
}

function PhoneOperations({ style }: { style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 220 450" xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "auto", filter: "drop-shadow(0 24px 48px rgba(1,45,26,0.4))", ...style }}>
      <rect x="2" y="2" width="216" height="446" rx="30" fill="#0d1f14" stroke="#2a4a33" strokeWidth="2"/>
      <rect x="10" y="10" width="200" height="430" rx="24" fill="#f8fef9"/>
      <rect x="82" y="14" width="56" height="11" rx="5.5" fill="#0d1f14"/>
      <text x="20" y="34" fontSize="9" fill="#555" fontFamily="system-ui,sans-serif" fontWeight="600">9:41</text>
      <rect x="10" y="10" width="200" height="54" rx="24" fill="#012d1a"/>
      <rect x="10" y="36" width="200" height="28" fill="#012d1a"/>
      <text x="130" y="28" fontSize="7" fill="rgba(255,255,255,0.45)" fontFamily="system-ui,sans-serif" fontWeight="600">LABOURBOOK</text>
      <text x="22" y="52" fontSize="13" fill="white" fontFamily="system-ui,sans-serif" fontWeight="700">Operations</text>
      <text x="22" y="80" fontSize="8" fill="#888" fontFamily="system-ui,sans-serif" fontWeight="600">PLOT</text>
      <rect x="18" y="84" width="184" height="26" rx="7" fill="white" stroke="#e0e0e0" strokeWidth="1"/>
      <text x="30" y="101" fontSize="10" fill="#222" fontFamily="system-ui,sans-serif" fontWeight="600">ARA 35</text>
      <text x="190" y="101" fontSize="9" fill="#888" fontFamily="system-ui,sans-serif" textAnchor="end">&#9660;</text>
      <text x="22" y="124" fontSize="8" fill="#888" fontFamily="system-ui,sans-serif" fontWeight="600">SEASON</text>
      <rect x="18" y="128" width="184" height="26" rx="7" fill="white" stroke="#e0e0e0" strokeWidth="1"/>
      <text x="30" y="145" fontSize="10" fill="#222" fontFamily="system-ui,sans-serif" fontWeight="600">2025</text>
      <text x="190" y="145" fontSize="9" fill="#888" fontFamily="system-ui,sans-serif" textAnchor="end">&#9660;</text>
      <text x="22" y="168" fontSize="8" fill="#888" fontFamily="system-ui,sans-serif" fontWeight="600">STAGE</text>
      <rect x="18" y="172" width="184" height="26" rx="7" fill="white" stroke="#e0e0e0" strokeWidth="1"/>
      <text x="30" y="189" fontSize="10" fill="#222" fontFamily="system-ui,sans-serif" fontWeight="600">Fruit Production</text>
      <text x="190" y="189" fontSize="9" fill="#888" fontFamily="system-ui,sans-serif" textAnchor="end">&#9660;</text>
      <rect x="18" y="206" width="184" height="28" rx="8" fill="#f0f0f0"/>
      <rect x="20" y="208" width="48" height="24" rx="6" fill="white"/>
      <text x="44" y="223" fontSize="7.5" fill="#012d1a" fontFamily="system-ui,sans-serif" textAnchor="middle" fontWeight="600">Spraying</text>
      <text x="93" y="223" fontSize="7.5" fill="#888" fontFamily="system-ui,sans-serif" textAnchor="middle">Labour Work</text>
      <text x="140" y="223" fontSize="7.5" fill="#888" fontFamily="system-ui,sans-serif" textAnchor="middle">Fertigation</text>
      <text x="185" y="223" fontSize="7.5" fill="#888" fontFamily="system-ui,sans-serif" textAnchor="middle">Other</text>
      <rect x="18" y="244" width="184" height="54" rx="9" fill="white" stroke="#e8f5e9" strokeWidth="1"/>
      <circle cx="34" cy="263" r="10" fill="#e8f5e9"/>
      <text x="34" y="267" fontSize="12" fontFamily="system-ui,sans-serif" textAnchor="middle">&#127807;</text>
      <text x="50" y="259" fontSize="9.5" fill="#333" fontFamily="system-ui,sans-serif" fontWeight="700">Other</text>
      <text x="196" y="259" fontSize="8" fill="#888" fontFamily="system-ui,sans-serif" textAnchor="end">24 Oct</text>
      <text x="50" y="272" fontSize="8" fill="#888" fontFamily="system-ui,sans-serif">Macrofer 0.5ml</text>
      <text x="50" y="284" fontSize="7.5" fill="#bbb" fontFamily="system-ui,sans-serif">No workers assigned</text>
      <circle cx="192" cy="378" r="18" fill="#012d1a"/>
      <text x="192" y="384" fontSize="22" fill="white" fontFamily="system-ui,sans-serif" textAnchor="middle">+</text>
      <rect x="10" y="400" width="200" height="40" fill="white"/>
      <line x1="10" y1="400" x2="210" y2="400" stroke="#e8e8e8" strokeWidth="1"/>
      <text x="37" y="425" fontSize="16" fill="#ccc" fontFamily="system-ui,sans-serif" textAnchor="middle">&#127968;</text>
      <text x="75" y="425" fontSize="16" fill="#ccc" fontFamily="system-ui,sans-serif" textAnchor="middle">&#128101;</text>
      <rect x="95" y="408" width="30" height="24" rx="6" fill="#e8f5e9"/>
      <text x="110" y="425" fontSize="16" fontFamily="system-ui,sans-serif" textAnchor="middle">&#128203;</text>
      <text x="148" y="425" fontSize="16" fill="#ccc" fontFamily="system-ui,sans-serif" textAnchor="middle">&#128202;</text>
      <text x="185" y="425" fontSize="16" fill="#ccc" fontFamily="system-ui,sans-serif" textAnchor="middle">&#9881;</text>
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div style={{ fontFamily: "Inter, system-ui, -apple-system, sans-serif", color: "#1a2e1a", overflowX: "hidden" }}>

      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "white", borderBottom: "1px solid #e2f0e7",
        boxShadow: "0 1px 12px rgba(1,45,26,0.06)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", gap: 32 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none", flexShrink: 0 }}>
            <img src="/LabourBook%20Farm-Inspired%20Logo.png" alt="LabourBook" style={{ height: 36 }} />
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 28, flex: 1 }}>
            {["Features", "How it works", "Mobile App", "Pricing"].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`}
                style={{ color: "#4a5568", textDecoration: "none", fontSize: 15, fontWeight: 500 }}>{l}</a>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Link href="/login" style={{ color: "#012d1a", textDecoration: "none", fontSize: 15, fontWeight: 600 }}>Log in</Link>
            <Link href="/signup" style={{
              background: "#012d1a", color: "white", textDecoration: "none",
              fontSize: 14, fontWeight: 700, padding: "10px 22px", borderRadius: 10,
            }}>Get started free</Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ background: "linear-gradient(155deg, #012d1a 0%, #1b4332 55%, #2d6a4f 100%)", padding: "72px 24px 0", overflow: "hidden" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", gap: 48, flexWrap: "wrap" }}>
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
          <div style={{ flex: "0 1 500px", position: "relative", height: 440, minWidth: 300 }}>
            <div style={{ position: "absolute", left: 0, top: 44, width: 162, transform: "rotate(-7deg)", opacity: 0.82 }}>
              <PhoneOperations />
            </div>
            <div style={{ position: "absolute", left: "50%", top: 0, width: 208, transform: "translateX(-50%)", zIndex: 2 }}>
              <PhoneDashboard />
            </div>
            <div style={{ position: "absolute", right: 0, top: 52, width: 156, transform: "rotate(7deg)", opacity: 0.82 }}>
              <PhoneLabour />
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
          <div style={{ display: "flex", gap: 28, justifyContent: "center", flexWrap: "wrap" as const, marginBottom: 52 }}>
            <div style={{ flex: "0 1 240px" }}><PhoneDashboard /></div>
            <div style={{ flex: "0 1 240px" }}><PhoneLabour /></div>
            <div style={{ flex: "0 1 240px" }}><PhoneOperations /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 28 }}>
            {[
              { icon: "📊", title: "Dashboard", desc: "See attendance, payments and farm activity summary at a glance." },
              { icon: "👥", title: "People", desc: "Manage individual labourers, teams, wages and balances easily." },
              { icon: "🌾", title: "Operations", desc: "Record spraying, fertigation, labour work and other farm activities by plot, season and stage." },
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
          <div style={{ flex: "0 1 220px", transform: "rotate(3deg)" }}>
            <PhoneDashboard />
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
