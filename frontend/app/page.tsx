import Link from "next/link";

/* ─── Phone Mockup SVGs ─────────────────────────────────────────────────────── */

function PhoneDashboard() {
  return (
    <svg viewBox="0 0 280 560" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full drop-shadow-2xl">
      {/* Frame */}
      <rect x="2" y="2" width="276" height="556" rx="38" fill="#111827" />
      <rect x="8" y="8" width="264" height="544" rx="34" fill="#fcf9f8" />
      {/* Notch */}
      <rect x="100" y="12" width="80" height="20" rx="10" fill="#111827" />
      {/* Status bar */}
      <text x="24" y="48" fontSize="10" fill="#6b7280" fontFamily="Inter,sans-serif">9:41</text>
      <text x="230" y="48" fontSize="10" fill="#6b7280" fontFamily="Inter,sans-serif">●●●</text>

      {/* Header */}
      <rect x="8" y="56" width="264" height="52" fill="#012d1d" />
      <text x="28" y="88" fontSize="16" fontWeight="700" fill="white" fontFamily="Inter,sans-serif">LabourBook</text>
      <text x="215" y="88" fontSize="11" fill="#c1ecd4" fontFamily="Inter,sans-serif">Oct 26</text>

      {/* Greeting */}
      <text x="24" y="130" fontSize="13" fontWeight="700" fill="#1b1c1c" fontFamily="Inter,sans-serif">Good morning, Rajesh 👋</text>
      <text x="24" y="148" fontSize="10" fill="#717973" fontFamily="Inter,sans-serif">Sunday, 26 October 2026</text>

      {/* Stat cards */}
      <rect x="20" y="160" width="112" height="72" rx="12" fill="#012d1d" />
      <text x="32" y="185" fontSize="9" fill="#c1ecd4" fontFamily="Inter,sans-serif">PRESENT TODAY</text>
      <text x="32" y="210" fontSize="24" fontWeight="800" fill="white" fontFamily="Inter,sans-serif">24</text>
      <text x="68" y="210" fontSize="10" fill="#86af99" fontFamily="Inter,sans-serif">/ 32</text>

      <rect x="144" y="160" width="112" height="72" rx="12" fill="#1b4332" />
      <text x="156" y="185" fontSize="9" fill="#c1ecd4" fontFamily="Inter,sans-serif">WAGES DUE</text>
      <text x="156" y="210" fontSize="18" fontWeight="800" fill="white" fontFamily="Inter,sans-serif">₹1.2L</text>

      <rect x="20" y="244" width="112" height="72" rx="12" fill="#f6f3f2" stroke="#c1c8c2" strokeWidth="1" />
      <text x="32" y="269" fontSize="9" fill="#717973" fontFamily="Inter,sans-serif">TOTAL PAID</text>
      <text x="32" y="294" fontSize="18" fontWeight="800" fill="#012d1d" fontFamily="Inter,sans-serif">₹84,200</text>

      <rect x="144" y="244" width="112" height="72" rx="12" fill="#f6f3f2" stroke="#c1c8c2" strokeWidth="1" />
      <text x="156" y="269" fontSize="9" fill="#717973" fontFamily="Inter,sans-serif">OPERATIONS</text>
      <text x="156" y="294" fontSize="18" fontWeight="800" fill="#012d1d" fontFamily="Inter,sans-serif">12</text>

      {/* Recent section */}
      <text x="24" y="340" fontSize="11" fontWeight="700" fill="#012d1d" fontFamily="Inter,sans-serif">Recent Activity</text>

      {[
        { name: "Deepak Jadhav", status: "P", statusColor: "#012d1d", statusBg: "#c1ecd4", wage: "₹450" },
        { name: "Shinde Team", status: "P", statusColor: "#012d1d", statusBg: "#c1ecd4", wage: "₹5,400" },
        { name: "Priya More", status: "H", statusColor: "#6b4c04", statusBg: "#fef3c7", wage: "₹225" },
        { name: "Suresh Kale", status: "A", statusColor: "#ba1a1a", statusBg: "#ffdad6", wage: "₹0" },
      ].map((row, i) => (
        <g key={i}>
          <rect x="20" y={358 + i * 42} width="236" height="36" rx="8" fill="white" stroke="#e4e2e1" strokeWidth="1" />
          <circle cx="40" cy={376 + i * 42} r="10" fill="#c1ecd4" />
          <text x="36" y={380 + i * 42} fontSize="9" fontWeight="700" fill="#012d1d" fontFamily="Inter,sans-serif">{row.name[0]}</text>
          <text x="56" y={374 + i * 42} fontSize="10" fontWeight="600" fill="#1b1c1c" fontFamily="Inter,sans-serif">{row.name}</text>
          <text x="56" y={386 + i * 42} fontSize="9" fill="#717973" fontFamily="Inter,sans-serif">Daily labour</text>
          <rect x="170" y={364 + i * 42} width="18" height="18" rx="4" fill={row.statusBg} />
          <text x="175" y={377 + i * 42} fontSize="9" fontWeight="700" fill={row.statusColor} fontFamily="Inter,sans-serif">{row.status}</text>
          <text x="196" y={377 + i * 42} fontSize="10" fontWeight="600" fill="#1b1c1c" fontFamily="Inter,sans-serif">{row.wage}</text>
        </g>
      ))}

      {/* Bottom nav */}
      <rect x="8" y="510" width="264" height="42" rx="0" fill="white" />
      <line x1="8" y1="510" x2="272" y2="510" stroke="#e4e2e1" strokeWidth="1" />
      {["⊞", "👥", "📅", "🌱", "···"].map((icon, i) => (
        <text key={i} x={36 + i * 52} y="536" fontSize="14" textAnchor="middle" fill={i === 0 ? "#012d1d" : "#717973"} fontFamily="Inter,sans-serif">{icon}</text>
      ))}
    </svg>
  );
}

