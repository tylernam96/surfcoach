"""
scoring.py — Converts raw analyse.py metrics into human-readable 1–100 scores.

Three pillar scores:
  position_score  — Stance, balance, foot bias, rail engagement
  power_score     — Knee drive, compression depth, pump quality, rotation
  flow_score      — Gaze direction, dead time, arm usage, linking

One aggregate:
  surfy_score     — Weighted mean of the three pillars (position 30%, power 40%, flow 30%)

Each score comes with:
  value           — int 1–100
  label           — "Excellent" | "Good" | "Needs Work" | "Poor"
  breakdown       — list of individual sub-scores, each with:
                      name    — sub-score name
                      value   — 1–100
                      summary — SHORT plain-language verdict (no jargon/numbers),
                                shown as the headline bullet on the frontend
                      note    — full explanation WITH the numbers, shown when the
                                user expands "View details"
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import List, Optional
import math


# ── Grade thresholds ──────────────────────────────────────────────────────────

def _label(score: float) -> str:
    if score >= 80:
        return "Excellent"
    if score >= 60:
        return "Good"
    if score >= 40:
        return "Needs Work"
    return "Poor"


# ── Clamp helper ──────────────────────────────────────────────────────────────

def _clamp(v: float, lo: float = 1.0, hi: float = 100.0) -> int:
    return int(max(lo, min(hi, round(v))))


# ── Sub-score data class ──────────────────────────────────────────────────────

@dataclass
class SubScore:
    name: str
    value: int           # 1–100
    summary: str         # short plain-language headline, e.g. "Fast pumping"
    note: str            # full detail with numbers, e.g. "Pump rate 1.64 Hz — slightly fast…"


@dataclass
class PillarScore:
    value: int
    label: str
    breakdown: List[SubScore] = field(default_factory=list)


@dataclass
class SurfyScores:
    position: PillarScore
    power: PillarScore
    flow: PillarScore
    surfy_score: int
    surfy_label: str


# ── Knee-drive scoring ────────────────────────────────────────────────────────
#
# "Knee drive" is about dynamic loading — how DEEP the surfer compresses and how
# much range they cycle through — not whether their average angle sits in a tidy
# band. Elite surfers compress very low (often <90°) through bottom turns and
# laybacks; that is correct, powerful surfing and must score HIGH.
#
# We therefore score two things from the per-frame knee series:
#   1. Compression depth  — the deepest bend reached (min angle). Deeper = better,
#      down to a sane floor, with only a gentle penalty for never compressing.
#   2. Range of motion     — how much the knee travels between compression and
#      extension across the clip. More range = more dynamic loading.
#
# Both use soft slopes, never cliffs.

# Per-category target: (deep_compression_target, min_useful_range)
# deep_compression_target = angle at/below which compression depth scores ~full.
KNEE_TARGETS = {
    #            deep_target  range_target
    "aerial":   (95,          45),
    "power":    (100,         50),
    "tube":     (105,         35),
    "general":  (105,         45),
}


def _soft_score(value: float, good_at: float, zero_at: float) -> int:
    """
    Smooth monotonic score. Returns ~100 when value reaches `good_at`,
    ~30 when at `zero_at`, linear in between, clamped 1–100. Works in either
    direction (good_at can be less than zero_at for 'lower is better').
    """
    if good_at == zero_at:
        return 100
    frac = (value - zero_at) / (good_at - zero_at)
    return _clamp(30 + frac * 70)


def _knee_score(
    knee_min: Optional[float],
    knee_range: Optional[float],
    category: str,
) -> tuple[int, str, str]:
    """
    Score knee drive from compression depth (min angle) and range of motion.
    Pass the MIN knee angle across the clip and the (max - min) range.
    A gentle floor handles dangerously hyper-collapsed angles only.
    Returns (score, summary, note).
    """
    if knee_min is None:
        return 50, "Knee data unavailable", "Knee bend data not available"

    deep_target, range_target = KNEE_TARGETS.get(category, KNEE_TARGETS["general"])

    # Compression depth: reaching deep_target (or deeper) scores full; staying
    # upright (~160°, barely bending) scores low. Lower angle = deeper = better.
    depth_score = _soft_score(knee_min, good_at=deep_target, zero_at=160)
    # Only penalise genuinely unsafe over-collapse (knees folded past ~55°).
    if knee_min < 55:
        depth_score = min(depth_score, 75)

    # Range of motion: hitting range_target scores full; a static leg scores low.
    if knee_range is None:
        range_score = depth_score
    else:
        range_score = _soft_score(knee_range, good_at=range_target, zero_at=8)

    score = int(depth_score * 0.6 + range_score * 0.4)

    if depth_score >= 75 and range_score >= 70:
        summary = "Strong knee drive"
        note = (
            f"Strong knee drive — compressing to {round(knee_min)}° "
            f"with good range through the wave"
        )
    elif depth_score < 55:
        pct = round((knee_min - deep_target) / deep_target * 100)
        summary = "Staying upright"
        note = (
            f"Staying fairly upright (deepest bend {round(knee_min)}°, ~{pct}% shy "
            f"of a deep load). Compress lower through turns to drive more power."
        )
    elif knee_range is not None and range_score < 55:
        summary = "Limited compression range"
        note = (
            f"Good depth but limited range ({round(knee_range)}° of travel) — "
            f"work the full compress-and-extend cycle, not a held crouch."
        )
    else:
        summary = "Solid knee drive"
        note = f"Solid knee drive — compressing to {round(knee_min)}°"

    return _clamp(score), summary, note


# ── Hip / CoM height ──────────────────────────────────────────────────────────

def _hip_height_score(com_std: float, foot_bias: str) -> tuple[int, str, str]:
    """
    Two sub-signals:
      com_std   — variability (too low = static rider, too high = erratic)
      foot_bias — balanced / front-heavy / back-heavy
    Returns (score, summary, note).
    """
    # com_height in pose.py is the raw hip-midpoint y (normalised 0-1 frame
    # coords), so its std across a ride is smaller than a body-scaled metric.
    # Good dynamic range sits ~0.03-0.09; below ~0.015 is a static rider.
    if com_std < 0.015:
        std_score = 45
        summary = "Hips barely moving"
        std_note = "Hips barely moving — compress through turns and extend at top"
    elif com_std < 0.03:
        pct_low = round((0.03 - com_std) / 0.03 * 100)
        std_score = 60 + int((1 - pct_low / 100) * 25)
        summary = "Slightly stiff hips"
        std_note = f"Hip movement a touch restricted (~{pct_low}% shy) — load a little deeper"
    elif com_std <= 0.09:
        std_score = 88 + int((com_std - 0.03) / 0.06 * 12)
        summary = "Smooth hip movement"
        std_note = "Good hip range of motion through the wave"
    else:
        pct_high = round((com_std - 0.09) / 0.09 * 100)
        std_score = max(55, 90 - int(pct_high * 0.4))
        summary = "Over-active hips"
        std_note = f"Hip movement {pct_high}% more than ideal — aim for smooth, controlled cycles"

    # Foot bias is currently unrecoverable from 2D pose (see analyse._foot_bias),
    # so "unknown" must be neutral — score Hip Position purely on CoM range and
    # don't fabricate a front/back-heavy verdict.
    if foot_bias in ("front-heavy", "back-heavy", "balanced"):
        bias_score = {"balanced": 100, "front-heavy": 55, "back-heavy": 50}[foot_bias]
        bias_note = {
            "balanced":    "Weight evenly distributed front to back",
            "front-heavy": "Too much weight on the front foot — stack hips over centre through turns",
            "back-heavy":  "Weight sitting too far back — drive your front knee forward over your toes",
        }[foot_bias]
        combined = int(std_score * 0.6 + bias_score * 0.4)
        note = f"{std_note}. {bias_note}."
    else:
        combined = std_score
        note = std_note

    return _clamp(combined), summary, note


# ── Rail engagement ───────────────────────────────────────────────────────────

def _rail_score(rail_engagement: float, category: str) -> tuple[int, str, str]:
    """rail_engagement is 0–1 from analyse.py. Returns (score, summary, note)."""
    # For tube riding rail engagement is less relevant
    if category == "tube":
        return 70, "Not key for tube riding", "Rail engagement not the primary metric for tube riding"

    if rail_engagement >= 0.7:
        score = 85 + int((rail_engagement - 0.7) / 0.3 * 15)
        summary = "Committed rail lean"
        note = "Good body lean committed into the rail"
    elif rail_engagement >= 0.35:
        pct = round((rail_engagement - 0.35) / 0.35 * 100)
        score = 50 + int(pct * 0.5)
        summary = "Shallow rail lean"
        note = (
            f"Rail engagement {100 - pct}% too shallow — lean your whole body "
            f"through toes or heels, not just your arms"
        )
    else:
        pct_low = round((0.35 - rail_engagement) / 0.35 * 100)
        score = 20 + int(rail_engagement / 0.35 * 30)
        summary = "Weak rail engagement"
        note = (
            f"Very low rail engagement — {pct_low}% below target. "
            f"Commit your weight into the rail; carving starts with the whole body leaning"
        )

    return _clamp(score), summary, note


# ── Pump quality ──────────────────────────────────────────────────────────────

def _pump_score(
    pump_frequency: float,
    pump_amplitude: float,
    pump_smoothness: float,
    pump_cycles: int,
    category: str,
) -> tuple[int, str, str]:
    """Returns (score, summary, note)."""
    if category in ("tube", "aerial"):
        return 70, "Not scored for this move", "Pump mechanics not scored for this maneuver type"
    if pump_cycles == 0:
        return 30, "No pumping detected", "No pump cycles detected — work on rhythmic compression-extension between sections"

    # Frequency: 0.4–0.9 Hz is good surf pumping
    if pump_frequency < 0.25:
        freq_score = 35
        freq_note = f"Pump rate {pump_frequency:.2f} Hz — too slow; faster rhythmic cycles build more speed"
    elif pump_frequency < 0.4:
        pct_low = round((0.4 - pump_frequency) / 0.4 * 100)
        freq_score = 55
        freq_note = f"Pump rate {pump_frequency:.2f} Hz — {pct_low}% below ideal; tighten the compression-extension loop"
    elif pump_frequency <= 0.9:
        freq_score = 90
        freq_note = f"Pump rate {pump_frequency:.2f} Hz — in the ideal range"
    else:
        freq_score = 70
        freq_note = f"Pump rate {pump_frequency:.2f} Hz — slightly fast; focus on full extension at the top"

    # Amplitude: target 0.06+
    if pump_amplitude < 0.04:
        pct_low = round((0.06 - pump_amplitude) / 0.06 * 100)
        amp_score = 35
        amp_note = f"Pump depth {pct_low}% too shallow — drive harder through knees and hips each cycle"
    elif pump_amplitude < 0.06:
        amp_score = 65
        amp_note = "Pump depth moderate — aim for a deeper squat-to-extension arc"
    else:
        amp_score = 90
        amp_note = "Good pump depth"

    smoothness_score = _clamp(pump_smoothness * 100)

    combined = int(freq_score * 0.4 + amp_score * 0.35 + smoothness_score * 0.25)

    # Plain-language headline — lead with whichever issue is most salient,
    # keeping the actual Hz / depth numbers for the detailed note only.
    if pump_amplitude < 0.04:
        summary = "Shallow pumping"
    elif pump_frequency < 0.4:
        summary = "Slow pumping"
    elif pump_frequency > 0.9:
        summary = "Fast pumping"
    else:
        summary = "Good pumping rhythm"

    note = f"{freq_note}. {amp_note}."
    return _clamp(combined), summary, note


# ── Shoulder rotation ─────────────────────────────────────────────────────────

def _rotation_score(sh_rot_mean: Optional[float], category: str) -> tuple[int, str, str]:
    """Returns (score, summary, note)."""
    if sh_rot_mean is None:
        return 50, "Rotation data unavailable", "Shoulder rotation data unavailable"
    if category == "aerial":
        return 70, "Not scored for aerials", "Full-body rotation not scored for aerials"

    # sh_rot is normalised (0–1); ideal range 0.10–0.30
    if sh_rot_mean < 0.05:
        pct_low = round((0.10 - sh_rot_mean) / 0.10 * 100)
        score = 30
        summary = "Shoulders too square"
        note = (
            f"Shoulders {pct_low}% too square — lead turns with your front shoulder "
            f"to create rotation and drive speed"
        )
    elif sh_rot_mean < 0.10:
        pct_low = round((0.10 - sh_rot_mean) / 0.10 * 100)
        score = 55
        summary = "Limited rotation"
        note = f"Shoulder rotation {pct_low}% below target — open up through turns a little more"
    elif sh_rot_mean <= 0.35:
        score = 90
        summary = "Good shoulder rotation"
        note = "Good shoulder rotation leading turns"
    else:
        pct_high = round((sh_rot_mean - 0.35) / 0.35 * 100)
        score = 70
        summary = "Over-rotating"
        note = f"Shoulder rotation {pct_high}% over-rotated — keep upper body controlled through completion"

    return _clamp(score), summary, note


# ── Gaze ──────────────────────────────────────────────────────────────────────

def _gaze_score(
    gaze_down_mean: Optional[float],
    gaze_lat_mean: Optional[float],
    category: str,
) -> tuple[int, str, str]:
    """Returns (score, summary, note)."""
    if category == "aerial":
        return 70, "Not scored for aerials", "Gaze not scored during full-rotation aerials"
    if gaze_down_mean is None and gaze_lat_mean is None:
        return 50, "Gaze data unavailable", "Gaze data not available"

    notes = []
    score = 80  # start optimistic
    summary = "Eyes up, reading the wave"  # default — overwritten by worst issue

    if gaze_down_mean is not None:
        if gaze_down_mean > 0.30:
            pct_high = round((gaze_down_mean - 0.20) / 0.20 * 100)
            score -= 35
            summary = "Eyes dropping to feet"
            notes.append(
                f"Looking down {pct_high}% too much — eyes on the wave face, not your feet"
            )
        elif gaze_down_mean > 0.20:
            pct_high = round((gaze_down_mean - 0.20) / 0.20 * 100)
            score -= 15
            summary = "Head dropping a little"
            notes.append(
                f"Head dropping {pct_high}% more than ideal — keep your chin up through turns"
            )
        else:
            notes.append("Good head position — eyes staying up")

    if gaze_lat_mean is not None:
        if abs(gaze_lat_mean) < 0.10:
            pct_low = round((0.15 - abs(gaze_lat_mean)) / 0.15 * 100)
            score -= 20
            # Only set as headline if we don't already have a worse "looking down" issue.
            if gaze_down_mean is None or gaze_down_mean <= 0.30:
                summary = "Not looking down the line"
            notes.append(
                f"Gaze {pct_low}% too straight ahead — turn your head toward the wave "
                f"to read sections earlier and set up turns"
            )
        elif abs(gaze_lat_mean) < 0.15:
            score -= 8
            notes.append("Lateral gaze slightly low — look further down the line")
        else:
            notes.append("Good lateral gaze direction")

    return _clamp(score), summary, ". ".join(notes)


# ── Dead time (flow / linking) ────────────────────────────────────────────────

def _flow_score(dead_time_pct: float) -> tuple[int, str, str]:
    """dead_time_pct is 0–1. Returns (score, summary, note)."""
    if dead_time_pct < 0.20:
        score = 95
        summary = "Great flow, always active"
        note = "Constantly active — excellent flow and linking between moves"
    elif dead_time_pct < 0.35:
        pct_over = round((dead_time_pct - 0.20) / 0.20 * 100)
        score = 70
        summary = "Slightly stop-start"
        note = (
            f"Flow {pct_over}% below ideal — keep pumping through flat sections "
            f"and link moves without pausing"
        )
    elif dead_time_pct < 0.50:
        score = 45
        summary = "Too much dead time"
        note = (
            f"Too much dead time ({int(dead_time_pct * 100)}% of frames static) — "
            f"stay active between sections and keep your body moving"
        )
    else:
        score = 25
        summary = "Mostly static"
        note = (
            f"{int(dead_time_pct * 100)}% of the ride is static — "
            f"work on continuous movement and rhythm across the whole wave"
        )
    return _clamp(score), summary, note


# ── Arm usage ─────────────────────────────────────────────────────────────────

def _arm_usage_score(
    arm_spread_mean: Optional[float],
    arm_asym_mean: Optional[float],
) -> tuple[int, str, str]:
    """Returns (score, summary, note)."""
    if arm_spread_mean is None:
        return 65, "Arm data unavailable", "Arm spread data not available — pose detection may not have captured wrists clearly"

    notes = []
    score = 80
    summary = "Good arm use"

    # Spread: ideal 0.35–0.65
    if arm_spread_mean < 0.30:
        pct_low = round((0.35 - arm_spread_mean) / 0.35 * 100)
        score -= 25
        summary = "Arms too tucked"
        notes.append(
            f"Arms {pct_low}% too close to body — spread wide to improve balance "
            f"and help initiate turns"
        )
    elif arm_spread_mean > 0.70:
        pct_high = round((arm_spread_mean - 0.65) / 0.65 * 100)
        score -= 10
        summary = "Arms a bit wide"
        notes.append(f"Arms {pct_high}% overly wide — keep a functional spread without windmilling")
    else:
        notes.append("Good arm spread")

    # Asymmetry: high arm asymmetry is CORRECT in dynamic surfing — the lead arm
    # drives forward while the trailing arm guides from behind. We only note
    # extreme, sustained asymmetry as information, never as a real penalty.
    if arm_asym_mean is not None:
        if arm_asym_mean > 0.45:
            score -= 6
            notes.append(
                "Arms very asymmetric throughout — fine through turns, "
                "just keep the trailing arm guiding rather than flailing"
            )
        else:
            notes.append("Active, asymmetric arm use — good for driving turns")

    return _clamp(score), summary, ". ".join(notes)


# ── Stance balance ────────────────────────────────────────────────────────────
#
# NOTE: toe/heel weight distribution CANNOT be recovered from 2D pose landmarks —
# there is no ground-reaction-force or lateral-pressure signal in the data. The
# old proxy keyed off hip_hinge, which pose.py emits as a shoulder-hip-knee angle
# in DEGREES (~120-175°), not a normalised lean coefficient — so it floored every
# real ride at 1/100. We instead score Stance Balance from stance_width, which
# pose.py genuinely provides (ankle distance / torso height, camera-independent).

def _stance_balance_score(
    stance_mean: Optional[float],
    stance_std: Optional[float],
    category: str,
) -> tuple[int, str, str]:
    """
    Score stance from width (normalised to torso height) and its steadiness.
    Good surf stance sits roughly 1.1–2.0x; aerials run wider on landing.
    Returns (score, summary, note).
    """
    if stance_mean is None:
        return 60, "Stance data unavailable", "Stance width data not available"

    lo, hi = (1.1, 2.6) if category == "aerial" else (1.1, 2.0)

    if stance_mean < lo:
        pct = round((lo - stance_mean) / lo * 100)
        width_score = _clamp(75 - pct * 1.2)
        summary = "Stance a touch narrow"
        width_note = (
            f"Stance ~{pct}% narrower than ideal — widen toward shoulder-width "
            f"for a more stable base"
        )
    elif stance_mean > hi:
        pct = round((stance_mean - hi) / hi * 100)
        width_score = _clamp(80 - pct * 0.8)
        summary = "Stance a touch wide"
        width_note = (
            f"Stance ~{pct}% wider than ideal — can restrict hip rotation through turns"
        )
    else:
        width_score = 92
        summary = "Strong, stable stance"
        width_note = "Stance width in a strong, stable range"

    # Steadiness: a wildly varying stance width suggests unsettled footwork.
    if stance_std is not None and stance_std > 0.45:
        width_score = max(50, width_score - 12)
        summary = "Unsettled footwork"
        width_note += "; footwork looks a little unsettled between turns"

    return _clamp(width_score), summary, width_note


# ── Pillar aggregators ────────────────────────────────────────────────────────

def _position_pillar(metrics: dict, category: str) -> PillarScore:
    pillars = metrics.get("pillars", {}).get("position", {})
    com_std     = metrics.get("com_height_std", 0.0)
    foot_bias   = metrics.get("foot_bias", "balanced")
    rail_eng    = metrics.get("rail_engagement", 0.0)
    stance_mean = metrics.get("stance_width", {}).get("mean", None)
    stance_std  = metrics.get("stance_width", {}).get("std", None)

    hip_s, hip_sum, hip_note         = _hip_height_score(com_std, foot_bias)
    rail_s, rail_sum, rail_note      = _rail_score(rail_eng, category)
    stance_s, stance_sum, stance_note = _stance_balance_score(stance_mean, stance_std, category)

    # Weighted: hip position 45%, rail engagement 30%, stance balance 25%
    value = _clamp(hip_s * 0.45 + rail_s * 0.30 + stance_s * 0.25)

    breakdown = [
        SubScore("Hip Position",    hip_s,    hip_sum,    hip_note),
        SubScore("Rail Engagement", rail_s,   rail_sum,   rail_note),
        SubScore("Stance Balance",  stance_s, stance_sum, stance_note),
    ]
    return PillarScore(value=value, label=_label(value), breakdown=breakdown)


def _power_pillar(metrics: dict, category: str) -> PillarScore:
    pillars      = metrics.get("pillars", {}).get("power", {})
    pump_freq    = metrics.get("pump_frequency", 0.0)
    pump_amp     = metrics.get("pump_amplitude", 0.0)
    pump_smooth  = metrics.get("pump_smoothness", 0.0)
    pump_cycles  = metrics.get("pump_cycles", 0)
    sh_rot_mean  = pillars.get("shoulder_rotation", None)

    # Knee drive from compression depth (min angle) + range (max - min).
    # analyse.py's _stat() already provides min/max per knee in metrics.
    knee_l_stat = metrics.get("knee_bend_left", {})
    knee_r_stat = metrics.get("knee_bend_right", {})
    mins = [s.get("min") for s in (knee_l_stat, knee_r_stat) if s.get("min") is not None]
    knee_min = min(mins) if mins else None  # deepest compression of either leg

    ranges = [
        s["max"] - s["min"]
        for s in (knee_l_stat, knee_r_stat)
        if s.get("max") is not None and s.get("min") is not None
    ]
    knee_range = max(ranges) if ranges else None

    knee_s, knee_sum, knee_note = _knee_score(knee_min, knee_range, category)
    pump_s, pump_sum, pump_note = _pump_score(pump_freq, pump_amp, pump_smooth, pump_cycles, category)
    rot_s,  rot_sum,  rot_note  = _rotation_score(sh_rot_mean, category)

    # Weighted: knee 40%, pump 35%, rotation 25%
    value = _clamp(knee_s * 0.40 + pump_s * 0.35 + rot_s * 0.25)

    breakdown = [
        SubScore("Knee Drive",        knee_s, knee_sum, knee_note),
        SubScore("Pump Quality",      pump_s, pump_sum, pump_note),
        SubScore("Shoulder Rotation", rot_s,  rot_sum,  rot_note),
    ]
    return PillarScore(value=value, label=_label(value), breakdown=breakdown)


def _flow_pillar(metrics: dict, category: str) -> PillarScore:
    pillars       = metrics.get("pillars", {}).get("flow", {})
    dead_time     = metrics.get("dead_time_pct", 0.5)
    gaze_down     = pillars.get("gaze_down_mean", None)
    gaze_lat      = pillars.get("gaze_lat_mean", None)
    arm_spread    = pillars.get("arm_spread_mean", None)
    arm_asym      = pillars.get("arm_asym_mean", None)

    flow_s, flow_sum, flow_note = _flow_score(dead_time)
    gaze_s, gaze_sum, gaze_note = _gaze_score(gaze_down, gaze_lat, category)
    arm_s,  arm_sum,  arm_note  = _arm_usage_score(arm_spread, arm_asym)

    # Weighted: flow/linking 40%, gaze 35%, arms 25%
    value = _clamp(flow_s * 0.40 + gaze_s * 0.35 + arm_s * 0.25)

    breakdown = [
        SubScore("Flow & Linking", flow_s, flow_sum, flow_note),
        SubScore("Gaze Direction", gaze_s, gaze_sum, gaze_note),
        SubScore("Arm Usage",      arm_s,  arm_sum,  arm_note),
    ]
    return PillarScore(value=value, label=_label(value), breakdown=breakdown)


# ── Public entry point ────────────────────────────────────────────────────────

def compute_scores(analysis_dict: dict) -> dict:
    """
    Takes the dict returned by analyse.py's analyse_pose_data() and returns
    a serialisable SurfyScores dict.

    Usage:
        from analyse import analyse_pose_data
        from scoring import compute_scores

        result   = analyse_pose_data(frame_data, maneuver="cutback", fps=30.0)
        scores   = compute_scores(result)

    Output shape:
        {
          "position": { "value": 72, "label": "Good",  "breakdown": [...] },
          "power":    { "value": 58, "label": "Needs Work", "breakdown": [...] },
          "flow":     { "value": 81, "label": "Excellent",  "breakdown": [...] },
          "surfy_score": 70,
          "surfy_label": "Good"
        }
    """
    metrics  = analysis_dict.get("metrics", {})
    category = analysis_dict.get("maneuver_category", "general")

    position = _position_pillar(metrics, category)
    power    = _power_pillar(metrics, category)
    flow     = _flow_pillar(metrics, category)

    # Aggregate: position 30%, power 40%, flow 30%
    surfy_raw   = position.value * 0.30 + power.value * 0.40 + flow.value * 0.30
    surfy_score = _clamp(surfy_raw)
    surfy_label = _label(surfy_score)

    scores = SurfyScores(
        position=position,
        power=power,
        flow=flow,
        surfy_score=surfy_score,
        surfy_label=surfy_label,
    )
    return asdict(scores)
