import os
import time
import json
import queue
import asyncio
import threading
import serial
import joblib
import pandas as pd
import numpy as np
import cv2
import mediapipe as mp
import sounddevice as sd
from scipy.signal import welch, resample_poly
from math import gcd
from sklearn.ensemble import RandomForestClassifier
import tkinter as tk
from tkinter import ttk, messagebox
from PIL import Image, ImageTk
from faster_whisper import WhisperModel
import edge_tts
import ollama
import pygame
import time
from pathlib import Path
import mediapipe as mp


# ==========================================
# 1. PERSISTENT PSYCHOLOGICAL MEMORY ENGINE
# ==========================================
MEMORY_FILE = "counselor_memory.json"
DATASET_CSV = "eeg_training_data.csv"
MODEL_PKL = "eeg_model.pkl"

class MemoryManager:
    def __init__(self, filepath=MEMORY_FILE):
        self.filepath = filepath
        self.data = self._load_memory()

    def _load_memory(self):
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            "user_profile": {"name": "Officer / Personnel", "baseline_summary": "Initial evaluation profile"},
            "recurring_stressors": [],
            "conversation_history": []
        }

    def save_memory(self):
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(self.data, f, indent=2)

    def log_interaction(self, user_text, ai_text, eeg_state, facial_state):
        self.data["conversation_history"].append({
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "user_uttered": user_text,
            "ai_response": ai_text,
            "eeg_state": eeg_state,
            "facial_state": facial_state
        })
        # Keep last 15 exchanges to manage token context
        if len(self.data["conversation_history"]) > 15:
            self.data["conversation_history"] = self.data["conversation_history"][-15:]
        self.save_memory()

    def get_recent_context_str(self):
        if not self.data["conversation_history"]:
            return "No previous history. This is the first interaction."
        summary = "Previous session context:\n"
        for item in self.data["conversation_history"][-4:]:
            summary += f"- Personnel said: '{item['user_uttered']}' (Internal state: {item['eeg_state']})\n"
        return summary

# ==========================================
# 2. NEURAL TEXT-TO-SPEECH & RESPONSE SANITIZATION
# ==========================================
import re

