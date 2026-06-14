"""
analyse.py — Rule-based surf form analyser.

Structured around three training pillars:

  POSITION  — Stance & Balance, Rail Engagement
              (foot width, CoM range, foot bias, body lean into rail)

  POWER     — Compression & Extension, Pump Detection, Shoulder & Hip Rotation
              (knee angles, CoM cycles, pump frequency/amplitude, torso rotation)

  FLOW      — Head & Eye Direction, Arm Usage, Flow & Linking
              (gaze direction, arm symmetry/spread, dead time between moves)

Thresholds are maneuver-aware — an air requires deep knee bend that would
be flagged on a standard trim, so flags only fire when the biomechanics are
wrong *for the declared maneuver type*.

New keys gracefully consumed from pose.py (no error if absent):
  hip_rotation     — separate hip yaw angle
  arm_spread       — wrist-to-wrist width, normalised
  arm_asymmetry    — L/R arm height difference, normalised
  hip_over_feet    — lateral hip-over-feet offset
"""
import numpy as np
from dataclasses import dataclass, field, asdict
from typing import List, Optional


# ── Maneuver categories ───────────────────────────────────────────────────────

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


# ── Thresholds ────────────────────────────────────────────────────────────────

KNEE_THRESHOLDS = {
    #               over_crouch  under_crouch
    "aerial":      (75,          145),
    "power":       (100,         155),
    "tube":        (85,          150),
    "general":     (110,         160),
}

# Gaze
GAZE_DOWN_THRESH   = 0.20
GAZE_LATERAL_MIN   = 0.15

# Stance
STANCE_NARROW      = 0.80
STANCE_WIDE        = 2.20
STANCE_WIDE_AERIAL = 2.60

# Foot bias (hip_hinge: positive = forward lean = front-heavy)
FOOT_BIAS_FRONT    = 0.15
FOOT_BIAS_BACK     = -0.10

# Pump
PUMP_LOW_FREQ      = 0.25    # cycles/sec below this = not generating speed
PUMP_WEAK_AMP      = 0.04    # normalised CoM units — below = shallow pumps
PUMP_MIN_GAP_FRAC  = 0.20    # min seconds between pump peaks (as fps fraction)

# Flow
DEAD_TIME_HIGH     = 0.45    # fraction of frames with no significant movement
VELOCITY_THRESH    = 0.008   # normalised CoM units/frame — below = "dead"

# Rail engagement proxy
RAIL_GOOD_THRESH   = 0.35

# Arms (if pose.py provides these)
ARM_SPREAD_LOW     = 0.30    # arms too close to body
ARM_ASYM_HIGH      = 0.25    # left/right asymmetry ratio

MIN_FRAMES         = 10
MIN_CONFIDENCE     = 0.50
FLAG_FRACTION      = 0.30


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class Flag:
    code: str
    severity: str       # "info" | "warning" | "issue"
    message: str
    pct_frames: float
    pillar: str = "general"   # "position" | "power" | "flow"


@dataclass
class Analysis:
    flags: List[Flag] = field(default_factory=list)
    metrics: dict = field(default_factory=dict)
    summary: str = ""
    maneuver_category: str = "general"


# ── Core helpers ──────────────────────────────────────────────────────────────

def _good_frames(frame_data: list) -> list:
    return [f for f in frame_data if f.get("confidence", 0) >= MIN_CONFIDENCE]


def _series(frames: list, key: str) -> np.ndarray:
    return np.array(
        [f[key] for f in frames if key in f and f[key] is not None],
        dtype=float,
    )


def _stat(arr: np.ndarray) -> dict:
    if len(arr) == 0:
        return {}
    return {
        "mean": round(float(np.mean(arr)), 2),
        "min":  round(float(np.min(arr)),  2),
        "max":  round(float(np.max(arr)),  2),
        "std":  round(float(np.std(arr)),  3),
    }


def _flag_if(
    frames: list,
    key: str,
    condition_fn,
    code: str,
    severity: str,
    message: str,
    pillar: str = "general",
) -> Optional[Flag]:
    vals = _series(frames, key)
    if len(vals) == 0:
        return None
    pct = float(np.mean([condition_fn(v) for v in vals]))
    if pct > FLAG_FRACTION:
        return Flag(
            code=code, severity=severity, message=message,
            pct_frames=round(pct, 2), pillar=pillar,
        )
    return None


# ── Peak / trough detection ───────────────────────────────────────────────────

