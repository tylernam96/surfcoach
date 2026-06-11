"use client";

import Link from "next/link";
import { SessionStatus } from "@/lib/types";

/* ── Logo ── */
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 no-underline">
      <div
        className="w-8 h-8 rounded-[10px] flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #38bdf8, #0e7490)" }}
      >
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
          <path
            d="M2 13 C5 7 9 4 14 6 C11 8 8 11 9 15 C6 15 3.5 14 2 13Z"
            fill="white"
            opacity="0.9"
          />
          <path
            d="M9 15 C8 11 11 8 14 6 C15 9 14 13 11 15Z"
            fill="white"
            opacity="0.5"
          />
        </svg>
      </div>
      <span
        className="font-serif text-[20px] text-white tracking-tight"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        Surf<span className="text-ocean-light">y</span>
      </span>
    </Link>
  );
}

/* ── Nav ── */
export function Nav() {
  return (
    <nav className="relative z-10 flex items-center justify-between px-12 py-7">
      <Logo />
      <ul className="flex items-center gap-8 list-none m-0 p-0">
        <li>
          <Link
            href="/dashboard"
            className="text-white/60 no-underline text-sm font-light hover:text-white transition-colors"
          >
            Sessions
          </Link>
        </li>
        <li>
          <Link
            href="/pricing"
            className="bg-ocean-light text-ocean-deep text-sm font-medium px-5 py-2 rounded-lg no-underline hover:bg-ocean-hover transition-colors"
          >
            Get started
          </Link>
        </li>
      </ul>
    </nav>
  );
}

/* ── Wave divider SVG ── */
export function WaveDivider() {
  return (
    <svg
      viewBox="0 0 1000 120"
      preserveAspectRatio="none"
      style={{ height: 130, display: "block", width: "100%" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="wg1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0e3d5c" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#0a1628" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,50 C120,15 250,85 400,50 C550,15 700,80 850,45 C920,28 970,55 1000,50 L1000,120 L0,120 Z"
        fill="url(#wg1)"
        opacity="0.8"
      />
      <path
        d="M0,70 C180,35 320,95 500,65 C680,35 800,85 1000,55 L1000,120 L0,120 Z"
        fill="rgba(14,116,144,0.12)"
      />
      <path
        d="M0,85 C200,55 380,100 580,75 C750,52 880,90 1000,70 L1000,120 L0,120 Z"
        fill="rgba(56,189,248,0.06)"
      />
    </svg>
  );
}

/* ── Section label ── */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-ocean-light mb-3">
      {children}
    </p>
  );
}

/* ── Section heading ── */
export function SectionHeading({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`font-serif text-white leading-[1.1] tracking-[-0.04em] ${className}`}
      style={{ fontFamily: "var(--font-serif)" }}
    >
      {children}
    </h2>
  );
}

/* ── Status badge ── */
const badgeStyles: Record<SessionStatus, string> = {
  complete: "bg-green-500/10 text-green-400 border border-green-500/20",
  processing: "bg-ocean-light/10 text-ocean-light border border-ocean-light/20",
  error: "bg-red-500/10 text-red-400 border border-red-500/20",
};

const badgeLabels: Record<SessionStatus, string> = {
  complete: "Complete",
  processing: "Analysing…",
  error: "Error",
};

const badgeDotColor: Record<SessionStatus, string> = {
  complete: "#4ade80",
  processing: "#38bdf8",
  error: "#f87171",
};

export function StatusBadge({ status }: { status: SessionStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${badgeStyles[status]}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: badgeDotColor[status] }}
      />
      {badgeLabels[status]}
    </span>
  );
}

/* ── Card wrapper ── */
export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white/[0.03] border border-subtle rounded-2xl p-5 ${className}`}
    >
      {children}
    </div>
  );
}

/* ── Card section title ── */
export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium tracking-[0.07em] uppercase text-white/40 mb-4">
      {children}
    </p>
  );
}