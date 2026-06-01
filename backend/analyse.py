"""
analyse.py — Rule-based surf form analyser.

Takes frame_data (list of dicts from pose.py) and returns a structured
analysis dict with flags, per-metric stats, and a text summary.

All thresholds are tunable — these are good starting defaults based on
coaching literature. Over time, replace with learned thresholds.
"""
import numpy as np
from dataclasses import dataclass, field, asdict
from typing import List, Optional


# ── Thresholds (degrees or normalised units) ──────────────────────────────────

OVER_CROUCH_KNEE   = 110   # avg knee angle below this = too crouched
UNDER_CROUCH_KNEE  = 160   # avg knee angle above this = too upright / not crouching
GAZE_DOWN_THRESH   = 0.20  # gaze_down above this = looking at board not horizon
GAZE_LATERAL_MIN   = 0.15  # if gaze_lateral near 0 = not looking down the line
STANCE_NARROW      = 0.80  # stance_width below this = feet too close
STANCE_WIDE        = 2.00  # stance_width above this = feet too wide
MIN_FRAMES         = 10    # need at least this many sampled frames to analyse
MIN_CONFIDENCE     = 0.50  # ignore frames where MediaPipe confidence is below this
# Fraction of high-confidence frames that must trigger for a flag to fire
FLAG_FRACTION      = 0.30  # flag fires if condition is true in >30% of good frames


@dataclass
class Flag:
    code: str           # machine-readable key  e.g. "over_crouching"
    severity: str       # "info" | "warning" | "issue"
    message: str        # plain-English coaching note
    pct_frames: float   # fraction of frames where condition was true


@dataclass
class Analysis:
    flags: List[Flag] = field(default_factory=list)
    metrics: dict = field(default_factory=dict)
    summary: str = ""


def _good_frames(frame_data: list) -> list:
    return [f for f in frame_data if f.get("confidence", 0) >= MIN_CONFIDENCE]


def _series(frames: list, key: str) -> np.ndarray:
    return np.array([f[key] for f in frames if key in f])


def _flag_if(frames, key, condition_fn, code, severity, message) -> Optional[Flag]:
    """
    Fire a flag if condition_fn(value) is True for > FLAG_FRACTION of frames.
    Returns a Flag or None.
    """
    vals = _series(frames, key)
    if len(vals) == 0:
        return None
    triggered = np.sum([condition_fn(v) for v in vals])
    pct = triggered / len(vals)
    if pct > FLAG_FRACTION:
        return Flag(code=code, severity=severity, message=message, pct_frames=round(float(pct), 2))
    return None


def analyse_pose_data(frame_data: list) -> dict:
    good = _good_frames(frame_data)

    if len(good) < MIN_FRAMES:
        return asdict(Analysis(
            summary="Not enough high-confidence frames to analyse. "
                    "Make sure the surfer is clearly visible throughout the clip."
        ))

    analysis = Analysis()
    flags = []

    # ── Knee bend / crouching ─────────────────────────────────────────────────
    avg_knee = (_series(good, "knee_bend_left") + _series(good, "knee_bend_right")) / 2

    f = _flag_if(good, "knee_bend_left",
                 lambda v: v < OVER_CROUCH_KNEE,
                 "over_crouching", "warning",
                 "You're crouching too low through much of the ride. "
                 "Try to maintain an athletic stance with knees around 120-140°.")
    if f: flags.append(f)

    f = _flag_if(good, "knee_bend_left",
                 lambda v: v > UNDER_CROUCH_KNEE,
                 "under_crouching", "issue",
                 "You're standing too tall and not bending your knees enough. "
                 "Lower your centre of mass for more control and power.")
    if f: flags.append(f)

    # ── Gaze / head position ──────────────────────────────────────────────────
    f = _flag_if(good, "gaze_down",
                 lambda v: v > GAZE_DOWN_THRESH,
                 "looking_at_board", "issue",
                 "Your head is dropping — you're looking at the board instead of down the line. "
                 "Eyes lead the body: look where you want to go.")
    if f: flags.append(f)

    f = _flag_if(good, "gaze_lateral",
                 lambda v: abs(v) < GAZE_LATERAL_MIN,
                 "not_looking_down_line", "warning",
                 "Your gaze doesn't appear to be directed down the line. "
                 "Turn your head toward the wave face to set up better turns.")
    if f: flags.append(f)

    # ── Stance width ──────────────────────────────────────────────────────────
    f = _flag_if(good, "stance_width",
                 lambda v: v < STANCE_NARROW,
                 "narrow_stance", "warning",
                 "Your feet are too close together. "
                 "Widen your stance for a more stable base — feet roughly shoulder-width apart.")
    if f: flags.append(f)

    f = _flag_if(good, "stance_width",
                 lambda v: v > STANCE_WIDE,
                 "wide_stance", "info",
                 "Your stance is very wide. This can limit hip rotation on turns.")
    if f: flags.append(f)

    # ── CoM height arc (bottom turn proxy) ───────────────────────────────────
    # A good bottom turn dips CoM low then rises through the turn.
    # Simple proxy: check for variance in com_height — low variance = flat/static riding.
    com = _series(good, "com_height")
    com_std = float(np.std(com)) if len(com) > 1 else 0.0
    if com_std < 0.03:
        flags.append(Flag(
            code="static_com",
            severity="info",
            message="Your body height stays very constant throughout the ride. "
                    "Try compressing into the bottom of a turn and extending through the top.",
            pct_frames=1.0,
        ))

    # ── Shoulder rotation ─────────────────────────────────────────────────────
    f = _flag_if(good, "shoulder_rotation",
                 lambda v: v < 0.05,
                 "square_shoulders", "warning",
                 "Your shoulders look square to the camera for most of the ride. "
                 "Lead turns with your front shoulder to generate more rotation.")
    if f: flags.append(f)

    # ── Aggregate metrics ─────────────────────────────────────────────────────
    def stat(arr):
        if len(arr) == 0:
            return {}
        return {"mean": round(float(np.mean(arr)), 1),
                "min":  round(float(np.min(arr)),  1),
                "max":  round(float(np.max(arr)),  1)}

    analysis.flags = flags
    analysis.metrics = {
        "knee_bend_left":     stat(_series(good, "knee_bend_left")),
        "knee_bend_right":    stat(_series(good, "knee_bend_right")),
        "hip_hinge":          stat(_series(good, "hip_hinge")),
        "gaze_down":          stat(_series(good, "gaze_down")),
        "gaze_lateral":       stat(_series(good, "gaze_lateral")),
        "stance_width":       stat(_series(good, "stance_width")),
        "com_height":         stat(com),
        "com_height_std":     round(com_std, 3),
        "shoulder_rotation":  stat(_series(good, "shoulder_rotation")),
        "frames_analysed":    len(good),
        "total_frames":       len(frame_data),
    }

    # ── Plain-text summary for Claude prompt ─────────────────────────────────
    flag_lines = "\n".join(f"- [{f.severity.upper()}] {f.message}" for f in flags) or "No major issues detected."
    analysis.summary = (
        f"Analysed {len(good)} frames from a surf video.\n"
        f"Average knee bend: L={analysis.metrics['knee_bend_left'].get('mean','?')}° "
        f"R={analysis.metrics['knee_bend_right'].get('mean','?')}°\n"
        f"Stance width (normalised): {analysis.metrics['stance_width'].get('mean','?')}\n"
        f"CoM height variability: {com_std:.3f}\n\n"
        f"Flags raised:\n{flag_lines}"
    )

    return asdict(analysis)