def _find_peaks(arr: np.ndarray, min_gap: int = 3) -> List[int]:
    """Indices of local maxima with minimum separation."""
    if len(arr) < 3:
        return []
    peaks: List[int] = []
    for i in range(1, len(arr) - 1):
        if arr[i] >= arr[i - 1] and arr[i] >= arr[i + 1]:
            if not peaks or (i - peaks[-1]) >= min_gap:
                peaks.append(i)
    return peaks


def _find_troughs(arr: np.ndarray, min_gap: int = 3) -> List[int]:
    """Indices of local minima with minimum separation."""
    if len(arr) < 3:
        return []
    troughs: List[int] = []
    for i in range(1, len(arr) - 1):
        if arr[i] <= arr[i - 1] and arr[i] <= arr[i + 1]:
            if not troughs or (i - troughs[-1]) >= min_gap:
                troughs.append(i)
    return troughs


# ── POWER: pump metrics ───────────────────────────────────────────────────────

def _pump_metrics(com_arr: np.ndarray, fps: float = 30.0) -> dict:
    """
    Analyse compression-extension cycles from CoM height time series.

    Returns:
        frequency  — cycles per second
        amplitude  — mean peak-to-trough CoM travel (normalised)
        smoothness — 0–1, higher = more consistent velocity
        cycles     — total detected pump cycles
    """
    empty = {"frequency": 0.0, "amplitude": 0.0, "smoothness": 0.0, "cycles": 0}
    if len(com_arr) < 6:
        return empty

    # Light 3-frame smoothing to reduce single-frame noise
    smoothed = np.convolve(com_arr, np.ones(3) / 3.0, mode="same")
    min_gap  = max(3, int(fps * PUMP_MIN_GAP_FRAC))

    peaks   = _find_peaks(smoothed,  min_gap=min_gap)
    troughs = _find_troughs(smoothed, min_gap=min_gap)
    if not peaks or not troughs:
        return empty

    num_cycles = min(len(peaks), len(troughs))
    duration_s = len(com_arr) / fps
    frequency  = round(num_cycles / duration_s, 2) if duration_s > 0 else 0.0

    # Amplitude: mean paired peak-to-trough distance
    peak_vals   = smoothed[np.array(peaks)]
    trough_vals = smoothed[np.array(troughs)]
    n           = min(len(peak_vals), len(trough_vals))
    amplitude   = round(float(np.mean(np.abs(peak_vals[:n] - trough_vals[:n]))), 3)

    # Smoothness: consistent velocity → high score, erratic → low
    velocity   = np.diff(com_arr)
    smoothness = round(max(0.0, 1.0 - min(float(np.std(velocity)) * 15.0, 1.0)), 2)

    return {
        "frequency":  frequency,
        "amplitude":  amplitude,
        "smoothness": smoothness,
        "cycles":     num_cycles,
    }


# ── POWER: compression / extension cycles ────────────────────────────────────

def _compression_metrics(com_arr: np.ndarray, knee_arr: np.ndarray) -> dict:
    """
    Compression depth (CoM range per cycle) and timing regularity.

    depth          — mean peak-to-trough CoM distance (bigger = more range)
    timing_var     — std of trough-to-trough intervals in frames (lower = more regular)
    extension_ratio — extension frames / compression frames (>1 = surfer extends more than compresses)
    """
    empty = {"depth": 0.0, "timing_var": 0.0, "extension_ratio": 0.0}
    if len(com_arr) < 4:
        return empty

    troughs = _find_troughs(com_arr, min_gap=3)
    peaks   = _find_peaks(com_arr,   min_gap=3)

    if peaks and troughs:
        depth = round(
            float(np.mean(com_arr[np.array(peaks)])) -
            float(np.mean(com_arr[np.array(troughs)])),
            3,
        )
    else:
        depth = round(float(np.ptp(com_arr)), 3)

    timing_var = 0.0
    if len(troughs) > 1:
        timing_var = round(float(np.std(np.diff(np.array(troughs)))), 1)

    extension_ratio = 0.0
    if len(knee_arr) > 1:
        d    = np.diff(knee_arr)
        comp = int(np.sum(d < -1))
        ext  = int(np.sum(d >  1))
        if comp > 0:
            extension_ratio = round(float(ext) / float(comp), 2)

    return {
        "depth":            depth,
        "timing_var":       timing_var,
        "extension_ratio":  extension_ratio,
    }


# ── FLOW: dead time ───────────────────────────────────────────────────────────