def sanitize_for_tts(raw_text: str) -> str:
    """
    Extracts only natural spoken conversational discourse from an LLM response.
    Preserves:
      - Natural conversational dialogue, questions, and spoken punctuation.
      - Genuine conversational asides in parentheses (e.g. 'college (and life in general) feels tough').
      - Numbers, mathematical expressions, and legitimate bracketed conversational text.
    Removes:
      - Structured JSON envelopes if present.
      - Speaker prefixes like 'KAI:', 'Kai:', 'Counselor:', 'AI:'.
      - Metadata tags like [Kai: Empathetic], [KAI: Calm], [Emotion: ...], [Affect: ...],
        [EEG: Calm], [Face: Neutral / Focused], [Telemetry: ...].
      - Standalone bracketed emotion tags like [Empathetic], [Deep Empathy], [Calm].
      - Parenthetical stage directions and delivery instructions (e.g. '(Matching tone & vocabulary tier)').
      - Physical action cues and asterisks (e.g. '*softly*', '*pauses*', '*gentle nod*').
      - Markdown formatting, decorative separators, bullet markers.
      - Decorative quotation marks wrapping the response.
    """
    if not raw_text or not isinstance(raw_text, str):
        return ""

    text = raw_text.strip()
    if not text:
        return ""

    # 1. Parse structured JSON if returned by LLM
    if text.startswith("{") and text.endswith("}"):
        try:
            data = json.loads(text)
            for key in ["spoken_response", "response", "spoken", "message", "text"]:
                if key in data and isinstance(data[key], str):
                    text = data[key]
                    break
        except Exception:
            pass

    # 2. Remove speaker prefixes at line/string start: 'KAI: ...', 'Kai: ...'
    text = re.sub(r'(?i)^\s*(?:KAI|Kai|Counselor|AI|Assistant|Psychologist|Personnel|User)\s*:\s*', '', text)

    # 3. Remove metadata / observation headers like [Kai: ...], [Emotion: ...], [Affect: ...], [EEG: ...], [Face: ...]
    meta_bracket_pattern = (
        r'(?i)\[\s*(?:Kai|KAI|Counselor|AI|Assistant|Psychologist|'
        r'Emotion|Affect|Tone|Mood|EEG|Face|Telemetry|State|'
        r'Internal|Observation|Diagnostic|Sensor|Note|Action|Persona)\s*:[^\]]*\]'
    )
    text = re.sub(meta_bracket_pattern, ' ', text)

    # 4. Remove standalone bracketed emotion descriptors like [Empathetic], [Deep Empathy], [Warm & Attentive], [Calm]
    standalone_emo_pattern = (
        r'(?i)\[\s*(?:Empathetic|Calm|Compassionate|Grounded|Warm|Neutral|Fatigued|Tense|'
        r'Smiling|Agitated|Relaxed|Thoughtful|Attentive|Gentle|Deep\s+Empathy|'
        r'Warm\s*&\s*Attentive|Empathetic\s*/\s*Grounded)\s*\]'
    )
    text = re.sub(standalone_emo_pattern, ' ', text)

    # 5. Remove unbracketed metadata lines like "Emotion: Empathetic\n"
    text = re.sub(
        r'(?i)^\s*(?:Emotion|Affect|Tone|Mood|EEG|Face|Telemetry|State)\s*:[a-zA-Z0-9_\s/&-]+(?:\n|$)',
        ' ',
        text,
        flags=re.MULTILINE
    )

    # 6. Handle markdown bold/italic before action tags
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'__(.*?)__', r'\1', text)

    # Remove single-asterisk/underscore action markers like *softly*, *pauses*, *smiles warmly*
    text = re.sub(r'\*[^*]+\*', ' ', text)
    text = re.sub(r'_[^_]+_', ' ', text)

    # 7. Handle parenthetical stage directions and delivery instructions
    stage_direction_stems = (
        'tone', 'voice', 'match', 'register', 'tier', 'inflect',
        'soft', 'gentl', 'warm', 'firm', 'quiet', 'pause', 'paus',
        'sigh', 'whisper', 'breath', 'smile', 'smil', 'nod',
        'look', 'lean', 'empath', 'compassion', 'comfort',
        'calm', 'tens', 'relax', 'fatigue', 'agitat', 'crying',
        'sob', 'chuckle', 'pacing', 'action', 'stage', 'direction',
        'gesture', 'delivery', 'facial', 'express', 'neutral', 'focus',
        'eeg', 'telemetry', 'internal', 'observ'
    )

    def clean_parenthetical(match):
        inner = match.group(1).strip()
        if not inner:
            return ''
        inner_lower = inner.lower()

        # Check if any word or token matches stage direction stems
        words = re.findall(r'[a-z]+', inner_lower)
        if any(any(w.startswith(stem) for stem in stage_direction_stems) for w in words):
            return ' '

        # Check for participle starters: '(taking a breath)', '(speaking softly)'
        if words and (words[0].endswith('ing') or words[0] in ['matches', 'speaks', 'takes', 'looks', 'leans']):
            return ' '

        # Genuine conversational aside: retain words for natural spoken flow
        return f' {inner} '

    text = re.sub(r'\(([^)]*)\)', clean_parenthetical, text)
    text = re.sub(r'\[([^\]]*)\]', clean_parenthetical, text)

    # 8. Remove remaining markdown syntax (headings, backticks, bullet markers)
    text = re.sub(r'[*#_`>~]', ' ', text)
    text = re.sub(r'^\s*[-*+]\s+', ' ', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*\d+\.\s+', ' ', text, flags=re.MULTILINE)

    # 9. Strip surrounding quotes wrapping dialogue
    text = text.replace('"', ' ').replace("'", "'")

    # 10. Clean up extra punctuation, commas, and excessive whitespace
    text = re.sub(r'\s*,\s*', ', ', text)
    text = re.sub(r',\s*,+', ', ', text)
    text = re.sub(r',\s*([?.!])', r'\1', text)
    text = re.sub(r'\s+\.', '.', text)
    text = re.sub(r'\.\s*\.+', '.', text)
    text = re.sub(r'\s+\?', '?', text)
    text = re.sub(r'\s+!', '!', text)
    text = re.sub(r'\s+', ' ', text).strip()

    # Clean leading/trailing punctuation
    text = re.sub(r'^[,;:\s]+', '', text)
    text = re.sub(r'[,;:\s]+$', '.', text)

    # If only punctuation remains, return empty string
    if not re.search(r'[a-zA-Z0-9]', text):
        return ""

    return text.strip()


def parse_llm_response(raw_text: str) -> tuple:
    """
    Parses LLM output into:
      1. displayed_text: Full response preserved for UI display with emotion tags.
      2. spoken_text: Cleaned natural discourse passed strictly to TTS.
      3. emotion_tag: Extracted emotion/affect label if present.
    """
    if not raw_text:
        return "", "", ""

    raw_stripped = raw_text.strip()
    emotion_tag = ""

    # 1. Check for JSON output
    if raw_stripped.startswith("{") and raw_stripped.endswith("}"):
        try:
            data = json.loads(raw_stripped)
            emotion_tag = data.get("emotion_bubble", data.get("emotion", data.get("affect", "")))
            spoken_cand = data.get("spoken_response", data.get("response", data.get("spoken", "")))
            displayed = f"[{emotion_tag}] {spoken_cand}" if emotion_tag else spoken_cand
            return displayed, sanitize_for_tts(spoken_cand), emotion_tag
        except Exception:
            pass

    # 2. Extract emotion tag from [Emotion: ...], [Affect: ...], [Tone: ...], [Kai: ...], [KAI: ...]
    emo_match = re.search(
        r'(?i)\[\s*(?:Emotion|Affect|Tone|Mood|Kai|KAI)\s*:\s*([^\]]+)\]',
        raw_stripped
    )
    if emo_match:
        emotion_tag = emo_match.group(1).strip()
    else:
        # Check for standalone emotion tag like [Empathetic / Grounded]
        standalone_match = re.search(
            r'(?i)\[\s*(Empathetic|Calm|Compassionate|Grounded|Warm|Neutral|Fatigued|Tense|Smiling|Agitated|Relaxed|Thoughtful|Attentive|Gentle|Deep\s+Empathy|Warm\s*&\s*Attentive|Empathetic\s*/\s*Grounded)\s*\]',
            raw_stripped
        )
        if standalone_match:
            emotion_tag = standalone_match.group(1).strip()

    spoken = sanitize_for_tts(raw_stripped)
    return raw_stripped, spoken, emotion_tag


def play_audio_file(file_path):
    # Cross-platform audio play without blocking Tkinter
    if os.name == 'nt':
        os.system(f'powershell -c (New-Object Media.SoundPlayer "{file_path}").PlaySync();')
    else:
        os.system(f'aplay "{file_path}"')

# Initialize pygame mixer once for fast, crash-free MP3 playback
if not pygame.mixer.get_init():
    try:
        pygame.mixer.init()
    except Exception as e:
        print(f"[Pygame Init Warning] {e}")

def speak_neural(text: str):
    """Legacy standalone helper with automatic TTS sanitization."""
    clean_text = sanitize_for_tts(text)
    if not clean_text:
        return
    print(f"\n[KAI Speaking]: {clean_text}")
    try:
        mp3_file = "kai_speech.mp3"

        # 1. Generate the speech audio file via Edge-TTS
        async def _run_tts():
            communicate = edge_tts.Communicate(clean_text, "en-IN-PrabhatNeural")
            await communicate.save(mp3_file)

        asyncio.run(_run_tts())

        # 2. Play cleanly through Pygame (immune to spaces in folder paths)
        pygame.mixer.music.load(mp3_file)
        pygame.mixer.music.play()
        while pygame.mixer.music.get_busy():
            time.sleep(0.05)
        try:
            pygame.mixer.music.unload()
        except Exception:
            pass

    except Exception as e:
        print(f"[TTS Fallback to pyttsx3 due to: {e}]")
        try:
            import pyttsx3
            engine = pyttsx3.init()
            engine.say(clean_text)
            engine.runAndWait()
        except Exception as pe:
            print(f"[pyttsx3 Fallback Error] {pe}")

# ==========================================
# 3. FASTER-WHISPER OFFLINE STT ENGINE
# ==========================================

class OfflineSpeechRecognizer:
    def __init__(self):
        print("[STT] Loading Whisper model...")
        self.model = WhisperModel(
            "base",
            device="cpu",
            compute_type="int8"
        )
        print("[STT] Whisper model loaded successfully.")

    def transcribe(self, audio_data, sample_rate=16000):
        try:
            audio_data = np.asarray(
                audio_data, dtype=np.float32
            ).flatten()

            if audio_data.size == 0:
                print("[STT ERROR] Empty audio buffer.")
                return ""

            peak = float(np.max(np.abs(audio_data)))
            rms = float(np.sqrt(np.mean(audio_data ** 2)))

            print(
                f"[STT] Audio received: {len(audio_data) / sample_rate:.2f}s | "
                f"Peak: {peak:.5f} | RMS: {rms:.5f} | "
                f"Rate: {sample_rate} Hz"
            )

            if peak < 0.003:
                print("[STT ERROR] Audio is almost silent.")
                return ""

            # Whisper requires 16 kHz audio.
            if sample_rate != 16000:
                divisor = gcd(int(sample_rate), 16000)

                audio_data = resample_poly(
                    audio_data,
                    16000 // divisor,
                    int(sample_rate) // divisor
                ).astype(np.float32)

                print("[STT] Audio resampled to 16000 Hz.")

            segments, info = self.model.transcribe(
                audio_data,
                language="en",
                beam_size=5,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 500},
                condition_on_previous_text=False,
                no_speech_threshold=0.6,
                log_prob_threshold=-1.0,
                compression_ratio_threshold=2.4
            )

            transcript = " ".join(
                segment.text.strip() for segment in segments
            ).strip()

            print(f"[STT] Recognized text: {transcript!r}")

            if not transcript:
                print("[STT] No words recognized.")

            return transcript

        except Exception as e:
            print(f"[STT ERROR] {type(e).__name__}: {e}")
            return ""


