"""
segmentation.py — Splits a ride into discrete phases for per-turn coaching.

Three products, all derived from the per-frame pose series (frame_data):

  popup   — takeoff / pop-up quality (time-to-feet, first compression).
            Best-effort: only reported when a clear "low body → standing"
            transition is visible at the start of the clip.

  turns   — individual turns segmented from the horizontal CoM trajectory
            (com_x). A turn is centred on a direction reversal of the board's
            travel. Each turn carries its own mini-score + plain-language
            summary so the UI can say "your 2nd bottom turn was your weakest".

  timing  — rhythm / linking across the ride: gaps between turns, how even the
            spacing is, and WHERE the dead (static) sections occurred.

Requires `com_x` in frame_data (added to pose.py). Sessions analysed before
com_x existed return empty structures, and the frontend hides these panels.

NOTE: turn *type* (bottom / top / cutback) is estimated from the rider's
vertical position on the wave — it is a heuristic and the UI labels it as such.
"""
from __future__ import annotations
from typing import List, Optional
import numpy as np

from scoring import _knee_score, _rotation_score, _label, _clamp


# ── Tunables ──────────────────────────────────────────────────────────────────

MIN_CONFIDENCE   = 0.40
MIN_FRAMES       = 12
MIN_TURN_GAP_S   = 0.40    # two reversals closer than this are one turn
DEAD_MOVE_THRESH = 0.006   # combined CoM movement/sample below this = "static"
DEAD_MIN_DUR_S   = 0.40    # a dead stretch must last at least this long to report


# ── Small helpers ───────────────────────────────────────────────────────────--

def _smooth(arr: np.ndarray, k: int = 5) -> np.ndarray:
    if len(arr) < k or k < 2:
        return arr
    # Edge-pad before convolving so the boundaries don't dip toward zero —
    # those dips otherwise register as phantom turns at the clip's start/end.
    pad = k // 2
    padded = np.pad(arr, pad, mode="edge")
    kernel = np.ones(k) / k
    return np.convolve(padded, kernel, mode="valid")[: len(arr)]


def _extrema(x: np.ndarray, min_gap: int, min_prom: float) -> List[tuple[int, str]]:
    """Local maxima/minima of x with a minimum index gap and prominence."""
    out: List[tuple[int, str]] = []
    for i in range(1, len(x) - 1):
        is_max = x[i] >= x[i - 1] and x[i] >= x[i + 1]
        is_min = x[i] <= x[i - 1] and x[i] <= x[i + 1]
        if not (is_max or is_min):
            continue
        # Prominence vs. a local neighbourhood
        lo = max(0, i - min_gap)
        hi = min(len(x), i + min_gap + 1)
        neigh = x[lo:hi]
        prom = (x[i] - neigh.min()) if is_max else (neigh.max() - x[i])
        if prom < min_prom:
            continue
        kind = "max" if is_max else "min"
        if out and (i - out[-1][0]) < min_gap:
            # Keep the more prominent of two close extrema of the same kind.
            continue
        out.append((i, kind))
    return out


def _empty() -> dict:
    return {
        "popup": None,
        "turns": [],
        "timing": {
            "turn_count": 0,
            "avg_gap_s": None,
            "rhythm_consistency": None,
            "summary": "Not enough motion data to map the ride's rhythm.",
            "dead_segments": [],
        },
        "available": False,
    }


# ── Pop-up / takeoff ────────────────────────────────────────────────────────--

