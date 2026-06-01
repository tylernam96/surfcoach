"""
pose.py — MediaPipe pose extraction with surf-specific joint metrics.
Returns frame_data list AND writes annotated video to output_path.
"""
import cv2
import mediapipe as mp
import numpy as np

mp_pose = mp.solutions.pose
mp_draw = mp.solutions.drawing_utils
mp_styles = mp.solutions.drawing_styles


def angle_between(a, b, c):
    """Angle at point b, formed by a-b-c."""
    a, b, c = np.array(a), np.array(b), np.array(c)
    ba, bc = a - b, c - b
    norm = np.linalg.norm(ba) * np.linalg.norm(bc)
    if norm == 0:
        return 0.0
    cos = np.dot(ba, bc) / norm
    return round(np.degrees(np.arccos(np.clip(cos, -1, 1))), 1)


def process_video(path: str, output_path: str = "output.mp4", sample_every: int = 3) -> list:
    cap = cv2.VideoCapture(path)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    out = cv2.VideoWriter(output_path, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))

    frame_data = []
    frame_num = 0

    with mp_pose.Pose(min_detection_confidence=0.5, min_tracking_confidence=0.5) as pose:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(rgb)

            if results.pose_landmarks:
                mp_draw.draw_landmarks(
                    frame,
                    results.pose_landmarks,
                    mp_pose.POSE_CONNECTIONS,
                    landmark_drawing_spec=mp_styles.get_default_pose_landmarks_style(),
                )
                lm = results.pose_landmarks.landmark

                if frame_num % sample_every == 0:
                    def pt(i):
                        return [lm[i].x, lm[i].y, lm[i].z]

                    # ── Core joint angles ────────────────────────────────────
                    knee_l = angle_between(pt(23), pt(25), pt(27))
                    knee_r = angle_between(pt(24), pt(26), pt(28))
                    hip_angle = angle_between(pt(11), pt(23), pt(25))

                    # ── Camera-normalised surf metrics ───────────────────────
                    shoulder_mid = np.mean([pt(11), pt(12)], axis=0)
                    hip_mid = np.mean([pt(23), pt(24)], axis=0)
                    torso_vec = np.array(shoulder_mid) - np.array(hip_mid)
                    torso_height = np.linalg.norm(torso_vec)
                    if torso_height < 1e-6:
                        torso_height = 1e-6  # guard divide-by-zero

                    nose = pt(0)

                    # Gaze lateral: how far nose is displaced sideways from shoulder midpoint
                    # normalised to torso height → camera-angle independent
                    gaze_lateral = round((nose[0] - shoulder_mid[0]) / torso_height, 3)

                    # Gaze down: positive means nose is below shoulder midpoint (looking at board)
                    gaze_down = round((nose[1] - shoulder_mid[1]) / torso_height, 3)

                    # Stance width normalised to torso height
                    ankle_dist = np.linalg.norm(np.array(pt(27)) - np.array(pt(28)))
                    stance_width = round(ankle_dist / torso_height, 3)

                    # CoM height proxy (hip midpoint y; 0=top, 1=bottom of frame)
                    com_height = round(float(hip_mid[1]), 3)

                    # Shoulder rotation: angle between shoulder line and hip line in x-z plane
                    # Approximation: difference in x-offset of shoulders vs hips
                    shoulder_rotation = round(
                        abs((lm[11].x - lm[12].x) - (lm[23].x - lm[24].x)) / torso_height, 3
                    )

                    # Arm position: average elbow bend (useful for flagging stiff arms)
                    elbow_l = angle_between(pt(11), pt(13), pt(15))
                    elbow_r = angle_between(pt(12), pt(14), pt(16))

                    confidence = round(sum(l.visibility for l in lm) / len(lm), 2)

                    record = {
                        "frame": frame_num,
                        "time_s": round(frame_num / fps, 2),
                        "knee_bend_left": knee_l,
                        "knee_bend_right": knee_r,
                        "hip_hinge": hip_angle,
                        "elbow_bend_left": elbow_l,
                        "elbow_bend_right": elbow_r,
                        "gaze_lateral": gaze_lateral,
                        "gaze_down": gaze_down,
                        "stance_width": stance_width,
                        "com_height": com_height,
                        "shoulder_rotation": shoulder_rotation,
                        "confidence": confidence,
                    }
                    frame_data.append(record)

                    # Overlay key values on frame
                    overlays = [
                        (25, f"KL:{knee_l}°"),
                        (26, f"KR:{knee_r}°"),
                        (23, f"H:{hip_angle}°"),
                    ]
                    for idx, label in overlays:
                        x, y = int(lm[idx].x * w), int(lm[idx].y * h)
                        cv2.putText(frame, label, (x + 8, y - 8),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)

            out.write(frame)
            frame_num += 1

    cap.release()
    out.release()

    print(f"Pose extraction done. {len(frame_data)} frames sampled.")
    return frame_data