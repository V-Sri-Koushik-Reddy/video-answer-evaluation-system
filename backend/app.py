import os
import json
import math
import re
import subprocess
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Tuple

import cv2
import whisper
from sentence_transformers import SentenceTransformer, util


# =========================
# CONFIG
# =========================
VIDEO_PATH = "input/student.mp4"
REFERENCE_PATH = "input/reference.txt"
OUTPUT_DIR = "output"

AUDIO_PATH = os.path.join(OUTPUT_DIR, "student_audio.wav")
TRANSCRIPT_PATH = os.path.join(OUTPUT_DIR, "transcript.json")
RESULT_PATH = os.path.join(OUTPUT_DIR, "evaluation_result.json")

WHISPER_MODEL = "base"      # tiny / base / small / medium
CHUNK_SECONDS = 10
FRAME_SAMPLE_EVERY_SEC = 1  # sample one frame per second for visual analysis

FILLER_WORDS = {
    "um", "uh", "like", "basically", "actually", "you know", "sort of", "kind of"
}

STOPWORDS = {
    "the", "is", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with",
    "that", "this", "it", "as", "by", "at", "from", "are", "was", "were", "be",
    "been", "being", "has", "have", "had", "do", "does", "did", "will", "would",
    "can", "could", "should", "may", "might", "about", "into", "than", "then",
    "their", "there", "them", "they", "he", "she", "we", "you", "i"
}


# =========================
# DATA CLASSES
# =========================
@dataclass
class ChunkResult:
    chunk_id: int
    start: float
    end: float
    text: str
    semantic_similarity: float
    keyword_coverage: float
    filler_ratio: float
    visual_activity: float
    chunk_score_10: float
    visual_tag: str


# =========================
# UTILS
# =========================
def ensure_dirs() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)


def run_cmd(cmd: List[str]) -> None:
    try:
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Command failed: {' '.join(cmd)}") from e