def _detect_popup(t: np.ndarray, com_h: np.ndarray, knee: np.ndarray) -> Optional[dict]:
    """
    Detect a takeoff at the start of the clip.

    During a pop-up the rider is low/horizontal (hip-y large), then rises to a
    riding stance (hip-y settles to a baseline). We only report when the opening
    of the clip is clearly lower than the riding baseline — otherwise the clip
    likely starts mid-ride and there's no takeoff to grade.
    """
    if len(t) < MIN_FRAMES:
        return None

    duration = float(t[-1] - t[0])
    if duration < 1.0:
        return None

    # Riding baseline = median hip-y over the settled middle of the clip.
    mid = com_h[len(com_h) // 4: max(len(com_h) // 4 + 1, 3 * len(com_h) // 4)]
    baseline = float(np.median(mid))
    spread = float(np.std(com_h)) or 1e-6

    # Opening window: first ~1.5s.
    open_mask = (t - t[0]) <= 1.5
    if open_mask.sum() < 3:
        return None
    open_peak = float(np.max(com_h[open_mask]))  # lowest body point (largest y)

    # Require the opening to sit clearly lower (larger y) than the baseline.
    if open_peak < baseline + 0.5 * spread:
        return None

    # Time-to-feet: first frame where hip-y has risen back to the baseline band.
    feet_idx = None
    for i in range(len(com_h)):
        if com_h[i] <= baseline + 0.2 * spread:
            feet_idx = i
            break
    if feet_idx is None or t[feet_idx] - t[0] > 2.5:
        return None
    time_to_feet = round(float(t[feet_idx] - t[0]), 2)

    # First compression after standing = deepest knee bend in the ~1.5s window
    # right after the rider gets to their feet (not the whole rest of the ride).
    first_comp_s = None
    first_comp_knee = None
    if len(knee) == len(t):
        win_mask = (t - t[feet_idx]) >= 0
        win_mask &= (t - t[feet_idx]) <= 1.5
        idxs = np.where(win_mask)[0]
        if len(idxs) >= 2:
            j = idxs[int(np.argmin(knee[idxs]))]
            first_comp_s = round(float(t[j] - t[0]), 2)
            first_comp_knee = round(float(knee[j]), 1)

    # Score: faster to feet = better; reward an early committed first compression.
    score = _clamp(100 - max(0.0, time_to_feet - 0.6) * 45)
    if first_comp_knee is not None and first_comp_knee < 120:
        score = min(100, score + 5)

    if time_to_feet <= 0.9:
        summary = "Quick, clean pop-up"
    elif time_to_feet <= 1.4:
        summary = "Solid pop-up"
    else:
        summary = "Slow to your feet"

    note = f"Up to your feet in {time_to_feet}s"
    if first_comp_knee is not None:
        note += f", first compression to {first_comp_knee}° at {first_comp_s}s"
    note += "."

    return {
        "detected": True,
        "time_to_feet_s": time_to_feet,
        "first_compression_s": first_comp_s,
        "first_compression_knee": first_comp_knee,
        "value": score,
        "label": _label(score),
        "summary": summary,
        "note": note,
    }


# ── Turn classification + scoring ─────────────────────────────────────────────

def _classify_turns(feats: List[dict], net_drift: float) -> List[str]:
    """
    Estimate each turn's type from several cues rather than vertical position
    alone:
      • vertical position on the wave  (low = bottom turn, high = top turn)
      • compression depth              (bottom turns load the deepest)
      • shoulder rotation              (top turns / cutbacks snap harder)
      • horizontal swing + direction reversal (the cutback signature — a turn
        back toward the pocket, against the rider's net down-the-line drift)
      • sequence priors                (rides open on a bottom turn off the
        takeoff, and turns tend to alternate bottom→top→bottom)

    Still a heuristic — 2D pose can't see the wave itself — but it fuses five
    signals instead of one, which is materially more reliable.
    """
    n = len(feats)
    if n == 0:
        return []

    ch  = np.array([f["ch"] for f in feats])
    knm = np.array([f["knee_min"] for f in feats])
    rot = np.array([f["rot"] for f in feats])
    xsw = np.array([f["xswing"] for f in feats])
    xdir = np.array([f["xdir"] for f in feats])

    def z(a: np.ndarray) -> np.ndarray:
        s = float(np.std(a))
        return (a - float(np.mean(a))) / s if s > 1e-6 else np.zeros_like(a)

    ch_z = z(ch)        # high → low on the wave  (bottom-ish)
    depth_z = z(-knm)   # high → deeper compression (bottom-ish)
    rot_z = z(rot)      # high → more rotation     (top / cutback)
    xsw_z = z(xsw)      # high → bigger horizontal swing (cutback)

    drift_sign = float(np.sign(net_drift))
    types: List[str] = []
    for i in range(n):
        reverses = drift_sign != 0 and xdir[i] == -drift_sign

        bottom  = 1.0 * ch_z[i] + 0.8 * depth_z[i]
        top     = -1.0 * ch_z[i] + 0.6 * rot_z[i] - 0.3 * depth_z[i]
        cutback = 1.0 * xsw_z[i] + 0.5 * rot_z[i] - 0.3 * abs(ch_z[i])
        cutback += 0.8 if reverses else -0.4

        if i == 0:
            bottom += 0.6  # rides almost always open with a bottom turn

        scores = {"Bottom turn": bottom, "Top turn": top, "Cutback": cutback}

        # Alternation nudge: discourage repeating the previous bottom/top type.
        if types and types[-1] in ("Bottom turn", "Top turn"):
            scores[types[-1]] -= 0.5

        types.append(max(scores, key=scores.get))
    return types


def _score_turn(
    knee_win: np.ndarray,
    sh_rot_win: np.ndarray,
    com_h_win: np.ndarray,
    category: str,
) -> tuple[int, str, str]:
    """Mini-score for a single turn window. Returns (value, summary, note)."""
    knee_min = float(np.min(knee_win)) if len(knee_win) else None
    knee_rng = float(np.ptp(knee_win)) if len(knee_win) else None
    rot_mean = float(np.mean(sh_rot_win)) if len(sh_rot_win) else None

    knee_s, _, knee_note = _knee_score(knee_min, knee_rng, category)
    rot_s, _, _ = _rotation_score(rot_mean, category)

    # Commitment from vertical travel through the turn (more range = more drive).
    com_ptp = float(np.ptp(com_h_win)) if len(com_h_win) > 1 else 0.0
    commit_s = _clamp(30 + min(com_ptp / 0.10, 1.0) * 70)

    value = _clamp(knee_s * 0.5 + rot_s * 0.25 + commit_s * 0.25)

    if knee_s >= 70 and commit_s >= 65:
        summary = "Committed and powerful"
    elif knee_s < 50:
        summary = "Stand taller — drive harder"
    elif rot_s < 50:
        summary = "Open the shoulders more"
    elif commit_s < 50:
        summary = "Lean further into it"
    else:
        summary = "Solid turn"

    note = (
        f"Compressed to {round(knee_min)}° " if knee_min is not None else ""
    ) + f"with {round(com_ptp * 100)}% body travel through the arc. {knee_note}"
    return value, summary, note.strip()


# ── Main entry point ──────────────────────────────────────────────────────────

def segment_ride(
    frame_data: list,
    fps: float = 30.0,
    category: str = "general",
) -> dict:
    """
    Returns the segmentation dict described in the module docstring.
    Safe on any input — returns empty (available=False) when the data can't
    support segmentation (no com_x, too few frames, no clear turns).
    """
    good = [f for f in frame_data if f.get("confidence", 0) >= MIN_CONFIDENCE]
    if len(good) < MIN_FRAMES or not all("com_x" in f for f in good[:3]):
        return _empty()

    t      = np.array([f.get("time_s", i) for i, f in enumerate(good)], dtype=float)
    com_x  = np.array([f.get("com_x", np.nan) for f in good], dtype=float)
    com_h  = np.array([f.get("com_height", np.nan) for f in good], dtype=float)
    knee_l = np.array([f.get("knee_bend_left", np.nan) for f in good], dtype=float)
    knee_r = np.array([f.get("knee_bend_right", np.nan) for f in good], dtype=float)
    knee   = np.nanmin(np.vstack([knee_l, knee_r]), axis=0)
    sh_rot = np.array([f.get("shoulder_rotation", 0.0) for f in good], dtype=float)

    if np.isnan(com_x).all():
        return _empty()
    com_x = np.nan_to_num(com_x, nan=float(np.nanmean(com_x)))
    com_h = np.nan_to_num(com_h, nan=float(np.nanmean(com_h)))

    # Sampling cadence (frame_data is decimated, so use real timestamps).
    dt = float(np.median(np.diff(t))) if len(t) > 1 else (3.0 / fps)
    dt = dt if dt > 1e-3 else (3.0 / fps)
    min_gap = max(2, int(round(MIN_TURN_GAP_S / dt)))

    # ── Turns from horizontal direction reversals ────────────────────────────
    cx_s = _smooth(com_x, k=min(7, max(3, min_gap)))
    prom = max(0.02, 0.30 * float(np.std(cx_s)))
    apexes = _extrema(cx_s, min_gap=min_gap, min_prom=prom)

    # First pass — build each turn's window and its classification features.
    apex_idxs = [a[0] for a in apexes]
    windows: List[dict] = []
    for n, idx in enumerate(apex_idxs):
        # Window = midpoint to previous apex … midpoint to next apex.
        prev_i = apex_idxs[n - 1] if n > 0 else 0
        next_i = apex_idxs[n + 1] if n < len(apex_idxs) - 1 else len(good) - 1
        start = (prev_i + idx) // 2 if n > 0 else max(0, idx - min_gap)
        end = (idx + next_i) // 2 if n < len(apex_idxs) - 1 else min(len(good) - 1, idx + min_gap)
        if end <= start:
            continue
        kseg = knee[start:end + 1]
        windows.append({
            "start": start, "idx": idx, "end": end,
            "ch": float(com_h[idx]),
            "knee_min": float(np.min(kseg)) if len(kseg) else 180.0,
            "rot": float(np.mean(sh_rot[start:end + 1])),
            "xswing": float(np.ptp(com_x[start:end + 1])),
            "xdir": float(np.sign(com_x[end] - com_x[start])),
        })

    net_drift = float(np.sign(com_x[-1] - com_x[0]))
    types = _classify_turns(windows, net_drift)

    # Second pass — score each turn window.
    turns: List[dict] = []
    for w, ttype in zip(windows, types):
        value, summary, note = _score_turn(
            knee[w["start"]:w["end"] + 1],
            sh_rot[w["start"]:w["end"] + 1],
            com_h[w["start"]:w["end"] + 1],
            category,
        )
        turns.append({
            "index": len(turns) + 1,
            "type": ttype,
            "start_s": round(float(t[w["start"]]), 2),
            "peak_s": round(float(t[w["idx"]]), 2),
            "end_s": round(float(t[w["end"]]), 2),
            "value": value,
            "label": _label(value),
            "summary": summary,
            "note": note,
        })

    # ── Pop-up ────────────────────────────────────────────────────────────────
    popup = _detect_popup(t, com_h, knee)

    # ── Timing / linking ──────────────────────────────────────────────────────
    timing = _timing(t, com_x, com_h, turns, dt)

    return {
        "popup": popup,
        "turns": turns,
        "timing": timing,
        "available": True,
    }


def _timing(
    t: np.ndarray,
    com_x: np.ndarray,
    com_h: np.ndarray,
    turns: List[dict],
    dt: float,
) -> dict:
    # Inter-turn gaps (end of one turn → start of the next).
    gaps = [
        round(turns[i + 1]["start_s"] - turns[i]["end_s"], 2)
        for i in range(len(turns) - 1)
    ]
    gaps = [g for g in gaps if g >= 0]
    avg_gap = round(float(np.mean(gaps)), 2) if gaps else None

    # Rhythm consistency: even spacing of turn apexes → high score.
    rhythm = None
    if len(turns) >= 3:
        intervals = np.diff([tn["peak_s"] for tn in turns])
        mean_int = float(np.mean(intervals))
        if mean_int > 0:
            cv = float(np.std(intervals)) / mean_int  # coefficient of variation
            rhythm = _clamp(100 - cv * 120)

    # Dead segments: stretches with very little combined CoM movement.
    move = np.sqrt(np.diff(com_x) ** 2 + np.diff(com_h) ** 2)
    dead_mask = move < DEAD_MOVE_THRESH
    dead_segments: List[dict] = []
    i = 0
    min_run = max(2, int(round(DEAD_MIN_DUR_S / dt)))
    while i < len(dead_mask):
        if dead_mask[i]:
            j = i
            while j < len(dead_mask) and dead_mask[j]:
                j += 1
            if (j - i) >= min_run:
                dead_segments.append({
                    "start_s": round(float(t[i]), 2),
                    "end_s": round(float(t[j]), 2),
                    "duration_s": round(float(t[j] - t[i]), 2),
                })
            i = j
        else:
            i += 1

    # Plain-language headline.
    if len(turns) < 2:
        summary = "Too few turns to assess rhythm — link more moves together."
    elif rhythm is not None and rhythm >= 75:
        summary = f"Smooth rhythm — {len(turns)} turns evenly linked."
    elif rhythm is not None and rhythm >= 50:
        summary = f"{len(turns)} turns, but the spacing is a little uneven."
    else:
        summary = f"{len(turns)} turns with stop-start timing — keep moving between them."
    if dead_segments:
        longest = max(dead_segments, key=lambda d: d["duration_s"])
        summary += f" Longest stall: {longest['duration_s']}s around {longest['start_s']}s."

    return {
        "turn_count": len(turns),
        "avg_gap_s": avg_gap,
        "rhythm_consistency": rhythm,
        "summary": summary,
        "dead_segments": dead_segments,
    }