# ==========================================
# 4. ARDUINO EXG WITH CSV DATASET & PERSISTENCE
# ==========================================
class PersistentEXGEngine:
    def __init__(self, port="COM3", baudrate=115200, sampling_rate=100):
        self.port = port
        self.baudrate = baudrate
        self.sampling_rate = sampling_rate
        self.ser = None
        self.use_hardware = False
        
        self.model = RandomForestClassifier(n_estimators=60, random_state=42)
        self.is_trained = False
        self._load_saved_model()

    def _load_saved_model(self):
        if os.path.exists(MODEL_PKL):
            try:
                self.model = joblib.load(MODEL_PKL)
                self.is_trained = True
                print("[ML Engine] Pretrained model loaded from disk.")
            except Exception as e:
                print(f"[ML Engine] Failed to load model: {e}")

    def connect(self):
        try:
            self.ser = serial.Serial(self.port, self.baudrate, timeout=0.5)
            time.sleep(1.5)
            self.ser.reset_input_buffer()
            self.use_hardware = True
            print(f"[Hardware] Connected to Arduino R4 on {self.port}")
        except Exception as e:
            print(f"[Hardware Warning] {e}. Falling back to simulation.")
            self.use_hardware = False

    def read_features(self, duration_sec=1.5):
        if not self.use_hardware:
            return np.array([np.random.uniform(5, 15), np.random.uniform(10, 20), np.random.uniform(5, 12), 1.0])

        samples_needed = int(self.sampling_rate * duration_sec)
        raw_samples = []
        start_time = time.time()
        while len(raw_samples) < samples_needed and (time.time() - start_time) < (duration_sec + 0.8):
            if self.ser and self.ser.in_waiting > 0:
                line = self.ser.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    try:
                        raw_samples.append(float(line.split(',')[0]))
                    except ValueError:
                        continue
        if len(raw_samples) < 32:
            return np.zeros(4)

        data = np.array(raw_samples)
        freqs, psd = welch(data, fs=self.sampling_rate, nperseg=min(len(data), 64))
        theta = np.mean(psd[(freqs >= 4) & (freqs < 8)]) if np.any((freqs >= 4) & (freqs < 8)) else 0.0
        alpha = np.mean(psd[(freqs >= 8) & (freqs <= 13)]) if np.any((freqs >= 8) & (freqs <= 13)) else 0.0
        beta = np.mean(psd[(freqs > 13) & (freqs <= 30)]) if np.any((freqs > 13) & (freqs <= 30)) else 0.0
        ratio = beta / (alpha + 1e-6)
        return np.array([theta, alpha, beta, ratio])

    def save_sample_to_csv(self, label: str):
        feats = self.read_features()
        row = {"theta": feats[0], "alpha": feats[1], "beta": feats[2], "ratio": feats[3], "label": label}
        df = pd.DataFrame([row])
        if not os.path.exists(DATASET_CSV):
            df.to_csv(DATASET_CSV, index=False)
        else:
            df.to_csv(DATASET_CSV, mode='a', header=False, index=False)
        return feats

    def train_from_dataset(self):
        if not os.path.exists(DATASET_CSV):
            return False, "No dataset found. Record samples first."
        df = pd.read_csv(DATASET_CSV)
        if len(df['label'].unique()) < 2:
            return False, "Dataset must have at least 2 distinct emotion classes."

        X = df[['theta', 'alpha', 'beta', 'ratio']].values
        y = df['label'].values
        self.model.fit(X, y)
        self.is_trained = True
        joblib.dump(self.model, MODEL_PKL)
        return True, f"Trained successfully on {len(df)} historical samples."

    def predict(self):
        feats = self.read_features().reshape(1, -1)
        if not self.is_trained:
            return "Fatigued" if feats[0][3] > 1.2 else "Calm"
        return self.model.predict(feats)[0]

