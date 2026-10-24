"""
=============================================================================
PROJECT KAI: WEB BRIDGE & MULTIMODAL RUNTIME ADAPTER
=============================================================================
This module wraps the existing Project KAI application without modifying
any existing backend files.
=============================================================================
"""

import os
import re
import sys
import time
import json
import asyncio
import threading
import importlib.util
from pathlib import Path
from typing import Dict, Any, List, Set

import cv2
import numpy as np
import sounddevice as sd
import edge_tts
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# 1. DYNAMIC IMPORT OF EXISTING PROTECTED BACKEND
BASE_DIR = Path(__file__).resolve().parent
CORE_PATH = BASE_DIR / "kai_interactive_core(arudino).py"

if not CORE_PATH.exists():
    raise FileNotFoundError(f"Missing protected core application: {CORE_PATH}")

spec = importlib.util.spec_from_file_location("kai_core", CORE_PATH)
kai_core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kai_core)

print("[BRIDGE] Successfully loaded existing KAI Core modules.")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    global main_loop
    main_loop = asyncio.get_running_loop()
    print("[BRIDGE] FastAPI startup complete. Main loop registered.")
    yield

# 2. STATE & SUBSYSTEM INITIALIZATION
app = FastAPI(title="Project KAI Web Bridge", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Event Loop Reference for thread-safe dispatch
main_loop: asyncio.AbstractEventLoop = None
client_queues: Set[asyncio.Queue] = set()

# Persistent Components from kai_core
memory_manager = kai_core.MemoryManager(filepath=str(BASE_DIR / "counselor_memory.json"))
from eeg_adapter import detect_arduino_port
detected_eeg_port = detect_arduino_port(preferred="COM3") or "COM3"
print(f"[BRIDGE] Auto-detected EEG serial port: {detected_eeg_port}")
exg_engine = kai_core.PersistentEXGEngine(port=detected_eeg_port, baudrate=115200, sampling_rate=512)
exg_engine.connect()

stt_engine = kai_core.OfflineSpeechRecognizer()

# Camera & Vision Subsystem
print("[BRIDGE] Initializing Biometric Vision...")
vision = None
try:
    vision = kai_core.FullMeshVision()
    # Verify camera illumination
    if vision.cap is not None:
        ret, test_f = vision.cap.read()
        if ret and test_f is not None and test_f.mean() < 5.0:
            print("[BRIDGE] Camera returned dark frame. Selecting Camera 0...")
            vision.cap.release()
            vision.cap = cv2.VideoCapture(0)
except Exception as e:
    print(f"[BRIDGE WARNING] Vision initialization warning: {e}")

# Global Telemetry & Streaming Buffers
latest_jpeg_bytes: bytes = b""
latest_facial_telemetry: Dict[str, Any] = {
    "mood": "Neutral / Focused",
    "tension": 0.12,
    "browContraction": 0.0,
    "smileLift": 0.0,
    "isCalibrated": False,
    "calibrationProgress": 0,
    "isFaceDetected": False,
    "landmarksCount": 0,
}

latest_eeg_telemetry: Dict[str, Any] = {
    "theta": 8.5,
    "alpha": 14.2,
    "beta": 9.1,
    "arousalRatio": 0.64,
    "state": "Calm",
    "isHardwareConnected": exg_engine.use_hardware,
    "samplingRate": 512,
}

# BioAmp EEG Adapter & Training Router
from eeg_adapter import router as eeg_router, init_eeg_adapter
init_eeg_adapter(
    exg_engine=exg_engine,
    latest_telemetry=latest_eeg_telemetry,
    dataset_file=BASE_DIR / "eeg_training_data.csv"
)
app.include_router(eeg_router)

active_speech_id = 0
is_speaking = False
speech_stop_event = threading.Event()
playback_finished_event = threading.Event()
session_active = False
speech_audio_file = BASE_DIR / "kai_speech_web.mp3"

# 3. BACKGROUND CAMERA CAPTURE THREAD
def camera_capture_loop():
    global latest_jpeg_bytes, latest_facial_telemetry, vision
    print("[BRIDGE] Starting live camera acquisition loop...")
    while True:
        try:
            if vision is not None and vision.cap is not None and vision.cap.isOpened():
                frame, tension, mood = vision.get_processed_frame()
                if frame is not None:
                    # Update Telemetry
                    latest_facial_telemetry["mood"] = mood
                    latest_facial_telemetry["tension"] = float(tension)
                    latest_facial_telemetry["isCalibrated"] = bool(vision.calibrated)
                    latest_facial_telemetry["calibrationProgress"] = int(
                        min(100, (vision.calib_frames / max(1, vision.calib_limit)) * 100)
                    )
                    latest_facial_telemetry["browContraction"] = float(
                        getattr(vision, "base_brow", 0.0)
                    )
                    latest_facial_telemetry["smileLift"] = float(
                        getattr(vision, "base_lift", 0.0)
                    )
                    latest_facial_telemetry["isFaceDetected"] = "No Video" not in mood
                    latest_facial_telemetry["landmarksCount"] = 468 if "No Video" not in mood else 0

                    # Compress to JPEG for Web Stream
                    ret, jpeg = cv2.imencode(
                        ".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75]
                    )
                    if ret:
                        latest_jpeg_bytes = jpeg.tobytes()
            time.sleep(0.033)  # ~30 FPS
        except Exception:
            time.sleep(0.1)

threading.Thread(target=camera_capture_loop, daemon=True).start()

# 4. BROADCAST HELPERS
def broadcast_event(event_type: str, payload: Any):
    if main_loop is not None and main_loop.is_running():
        msg = json.dumps({"type": event_type, "payload": payload})
        for q in list(client_queues):
            try:
                main_loop.call_soon_threadsafe(q.put_nowait, msg)
            except Exception:
                pass

# 5. MULTIMODAL CONVERSATION SESSION WORKER
def session_worker_loop():
    global session_active, active_speech_id, is_speaking
    print("[BRIDGE] Multimodal session engine active.")

    while True:
        if not session_active:
            time.sleep(0.2)
            continue

        broadcast_event("session_state", {"state": "listening"})
        audio_buffer = []
        has_spoken = False
        silence_start = None

        try:
            device_info = sd.query_devices(kind="input")
            capture_rate = int(device_info["default_samplerate"])

            with sd.InputStream(
                samplerate=capture_rate,
                channels=1,
                dtype="float32",
                blocksize=1024,
            ) as stream:
                wait_start = time.time()
                while session_active:
                    chunk, _ = stream.read(1024)
                    chunk = chunk.flatten()
                    rms = float(np.sqrt(np.mean(chunk ** 2)))

                    if rms > 0.008:
                        has_spoken = True
                        silence_start = None
                        audio_buffer.append(chunk)
                    elif has_spoken:
                        audio_buffer.append(chunk)
                        if silence_start is None:
                            silence_start = time.time()
                        elif time.time() - silence_start >= 1.5:
                            break
                    else:
                        if time.time() - wait_start >= 12:
                            break

            if not session_active or not has_spoken or not audio_buffer:
                continue

            # Transcribe speech
            broadcast_event("session_state", {"state": "thinking"})
            audio_array = np.concatenate(audio_buffer).astype(np.float32)
            user_transcript = stt_engine.transcribe(audio_array, sample_rate=capture_rate)

            if not user_transcript or len(user_transcript.strip()) == 0:
                continue

            # Biometric evaluation
            eeg_state = exg_engine.predict()
            feats = exg_engine.read_features(duration_sec=0.5)
            latest_eeg_telemetry["theta"] = float(feats[0])
            latest_eeg_telemetry["alpha"] = float(feats[1])
            latest_eeg_telemetry["beta"] = float(feats[2])
            latest_eeg_telemetry["arousalRatio"] = float(feats[3])
            latest_eeg_telemetry["state"] = str(eeg_state)

            mood = latest_facial_telemetry["mood"]

            # Broadcast User Transcript
            timestamp = time.strftime("%H:%M:%S")
            broadcast_event("transcript", {
                "speaker": "user",
                "text": user_transcript,
                "timestamp": timestamp,
                "eegState": eeg_state,
                "facialState": mood,
            })

            # Check Affective Incongruence
            incongruence_note = ""
            if "Smiling" in mood and eeg_state in ["Fatigued", "High_Load", "Agitated"]:
                incongruence_note = (
                    "OBSERVATION: The user is smiling outwardly, but their internal EEG reveals genuine fatigue and distress. "
                    "Acknowledge their courage gently and invite them to drop the facade without reciting sensor telemetry."
                )

            # Query Ollama with Clinical Persona
            past_context = memory_manager.get_recent_context_str()
            system_prompt = (
                "ROLE: You are KAI (Knowledgeable Affective Intelligence), a licensed clinical psychologist and biofeedback counselor. "
                "Provide radical emotional validation, mirroring the user's conversational pacing. "
                "Output strictly 2 to 4 natural spoken sentences. "
                "Format: You may prefix your response with [Emotion: Empathetic / Grounded] for UI display, followed by your natural spoken conversation."
            )

            user_prompt = (
                f"{past_context}\n"
                f"[DIAGNOSTIC INTUITION]: True internal tension: {eeg_state} | Facial expression: {mood}\n"
                f"{incongruence_note}\n\n"
                f"User says: \"{user_transcript}\"\n\n"
                f"Respond with warmth, empathy, and emotional clarity:"
            )

            ai_raw_reply = "I'm right here with you. Take a gentle breath, and take all the time you need."
            try:
                import ollama
                client = ollama.Client(host="http://127.0.0.1:11434")
                res = client.chat(
                    model="llama3:8b-instruct-q4_K_M",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    options={"temperature": 0.7, "repeat_penalty": 1.25},
                )
                ai_raw_reply = res["message"]["content"]
            except Exception as oe:
                print(f"[BRIDGE OLLAMA] Using offline fallback response: {oe}")
                if "Smiling" in mood and eeg_state in ["Fatigued", "High_Load"]:
                    ai_raw_reply = "[Emotion: Deep Empathy] I hear what you're saying, and I can see you smiling, but I know how heavy things actually feel right now. You don't have to carry this alone."
                else:
                    ai_raw_reply = f"[Emotion: Warm & Attentive] I hear you completely. It takes genuine courage to face this, and I'm right beside you."

            # Parse display text vs spoken discourse
            displayed_reply, spoken_reply, emotion_tag = kai_core.parse_llm_response(ai_raw_reply)

            # Log to Memory
            memory_manager.log_interaction(user_transcript, displayed_reply, eeg_state, mood)

            # Broadcast AI Transcript to Web Interface
            broadcast_event("transcript", {
                "speaker": "kai",
                "text": displayed_reply,
                "timestamp": time.strftime("%H:%M:%S"),
                "emotionTag": emotion_tag or "Empathetic / Grounded",
                "eegState": eeg_state,
                "facialState": mood,
            })

            # Synthesize Speech via Edge-TTS
            # Defensive sanitization gate: ensure absolutely no internal tags reach the TTS engine
            clean_speech = kai_core.sanitize_for_tts(spoken_reply)
            if not clean_speech or not re.search(r'[a-zA-Z0-9]', clean_speech):
                if spoken_reply:
                    print(f"[BRIDGE] [{time.strftime('%H:%M:%S')}] Spoken reply sanitized to empty discourse; suppressing TTS.")
                is_speaking = False
                continue

            if not session_active:
                is_speaking = False
                continue

            active_speech_id += 1
            current_id = active_speech_id
            speech_stop_event.clear()
            playback_finished_event.clear()
            is_speaking = True

            # 1. State: generating_speech
            broadcast_event("session_state", {"state": "generating_speech", "speechId": current_id})
            print(f"[BRIDGE] [{time.strftime('%H:%M:%S')}] [Turn {current_id}] Synthesizing TTS audio ({len(clean_speech)} chars)...")

            try:
                async def _run_tts():
                    comm = edge_tts.Communicate(clean_speech, "en-IN-PrabhatNeural")
                    await comm.save(str(speech_audio_file))

                asyncio.run(_run_tts())

                if not speech_audio_file.exists() or speech_audio_file.stat().st_size == 0:
                    raise RuntimeError("Edge-TTS produced empty audio file.")

                file_size = speech_audio_file.stat().st_size
                print(f"[BRIDGE] [{time.strftime('%H:%M:%S')}] [Turn {current_id}] TTS generated successfully ({file_size} bytes)")

            except Exception as tts_err:
                print(f"[BRIDGE TTS ERROR] [Turn {current_id}] {tts_err}")
                broadcast_event("session_state", {"state": "error", "error": f"TTS synthesis failed: {tts_err}"})
                is_speaking = False
                time.sleep(1.0)
                continue

            if speech_stop_event.is_set() or current_id != active_speech_id or not session_active:
                print(f"[BRIDGE] [Turn {current_id}] Speech was cancelled before playback.")
                is_speaking = False
                continue

            # 2. State: speaking
            broadcast_event("session_state", {"state": "speaking", "speechId": current_id})
            broadcast_event("audio_available", {
                "url": f"/api/audio/current?t={time.time()}",
                "speechId": current_id,
            })

            # Estimate natural playback duration with safe ceiling
            word_count = len(clean_speech.split())
            estimated_duration = max(2.5, (word_count / 2.2) + 1.2)
            print(f"[BRIDGE] [{time.strftime('%H:%M:%S')}] [Turn {current_id}] Playback started. Waiting for completion (est. {estimated_duration:.1f}s)...")

            # AWAIT client playback completion or user interruption or timeout
            wait_start = time.time()
            while session_active and not playback_finished_event.is_set() and not speech_stop_event.is_set():
                if time.time() - wait_start > (estimated_duration + 5.0):
                    print(f"[BRIDGE] [Turn {current_id}] Playback safety timeout reached ({estimated_duration + 5.0:.1f}s)")
                    break
                time.sleep(0.05)

            is_speaking = False
            if speech_stop_event.is_set():
                print(f"[BRIDGE] [Turn {current_id}] Speech interrupted by user.")
                broadcast_event("session_state", {"state": "interrupted", "speechId": current_id})
                time.sleep(0.2)
            else:
                print(f"[BRIDGE] [{time.strftime('%H:%M:%S')}] [Turn {current_id}] Speech playback completed naturally.")

            # Acoustic echo dissipation cooldown: allow room/speaker reverberation to fade
            time.sleep(0.4)

        except Exception as se:
            print(f"[BRIDGE SESSION ERROR] {se}")
            time.sleep(1)

threading.Thread(target=session_worker_loop, daemon=True).start()

# Continuous Telemetry Emitter Loop
def telemetry_emitter_loop():
    while True:
        try:
            # Continuous biometric stream
            broadcast_event("facial_telemetry", latest_facial_telemetry)
            broadcast_event("eeg_telemetry", latest_eeg_telemetry)
            time.sleep(0.08)  # ~12 Hz
        except Exception:
            time.sleep(0.2)

threading.Thread(target=telemetry_emitter_loop, daemon=True).start()

# 6. REST API ENDPOINTS
@app.get("/api/status")
def get_status():
    global session_active, is_speaking, exg_engine, vision
    ollama_ok = False
    try:
        import urllib.request
        req = urllib.request.urlopen("http://127.0.0.1:11434/api/tags", timeout=0.6)
        ollama_ok = req.status == 200
    except Exception:
        ollama_ok = False

    return {
        "connected": True,
        "hardwarePort": exg_engine.port if exg_engine.use_hardware else None,
        "cameraAvailable": vision is not None and vision.cap is not None and vision.cap.isOpened(),
        "ollamaAvailable": ollama_ok,
        "sessionActive": session_active,
        "audioActive": is_speaking,
        "activeSpeechId": active_speech_id,
    }

@app.get("/api/history")
def get_history():
    return {
        "user_profile": memory_manager.data.get("user_profile", {}),
        "history": memory_manager.data.get("conversation_history", []),
    }

@app.api_route("/api/audio/current", methods=["GET", "HEAD"])
def get_current_audio():
    if speech_audio_file.exists():
        return FileResponse(
            path=str(speech_audio_file),
            media_type="audio/mpeg",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Access-Control-Allow-Origin": "*",
            },
        )
    return JSONResponse(status_code=404, content={"error": "No speech audio available"})

