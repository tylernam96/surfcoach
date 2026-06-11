"use client";

import VideoUploader from "@/components/VideoUploader";
import { Nav, WaveDivider, SectionLabel, SectionHeading } from "@/components/UI";
import { useRouter } from "next/navigation";

const BULLETS = [
  "Analyses your surfing with precision no human coach can match.",
  "Delivers the exact fix YOU need — based on your real biomechanical data.",
  "Measures your form against elite surfers to show exactly where you stack up.",
  "Works on any clip — side-on, behind, or drone footage.",
  "Placeholder bullet point five — edit me.",
];

const FEATURES = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 3l-3.5 8h7L10 17" stroke="#0e7490" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    iconBg: "bg-ocean-teal/20",
    title: "Knee bend",
    desc: "Track compression depth on both legs across the whole ride.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 10a6 6 0 0112 0" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10 4v3M4 10h3M13 10h3" stroke="#d97706" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
    iconBg: "bg-amber-500/15",
    title: "Hip hinge",
    desc: "Detect weight stacking — forward over fins vs. centred.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M5 10h10M10 5l5 5-5 5" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    iconBg: "bg-coral/10",
    title: "Shoulder rotation",
    desc: "Measure how your upper body opens to drive speed and direction.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="8" r="3.5" stroke="#38bdf8" strokeWidth="1.4" />
        <path d="M6.5 17c0-1.93 1.57-3.5 3.5-3.5s3.5 1.57 3.5 3.5" stroke="#38bdf8" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
    iconBg: "bg-ocean-light/15",
    title: "Gaze direction",
    desc: "Spots board-watching — the #1 habit that kills speed.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="4" y="8" width="12" height="8" rx="2" stroke="#22c55e" strokeWidth="1.4" />
        <path d="M7.5 8V6a2.5 2.5 0 015 0v2" stroke="#22c55e" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
    iconBg: "bg-green-500/15",
    title: "Stance width",
    desc: "Check foot placement relative to your height and board size.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 14c2-4 4-2 6-5 2-3 4-1 6-5" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    iconBg: "bg-purple-500/15",
    title: "Centre of mass",
    desc: "Reveals whether you're riding a compression arc or surfing flat.",
  },
];

export default function Home() {
  return (
    <main className="bg-ocean-deep min-h-screen">
      {/* ── HERO ── */}
      <section
        className="relative min-h-screen flex flex-col overflow-hidden"
        style={{
          background:
            "linear-gradient(160deg, #020c1b 0%, #0a1628 40%, #0c2a4a 70%, #0e3d5c 100%)",
        }}
      >
        <Nav />

        {/* Hero body */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 pb-36">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 bg-ocean-teal/20 border border-ocean-light/25 rounded-full px-3.5 py-1.5 text-[11px] font-medium text-ocean-light tracking-[0.08em] uppercase mb-7">
            <span className="w-1.5 h-1.5 bg-ocean-light rounded-full pulse-dot" />
            AI Surf Coach · Built by surfers, for surfers
          </div>

          <h1
            className="font-serif text-white leading-[1.05] tracking-[-0.05em] mb-6 max-w-3xl"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(42px, 7vw, 76px)",
            }}
          >
            The first AI surf analyzer
            <br />
            <em className="text-ocean-light">built by surfers,</em>
            <br />
            for surfers.
          </h1>

          <p className="text-[17px] font-light text-white/55 max-w-xl leading-relaxed mb-10">
            Surfy looks at your surfing and adapts to fix your stance based on{" "}
            <span className="text-white/80 font-normal">YOUR</span> real-time biomechanical
            data — while measuring you against the best surfers in the world.
          </p>

          {/* Bullet points */}
          <ul className="text-left mb-11 space-y-3 max-w-lg w-full">
            {BULLETS.map((b, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-[3px] flex-shrink-0 w-5 h-5 rounded-full bg-ocean-teal/30 border border-ocean-light/30 flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 3" stroke="#38bdf8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="text-[15px] text-white/65 leading-snug">{b}</span>
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <a
              href="/pricing"
              className="inline-flex items-center gap-2 bg-ocean-light text-ocean-deep font-semibold text-[15px] px-8 py-4 rounded-xl hover:bg-ocean-hover transition-all hover:-translate-y-0.5 shadow-lg shadow-ocean-light/20"
            >
              Let&rsquo;s Get Started
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 bg-transparent text-white/65 border border-white/15 font-light text-[15px] px-7 py-3.5 rounded-xl hover:border-white/35 hover:text-white transition-all"
            >
              View sessions
            </a>
          </div>
        </div>

        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0 z-0">
          <WaveDivider />
        </div>
      </section>

      {/* ── UPLOAD ── */}
      <section id="upload" className="bg-ocean-card py-24 px-12">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <SectionLabel>Upload</SectionLabel>
          <SectionHeading className="text-[clamp(36px,5vw,52px)] mb-4">
            Drop your clip.
            <br />
            <em className="text-ocean-light">We&rsquo;ll do the rest.</em>
          </SectionHeading>
          <p className="text-[16px] font-light text-white/45 leading-relaxed">
            Works with any angle — side-on, behind, or drone. The AI adapts to
            what it can see.
          </p>
        </div>
        <VideoUploader />
      </section>

      {/* ── FEATURES ── */}
      <section className="bg-ocean-dark py-24 px-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <SectionLabel>What we analyse</SectionLabel>
            <SectionHeading className="text-[clamp(36px,5vw,52px)]">
              Nine metrics.{" "}
              <em className="text-ocean-light">One complete picture.</em>
            </SectionHeading>
          </div>

          <div
            className="grid grid-cols-3 gap-px rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.04)" }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-ocean-card hover:bg-[#0c1830] transition-colors p-8"
              >
                <div
                  className={`w-11 h-11 rounded-[11px] ${f.iconBg} flex items-center justify-center mb-5`}
                >
                  {f.icon}
                </div>
                <h3
                  className="font-serif text-[19px] text-white mb-2"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {f.title}
                </h3>
                <p className="text-[13px] text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#040a14] px-12 py-12 flex items-center justify-between border-t border-white/5">
        <span className="font-serif text-[18px] text-white/40" style={{ fontFamily: "var(--font-serif)" }}>
          Surfy
        </span>
        <div className="flex gap-6">
          {["Privacy", "Terms", "GitHub"].map((l) => (
            <a key={l} href="#" className="text-[13px] text-white/30 hover:text-white/60 transition-colors no-underline">
              {l}
            </a>
          ))}
        </div>
        <span className="text-[12px] text-white/20">© 2026 Surfy</span>
      </footer>
    </main>
  );
}