function PhoneAttendance() {
  return (
    <svg viewBox="0 0 280 560" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full drop-shadow-2xl">
      <rect x="2" y="2" width="276" height="556" rx="38" fill="#111827" />
      <rect x="8" y="8" width="264" height="544" rx="34" fill="#fcf9f8" />
      <rect x="100" y="12" width="80" height="20" rx="10" fill="#111827" />
      <text x="24" y="48" fontSize="10" fill="#6b7280" fontFamily="Inter,sans-serif">9:41</text>

      <rect x="8" y="56" width="264" height="52" fill="#012d1d" />
      <text x="28" y="88" fontSize="16" fontWeight="700" fill="white" fontFamily="Inter,sans-serif">Attendance</text>

      {/* Week nav */}
      <rect x="20" y="120" width="236" height="40" rx="10" fill="white" stroke="#e4e2e1" strokeWidth="1" />
      <text x="36" y="145" fontSize="14" fill="#012d1d" fontFamily="Inter,sans-serif">‹</text>
      <text x="100" y="145" fontSize="11" fontWeight="600" fill="#1b1c1c" fontFamily="Inter,sans-serif">21–27 Oct 2026</text>
      <text x="240" y="145" fontSize="14" fill="#c1c8c2" fontFamily="Inter,sans-serif">›</text>

      {/* Day chips */}
      {["M","T","W","T","F","S","S"].map((d, i) => (
        <g key={i}>
          <rect x={20 + i * 34} y="172" width="28" height="44" rx="8" fill={i === 5 ? "#012d1d" : "#f6f3f2"} />
          <text x={34 + i * 34} y="190" fontSize="9" fontWeight="700" textAnchor="middle" fill={i === 5 ? "#c1ecd4" : "#717973"} fontFamily="Inter,sans-serif">{d}</text>
          <text x={34 + i * 34} y="208" fontSize="12" fontWeight="700" textAnchor="middle" fill={i === 5 ? "white" : "#1b1c1c"} fontFamily="Inter,sans-serif">{21 + i}</text>
        </g>
      ))}

      {/* Mark Day tab */}
      <rect x="20" y="228" width="114" height="32" rx="8" fill="#012d1d" />
      <rect x="142" y="228" width="114" height="32" rx="8" fill="#f0eded" />
      <text x="77" y="249" fontSize="11" fontWeight="700" textAnchor="middle" fill="white" fontFamily="Inter,sans-serif">Mark Day</text>
      <text x="199" y="249" fontSize="11" fontWeight="600" textAnchor="middle" fill="#717973" fontFamily="Inter,sans-serif">Week History</text>

      {/* Labour rows */}
      {[
        { name: "Deepak Jadhav", sub: "₹450/day", status: "P", color: "#012d1d", bg: "#c1ecd4" },
        { name: "Priya More", sub: "₹380/day", status: "H", color: "#6b4c04", bg: "#fef3c7" },
        { name: "Ramesh Patil", sub: "₹450/day", status: "A", color: "#ba1a1a", bg: "#ffdad6" },
        { name: "Shinde Team", sub: "12 workers", status: "P", color: "#012d1d", bg: "#c1ecd4" },
        { name: "Gaikwad Team", sub: "8 workers", status: "", color: "#717973", bg: "#f0eded" },
      ].map((r, i) => (
        <g key={i}>
          <rect x="20" y={272 + i * 46} width="236" height="40" rx="8" fill="white" stroke="#e4e2e1" strokeWidth="1" />
          <circle cx="42" cy={292 + i * 46} r="12" fill="#c1ecd4" />
          <text x="38" y={296 + i * 46} fontSize="10" fontWeight="700" fill="#012d1d" fontFamily="Inter,sans-serif">{r.name[0]}</text>
          <text x="62" y={288 + i * 46} fontSize="10" fontWeight="600" fill="#1b1c1c" fontFamily="Inter,sans-serif">{r.name}</text>
          <text x="62" y={300 + i * 46} fontSize="9" fill="#717973" fontFamily="Inter,sans-serif">{r.sub}</text>
          {["P","H","A"].map((s, j) => (
            <g key={j}>
              <rect x={172 + j * 26} y={280 + i * 46} width="22" height="22" rx="6"
                fill={r.status === s ? r.bg : "#f6f3f2"}
                stroke={r.status === s ? r.color : "transparent"} strokeWidth="1.5" />
              <text x={183 + j * 26} y={296 + i * 46} fontSize="9" fontWeight="700" textAnchor="middle"
                fill={r.status === s ? r.color : "#9ca3af"} fontFamily="Inter,sans-serif">{s}</text>
            </g>
          ))}
        </g>
      ))}

      {/* Bottom nav */}
      <rect x="8" y="510" width="264" height="42" rx="0" fill="white" />
      <line x1="8" y1="510" x2="272" y2="510" stroke="#e4e2e1" strokeWidth="1" />
      {["⊞","👥","📅","🌱","···"].map((icon, i) => (
        <text key={i} x={36 + i * 52} y="536" fontSize="14" textAnchor="middle" fill={i === 2 ? "#012d1d" : "#717973"} fontFamily="Inter,sans-serif">{icon}</text>
      ))}
    </svg>
  );
}