@app.get("/api/camera/stream")
def get_camera_stream():
    def frame_generator():
        while True:
            if latest_jpeg_bytes:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + latest_jpeg_bytes + b"\r\n"
                )
            time.sleep(0.033)

    return StreamingResponse(
        frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )

@app.post("/api/session/start")
def start_session():
    global session_active
    session_active = True
    broadcast_event("session_state", {"state": "listening"})
    return {"status": "started"}

@app.post("/api/session/stop")
def stop_session():
    global session_active, is_speaking
    session_active = False
    is_speaking = False
    speech_stop_event.set()
    playback_finished_event.set()
    broadcast_event("session_state", {"state": "idle"})
    broadcast_event("speech_interrupted", {})
    return {"status": "stopped"}

@app.post("/api/session/stop_speaking")
def stop_speaking():
    global is_speaking, active_speech_id
    active_speech_id += 1
    speech_stop_event.set()
    playback_finished_event.set()
    is_speaking = False
    print(f"[BRIDGE] [stop_speaking] Explicit interruption triggered for active_speech_id={active_speech_id}")
    broadcast_event("speech_interrupted", {"speechId": active_speech_id})
    broadcast_event("session_state", {"state": "interrupted"})
    return {"status": "interrupted"}

@app.post("/api/session/playback_finished")
def post_playback_finished():
    playback_finished_event.set()
    return {"status": "ok"}

