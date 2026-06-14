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

const PILLARS = [
  {
    id: "position",
    label: "Position",
    tagline: "Balance & Positioning",
    color: "#38bdf8",
    border: "rgba(56,189,248,0.14)",
    glow: "rgba(56,189,248,0.04)",
    summary: "Stability and connection are the names of the game when it comes to surfing waves. Surfy tracks your stance width, weight distribution, and precise rail engagement. By mastering these micro-adjustments, you'll stay completely locked into the wave's power pocket, turning erratic rides into smooth, unbreakable control.",
    metrics: [
      {
        name: "Stance & Balance",
        desc: "Foot width vs. shoulder width, centre of mass over feet, and front/back-foot bias detection.",
      },
      {
        name: "Rail Engagement",
        desc: "Body lean angle via shoulder and hip alignment — are you committing weight to the rail in turns?",
      },
    ],
  },
  {
    id: "power",
    label: "Power",
    tagline: "Speed Generation",
    color: "#f97316",
    border: "rgba(249,115,22,0.14)",
    glow: "rgba(249,115,22,0.04)",
    summary: "Your body should move like a coiled spring through every turn — you COMPRESS into the board to absorb energy, and then EXTEND to create speed. SURFY teaches you the exact knee and hip mechanics needed for efficient pumping.",
    metrics: [
      {
        name: "Compression & Extension",
        desc: "Knee angles and hip height — measuring depth, speed, and timing of each cycle.",
      },
      {
        name: "Pump Detection",
        desc: "Frequency, amplitude, and smoothness of repeated compression-extension cycles.",
      },
      {
        name: "Shoulder & Hip Rotation",
        desc: "Torso separation and shoulder-hip delta — does your upper body correctly lead turns?",
      },
    ],
  },
  {
    id: "flow",
    label: "Flow",
    tagline: "Movement Sequencing",
    color: "#a855f7",
    border: "rgba(168,85,247,0.14)",
    glow: "rgba(168,85,247,0.04)",
    summary: "SURFY analyzes your coordination, tracking the critical sequence of eyes → arms → shoulders → hips. It teaches you to look where you want to go and link maneuvers seamlessly.",
    metrics: [
      {
        name: "Head & Eye Direction",
        desc: "Face orientation and nose direction — looking where you're going, not down at the board.",
      },
      {
        name: "Arm Usage",
        desc: "Position, symmetry, and movement timing — do your arms initiate turns and generate momentum?",
      },
      {
        name: "Flow & Linking",
        desc: "Measuring dead time between movements and ability to link pumps, bottom turns, and cutbacks.",
      },
    ],
  },
];

export default function Home() {
  return (
    <>
      {/* ── FIXED BACKGROUND PHOTO ── */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          backgroundImage: "url('/surfdronephoto.jpeg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      />
      {/* Dark overlay so text stays readable */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          background: "rgba(20, 20, 20, 0.55)",
        }}
      />

      <main className="relative min-h-screen" style={{ zIndex: 2 }}>
        {/* Sticky nav */}
        <Nav />

        {/* ── HERO ── */}
        <section className="min-h-screen flex flex-col items-center justify-center text-center px-6 pb-24 pt-32">
          <h1
            className="font-serif text-white leading-[1.05] tracking-[-0.05em] mb-6 max-w-3xl"
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "clamp(42px, 7vw, 76px)",
              textShadow: "0 2px 24px rgba(0,0,0,0.6)",
            }}
          >
            The first AI surf analyzer
            <br />
            <em className="text-ocean-light">built by surfers,</em>
            <br />
            for surfers.
          </h1>

          <p className="text-[17px] font-light text-white/70 max-w-xl leading-relaxed mb-10" style={{ textShadow: "0 1px 12px rgba(0,0,0,0.5)" }}>
            Surfy looks at your surfing and adapts to fix your stance based on{" "}
            <span className="text-white font-normal">YOUR</span> real-time biomechanical
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
                <span className="text-[15px] text-white/80 leading-snug" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.5)" }}>{b}</span>
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
              className="inline-flex items-center gap-2 bg-transparent text-white/75 border border-white/25 font-light text-[15px] px-7 py-3.5 rounded-xl hover:border-white/50 hover:text-white transition-all"
            >
              View sessions
            </a>
          </div>
        </section>

        {/* ── UPLOAD — frosted panel ── */}
        <section id="upload" className="py-6 px-6">
          <div
            className="max-w-5xl mx-auto rounded-3xl px-12 py-16"
            style={{
              background: "rgba(8, 18, 38, 0.45)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 8px 64px rgba(0,0,0,0.25)",
            }}
          >
            <div className="text-center mb-12">
              <SectionHeading className="text-[clamp(32px,4.5vw,48px)] mb-4">
                Drop your clip.
                <br />
                <em className="text-ocean-light">We&rsquo;ll do the rest.</em>
              </SectionHeading>
              <p className="text-[15px] font-light text-white/45 leading-relaxed">
                Works with any angle — side-on, behind, or drone. The AI adapts to what it can see.
              </p>
            </div>
            <VideoUploader />
          </div>
        </section>

        {/* ── FEATURES — frosted panel ── */}
        <section className="py-6 px-6 pb-16">
          <div
            className="max-w-5xl mx-auto rounded-3xl px-12 py-16"
            style={{
              background: "rgba(8, 18, 38, 0.45)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 8px 64px rgba(0,0,0,0.25)",
            }}
          >
            <div className="text-center mb-14">
              <SectionHeading className="text-[clamp(32px,4.5vw,52px)]">
                What <em className="text-ocean-light">SURFY</em> is teaching you
              </SectionHeading>
              <p className="text-[15px] font-light text-white/45 leading-relaxed mt-4">
                It breaks things down into three core mechanics
              </p>
            </div>

            <div className="grid grid-cols-3 gap-5">
              {PILLARS.map((pillar) => (
                <div
                  key={pillar.id}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${pillar.border}`,
                  }}
                >
                  {/* Colored top bar */}
                  <div className="h-1.5 w-full" style={{ background: pillar.color }} />
                  <div className="p-8 text-center">
                    <h3
                      className="font-bold text-[22px] tracking-widest uppercase mb-5"
                      style={{ color: pillar.color, fontFamily: "var(--font-serif)" }}
                    >
                      {pillar.label}
                    </h3>
                    <p className="text-[14px] text-white/55 leading-relaxed">{pillar.summary}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA button */}
            <div className="text-center mt-14">
              <a
                href="/pricing"
                className="inline-flex items-center gap-2 bg-ocean-light text-ocean-deep font-bold text-[16px] px-10 py-4 rounded-full hover:bg-ocean-hover transition-all hover:-translate-y-0.5 shadow-lg shadow-ocean-light/20"
              >
                I want to IMPROVE my surfing
              </a>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer
          className="px-12 py-10 flex items-center justify-between"
          style={{
            background: "rgba(4, 10, 20, 0.85)",
            backdropFilter: "blur(12px)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
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
    </>
  );
}