def _dead_time_pct(com_arr: np.ndarray, knee_arr: np.ndarray) -> float:
    """
    Fraction of frames with very little body movement.
    Requires both CoM and knee velocity to be near-zero to count as "dead."
    """
    if len(com_arr) < 2:
        return 1.0
    com_vel = np.abs(np.diff(com_arr))
    dead    = com_vel < VELOCITY_THRESH
    if len(knee_arr) > 1:
        knee_vel = np.abs(np.diff(knee_arr[:len(com_vel)]))
        dead     = dead & (knee_vel < 2.0)   # degrees/frame threshold
    return round(float(np.mean(dead)), 2)


# ── POSITION: foot bias ───────────────────────────────────────────────────────

def _foot_bias(hip_hinge_arr: np.ndarray) -> str:
    """
    Estimate front/back foot weighting from mean hip hinge.
    Convention (from pose.py): positive = forward lean = front-heavy.
    """
    if len(hip_hinge_arr) == 0:
        return "unknown"
    mean = float(np.mean(hip_hinge_arr))
    if mean > FOOT_BIAS_FRONT:
        return "front-heavy"
    if mean < FOOT_BIAS_BACK:
        return "back-heavy"
    return "balanced"


# ── POSITION: rail engagement proxy ──────────────────────────────────────────

def _rail_engagement_score(
    sh_rot: np.ndarray,
    hip_hinge: np.ndarray,
    hip_over_feet: np.ndarray,
) -> float:
    """
    Proxy for weight committed into the rail, using:
      - shoulder rotation magnitude (50% weight)
      - hip hinge variability (30% weight)
      - hip-over-feet lateral offset (20% weight, if available)
    Score range 0–1; higher = more rail engagement.
    """
    if len(sh_rot) == 0:
        return 0.0
    rot_mean  = float(np.mean(np.abs(sh_rot)))
    hinge_std = float(np.std(hip_hinge)) if len(hip_hinge) > 1 else 0.0
    hof_mean  = float(np.mean(np.abs(hip_over_feet))) if len(hip_over_feet) > 0 else 0.0
    return round(min(rot_mean * 0.5 + hinge_std * 0.3 + hof_mean * 0.2, 1.0), 2)


# ── Main ──────────────────────────────────────────────────────────────────────