# 7. WEBSOCKET REAL-TIME TELEMETRY
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    queue = asyncio.Queue(maxsize=120)
    client_queues.add(queue)

    # Handshake payload
    await ws.send_text(json.dumps({
        "type": "system_status",
        "payload": {
            "connected": True,
            "sessionActive": session_active,
            "hardwarePort": exg_engine.port if exg_engine.use_hardware else None,
            "cameraAvailable": vision is not None and vision.cap is not None and vision.cap.isOpened(),
        }
    }))

    # Read/Write pump tasks
    async def incoming_reader():
        try:
            while True:
                data_text = await ws.receive_text()
                data = json.loads(data_text)
                action = data.get("action")
                if action == "start":
                    start_session()
                elif action == "stop":
                    stop_session()
                elif action == "stop_speaking":
                    stop_speaking()
                elif action == "playback_finished":
                    speech_id = data.get("speechId")
                    print(f"[BRIDGE] Client confirmed playback finished for speechId={speech_id}")
                    playback_finished_event.set()
        except Exception:
            pass

    async def outgoing_sender():
        try:
            while True:
                msg = await queue.get()
                await ws.send_text(msg)
        except Exception:
            pass

    reader_task = asyncio.create_task(incoming_reader())
    sender_task = asyncio.create_task(outgoing_sender())

    try:
        done, pending = await asyncio.wait(
            [reader_task, sender_task],
            return_when=asyncio.FIRST_COMPLETED,
        )
        for t in pending:
            t.cancel()
    finally:
        client_queues.discard(queue)
        try:
            await ws.close()
        except Exception:
            pass

# 8. SERVE PRODUCTION FRONTEND BUILD
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="static")

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("[KAI] PROJECT KAI - WEB RUNTIME ACTIVE")
    print("Local Web Interface: http://localhost:8000")
    print("Vite Dev Server (if active): http://localhost:3000")
    print("WebSocket Telemetry: ws://localhost:8000/ws")
    print("Camera Stream: http://localhost:8000/api/camera/stream")
    print("=" * 60 + "\n")

    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="warning")