function PhoneStatement() {
  return (
    <svg viewBox="0 0 280 560" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full drop-shadow-2xl">
      <rect x="2" y="2" width="276" height="556" rx="38" fill="#111827" />
      <rect x="8" y="8" width="264" height="544" rx="34" fill="#fcf9f8" />
      <rect x="100" y="12" width="80" height="20" rx="10" fill="#111827" />
      <text x="24" y="48" fontSize="10" fill="#6b7280" fontFamily="Inter,sans-serif">9:41</text>

      {/* Nav bar */}
      <rect x="8" y="56" width="264" height="52" fill="white" stroke="#e4e2e1" strokeWidth="0" />
      <line x1="8" y1="108" x2="272" y2="108" stroke="#e4e2e1" strokeWidth="1" />
      <text x="28" y="88" fontSize="18" fill="#012d1d" fontFamily="Inter,sans-serif">←</text>
      <text x="110" y="88" fontSize="14" fontWeight="700" fill="#012d1d" fontFamily="Inter,sans-serif">Deepak Jadhav</text>
      <rect x="218" y="70" width="46" height="26" rx="8" fill="#012d1d" />
      <text x="241" y="88" fontSize="10" fontWeight="700" textAnchor="middle" fill="white" fontFamily="Inter,sans-serif">PDF</text>

      {/* Entity card */}
      <rect x="20" y="120" width="236" height="80" rx="12" fill="white" stroke="#e4e2e1" strokeWidth="1" />
      <circle cx="50" cy="160" r="20" fill="#c1ecd4" />
      <text x="44" y="165" fontSize="14" fontWeight="700" fill="#012d1d" fontFamily="Inter,sans-serif">DJ</text>
      <text x="78" y="148" fontSize="13" fontWeight="700" fill="#012d1d" fontFamily="Inter,sans-serif">Deepak Jadhav</text>
      <text x="78" y="163" fontSize="10" fill="#717973" fontFamily="Inter,sans-serif">Individual Labour · ₹450/day</text>
      <text x="78" y="176" fontSize="10" fill="#717973" fontFamily="Inter,sans-serif">Junnar, Pune</text>
      <text x="174" y="148" fontSize="9" fill="#717973" fontFamily="Inter,sans-serif">PERIOD</text>
      <text x="174" y="163" fontSize="10" fontWeight="700" fill="#1b1c1c" fontFamily="Inter,sans-serif">Oct 2026</text>

      {/* Summary pills */}
      <text x="20" y="222" fontSize="10" fontWeight="700" fill="#012d1d" fontFamily="Inter,sans-serif">SUMMARY</text>
      {[
        { label: "Present", val: "22", bg: "#c1ecd4", color: "#012d1d" },
        { label: "Half Day", val: "3", bg: "#fef3c7", color: "#6b4c04" },
        { label: "Absent", val: "2", bg: "#ffdad6", color: "#ba1a1a" },
        { label: "Earned", val: "₹10,800", bg: "#c1ecd4", color: "#012d1d" },
      ].map((p, i) => (
        <g key={i}>
          <rect x={20 + i * 60} y="232" width="54" height="52" rx="8" fill={p.bg} />
          <text x={47 + i * 60} y="256" fontSize="13" fontWeight="800" textAnchor="middle" fill={p.color} fontFamily="Inter,sans-serif">{p.val}</text>
          <text x={47 + i * 60} y="274" fontSize="7" fontWeight="600" textAnchor="middle" fill={p.color} fontFamily="Inter,sans-serif">{p.label}</text>
        </g>
      ))}

      {/* Work table */}
      <text x="20" y="306" fontSize="10" fontWeight="700" fill="#012d1d" fontFamily="Inter,sans-serif">WORK RECORD</text>
      <rect x="20" y="316" width="236" height="26" rx="6" fill="#012d1d" />
      <text x="28" y="334" fontSize="9" fontWeight="700" fill="#c1ecd4" fontFamily="Inter,sans-serif">Date</text>
      <text x="90" y="334" fontSize="9" fontWeight="700" fill="#c1ecd4" fontFamily="Inter,sans-serif">Status</text>
      <text x="148" y="334" fontSize="9" fontWeight="700" fill="#c1ecd4" fontFamily="Inter,sans-serif">Task</text>
      <text x="210" y="334" fontSize="9" fontWeight="700" fill="#c1ecd4" fontFamily="Inter,sans-serif">Earned</text>

      {[
        { date: "Oct 26", status: "Present", statusC: "#012d1d", task: "Spraying", earned: "₹450" },
        { date: "Oct 25", status: "Present", statusC: "#012d1d", task: "Weeding", earned: "₹450" },
        { date: "Oct 24", status: "Half Day", statusC: "#6b4c04", task: "Fertigation", earned: "₹225" },
        { date: "Oct 23", status: "Present", statusC: "#012d1d", task: "Spraying", earned: "₹450" },
        { date: "Oct 22", status: "Absent", statusC: "#ba1a1a", task: "—", earned: "₹0" },
      ].map((row, i) => (
        <g key={i}>
          <rect x="20" y={342 + i * 28} width="236" height="28" fill={i % 2 === 0 ? "white" : "#f6f3f2"} />
          <text x="28" y={361 + i * 28} fontSize="9" fill="#1b1c1c" fontFamily="Inter,sans-serif">{row.date}</text>
          <text x="90" y={361 + i * 28} fontSize="9" fontWeight="600" fill={row.statusC} fontFamily="Inter,sans-serif">{row.status}</text>
          <text x="148" y={361 + i * 28} fontSize="9" fill="#717973" fontFamily="Inter,sans-serif">{row.task}</text>
          <text x="210" y={361 + i * 28} fontSize="9" fontWeight="700" fill="#1b1c1c" fontFamily="Inter,sans-serif">{row.earned}</text>
        </g>
      ))}

      {/* Balance bar */}
      <rect x="20" y="486" width="236" height="36" rx="8" fill="#012d1d" />
      <text x="32" y="509" fontSize="11" fontWeight="700" fill="#c1ecd4" fontFamily="Inter,sans-serif">Balance Due</text>
      <text x="190" y="509" fontSize="13" fontWeight="800" fill="white" fontFamily="Inter,sans-serif">₹3,600</text>
    </svg>
  );
}

