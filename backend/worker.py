"""
worker.py — orchestrates the full video processing pipeline:
  1. Download video from Supabase Storage
  2. Run MediaPipe pose extraction (pose.py)
  3. Run surf-specific analysis (analyse.py)
  4. Get Claude critique (claude_client.py)
  5. Write results back to Supabase
  6. Clean up temp files
"""
import os
import uuid
import tempfile
import requests
import traceback
from supabase_client import get_supabase
from pose import process_video
from analyse import analyse_pose_data
from claude import get_surf_critique
from scoring import compute_scores
from segmentation import segment_ride



def download_video(url: str, dest_path: str):
    """Stream-download a video from a signed Supabase URL."""
    r = requests.get(url, stream=True, timeout=60)
    r.raise_for_status()
    with open(dest_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)


def compress_video(input_path: str, output_path: str, target_mb: int = 40):
    """Re-encode with ffmpeg targeting a file size under target_mb."""
    import subprocess, json
    probe = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", input_path],
        capture_output=True, text=True, check=True,
    )
    duration = float(json.loads(probe.stdout)["format"]["duration"])
    target_bits = target_mb * 8 * 1024 * 1024
    bitrate = int(target_bits / duration * 0.92)  # 8% headroom
    subprocess.run([
        "ffmpeg", "-y", "-i", input_path,
        "-c:v", "libx264", "-b:v", str(bitrate),
        "-preset", "fast", "-movflags", "+faststart",
        "-an",  # annotated video has no audio
        output_path,
    ], check=True, capture_output=True)


def _derive_facing(stance: str | None, wave_direction: str | None) -> str | None:
    """
    Frontside vs backside is a pure function of lead foot × wave direction and
    is camera-independent (unlike anything we infer from the frame):
      • Regular (left foot forward): Right = frontside, Left = backside
      • Goofy   (right foot forward): Left  = frontside, Right = backside
    """
    if not stance or not wave_direction:
        return None
    s, w = stance.lower(), wave_direction.lower()
    if s == "regular":
        return "frontside" if w == "right" else "backside" if w == "left" else None
    if s == "goofy":
        return "frontside" if w == "left" else "backside" if w == "right" else None
    return None


def _window_frames(frame_data: list, clip) -> list:
    """Restrict the pose series to a [start_s, end_s] wave window (item 6).

    Trimming to one wave focuses every downstream metric — dead-time, pump
    cadence, turns — on the ride itself instead of the paddle-out or a second
    wave, which is what produces false 'stalls'. Times stay in original-video
    coordinates so timeline markers still line up with the full clip.
    """
    if not clip or len(clip) != 2:
        return frame_data
    lo, hi = float(clip[0]), float(clip[1])
    if hi <= lo:
        return frame_data
    return [f for f in frame_data if lo <= float(f.get("time_s", 0)) <= hi]


def _apply_turn_labels(segments: dict, overrides: dict | None) -> list[dict]:
    """Apply rider turn corrections (item 5) onto freshly computed turns.

    Overrides are keyed by 1-based turn index → {type?, mark?}. We capture the
    pre-override (predicted) type so the correction can be stored as a training
    label. Returns a list of label records for the turn_labels table.
    """
    labels: list[dict] = []
    if not overrides:
        return labels
    for turn in segments.get("turns", []):
        ov = overrides.get(str(turn["index"])) or overrides.get(turn["index"])
        if not ov:
            continue
        predicted = turn.get("type")
        corrected = ov.get("type") or predicted
        mark = ov.get("mark")
        if ov.get("type"):
            turn["type"] = ov["type"]
        if mark:
            turn["mark"] = mark
        labels.append({
            "turn_index": turn["index"],
            "predicted_type": predicted,
            "corrected_type": corrected,
            "mark": mark,
            "start_s": turn.get("start_s"),
            "peak_s": turn.get("peak_s"),
            "end_s": turn.get("end_s"),
        })
    return labels


