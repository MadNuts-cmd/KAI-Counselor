# Project KAI — Web Interface & Multimodal Core Suite

A locally hosted, browser-based desktop-class conversational interface for **Project KAI (Knowledgeable Affective Intelligence)**.

## Architecture

```
[Hardware Layer]
BioAmp EXG Pill (A0) ---> Arduino Uno R4 (512Hz) ---> Serial
Webcam -----------------> MediaPipe (468 landmarks) -> OpenCV
Microphone -------------> SoundDevice (RMS VAD) ----> Faster-Whisper

[Protected Core Application]
kai_interactive_core(arudino).py (Unmodified)
├── MemoryManager (counselor_memory.json)
├── PersistentEXGEngine (Welch PSD & RandomForest)
├── FullMeshVision (FaceLandmarker tracking)
├── OfflineSpeechRecognizer (tiny.en int8)
└── sanitize_for_tts & parse_llm_response

[Web Bridge Adapter]
web_bridge.py (FastAPI + Uvicorn)
├── /ws (Real-time telemetry streaming at ~12 Hz)
├── /api/camera/stream (MJPEG live video with 468 facial mesh)
├── /api/audio/current (Web Audio API & AnalyserNode playback)
├── /api/session/* (Lifecycle: start, stop, stop_speaking)
└── Static Web App Server (http://localhost:8000)

[React + Three.js Frontend]
frontend/ (React 18 + TypeScript + Vite + Tailwind CSS)
├── Central 3D KAI Energy Orb (Three.js point cloud shader)
├── Dialogue & Historical Memory Panel
├── Biometric Vision Matrix (Camera & Landmarks HUD)
├── Prefrontal EEG Telemetry (Theta, Alpha, Beta, Ratio)
├── Facial Action Units & Affective Masking Alert
└── Video-Call Controls (Start, End, Interruptible Stop Speaking)
```

## Features

1. **Central 3D Volumetric KAI Energy Orb:**
   - Procedural Three.js WebGL point-cloud organic orb based directly on the provided reference design.
   - Electric cyan and azure top surface curving into neon violet and radiant magenta on the underside.
   - Real-time audio reactive: driven by Web Audio API `AnalyserNode` connected to Edge-TTS output.
   - Contextual state machine: idle breathing, listening ripples, thinking swirls, and empathetic warmth.

2. **Real-time Live Camera with 468 MediaPipe Landmarks:**
   - Streams live annotated video frames from OpenCV and MediaPipe Tasks.
   - Dynamic self-calibration progress tracking (first 90 frames baseline).

3. **Prefrontal EEG Biofeedback Telemetry:**
   - Real-time spectral power across Theta (4–8 Hz), Alpha (8–13 Hz), and Beta (13–30 Hz).
   - Instantaneous $\beta / \alpha$ arousal ratio and predicted cognitive load (Calm / Fatigued / Agitated).

4. **Affective Incongruence Monitor:**
   - Detects affective masking (user smiling outwardly while EEG telemetry indicates genuine cognitive fatigue).
   - Visual alert badge with radical validation priority.

5. **Instant Speech Interruption:**
   - Prominent **Stop Speaking** button halts audio immediately, resets the orb, and allows the user to speak again without restarting the application.

## Quick Launch Instructions

### 1. Start the Complete Web Suite:
Double-click `start_web.bat` in the root folder, or run:
```bash
cd KAI-Counselor-main
python web_bridge.py
```

### 2. Access the Web Interface:
Open your browser to:
**http://localhost:8000**