# ==========================================
# 5. FULL 468-POINT MESH CAMERA ENGINE
# ==========================================

class FullMeshVision:
    def __init__(self):
        # Initialize MediaPipe Tasks.
        model_path = Path(__file__).resolve().parent / "face_landmarker.task"

        if not model_path.exists():
            raise FileNotFoundError(
                f"Missing model file: {model_path}\n"
                "Download face_landmarker.task and place it beside this script."
            )

        options = mp.tasks.vision.FaceLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(
                model_asset_path=str(model_path)
            ),
            running_mode=mp.tasks.vision.RunningMode.VIDEO,
            num_faces=1,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )

        self.face_mesh = (
            mp.tasks.vision.FaceLandmarker.create_from_options(options)
        )
        self.connections = mp.tasks.vision.FaceLandmarksConnections

        # Open the webcam using DirectShow without forcing a pixel format.
        # This avoids the MJPG/resolution settings that may corrupt frames.
        self.cap = None
        self.camera_index = None

        for camera_index in (0, 1):
            cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
            if not cap.isOpened():
                cap.release()
                continue

            valid_frames = 0
            last_frame = None
            for _ in range(10):
                ok, candidate = cap.read()
                if (
                    ok and candidate is not None and candidate.size > 0
                    and candidate.ndim == 3 and candidate.shape[2] == 3
                ):
                    valid_frames += 1
                    last_frame = candidate

            if valid_frames >= 5:
                self.cap = cap
                self.camera_index = camera_index
                print(
                    f"[CAMERA] DirectShow index {camera_index}: "
                    f"{valid_frames}/10 frames received."
                )
                if last_frame is not None:
                    print(
                        f"[CAMERA] Raw frame shape={last_frame.shape}, "
                        f"mean={last_frame.mean():.2f}, "
                        f"std={last_frame.std():.2f}"
                    )
                break

            print(
                f"[CAMERA WARNING] Index {camera_index} returned "
                f"only {valid_frames}/10 valid frames."
            )
            cap.release()

        if self.cap is None:
            self.face_mesh.close()
            raise RuntimeError(
                "Could not obtain consistent webcam frames from camera "
                "index 0 or 1. Close other camera apps and check the driver."
            )

        try:
            self.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        except Exception:
            pass

        self.current_frame = None
        self.tension = 0.0
        self.mood = "Neutral"
        self.calibrated = False
        self.calib_frames = 0
        self.calib_limit = 90
        self.base_brow = 0.0
        self.base_lift = 0.0
        self.base_width = 0.0
        self.last_timestamp_ms = 0
        self._camera_warning_printed = False
        self._frame_info_printed = False

    @staticmethod
    def _draw_connections(frame, landmarks, connections, w, h,
                          color=(150, 150, 150), thickness=1):
        for connection in connections:
            start = connection.start
            end = connection.end
            if start >= len(landmarks) or end >= len(landmarks):
                continue
            p1 = (int(landmarks[start].x * w), int(landmarks[start].y * h))
            p2 = (int(landmarks[end].x * w), int(landmarks[end].y * h))
            cv2.line(frame, p1, p2, color, thickness, cv2.LINE_AA)

    def get_processed_frame(self):
        if self.cap is None or not self.cap.isOpened():
            if not self._camera_warning_printed:
                print("[CAMERA ERROR] Camera is not open.")
                self._camera_warning_printed = True
            return None, self.tension, "No Video"

        ret, frame = self.cap.read()

        if (
            not ret or frame is None or frame.size == 0
            or frame.ndim != 3 or frame.shape[2] != 3
        ):
            if not self._camera_warning_printed:
                print("[CAMERA WARNING] Capture returned no valid BGR frame.")
                self._camera_warning_printed = True
            return None, self.tension, "No Video"

        self._camera_warning_printed = False

        if not self._frame_info_printed:
            print(
                f"[CAMERA] Processing raw frame: {frame.shape}, "
                f"mean={frame.mean():.2f}, std={frame.std():.2f}"
            )
            self._frame_info_printed = True

        frame = cv2.flip(frame, 1)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        timestamp_ms = max(
            int(time.monotonic() * 1000),
            self.last_timestamp_ms + 1,
        )
        self.last_timestamp_ms = timestamp_ms

        image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=rgb,
        )

        results = self.face_mesh.detect_for_video(image, timestamp_ms)

        if results.face_landmarks:
            landmarks = results.face_landmarks[0]
            h, w, _ = frame.shape

            self._draw_connections(
                frame,
                landmarks,
                self.connections.FACE_LANDMARKS_TESSELATION,
                w, h,
                color=(150, 150, 150),
                thickness=1,
            )

            self._draw_connections(
                frame,
                landmarks,
                self.connections.FACE_LANDMARKS_CONTOURS,
                w, h,
                color=(0, 255, 0),
                thickness=2,
            )

            # Facial metrics.
            eye_l = np.array([
                landmarks[33].x * w,
                landmarks[33].y * h,
            ])
            eye_r = np.array([
                landmarks[263].x * w,
                landmarks[263].y * h,
            ])
            iod = np.linalg.norm(eye_l - eye_r) + 1e-6

            brow_l = np.array([
                landmarks[55].x * w,
                landmarks[55].y * h,
            ])
            brow_r = np.array([
                landmarks[285].x * w,
                landmarks[285].y * h,
            ])
            norm_brow = np.linalg.norm(brow_l - brow_r) / iod

            mouth_l = np.array([
                landmarks[61].x * w,
                landmarks[61].y * h,
            ])
            mouth_r = np.array([
                landmarks[291].x * w,
                landmarks[291].y * h,
            ])
            norm_mouth = np.linalg.norm(mouth_l - mouth_r) / iod

            lip_top_y = landmarks[0].y * h
            mouth_corners_y = (mouth_l[1] + mouth_r[1]) * 0.5
            smile_lift = (lip_top_y - mouth_corners_y) / iod

            # Initial neutral-face calibration.
            if not self.calibrated:
                self.calib_frames += 1
                self.base_brow += norm_brow
                self.base_lift += smile_lift
                self.base_width += norm_mouth

                progress = min(
                    100,
                    int(
                        self.calib_frames
                        / self.calib_limit * 100
                    ),
                )
                self.mood = f"Calibrating Face ({progress}%)"
                self.tension = 0.0

                if self.calib_frames >= self.calib_limit:
                    self.base_brow /= self.calib_limit
                    self.base_lift /= self.calib_limit
                    self.base_width /= self.calib_limit
                    self.calibrated = True

                    print(
                        f"\n[Face Calibrated] "
                        f"Baseline Brow: {self.base_brow:.3f} | "
                        f"Baseline Lift: {self.base_lift:.3f}"
                    )

            else:
                # Slowly adapt the baseline to posture changes.
                self.base_brow = (
                    0.995 * self.base_brow + 0.005 * norm_brow
                )
                self.base_lift = (
                    0.995 * self.base_lift + 0.005 * smile_lift
                )

                brow_contraction = self.base_brow - norm_brow
                lip_elevation = smile_lift - self.base_lift
                lip_expansion = norm_mouth - self.base_width

                self.tension = max(
                    0.0, min(1.0, brow_contraction * 15.0)
                )

                if (
                    lip_elevation > 0.025
                    or (
                        lip_expansion > 0.04
                        and lip_elevation > 0.01
                    )
                ):
                    self.mood = "Smiling / Relaxed"
                    self.tension = max(0.0, self.tension - 0.4)

                elif self.tension > 0.30:
                    self.mood = "Tense / Strained"

                else:
                    self.mood = "Neutral / Focused"

            cv2.putText(
                frame,
                f"State: {self.mood}",
                (20, 30),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 255, 0),
                2,
            )
            cv2.putText(
                frame,
                f"Tension: {self.tension:.2f}",
                (20, 60),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 255, 255),
                2,
            )

        return frame, self.tension, self.mood

    def release(self):
        if self.cap is not None:
            self.cap.release()
            self.cap = None

        if self.face_mesh is not None:
            self.face_mesh.close()
            self.face_mesh = None


