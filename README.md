## 📊 Technical Specifications & Benchmarks
| Parameter | Specification / Benchmark |
| :--- | :--- |
| **EEG Sampling Rate** | $512\text{ Hz}$ ($\Delta t = 1,953\,\mu\text{s}$ interval via hardware timer) |
| **ADC Resolution** | $12\text{-bit}$ ($0 - 4,095$ integer digital counts) |
| **Serial Baud Rate** | $115,200\text{ bps}$ USB CDC |
| **Vision Tracking** | $468\text{ points}$ (full 3D face mesh @ $30\text{ FPS}$) |
| **STT Latency** | $\sim 280\text{ ms}$ on CUDA (Faster-Whisper `tiny.en` int8) |
| **LLM Generation Speed** | $\sim 45\text{ tokens/second}$ on NVIDIA RTX 3070 ($8\text{ GB}$ VRAM) |
| **VRAM Consumption** | $\sim 5.2\text{ GB}$ (leaving $>2.5\text{ GB}$ for vision and OS) |
| **WebSocket Refresh** | $\sim 12\text{ Hz}$ continuous biometric telemetry packets |
| **Total Cloud Data Sent** | **$0\text{ Bytes}$ (Zero cloud egress / complete data sovereignty)** |
---
## 🛡️ Safety, Ethics & Privacy
- **Low-Voltage DC Operation:** The BioAmp EXG Pill operates strictly on low-voltage ($3.3\text{V} - 5\text{V}$) DC power derived from standard USB isolation, guaranteeing complete electrical safety during skin-contact electrophysiological measurements.
- **Non-Diagnostic Supportive Care:** KAI is designed as an affective biofeedback companion and psychological co-regulation assistant. It does not replace psychiatric emergency care, but empowers users with objective cognitive self-awareness and validated coping mechanisms.
- **Zero Third-Party Telemetry:** No analytics libraries, third-party tracking scripts, or cloud inference APIs are employed.
---
## 🏆 License & Accreditations
Project KAI was developed for national technical competitions and evaluations:
- **JU Techfest Hackathon**
- **INSPIRE Awards MANAK** *(Department of Science and Technology, Govt. of India)*
- **MNIT Jaipur** Technical Showcase
- **Vishwakarma Awards 2026** *(IIT Indore)*
Distributed under the **MIT License**. See [`LICENSE`](https://opensource.org/licenses/MIT) for more information.
<div align="center">
  <sub>Built with ❤️ for accessible, stigma-free, privacy-first mental health biofeedback.</sub>
</div>
