"""
analyse.py — Rule-based surf form analyser.

Takes frame_data (list of dicts from pose.py) and returns a structured
analysis dict with flags, per-metric stats, and a text summary.

Thresholds are maneuver-aware — an air requires deep knee bend that would
be wrong on a standard trim, so flags only fire when the biomechanics are
wrong *for the declared maneuver type*.
"""
import numpy as np
from dataclasses import dataclass, field, asdict
from typing import List, Optional


# ── Maneuver categories ───────────────────────────────────────────────────────
# Maps maneuver tags to a category that selects the right threshold set.
# Add more maneuver names here as the tag library grows.

AERIAL_MANEUVERS = {
    "air", "air reverse", "air 360", "360 air", "alley oop", "lien air",
    "rodeo flip", "full rotation", "aerial", "air reverse 360",
}
POWER_MANEUVERS = {
    "bottom turn", "top turn", "cutback", "snap", "hack", "carve",
    "roundhouse", "layback",
}
TUBE_MANEUVERS = {
    "barrel", "tube", "pigdog", "stand up tube",
}


def _maneuver_category(maneuver: Optional[str]) -> str:
    if not maneuver:
        return "general"
    m = maneuver.lower().strip()
    if any(a in m for a in AERIAL_MANEUVERS):
        return "aerial"
    if any(p in m for p in POWER_MANEUVERS):
        return "power"
    if any(t in m for t in TUBE_MANEUVERS):
        return "tube"
    return "general"


# ── Thresholds by maneuver category ──────────────────────────────────────────
# Each entry: (over_crouch, under_crouch)
# over_crouch  = knee angle BELOW this = too crouched (bad)
# under_crouch = knee angle ABOVE this = too upright (bad)
# None = don't check that direction for this maneuver type

KNEE_THRESHOLDS = {
    #               over_crouch  under_crouch
    "aerial":      (75,          145),   # deep crouch expected on takeoff/landing
    "power":       (100,         155),   # athletic loaded stance
    "tube":        (85,          150),   # pigdog / compressed tube stance
    "general":     (110,         160),   # default recreational
}

GAZE_DOWN_THRESH   = 0.20
GAZE_LATERAL_MIN   = 0.15
STANCE_NARROW      = 0.80
STANCE_WIDE        = 2.20   # raised from 2.0 — wide stance common in power surfing
STANCE_WIDE_AERIAL = 2.60   # aerials need extra width for stability
MIN_FRAMES         = 10
MIN_CONFIDENCE     = 0.50
FLAG_FRACTION      = 0.30


@dataclass
class Flag:
    code: str
    severity: str       # "info" | "warning" | "issue"
    message: str
    pct_frames: float


@dataclass
class Analysis:
    flags: List[Flag] = field(default_factory=list)
    metrics: dict = field(default_factory=dict)
    summary: str = ""
    maneuver_category: str = "general"


def _good_frames(frame_data: list) -> list:
    return [f for f in frame_data if f.get("confidence", 0) >= MIN_CONFIDENCE]


def _series(frames: list, key: str) -> np.ndarray:
    return np.array([f[key] for f in frames if key in f])


def _flag_if(frames, key, condition_fn, code, severity, message) -> Optional[Flag]:
    vals = _series(frames, key)
    if len(vals) == 0:
        return None
    triggered = np.sum([condition_fn(v) for v in vals])
    pct = triggered / len(vals)
    if pct > FLAG_FRACTION:
        return Flag(code=code, severity=severity, message=message, pct_frames=round(float(pct), 2))
    return None


def analyse_pose_data(frame_data: list, maneuver: Optional[str] = None) -> dict:
    good = _good_frames(frame_data)
    category = _maneuver_category(maneuver)

    if len(good) < MIN_FRAMES:
        return asdict(Analysis(
            summary="Not enough high-confidence frames to analyse. "
                    "Make sure the surfer is clearly visible throughout the clip.",
            maneuver_category=category,
        ))

    analysis = Analysis(maneuver_category=category)
    flags = []

    over_thresh, under_thresh = KNEE_THRESHOLDS.get(category, KNEE_THRESHOLDS["general"])

    # ── Knee bend / crouching ─────────────────────────────────────────────────
    if over_thresh is not None:
        f = _flag_if(good, "knee_bend_left",
                     lambda v, t=over_thresh: v < t,
                     "over_crouching", "warning",
                     f"You're crouching very low (knee angle below {over_thresh}°) for much of the ride. "
                     f"For a {'{"+ category +"}'} maneuver, aim for a more controlled load rather than collapsing the knees." 
                     if category != "general" else
                     "You're crouching too low through much of the ride. "
                     "Try to maintain an athletic stance with knees around 120-140°.")
        if f: flags.append(f)

    if under_thresh is not None:
        f = _flag_if(good, "knee_bend_left",
                     lambda v, t=under_thresh: v > t,
                     "under_crouching", "issue",
                     "You're standing too tall and not bending your knees enough. "
                     "Lower your centre of mass for more control and power.")
        if f: flags.append(f)

    # ── Gaze / head position ──────────────────────────────────────────────────
    # Skip gaze checks for aerials — head position is chaotic during rotation
    if category != "aerial":
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
    wide_thresh = STANCE_WIDE_AERIAL if category == "aerial" else STANCE_WIDE

    f = _flag_if(good, "stance_width",
                 lambda v: v < STANCE_NARROW,
                 "narrow_stance", "warning",
                 "Your feet are too close together. "
                 "Widen your stance for a more stable base — feet roughly shoulder-width apart.")
    if f: flags.append(f)

    f = _flag_if(good, "stance_width",
                 lambda v, t=wide_thresh: v > t,
                 "wide_stance", "info",
                 "Your stance is very wide. This can limit hip rotation on turns."
                 if category != "aerial" else
                 "Your stance is extremely wide even for an aerial — check your landing position.")
    if f: flags.append(f)

    # ── CoM height arc ────────────────────────────────────────────────────────
    com = _series(good, "com_height")
    com_std = float(np.std(com)) if len(com) > 1 else 0.0

    # For aerials, high CoM variance is expected and correct — skip static CoM flag
    if category not in ("aerial",) and com_std < 0.03:
        flags.append(Flag(
            code="static_com",
            severity="info",
            message="Your body height stays very constant throughout the ride. "
                    "Try compressing into the bottom of a turn and extending through the top.",
            pct_frames=1.0,
        ))

    # ── Shoulder rotation ─────────────────────────────────────────────────────
    # Skip for aerials — full rotation means shoulders pass through square naturally
    if category != "aerial":
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

    maneuver_label = maneuver or "general surfing"
    flag_lines = "\n".join(f"- [{f.severity.upper()}] {f.message}" for f in flags) or "No major issues detected."
    analysis.summary = (
        f"Analysed {len(good)} frames — maneuver: {maneuver_label} (category: {category}).\n"
        f"Average knee bend: L={analysis.metrics['knee_bend_left'].get('mean','?')}° "
        f"R={analysis.metrics['knee_bend_right'].get('mean','?')}°\n"
        f"Stance width (normalised): {analysis.metrics['stance_width'].get('mean','?')}\n"
        f"CoM height variability: {com_std:.3f}\n\n"
        f"Flags raised:\n{flag_lines}"
    )

    return asdict(analysis)