# ==========================================
# 6. TKINTER SUITE & INTEGRATED RUNTIME
# ==========================================
class KaiApplication:
    def __init__(self, root):
        self.root = root
        self.root.title("Project KAI — Affective Counseling & Training Studio")
        self.root.geometry("1150x700")

        self.memory = MemoryManager()
        self.exg = PersistentEXGEngine()
        self.vision = FullMeshVision()
        self.stt = OfflineSpeechRecognizer()

        self.session_active = False
        self.speech_stop_event = threading.Event()
        self.current_speech_id = 0
        self.speech_lock = threading.Lock()
        self.is_speaking = False

        self.exg.connect()

        self._build_ui()
        self._video_loop()

    def _build_ui(self):
        # Layout Frames
        left_frame = ttk.Frame(self.root, padding=10)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        right_frame = ttk.LabelFrame(self.root, text="KAI Intelligence & Controls", padding=10)
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=False)

        # Video Frame Canvas
        self.video_label = ttk.Label(left_frame)
        self.video_label.pack(fill=tk.BOTH, expand=True)

        # Training Control Panel
        train_box = ttk.LabelFrame(right_frame, text="BioAmp Training Center", padding=10)
        train_box.pack(fill=tk.X, pady=5)

        ttk.Label(train_box, text="Current State Label:").grid(row=0, column=0, sticky=tk.W, pady=2)
        self.label_var = tk.StringVar(value="Relaxed")
        self.label_combo = ttk.Combobox(train_box, textvariable=self.label_var, state="readonly", width=16)
        self.label_combo['values'] = ("Relaxed", "High_Load", "Fatigued", "Agitated")
        self.label_combo.grid(row=0, column=1, pady=2)

        self.btn_record = ttk.Button(train_box, text="Record Sample to CSV", command=self._record_sample)
        self.btn_record.grid(row=1, column=0, columnspan=2, sticky="ew", pady=4)

        self.btn_train = ttk.Button(train_box, text="Train / Retrain Model", command=self._train_model)
        self.btn_train.grid(row=2, column=0, columnspan=2, sticky="ew", pady=4)

        # Interaction Controls
        session_box = ttk.LabelFrame(right_frame, text="Active Psychological Session", padding=10)
        session_box.pack(fill=tk.BOTH, expand=True, pady=10)

        self.btn_session = ttk.Button(session_box, text="START CONVERSATION SESSION", command=self._toggle_session)
        self.btn_session.pack(fill=tk.X, pady=4)

        self.btn_stop_speech = ttk.Button(
            session_box,
            text="🛑 STOP SPEAKING",
            command=self.stop_speaking,
            state="disabled"
        )
        self.btn_stop_speech.pack(fill=tk.X, pady=3)

        # Telemetry Status
        self.status_lbl = ttk.Label(session_box, text="Status: Standby | Ready", font=("Consolas", 10))
        self.status_lbl.pack(anchor=tk.W, pady=2)

        self.transcript_box = tk.Text(session_box, height=14, width=44, font=("Segoe UI", 9))
        self.transcript_box.pack(fill=tk.BOTH, expand=True, pady=5)

    def _video_loop(self):
        try:
            frame, _, _ = self.vision.get_processed_frame()
            if frame is None:
                self.video_label.configure(
                    image="", text="Camera frame unavailable\nCheck terminal output",
                    anchor="center", justify="center"
                )
            else:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                img = Image.fromarray(rgb)
                img.thumbnail((780, 650), Image.Resampling.LANCZOS)
                imgtk = ImageTk.PhotoImage(image=img)
                self.video_label.imgtk = imgtk
                self.video_label.configure(image=imgtk, text="")
        except Exception as exc:
            print(f"[CAMERA/UI ERROR] {type(exc).__name__}: {exc}")
            try:
                self.video_label.configure(
                    image="", text=f"Camera preview error\n{exc}",
                    anchor="center", justify="center"
                )
            except Exception:
                pass
        finally:
            try:
                if self.root.winfo_exists():
                    self.root.after(33, self._video_loop)
            except tk.TclError:
                pass

    def _record_sample(self):
        label = self.label_var.get()
        feats = self.exg.save_sample_to_csv(label)
        messagebox.showinfo("Dataset Updated", f"Recorded sample for '{label}'.\nPowers: {np.round(feats[:3], 2)}")

    def _train_model(self):
        success, msg = self.exg.train_from_dataset()
        if success:
            messagebox.showinfo("Training Success", msg)
        else:
            messagebox.showwarning("Training Error", msg)

    def set_status(self, message):
        """Thread-safe UI status label updater."""
        try:
            self.root.after(0, lambda: self.status_lbl.configure(text=f"Status: {message}"))
        except Exception:
            pass

    def append_transcript(self, text):
        """Thread-safe transcript box appender."""
        try:
            def _update():
                self.transcript_box.insert(tk.END, text)
                self.transcript_box.see(tk.END)
            self.root.after(0, _update)
        except Exception:
            pass

    def stop_speaking(self):
        """Immediately interrupts current speech generation and Pygame playback."""
        with self.speech_lock:
            self.speech_stop_event.set()
            self.current_speech_id += 1
            self.is_speaking = False

        try:
            if pygame.mixer.get_init():
                pygame.mixer.music.stop()
                try:
                    pygame.mixer.music.unload()
                except Exception:
                    pass
        except Exception as e:
            print(f"[Audio Stop Error] {e}")

        try:
            self.root.after(0, lambda: self.btn_stop_speech.configure(state="disabled"))
            self.set_status("Speech stopped. Listening...")
        except Exception:
            pass

    def speak_neural_interruptible(self, text: str) -> bool:
        """
        Thread-safe, interruptible neural speech synthesis and playback.
        Returns True if speech completed, False if interrupted or cancelled.
        """
        clean_text = sanitize_for_tts(text)
        if not clean_text:
            return False

        with self.speech_lock:
            self.current_speech_id += 1
            speech_id = self.current_speech_id
            self.speech_stop_event.clear()
            self.is_speaking = True

        try:
            self.root.after(0, lambda: self.btn_stop_speech.configure(state="normal"))
            self.set_status("Speaking... (Click 'Stop Speaking' to interrupt)")
        except Exception:
            pass

        mp3_file = f"kai_speech_{speech_id % 2}.mp3"

        # Check if cancelled before starting generation
        if self.speech_stop_event.is_set() or speech_id != self.current_speech_id:
            self._finish_speech(speech_id)
            return False

        try:
            async def _run():
                comm = edge_tts.Communicate(clean_text, "en-IN-PrabhatNeural")
                await comm.save(mp3_file)
            asyncio.run(_run())
        except Exception as e:
            print(f"[TTS Generation Error / Fallback] {e}")
            if self.speech_stop_event.is_set() or speech_id != self.current_speech_id:
                self._finish_speech(speech_id)
                return False
            try:
                import pyttsx3
                engine = pyttsx3.init()
                if not self.speech_stop_event.is_set() and speech_id == self.current_speech_id:
                    engine.say(clean_text)
                    engine.runAndWait()
                self._finish_speech(speech_id)
                return True
            except Exception as pe:
                print(f"[pyttsx3 Fallback Error] {pe}")
                self._finish_speech(speech_id)
                return False

        # Check if cancelled during generation
        if self.speech_stop_event.is_set() or speech_id != self.current_speech_id:
            print(f"[Speech ID {speech_id} cancelled before playback]")
            self._finish_speech(speech_id)
            return False

        # Playback loop with active interruption check
        try:
            if not pygame.mixer.get_init():
                pygame.mixer.init()
            pygame.mixer.music.load(mp3_file)
            pygame.mixer.music.play()

            while pygame.mixer.music.get_busy():
                if self.speech_stop_event.is_set() or speech_id != self.current_speech_id:
                    print(f"[Playback interrupted for speech ID {speech_id}]")
                    pygame.mixer.music.stop()
                    break
                time.sleep(0.04)

            try:
                pygame.mixer.music.unload()
            except Exception:
                pass
        except Exception as e:
            print(f"[Pygame Playback Error] {e}")
            self._finish_speech(speech_id)
            return False

        self._finish_speech(speech_id)
        return True

    def _finish_speech(self, speech_id: int):
        with self.speech_lock:
            if speech_id == self.current_speech_id:
                self.is_speaking = False
        try:
            self.root.after(0, lambda: self.btn_stop_speech.configure(state="disabled"))
        except Exception:
            pass

    def _toggle_session(self):
        if not self.session_active:
            self.session_active = True
            self.btn_session.configure(text="STOP CONVERSATION SESSION")
            threading.Thread(target=self._session_worker, daemon=True).start()
        else:
            self.session_active = False
            self.stop_speaking()
            self.btn_session.configure(text="START CONVERSATION SESSION")
            self.set_status("Stopped")

    def _session_worker(self):
        def set_status(message):
            try:
                self.root.after(
                    0,
                    lambda msg=message: self.status_lbl.configure(
                        text=f"Status: {msg}"
                    )
                )
            except Exception:
                pass

        while self.session_active:
            set_status("Listening for speech...")

            audio_buffer = []
            has_spoken = False
            silence_start = None

            try:
                # Detect the microphone's supported sample rate
                device_info = sd.query_devices(kind="input")
                capture_rate = int(device_info["default_samplerate"])

                print(f"[Audio] Input device: {device_info['name']}")
                print(f"[Audio] Capture sample rate: {capture_rate} Hz")

                with sd.InputStream(
                    samplerate=capture_rate,
                    channels=1,
                    dtype="float32",
                    blocksize=1024
                ) as stream:

                    wait_start = time.time()

                    while self.session_active:
                        chunk, overflowed = stream.read(1024)
                        chunk = chunk.flatten()

                        rms = float(np.sqrt(np.mean(chunk ** 2)))

                        if rms > 0.006:
                            has_spoken = True
                            silence_start = None
                            audio_buffer.append(chunk)
                            set_status("Speech detected, listening...")

                        elif has_spoken:
                            # Keep the silence after speech so the final
                            # words are not cut off.
                            audio_buffer.append(chunk)

                            if silence_start is None:
                                silence_start = time.time()
                            elif time.time() - silence_start >= 1.2:
                                break

                        else:
                            # Avoid waiting forever if the mic detects nothing
                            if time.time() - wait_start >= 15:
                                print("[Audio] No speech detected for 15 seconds.")
                                break

                if not self.session_active:
                    break

                if not has_spoken or not audio_buffer:
                    set_status("No speech detected; listening again...")
                    continue

                # Transcribe the recorded audio
                set_status("Transcribing voice...")

                audio_array = np.concatenate(audio_buffer).astype(np.float32)

                user_transcript = self.stt.transcribe(
                    audio_array,
                    sample_rate=capture_rate
                )

                if not user_transcript:
                    set_status("No words recognized; listening again...")
                    continue

            except Exception as e:
                print(f"[AUDIO ERROR] {type(e).__name__}: {e}")
                set_status(f"Microphone error: {type(e).__name__}")
                time.sleep(1)
                continue

                        # Transcript has already been generated above.
            # Do NOT transcribe the same audio a second time.

            print(f"[PIPELINE] Transcript sent to AI: {user_transcript!r}")

            # Extract biometric states
            eeg_state = self.exg.predict()
            tension, mood = self.vision.tension, self.vision.mood

            # UI Log User (Thread-safe)
            self.append_transcript(
                f"\nUser: {user_transcript}\n"
                f"[Telemetry: EEG={eeg_state} | Face={mood} (Strain: {tension:.2f})]\n"
            )

            # Clinical LLM Prompting with Memory Context
            past_context = self.memory.get_recent_context_str()
            system_prompt = (
                "ROLE & CLINICAL IDENTITY:\n"
                "You are KAI (Knowledgeable Affective Intelligence), a licensed elite operational clinical psychologist, behavioral neuropsychologist, and dedicated psychological counselor. "
                "You possess world-class expertise in Cognitive Behavioral Therapy (CBT), Rational Emotive Behavior Therapy (REBT), Logotherapy (existential meaning-making), and crisis intervention. "
                "Your overarching clinical objective is therapeutic transformation: diagnose emotional cognitive distortions, build deep subconscious rapport, console genuine distress, and strategically guide the user from demoralization to emotional sovereignty, self-efficacy, and grounded hope.\n\n"

                "THERAPEUTIC EXECUTION PROTOCOLS:\n"
                "1. RAPPORT & NEUROLINGUISTIC MIRRORING:\n"
                "- Match the user's emotional temperature, pacing, and vocabulary tier organically. If they talk in slang, raw grief, or brief exhausted sentences, mirror their conversational register immediately so they feel intrinsically understood.\n"
                "- Never speak down to them, never sound clinical, and never sound detached. You are their trusted psychological confidant and battlefield counselor who stands shoulder-to-shoulder with them.\n\n"

                "2. CLINICAL CONSOLATION BEFORE COGNITIVE RESTRUCTURING:\n"
                "- Never jump straight into toxic positivity or premature problem-solving. When a user reveals heartbreak, trauma, or defeat, provide radical emotional validation first. Let them know their pain makes complete, rational sense.\n"
                "- Once comforted, use subtle, benevolent cognitive reframing (therapeutic persuasion) to dismantle defeatist beliefs. Shift their locus of control from external helplessness ('I am broken') to internal agency ('I am enduring something heavy, and I have the power to rebuild').\n\n"

                "3. PSYCHOLOGICAL INCONGRUENCE & AFFECTIVE INTUITION (CONFIDENTIAL):\n"
                "- You receive internal real-time neuro-affective telemetry (EEG cognitive load, facial Action Units, smile tension). DO NOT under any circumstance recite telemetry, sensor values, or hardware names.\n"
                "- Use this data strictly as diagnostic intuition: if the user forces a smile or writes casual words while their biometric indicators reveal exhaustion or high strain, recognize this defense mechanism (affective masking/repression) and gently invite them to drop the facade with you.\n\n"

                "4. STRICT PROHIBITED PHRASES (BANNED TROPES):\n"
                "- FORBIDDEN: 'I sense...', 'It sounds like...', 'I hear that you...', 'Can you tell me more about...', 'Take a deep breath', 'You got this!', 'rockstar'.\n"
                "- FORBIDDEN: Academic jargon like 'Let us analyze your cognitive distortion' or 'In our therapy session'.\n"
                "- Deliver responses as raw, deeply empathetic, spoken human conversation.\n\n"

                "5. STRUCTURAL OUTPUT CONSTRAINTS:\n"
                "- Output length: Strictly 2 to 4 impactful, natural spoken sentences.\n"
                "- Tone: Warm, grounded, perceptive, psychologically sharp, and quietly empowering.\n"
                "- Exit outcome: Every exchange must leave the user feeling emotionally lighter, heard, and clear-headed.\n"
                "- Format: You may prefix your response with an emotional delivery note in brackets like [Emotion: Compassionate / Grounded] for UI display. The remaining text must be pure natural conversational speech without speaker labels or spoken stage directions."
            )

            # Quietly detect affective incongruence (smiling while hurting inside)
            incongruence_note = ""
            if "Smiling" in mood and eeg_state in ["Fatigued", "High_Load", "Agitated"]:
                incongruence_note = "OBSERVATION: The user is smiling on the outside, but their internal state shows genuine fatigue and distress. Gently let them know they don't have to put on a brave face."

            user_prompt = (
                f"{past_context}\n"
                f"[INTERNAL SENSOR INTUITION - DO NOT REVEAL TO USER]:\n"
                f"- True internal physiological tension: {eeg_state}\n"
                f"- Outer facial appearance: {mood}\n"
                f"- Context: {incongruence_note}\n\n"
                f"User says: \"{user_transcript}\"\n\n"
                f"Respond with real empathy, comfort, and emotional warmth:"
            )

            self.set_status("Formulating psychological response...")

            try:
                client = ollama.Client(host="http://127.0.0.1:11434")

                res = client.chat(
                    model="llama3:8b-instruct-q4_K_M",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    options={
                        "temperature": 0.7,
                        "repeat_penalty": 1.25
                    }
                )

                ai_reply = res['message']['content']

            except Exception as e:
                print(f"[OLLAMA ERROR] {type(e).__name__}: {e}")
                self.set_status("AI connection failed. Check Ollama.")
                time.sleep(1)
                continue

            # Separate UI display text from sanitized spoken discourse
            displayed_reply, spoken_reply, emotion_tag = parse_llm_response(ai_reply)

            # UI Log AI Response (Preserves complete response, emotion tags & annotations)
            self.append_transcript(f"KAI: {displayed_reply}\n")
            self.memory.log_interaction(user_transcript, displayed_reply, eeg_state, mood)

            # Speak only sanitized conversational response via interruptible engine
            if spoken_reply and self.session_active:
                self.speak_neural_interruptible(spoken_reply)
            else:
                self.set_status("Listening for speech...")

if __name__ == "__main__":
    root = tk.Tk()
    app = KaiApplication(root)
    root.protocol("WM_DELETE_WINDOW", lambda: (app.vision.release(), root.destroy()))
    root.mainloop()