/* ─── Feature Icons ──────────────────────────────────────────────────────────── */

function FeatureIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-12 h-12 rounded-2xl bg-primary-fixed flex items-center justify-center text-2xl mb-4">
      {children}
    </div>
  );
}

/* ─── Landing Page ───────────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Inter, sans-serif" }}>

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#012d1d" }}>
              <span className="text-white text-sm font-bold">L</span>
            </div>
            <span className="font-bold text-lg" style={{ color: "#012d1d" }}>LabourBook</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-gray-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How it works</a>
            <a href="#mobile" className="hover:text-gray-900 transition-colors">Mobile App</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors hover:bg-gray-100" style={{ color: "#012d1d" }}>
              Log in
            </Link>
            <Link href="/signup" className="text-sm font-semibold px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90" style={{ backgroundColor: "#012d1d" }}>
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 px-6" style={{ background: "linear-gradient(160deg, #012d1d 0%, #1b4332 60%, #2d6a4f 100%)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6" style={{ backgroundColor: "#c1ecd420", color: "#c1ecd4", border: "1px solid #c1ecd430" }}>
                🌿 Built for Indian farm owners
              </div>
              <h1 className="text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight mb-6">
                Manage your<br />
                <span style={{ color: "#c1ecd4" }}>farm labour,</span><br />
                effortlessly.
              </h1>
              <p className="text-lg mb-8 leading-relaxed" style={{ color: "#86af99" }}>
                Track attendance, calculate wages, record payments and generate statements — all in one place. Works in English, हिंदी and मराठी.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/signup" className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-base transition-all hover:scale-105" style={{ backgroundColor: "#c1ecd4", color: "#012d1d" }}>
                  Start for free →
                </Link>
                <Link href="/login" className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-base transition-all" style={{ color: "#c1ecd4", border: "1px solid #c1ecd440" }}>
                  Already have an account
                </Link>
              </div>
              <p className="mt-4 text-sm" style={{ color: "#86af99" }}>No credit card required · Free to get started</p>
            </div>
            <div className="relative flex justify-center">
              <div className="w-56 lg:w-64 relative z-10" style={{ transform: "rotate(-4deg)" }}>
                <PhoneDashboard />
              </div>
              <div className="w-48 lg:w-56 absolute right-0 lg:-right-8 top-8" style={{ transform: "rotate(4deg)" }}>
                <PhoneAttendance />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <section className="py-12 px-6 border-b" style={{ backgroundColor: "#f6f3f2" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { num: "500+", label: "Farm owners" },
            { num: "15,000+", label: "Workers tracked" },
            { num: "₹2Cr+", label: "Wages recorded" },
            { num: "3", label: "Languages supported" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-3xl font-extrabold" style={{ color: "#012d1d" }}>{s.num}</div>
              <div className="text-sm mt-1" style={{ color: "#717973" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest mb-3" style={{ color: "#012d1d" }}>FEATURES</p>
            <h2 className="text-4xl font-extrabold tracking-tight" style={{ color: "#012d1d" }}>
              Everything you need to run your farm payroll
            </h2>
            <p className="mt-4 text-lg max-w-2xl mx-auto" style={{ color: "#717973" }}>
              Replace paper registers and WhatsApp notes with a system that does the math, stores the records and generates reports on demand.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                emoji: "📅",
                title: "Daily Attendance",
                desc: "Mark Present, Half Day or Absent for each worker in seconds. Navigate by week. All records sync instantly.",
              },
              {
                emoji: "👥",
                title: "Labour & Teams",
                desc: "Manage individual workers and contractor teams separately. Track daily wage, hometown, phone and balance at a glance.",
              },
              {
                emoji: "💸",
                title: "Payments & Advances",
                desc: "Record cash, UPI and bank transfers. Track advances vs wages earned. See exactly who owes what.",
              },
              {
                emoji: "📄",
                title: "PDF Statements",
                desc: "Generate professional work + payment statements for any period. Share directly from your phone or print them.",
              },
              {
                emoji: "🌱",
                title: "Operations Tracking",
                desc: "Log field operations — Spraying, Fertigation, Weeding — with photos, worker assignments and costs.",
              },
              {
                emoji: "🗺️",
                title: "Plots & Contracts",
                desc: "Map your plots, track crop lifecycle and manage per-plot labour contracts with clear cost visibility.",
              },
            ].map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border transition-shadow hover:shadow-md" style={{ borderColor: "#e4e2e1", backgroundColor: "white" }}>
                <FeatureIcon>{f.emoji}</FeatureIcon>
                <h3 className="font-bold text-lg mb-2" style={{ color: "#012d1d" }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#717973" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── App showcase ───────────────────────────────────────────────────── */}
      <section id="mobile" className="py-24 px-6" style={{ backgroundColor: "#f6f3f2" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest mb-3" style={{ color: "#012d1d" }}>THE APP</p>
            <h2 className="text-4xl font-extrabold tracking-tight" style={{ color: "#012d1d" }}>
              See it in action
            </h2>
            <p className="mt-4 text-lg" style={{ color: "#717973" }}>Available on web and mobile. Works exactly the same on both.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12 items-end">
            <div className="text-center">
              <div className="w-48 mx-auto mb-6">
                <PhoneDashboard />
              </div>
              <h3 className="font-bold text-lg" style={{ color: "#012d1d" }}>Dashboard</h3>
              <p className="text-sm mt-2" style={{ color: "#717973" }}>See today's attendance, wages due and recent activity at a glance.</p>
            </div>
            <div className="text-center">
              <div className="w-48 mx-auto mb-6">
                <PhoneAttendance />
              </div>
              <h3 className="font-bold text-lg" style={{ color: "#012d1d" }}>Attendance</h3>
              <p className="text-sm mt-2" style={{ color: "#717973" }}>Mark P / H / A for every worker. Review the full week in one screen.</p>
            </div>
            <div className="text-center">
              <div className="w-48 mx-auto mb-6">
                <PhoneStatement />
              </div>
              <h3 className="font-bold text-lg" style={{ color: "#012d1d" }}>Statements</h3>
              <p className="text-sm mt-2" style={{ color: "#717973" }}>Generate and share a professional PDF statement for any worker or team.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest mb-3" style={{ color: "#012d1d" }}>HOW IT WORKS</p>
            <h2 className="text-4xl font-extrabold tracking-tight" style={{ color: "#012d1d" }}>
              Set up in under 5 minutes
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {[
              { step: "01", title: "Add your workers", desc: "Enter each labourer's name, daily wage and phone number. Or add a contractor team with its daily rate." },
              { step: "02", title: "Mark attendance daily", desc: "Open the app each morning. Tap P, H or A for each worker. The wages are calculated automatically." },
              { step: "03", title: "Share statements", desc: "At month end, generate a PDF statement for any worker and share it over WhatsApp in one tap." },
            ].map((s) => (
              <div key={s.step} className="relative">
                <div className="text-6xl font-black mb-4" style={{ color: "#c1ecd4" }}>{s.step}</div>
                <h3 className="font-bold text-lg mb-2" style={{ color: "#012d1d" }}>{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#717973" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Language strip ─────────────────────────────────────────────────── */}
      <section className="py-12 px-6" style={{ backgroundColor: "#012d1d" }}>
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm font-semibold mb-4" style={{ color: "#86af99" }}>AVAILABLE IN YOUR LANGUAGE</p>
          <div className="flex flex-wrap justify-center gap-4">
            {[
              { lang: "English", sample: "Present · Absent · Statement" },
              { lang: "हिंदी", sample: "उपस्थित · अनुपस्थित · विवरण" },
              { lang: "मराठी", sample: "उपस्थित · अनुपस्थित · विवरण" },
            ].map((l) => (
              <div key={l.lang} className="px-5 py-3 rounded-xl" style={{ backgroundColor: "#1b4332" }}>
                <div className="font-bold text-sm" style={{ color: "white" }}>{l.lang}</div>
                <div className="text-xs mt-0.5" style={{ color: "#86af99" }}>{l.sample}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-extrabold tracking-tight mb-4" style={{ color: "#012d1d" }}>
            Ready to replace your paper register?
          </h2>
          <p className="text-lg mb-8" style={{ color: "#717973" }}>
            Join hundreds of farm owners who've made the switch. Free to start, no technical knowledge needed.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link href="/signup" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base transition-all hover:scale-105 hover:shadow-lg" style={{ backgroundColor: "#012d1d", color: "white" }}>
              Create your free account →
            </Link>
            <Link href="/login" className="inline-flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-base border transition-colors hover:bg-gray-50" style={{ color: "#012d1d", borderColor: "#c1c8c2" }}>
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="py-10 px-6 border-t" style={{ borderColor: "#e4e2e1" }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#012d1d" }}>
              <span className="text-white text-xs font-bold">L</span>
            </div>
            <span className="font-bold" style={{ color: "#012d1d" }}>LabourBook</span>
          </div>
          <p className="text-xs" style={{ color: "#717973" }}>
            Built for Indian farmers · Pune, Maharashtra
          </p>
          <div className="flex gap-6 text-xs font-medium" style={{ color: "#717973" }}>
            <Link href="/login" className="hover:text-gray-900">Login</Link>
            <Link href="/signup" className="hover:text-gray-900">Sign Up</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