def analyse_pose_data(
    frame_data: list,
    maneuver: Optional[str] = None,
    fps: float = 30.0,
) -> dict:
    """
    Main entry point. Accepts an optional fps parameter for accurate pump
    frequency calculation — worker.py should pass the clip's actual FPS;
    30.0 is used as the default if not provided.

    Returns a dict (via dataclass asdict) containing:
      flags             — list of Flag dicts, each tagged with 'pillar'
      metrics           — flat metrics dict + nested 'pillars' breakdown
      summary           — human-readable text fed into the AI critique prompt
      maneuver_category — "general" | "power" | "aerial" | "tube"
    """
    good     = _good_frames(frame_data)
    category = _maneuver_category(maneuver)

    if len(good) < MIN_FRAMES:
        return asdict(Analysis(
            summary=(
                "Not enough high-confidence frames to analyse. "
                "Make sure the surfer is clearly visible throughout the clip."
            ),
            maneuver_category=category,
        ))

    analysis = Analysis(maneuver_category=category)
    flags: List[Flag] = []

    # ── Raw series ────────────────────────────────────────────────────────────
    knee_l      = _series(good, "knee_bend_left")
    knee_r      = _series(good, "knee_bend_right")
    hip_h       = _series(good, "hip_hinge")
    gaze_d      = _series(good, "gaze_down")
    gaze_lat    = _series(good, "gaze_lateral")
    stance      = _series(good, "stance_width")
    com         = _series(good, "com_height")
    sh_rot      = _series(good, "shoulder_rotation")
    # New keys — no error if pose.py hasn't added these yet:
    hip_rot     = _series(good, "hip_rotation")     # separate hip yaw
    arm_spread  = _series(good, "arm_spread")       # wrist-to-wrist width, normalised
    arm_asym    = _series(good, "arm_asymmetry")    # L/R arm height difference
    hip_over_ft = _series(good, "hip_over_feet")    # lateral hip-over-feet offset

    over_thresh, under_thresh = KNEE_THRESHOLDS.get(category, KNEE_THRESHOLDS["general"])

    # Pre-compute compound metrics used across both flags and metrics output
    com_std    = float(np.std(com)) if len(com) > 1 else 0.0
    pump       = _pump_metrics(com, fps=fps)
    comp_ext   = _compression_metrics(com, knee_l)
    dead_time  = _dead_time_pct(com, knee_l)
    bias       = _foot_bias(hip_h)
    rail_score = _rail_engagement_score(sh_rot, hip_h, hip_over_ft)

    # ════════════════════════════════════════════════════════════════════════
    # PILLAR 1 — POSITION  (Stance & Balance, Rail Engagement)
    # ════════════════════════════════════════════════════════════════════════

    wide_thresh = STANCE_WIDE_AERIAL if category == "aerial" else STANCE_WIDE

    f = _flag_if(good, "stance_width",
                 lambda v: v < STANCE_NARROW,
                 "narrow_stance", "warning",
                 "Your feet are too close together. "
                 "Widen your stance to roughly shoulder-width for a more stable base.",
                 pillar="position")
    if f: flags.append(f)

    f = _flag_if(good, "stance_width",
                 lambda v, t=wide_thresh: v > t,
                 "wide_stance", "info",
                 "Your stance is very wide — this can restrict hip rotation in turns."
                 if category != "aerial" else
                 "Extremely wide stance even for an aerial — check your landing position.",
                 pillar="position")
    if f: flags.append(f)

    if bias == "front-heavy":
        flags.append(Flag(
            code="front_foot_heavy", severity="warning", pillar="position",
            message=(
                "Your weight is biased toward the front foot. "
                "This can cause the tail to skid and reduce directional control — "
                "try to stack your hips over centre."
            ),
            pct_frames=0.0,
        ))
    elif bias == "back-heavy":
        flags.append(Flag(
            code="back_foot_heavy", severity="warning", pillar="position",
            message=(
                "Your weight is sitting on the back foot. "
                "This stalls the board and bleeds speed — "
                "drive your front knee forward and over your toes through turns."
            ),
            pct_frames=0.0,
        ))

    if category not in ("aerial",) and com_std < 0.03:
        flags.append(Flag(
            code="static_com", severity="info", pillar="position",
            message=(
                "Your body height stays nearly constant throughout the ride. "
                "Compress low through the base of turns and extend through the top — "
                "this range of motion is what connects position to power."
            ),
            pct_frames=1.0,
        ))

    if category in ("power", "general") and rail_score < RAIL_GOOD_THRESH:
        flags.append(Flag(
            code="low_rail_engagement", severity="warning", pillar="position",
            message=(
                "Your body lean into turns looks limited. "
                "Commit more weight through your toes or heels into the rail — "
                "true carving starts with the whole body leaning, not just the arms."
            ),
            pct_frames=0.0,
        ))

    # ════════════════════════════════════════════════════════════════════════
    # PILLAR 2 — POWER  (Compression & Extension, Pump Detection, Rotation)
    # ════════════════════════════════════════════════════════════════════════

    if over_thresh is not None:
        f = _flag_if(good, "knee_bend_left",
                     lambda v, t=over_thresh: v < t,
                     "over_crouching", "warning",
                     (
                         f"Crouching very low (knee < {over_thresh}°) through most of the ride. "
                         f"For a {category} maneuver, aim for a controlled load rather than collapsing."
                         if category != "general" else
                         "Crouching too low through the ride. "
                         "Maintain an athletic stance — knee angle around 120–140°."
                     ),
                     pillar="power")
        if f: flags.append(f)

    if under_thresh is not None:
        f = _flag_if(good, "knee_bend_left",
                     lambda v, t=under_thresh: v > t,
                     "under_crouching", "issue",
                     "Standing too upright — not enough knee bend. "
                     "Lower your centre of mass for more control and power generation.",
                     pillar="power")
        if f: flags.append(f)

    # Pump frequency and amplitude flags (skip for tube/aerial where static crouch is correct)
    if category not in ("tube", "aerial"):
        if pump["frequency"] < PUMP_LOW_FREQ and pump["cycles"] > 0:
            flags.append(Flag(
                code="low_pump_frequency", severity="info", pillar="power",
                message=(
                    f"Pump rate is low ({pump['frequency']} cycles/sec). "
                    "Work on faster, more rhythmic compression-extension cycles "
                    "between sections to maintain and build speed."
                ),
                pct_frames=0.0,
            ))

        if pump["amplitude"] < PUMP_WEAK_AMP and len(com) > 10:
            flags.append(Flag(
                code="shallow_pumps", severity="info", pillar="power",
                message=(
                    "Pumping motion is shallow — very little CoM travel per cycle. "
                    "Drive harder through your knees and hips to put more energy into the board."
                ),
                pct_frames=0.0,
            ))

    # Shoulder rotation
    if category != "aerial":
        f = _flag_if(good, "shoulder_rotation",
                     lambda v: v < 0.05,
                     "square_shoulders", "warning",
                     "Shoulders look square to the camera through most of the ride. "
                     "Lead turns with your front shoulder to create rotation and drive speed.",
                     pillar="power")
        if f: flags.append(f)

    # Shoulder-hip separation (only if hip_rotation available from pose.py)
    if len(hip_rot) > 0 and len(sh_rot) > 0 and category != "aerial":
        n     = min(len(sh_rot), len(hip_rot))
        delta = sh_rot[:n] - hip_rot[:n]
        low_sep_pct = float(np.mean(np.abs(delta) < 0.05))
        if low_sep_pct > FLAG_FRACTION:
            flags.append(Flag(
                code="low_shoulder_hip_sep", severity="warning", pillar="power",
                message=(
                    "Shoulders and hips are rotating together rather than sequencing. "
                    "Upper body should initiate turns before the hips — "
                    "let your shoulders lead and your hips follow."
                ),
                pct_frames=round(low_sep_pct, 2),
            ))

    # ════════════════════════════════════════════════════════════════════════
    # PILLAR 3 — FLOW  (Head/Eye, Arm Usage, Linking)
    # ════════════════════════════════════════════════════════════════════════

    # Gaze — skip for aerials (head position chaotic during full rotation)
    if category != "aerial":
        f = _flag_if(good, "gaze_down",
                     lambda v: v > GAZE_DOWN_THRESH,
                     "looking_at_board", "issue",
                     "Head is dropping — you're watching the board instead of reading the wave. "
                     "Eyes lead the whole body: look where you want to go, not at your feet.",
                     pillar="flow")
        if f: flags.append(f)

        f = _flag_if(good, "gaze_lateral",
                     lambda v: abs(v) < GAZE_LATERAL_MIN,
                     "not_looking_down_line", "warning",
                     "Gaze doesn't appear directed down the line. "
                     "Turn your head toward the wave face to set up turns "
                     "and spot sections earlier.",
                     pillar="flow")
        if f: flags.append(f)

    # Arm usage (only if pose.py provides these keys)
    if len(arm_spread) > 0:
        f = _flag_if(good, "arm_spread",
                     lambda v: v < ARM_SPREAD_LOW,
                     "arms_too_close", "warning",
                     "Arms are staying too close to the body. "
                     "Spread your arms wide to improve balance and help initiate turns.",
                     pillar="flow")
        if f: flags.append(f)

    if len(arm_asym) > 0:
        f = _flag_if(good, "arm_asymmetry",
                     lambda v: v > ARM_ASYM_HIGH,
                     "arm_asymmetry", "info",
                     "Arms are asymmetric — one consistently higher or wider than the other. "
                     "Keep your leading arm driving forward through turns, "
                     "trailing arm guiding from behind.",
                     pillar="flow")
        if f: flags.append(f)

    # Dead time / linking
    if dead_time > DEAD_TIME_HIGH:
        flags.append(Flag(
            code="high_dead_time", severity="warning", pillar="flow",
            message=(
                f"{int(dead_time * 100)}% of the ride shows very little body movement. "
                "Stay active between maneuvers — keep pumping through flat sections "
                "and link your moves without pausing."
            ),
            pct_frames=dead_time,
        ))

    # ════════════════════════════════════════════════════════════════════════
    # Assemble output
    # ════════════════════════════════════════════════════════════════════════

    analysis.flags = flags

    analysis.metrics = {
        # ── POSITION ──────────────────────────────────────────────────────
        "stance_width":       _stat(stance),
        "com_height":         _stat(com),
        "com_height_std":     round(com_std, 3),
        "hip_hinge":          _stat(hip_h),
        "foot_bias":          bias,
        "rail_engagement":    rail_score,
        # ── POWER ─────────────────────────────────────────────────────────
        "knee_bend_left":     _stat(knee_l),
        "knee_bend_right":    _stat(knee_r),
        "compression_depth":  comp_ext["depth"],
        "compression_timing": comp_ext["timing_var"],
        "extension_ratio":    comp_ext["extension_ratio"],
        "pump_frequency":     pump["frequency"],
        "pump_amplitude":     pump["amplitude"],
        "pump_smoothness":    pump["smoothness"],
        "pump_cycles":        pump["cycles"],
        "shoulder_rotation":  _stat(sh_rot),
        "hip_rotation":       _stat(hip_rot) if len(hip_rot) > 0 else {},
        # ── FLOW ──────────────────────────────────────────────────────────
        "gaze_down":          _stat(gaze_d),
        "gaze_lateral":       _stat(gaze_lat),
        "arm_spread":         _stat(arm_spread) if len(arm_spread) > 0 else {},
        "arm_asymmetry":      _stat(arm_asym)   if len(arm_asym)   > 0 else {},
        "dead_time_pct":      dead_time,
        # ── META ──────────────────────────────────────────────────────────
        "frames_analysed":    len(good),
        "total_frames":       len(frame_data),
        # ── PILLAR SUMMARY (structured for frontend + AI critique prompt) ─
        "pillars": {
            "position": {
                "stance_width":    _stat(stance),
                "com_variability": round(com_std, 3),
                "foot_bias":       bias,
                "rail_engagement": rail_score,
            },
            "power": {
                "compression_depth": comp_ext["depth"],
                "extension_ratio":   comp_ext["extension_ratio"],
                "pump_frequency":    pump["frequency"],
                "pump_amplitude":    pump["amplitude"],
                "pump_smoothness":   pump["smoothness"],
                "knee_bend_mean_l":  round(float(np.mean(knee_l)), 1) if len(knee_l) > 0 else None,
                "knee_bend_mean_r":  round(float(np.mean(knee_r)), 1) if len(knee_r) > 0 else None,
                "shoulder_rotation": round(float(np.mean(sh_rot)), 2) if len(sh_rot) > 0 else None,
            },
            "flow": {
                "dead_time_pct":   dead_time,
                "gaze_down_mean":  round(float(np.mean(gaze_d)),   3) if len(gaze_d)   > 0 else None,
                "gaze_lat_mean":   round(float(np.mean(gaze_lat)), 3) if len(gaze_lat) > 0 else None,
                "arm_spread_mean": round(float(np.mean(arm_spread)), 2) if len(arm_spread) > 0 else None,
                "arm_asym_mean":   round(float(np.mean(arm_asym)),   2) if len(arm_asym)   > 0 else None,
            },
        },
    }

    # ── Summary text — fed directly into the Claude API critique prompt ───────
    maneuver_label = maneuver or "general surfing"
    position_flags = [f for f in flags if f.pillar == "position"]
    power_flags    = [f for f in flags if f.pillar == "power"]
    flow_flags     = [f for f in flags if f.pillar == "flow"]

    def _flag_block(flag_list: List[Flag], label: str) -> str:
        if not flag_list:
            return f"  {label}: ✓ No issues detected"
        lines = "\n".join(f"    - [{f.severity.upper()}] {f.message}" for f in flag_list)
        return f"  {label}:\n{lines}"

    analysis.summary = (
        f"Analysed {len(good)}/{len(frame_data)} frames | "
        f"Maneuver: {maneuver_label} | Category: {category}\n\n"
        f"═══ POSITION (Balance & Positioning) ═══\n"
        f"  Stance width: {analysis.metrics['stance_width'].get('mean', '?')} (normalised) | "
        f"Foot bias: {bias} | Rail engagement proxy: {rail_score}\n"
        f"  CoM variability (std): {com_std:.3f}\n"
        f"{_flag_block(position_flags, 'Position flags')}\n\n"
        f"═══ POWER (Speed Generation) ═══\n"
        f"  Knee bend L: {analysis.metrics['knee_bend_left'].get('mean', '?')}° | "
        f"R: {analysis.metrics['knee_bend_right'].get('mean', '?')}°\n"
        f"  Compression depth: {comp_ext['depth']} | Extension ratio: {comp_ext['extension_ratio']}\n"
        f"  Pump cycles: {pump['cycles']} @ {pump['frequency']} Hz | "
        f"Amplitude: {pump['amplitude']} | Smoothness: {pump['smoothness']}\n"
        f"{_flag_block(power_flags, 'Power flags')}\n\n"
        f"═══ FLOW (Movement Sequencing) ═══\n"
        f"  Dead time: {int(dead_time * 100)}% | "
        f"Gaze down mean: {analysis.metrics['gaze_down'].get('mean', '?')}\n"
        f"{_flag_block(flow_flags, 'Flow flags')}"
    )

    return asdict(analysis)