def extract_audio(video_path: str, audio_path: str) -> None:
    """
    Extract mono 16k WAV audio using ffmpeg.
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video not found: {video_path}")

    cmd = [
        "ffmpeg",
        "-y",
        "-i", video_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        audio_path
    ]
    run_cmd(cmd)


def detect_device() -> str:
    """
    Prefer MPS on Apple Silicon if available.
    """
    try:
        import torch
        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            return "mps"
        return "cpu"
    except Exception:
        return "cpu"


def transcribe_audio(audio_path: str, model_name: str = "base") -> Dict[str, Any]:
    """
    Run Whisper transcription.
    """
    device = detect_device()
    model = whisper.load_model(model_name, device=device)
    result = model.transcribe(audio_path, verbose=False)

    with open(TRANSCRIPT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    return result


def read_reference(reference_path: str) -> str:
    if not os.path.exists(reference_path):
        raise FileNotFoundError(f"Reference answer not found: {reference_path}")

    with open(reference_path, "r", encoding="utf-8") as f:
        text = f.read().strip()

    if not text:
        raise ValueError("Reference text is empty.")

    return text


def normalize_text(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text


def extract_keywords(text: str) -> List[str]:
    tokens = normalize_text(text).split()
    keywords = [t for t in tokens if t not in STOPWORDS and len(t) > 2]
    return list(dict.fromkeys(keywords))


def count_fillers(text: str) -> Tuple[int, float]:
    cleaned = normalize_text(text)
    total_words = max(1, len(cleaned.split()))

    filler_count = 0
    for filler in FILLER_WORDS:
        filler_count += len(re.findall(rf"\b{re.escape(filler)}\b", cleaned))

    filler_ratio = filler_count / total_words
    return filler_count, round(filler_ratio, 4)


# =========================
# VIDEO / VISUAL ANALYSIS
# =========================
def get_video_duration_and_fps(video_path: str) -> Tuple[float, float]:
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
    duration = frame_count / fps if fps > 0 else 0.0
    cap.release()
    return duration, fps


def sample_frames_for_activity(video_path: str, sample_every_sec: int = 1) -> List[Dict[str, Any]]:
    """
    Sample one frame every N seconds and compute a simple motion/activity score
    using grayscale frame differences.
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = total_frames / fps if fps > 0 else 0.0

    sampled = []
    prev_gray = None
    t = 0.0

    while t <= duration:
        frame_idx = int(t * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ok, frame = cap.read()
        if not ok or frame is None:
            t += sample_every_sec
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.resize(gray, (320, 180))

        if prev_gray is None:
            motion_score = 0.0
        else:
            diff = cv2.absdiff(gray, prev_gray)
            motion_score = float(diff.mean())

        sampled.append({
            "time": round(t, 2),
            "motion_score": motion_score
        })

        prev_gray = gray
        t += sample_every_sec

    cap.release()
    return sampled


def motion_to_visual_tag(avg_motion: float) -> str:
    if avg_motion < 2.0:
        return "mostly static"
    if avg_motion < 8.0:
        return "light movement"
    if avg_motion < 18.0:
        return "moderate activity"
    return "high activity"


def aggregate_visual_activity_by_chunk(
    sampled_activity: List[Dict[str, Any]],
    chunked_segments: List[Dict[str, Any]]
) -> Dict[int, Dict[str, Any]]:
    activity_map: Dict[int, Dict[str, Any]] = {}

    for chunk in chunked_segments:
        start_t = chunk["start"]
        end_t = chunk["end"]

        relevant = [
            s["motion_score"]
            for s in sampled_activity
            if start_t <= s["time"] < end_t
        ]

        if relevant:
            avg_motion = sum(relevant) / len(relevant)
        else:
            avg_motion = 0.0

        # normalize rough activity score into [0,1]
        visual_activity = max(0.0, min(1.0, avg_motion / 20.0))

        activity_map[chunk["chunk_id"]] = {
            "avg_motion": round(avg_motion, 4),
            "visual_activity": round(visual_activity, 4),
            "visual_tag": motion_to_visual_tag(avg_motion)
        }

    return activity_map


# =========================
# CHUNKING
# =========================
def merge_segments_into_time_chunks(
    segments: List[Dict[str, Any]],
    chunk_seconds: int = 10
) -> List[Dict[str, Any]]:
    """
    Merge Whisper segments into fixed time buckets.
    """
    if not segments:
        return []

    max_end = max(seg["end"] for seg in segments)
    num_chunks = math.ceil(max_end / chunk_seconds)

    chunked = []
    for i in range(num_chunks):
        start_t = i * chunk_seconds
        end_t = min((i + 1) * chunk_seconds, max_end)

        texts = []
        for seg in segments:
            seg_start = seg["start"]
            seg_end = seg["end"]

            if seg_end > start_t and seg_start < end_t:
                texts.append(seg["text"].strip())

        merged_text = " ".join(t for t in texts if t).strip()

        # skip fully empty chunks
        if not merged_text:
            continue

        chunked.append({
            "chunk_id": len(chunked) + 1,
            "start": round(start_t, 2),
            "end": round(end_t, 2),
            "text": merged_text
        })

    return chunked


# =========================
# SEMANTIC + SCORING
# =========================
def compute_keyword_coverage(chunk_text: str, reference_keywords: List[str]) -> float:
    if not reference_keywords:
        return 0.0

    chunk_words = set(extract_keywords(chunk_text))
    hits = sum(1 for kw in reference_keywords if kw in chunk_words)
    return round(hits / len(reference_keywords), 4)


def score_chunks_against_reference(
    chunked_segments: List[Dict[str, Any]],
    reference_text: str,
    visual_map: Dict[int, Dict[str, Any]]
) -> List[ChunkResult]:
    """
    Combined evaluation:
    - semantic similarity
    - keyword coverage
    - filler penalty
    - visual activity context
    """
    model = SentenceTransformer("all-MiniLM-L6-v2")
    reference_embedding = model.encode(reference_text, convert_to_tensor=True)
    reference_keywords = extract_keywords(reference_text)

    results: List[ChunkResult] = []

    for chunk in chunked_segments:
        chunk_text = chunk["text"].strip()

        if not chunk_text:
            semantic_similarity = 0.0
            keyword_coverage = 0.0
            filler_ratio = 0.0
        else:
            chunk_embedding = model.encode(chunk_text, convert_to_tensor=True)
            sim_tensor = util.cos_sim(chunk_embedding, reference_embedding)
            semantic_similarity = float(sim_tensor[0][0])
            semantic_similarity = max(0.0, min(1.0, semantic_similarity))

            keyword_coverage = compute_keyword_coverage(chunk_text, reference_keywords)
            _, filler_ratio = count_fillers(chunk_text)

        visual_info = visual_map.get(chunk["chunk_id"], {
            "visual_activity": 0.0,
            "visual_tag": "unknown"
        })

        visual_activity = float(visual_info["visual_activity"])
        visual_tag = str(visual_info["visual_tag"])

        # weighted chunk score
        # visual activity is lightly used, mostly as context
        # filler ratio is converted to a penalty
        filler_penalty = min(1.0, filler_ratio * 10.0)

        combined_score = (
            0.70 * semantic_similarity +
            0.20 * keyword_coverage +
            0.10 * visual_activity -
            0.10 * filler_penalty
        )

        combined_score = max(0.0, min(1.0, combined_score))

        results.append(
            ChunkResult(
                chunk_id=chunk["chunk_id"],
                start=chunk["start"],
                end=chunk["end"],
                text=chunk_text,
                semantic_similarity=round(semantic_similarity, 4),
                keyword_coverage=round(keyword_coverage, 4),
                filler_ratio=round(filler_ratio, 4),
                visual_activity=round(visual_activity, 4),
                chunk_score_10=round(combined_score * 10, 2),
                visual_tag=visual_tag
            )
        )

    return results


def compute_final_score(chunk_results: List[ChunkResult]) -> Dict[str, Any]:
    if not chunk_results:
        return {
            "overall_semantic_similarity": 0.0,
            "overall_keyword_coverage": 0.0,
            "overall_visual_activity": 0.0,
            "overall_score_10": 0.0,
            "overall_score_100": 0.0
        }

    avg_semantic = sum(c.semantic_similarity for c in chunk_results) / len(chunk_results)
    avg_keywords = sum(c.keyword_coverage for c in chunk_results) / len(chunk_results)
    avg_visual = sum(c.visual_activity for c in chunk_results) / len(chunk_results)
    avg_filler = sum(c.filler_ratio for c in chunk_results) / len(chunk_results)

    filler_penalty = min(1.0, avg_filler * 10.0)

    final_score = (
        0.70 * avg_semantic +
        0.20 * avg_keywords +
        0.10 * avg_visual -
        0.10 * filler_penalty
    )

    final_score = max(0.0, min(1.0, final_score))

    return {
        "overall_semantic_similarity": round(avg_semantic, 4),
        "overall_keyword_coverage": round(avg_keywords, 4),
        "overall_visual_activity": round(avg_visual, 4),
        "overall_filler_ratio": round(avg_filler, 4),
        "overall_score_10": round(final_score * 10, 2),
        "overall_score_100": round(final_score * 100, 2)
    }


# =========================
# STRUCTURED OUTPUT
# =========================
def build_structured_timeline(chunk_results: List[ChunkResult]) -> List[Dict[str, Any]]:
    timeline = []
    for c in chunk_results:
        timeline.append({
            "chunk_id": c.chunk_id,
            "time_range": f"{c.start:.1f}s - {c.end:.1f}s",
            "transcript": c.text,
            "visual_summary": c.visual_tag,
            "semantic_similarity": c.semantic_similarity,
            "keyword_coverage": c.keyword_coverage,
            "filler_ratio": c.filler_ratio,
            "visual_activity": c.visual_activity,
            "chunk_score_10": c.chunk_score_10
        })
    return timeline


def save_results(
    transcript_text: str,
    chunk_results: List[ChunkResult],
    final_score: Dict[str, Any]
) -> None:
    output = {
        "full_transcript": transcript_text,
        "structured_timeline": build_structured_timeline(chunk_results),
        "chunk_results": [asdict(c) for c in chunk_results],
        "final_score": final_score
    }

    with open(RESULT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)


def print_summary(chunk_results: List[ChunkResult], final_score: Dict[str, Any]) -> None:
    print("\n===== CHUNK SCORES =====")
    for c in chunk_results:
        print(
            f"Chunk {c.chunk_id} | {c.start:>5.1f}s - {c.end:>5.1f}s "
            f"| semantic={c.semantic_similarity:.4f} "
            f"| keywords={c.keyword_coverage:.4f} "
            f"| filler={c.filler_ratio:.4f} "
            f"| visual={c.visual_activity:.4f} ({c.visual_tag}) "
            f"| score/10={c.chunk_score_10:.2f}"
        )

    print("\n===== FINAL SCORE =====")
    print(json.dumps(final_score, indent=2))


# =========================
# MAIN PIPELINE
# =========================
def main() -> None:
    ensure_dirs()

    print("Step 1: Extracting audio from video...")
    extract_audio(VIDEO_PATH, AUDIO_PATH)

    print("Step 2: Transcribing audio with Whisper...")
    transcription = transcribe_audio(AUDIO_PATH, WHISPER_MODEL)

    full_text = transcription.get("text", "").strip()
    segments = transcription.get("segments", [])

    print("Step 3: Creating timestamp segments...")
    chunked_segments = merge_segments_into_time_chunks(segments, CHUNK_SECONDS)

    print("Step 4: Reading reference answer...")
    reference_text = read_reference(REFERENCE_PATH)

    print("Step 5: Analysing video frames...")
    sampled_activity = sample_frames_for_activity(VIDEO_PATH, FRAME_SAMPLE_EVERY_SEC)
    visual_map = aggregate_visual_activity_by_chunk(sampled_activity, chunked_segments)

    print("Step 6: Semantic understanding + similarity scoring...")
    chunk_results = score_chunks_against_reference(
        chunked_segments,
        reference_text,
        visual_map
    )

    print("Step 7: Computing final score...")
    final_score = compute_final_score(chunk_results)

    print("Step 8: Saving output...")
    save_results(full_text, chunk_results, final_score)

    print_summary(chunk_results, final_score)
    print(f"\nDone. Results saved to: {RESULT_PATH}")


if __name__ == "__main__":
    main()