def resegment_session(session_id: str, manual_tags: dict | None = None) -> dict:
    """
    Re-run analysis on an already-analysed session using rider corrections —
    WITHOUT re-running MediaPipe. The per-frame pose series is persisted on the
    session row (`frame_data`), so this is cheap and fast.

    `manual_tags` is the FULL desired correction set (idempotent — replaces what
    was stored):
        { "takeoff_s": float, "clip": [start_s, end_s], "turn_labels": {...} }

    What gets recomputed:
      • segments — always (takeoff anchor + clip window + turn overrides).
      • metrics/scores — always, on the (possibly windowed) frames. Deterministic
        and cheap; this is what makes a trim actually move the scores.
      • critique — only when the analysis text materially changes (i.e. a trim),
        so turn relabels / takeoff taps don't trigger the (external) Claude call.

    Returns the updated analysis dict (segments + scores).
    """
    supabase = get_supabase()
    manual_tags = manual_tags or {}

    row = (
        supabase.table("sessions")
        .select("frame_data, analysis, critique")
        .eq("id", session_id)
        .single()
        .execute()
    )
    if not row.data:
        raise ValueError(f"Session {session_id} not found")

    frame_data = row.data.get("frame_data")
    if not frame_data:
        raise ValueError(
            "No pose data stored for this session — re-run the full analysis first."
        )

    old_analysis = row.data.get("analysis") or {}
    context = old_analysis.get("context") or {}

    # ── Window to the chosen wave, then re-derive everything from those frames ─
    clip = manual_tags.get("clip")
    frames = _window_frames(frame_data, clip)
    if len(frames) < 1:
        frames = frame_data  # degenerate trim — fall back to the whole clip

    analysis = analyse_pose_data(frames, context=context)
    analysis["scores"] = compute_scores(analysis)
    segments = segment_ride(
        frames,
        category=analysis.get("maneuver_category", "general"),
        takeoff_s=manual_tags.get("takeoff_s"),
    )

    # ── Turn corrections: apply live + persist as training data ───────────────
    turn_label_rows = _apply_turn_labels(segments, manual_tags.get("turn_labels"))
    analysis["segments"] = segments

    # Critique only re-runs when the windowed analysis actually differs — keeps
    # the external call off the path for takeoff taps and turn relabels.
    if analysis.get("summary") != old_analysis.get("summary"):
        critique = get_surf_critique(analysis)
    else:
        critique = row.data.get("critique")

    supabase.table("sessions").update({
        "analysis": analysis,
        "critique": critique,
        "manual_tags": manual_tags,
    }).eq("id", session_id).execute()

    # Upsert training labels (one row per corrected turn).
    if turn_label_rows:
        supabase.table("turn_labels").upsert(
            [{"session_id": session_id, **r} for r in turn_label_rows],
            on_conflict="session_id,turn_index",
        ).execute()

    print(
        f"[{session_id}] Re-segmented "
        f"(takeoff={manual_tags.get('takeoff_s')}, clip={clip}, "
        f"labels={len(turn_label_rows)}) ✓"
    )
    return analysis


def process_video_job(
    session_id: str,
    video_url: str,
    wave_direction: str | None = None,
    stance: str | None = None,
):
    supabase = get_supabase()

    context = {
        "stance": stance,
        "wave_direction": wave_direction,
        "facing": _derive_facing(stance, wave_direction),
    }

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            # ── 1. Download ──────────────────────────────────────────────────
            video_path = os.path.join(tmpdir, "input.mp4")
            output_path = os.path.join(tmpdir, "output.mp4")
            print(f"[{session_id}] Downloading video...")
            download_video(video_url, video_path)

            # ── 2. Pose extraction ───────────────────────────────────────────
            print(f"[{session_id}] Running MediaPipe...")
            frame_data = process_video(video_path, output_path=output_path, sample_every=3)
            # frame_data is a list of dicts with joint angles per frame
            print(f"[{session_id}] Extracted {len(frame_data)} frames")
            if frame_data:
                print(f"[{session_id}] First frame sample: {frame_data[0].get('knee_bend_left', 'N/A')}")

            if not frame_data:
                raise ValueError("No pose landmarks detected — is a surfer visible in the video?")

            # ── 3. Surf analysis (rule-based) ────────────────────────────────
            print(f"[{session_id}] Analysing surf form...")
            analysis = analyse_pose_data(frame_data, context=context)
            analysis["scores"] = compute_scores(analysis)
            analysis["segments"] = segment_ride(
                frame_data, category=analysis.get("maneuver_category", "general")
            )

            # analysis = { "flags": [...], "metrics": {...}, "summary": "...",
            #              "scores": {...}, "segments": {...} }

            # ── 4. Claude natural-language critique ──────────────────────────
            print(f"[{session_id}] Getting Claude critique...")
            critique = get_surf_critique(analysis)
            # critique = { "overall": "...", "tips": [...], "positives": [...] }

            # ── 5. Upload annotated video to Supabase Storage ────────────────
            # Store the storage path, NOT a signed URL — signed URLs expire.
            # The frontend generates a fresh signed URL on each page load.
            annotated_video_path = None
            if os.path.exists(output_path):
                print(f"[{session_id}] Compressing annotated video...")
                compressed_path = output_path.replace(".mp4", "_compressed.mp4")
                compress_video(output_path, compressed_path, target_mb=40)

                annotated_video_path = f"annotated/{session_id}.mp4"
                with open(compressed_path, "rb") as f:
                    supabase.storage.from_("surf-videos").upload(
                        annotated_video_path,
                        f,
                        {"content-type": "video/mp4", "upsert": "true"},
                    )
                os.remove(compressed_path)

            # ── 6. Write results ─────────────────────────────────────────────
            supabase.table("sessions").update({
                "status": "complete",
                "frame_data": frame_data,
                "analysis": analysis,
                "critique": critique,
                "annotated_video_path": annotated_video_path,  # path, not URL
            }).eq("id", session_id).execute()

            print(f"[{session_id}] Done ✓")

    except Exception as e:
        print(f"[{session_id}] ERROR: {e}")
        traceback.print_exc()
        supabase.table("sessions").update({
            "status": "error",
            "error_message": str(e),
        }).eq("id", session_id).execute()