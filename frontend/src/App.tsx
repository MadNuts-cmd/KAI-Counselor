import { useState, useEffect, useRef } from 'react';
import { useBackend } from './hooks/useBackend';
import { TopBar } from './components/TopBar';
import { ConversationPanel } from './components/ConversationPanel';
import { KaiOrb } from './components/KaiOrb';
import { CameraPanel } from './components/CameraPanel';
import { BiometricsPanel } from './components/BiometricsPanel';
import { EEGTrainingPanel } from './components/EEGTrainingPanel';
import { EmotionPanel } from './components/EmotionPanel';
import { CallControls } from './components/CallControls';
import { Square, MessageSquare, Activity, Sparkles, Camera } from 'lucide-react';

export default function App() {
  const {
    operationalState,
    affectiveState,
    status,
    messages,
    facialTelemetry,
    eegTelemetry,
    isAudioPlaying,
    isMicMuted,
    isCameraActive,
    isAudioMuted,
    sessionDuration,
    toggleSession,
    stopSpeaking,
    toggleMic,
    toggleCamera,
    toggleAudio,
  } = useBackend();

  // Primary Workspace Mode: 'video' (Minimal Call, Default) | 'eeg' (Technical Workspace)
  const [viewMode, setViewMode] = useState<'video' | 'eeg'>('video');

  // Floating PiP camera visibility in Video Mode
  const [isPipVisible, setIsPipVisible] = useState(true);

  // Floating dialogue history visibility in Video Call Mode
  const [isVideoChatOpen, setIsVideoChatOpen] = useState(false);

  // Mobile/Tablet Tab Switcher: 'orb' | 'chat' | 'telemetry'
  const [mobileTab, setMobileTab] = useState<'orb' | 'chat' | 'telemetry'>('orb');

  // Find latest KAI response for central subtitle overlay
  const latestKaiMessage = [...messages].reverse().find((m) => m.speaker === 'kai')?.text || '';

  // Synchronous state ref for rock-solid keyboard interruption without listener re-binding
  const interruptStateRef = useRef({
    operationalState,
    isAudioPlaying,
    stopSpeaking,
  });
  interruptStateRef.current = {
    operationalState,
    isAudioPlaying,
    stopSpeaking,
  };

  // Keyboard shortcut listener: Spacebar to interrupt speech immediately
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Respond strictly to Space key (or Escape)
      if (e.code !== 'Space' && e.key !== ' ' && e.key !== 'Escape') return;

      // Do NOT interrupt if typing in input, textarea, select, or contenteditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.closest('input, textarea, select, [contenteditable="true"]'))
      ) {
        return;
      }

      const { operationalState, isAudioPlaying, stopSpeaking } = interruptStateRef.current;
      const canInterrupt =
        operationalState === 'speaking' ||
        operationalState === 'generating_speech' ||
        isAudioPlaying;

      if (canInterrupt) {
        // Prevent default spacebar page scrolling
        e.preventDefault();
        console.log('[App] Spacebar interruption triggered');
        stopSpeaking();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#07090D] text-slate-100 overflow-hidden font-sans">
      {/* 1. Top Navigation Bar with Mode Selector & Telemetry */}
      <TopBar
        status={status}
        operationalState={operationalState}
        sessionDuration={sessionDuration}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* 2. Main Workplace Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* LEFT COLUMN: Dialogue & Historical Transcript (Visible in EEG Mode or Mobile Chat tab) */}
        {viewMode === 'eeg' && (
          <section
            className={`w-72 sm:w-80 shrink-0 h-full transition-all duration-300 z-10 ${
              mobileTab === 'chat'
                ? 'absolute inset-0 z-20 flex w-full'
                : 'hidden md:flex'
            }`}
          >
            <ConversationPanel
              messages={messages}
              isStreaming={operationalState === 'thinking'}
              className="w-full h-full"
            />
          </section>
        )}

        {/* CENTER COLUMN: Central AI Entity (The Animated 3D Energy Orb) */}
        <section
          className={`flex-1 flex flex-col items-center justify-between p-4 md:p-6 relative bg-gradient-to-b from-[#07090D] via-[#090C12] to-[#07090D] overflow-hidden ${
            mobileTab === 'orb' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {/* Ambient Cyber Scanline & Grid Effect */}
          <div className="scanline-effect opacity-30 pointer-events-none" />
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(circle at 1px 1px, #36CFFF 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }}
          />

          {/* Floating Dialogue History Window (Video Call Mode) */}
          {viewMode === 'video' && isVideoChatOpen && (
            <div className="absolute left-4 top-4 bottom-24 w-80 sm:w-84 max-w-[calc(100vw-32px)] bg-[#0D1117]/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.85)] z-30 flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-2 duration-150">
              <ConversationPanel
                messages={messages}
                isStreaming={operationalState === 'thinking'}
                onClose={() => setIsVideoChatOpen(false)}
                className="w-full h-full border-r-0"
              />
            </div>
          )}

          {/* Floating Dialogue Toggle Pill (Video Call Mode - When Closed) */}
          {viewMode === 'video' && !isVideoChatOpen && (
            <div className="absolute top-4 left-4 z-20">
              <button
                onClick={() => setIsVideoChatOpen(true)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#101520]/90 hover:bg-[#161F2E] backdrop-blur-md border border-cyan-500/30 text-cyan-300 text-xs shadow-lg transition cursor-pointer select-none"
                title="Open Dialogue History"
              >
                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                <span>Dialogue ({messages.length})</span>
              </button>
            </div>
          )}

          {/* Floating PiP Camera (Available in both Video Mode and EEG Mode over Orb Centerpiece) */}
          {isCameraActive && (
            <div className="absolute top-4 right-4 z-30">
              {isPipVisible ? (
                <CameraPanel
                  streamUrl="/api/camera/stream"
                  isAvailable={status.cameraAvailable}
                  telemetry={facialTelemetry}
                  variant="pip"
                  onClose={() => setIsPipVisible(false)}
                />
              ) : (
                <button
                  onClick={() => setIsPipVisible(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#101520]/90 backdrop-blur-md border border-cyan-500/30 text-cyan-300 text-xs shadow-lg hover:bg-slate-800 transition cursor-pointer select-none"
                  title="Show Live 468 MediaPipe Face Mesh Camera"
                >
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{viewMode === 'eeg' ? '468 Mesh Cam' : 'Show Camera'}</span>
                </button>
              )}
            </div>
          )}

          {/* Top Center Status Headline */}
          <div className="z-10 text-center select-none pt-1">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-xs text-slate-300 shadow-md">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {operationalState === 'speaking' || isAudioPlaying
                  ? 'KAI Speaking • Voice Matrix Active'
                  : operationalState === 'generating_speech'
                  ? 'Synthesizing Neural Speech Audio...'
                  : operationalState === 'thinking'
                  ? 'KAI Formulating Clinical Reflection'
                  : operationalState === 'listening'
                  ? 'Attentive Listening • VAD Active'
                  : operationalState === 'interrupted'
                  ? 'Speech Interrupted • Standing By'
                  : 'Ready • On-Device Psychological Counselor'}
              </span>
            </div>
          </div>

          {/* 3D Orb Visualizer Centerpiece (70–80% visual focus in Video Mode) */}
          <div className="w-full flex-1 flex items-center justify-center relative min-h-[320px]">
            <KaiOrb
              operationalState={operationalState}
              affectiveState={affectiveState}
              isAudioPlaying={isAudioPlaying}
              className={viewMode === 'video' ? 'max-w-[580px] max-h-[580px]' : 'max-w-[460px] max-h-[460px]'}
            />
          </div>

          {/* Subtitle / Active Response Banner */}
          <div className="w-full max-w-xl z-20 flex flex-col items-center gap-2 pb-1">
            {latestKaiMessage && (operationalState === 'speaking' || isAudioPlaying) ? (
              <div className="w-full bg-[#10141B]/95 backdrop-blur-md border border-cyan-500/30 rounded-2xl px-5 py-3.5 text-center shadow-[0_4px_25px_rgba(54,207,255,0.12)] animate-fade-in">
                <p className="text-xs md:text-sm text-cyan-100 font-medium leading-relaxed line-clamp-3">
                  "{latestKaiMessage}"
                </p>

                {/* Instant Stop Speaking Pill in Subtitle */}
                <div className="mt-2.5 flex items-center justify-center gap-2">
                  <button
                    onClick={stopSpeaking}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-semibold transition cursor-pointer shadow-sm hover:scale-102"
                    title="Press Space or click to stop speech"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Interrupt Speech (Space)</span>
                  </button>
                </div>
              </div>
            ) : operationalState === 'listening' ? (
              <div className="text-xs font-mono text-slate-400 flex items-center gap-2 bg-[#0E121B]/80 px-3.5 py-1.5 rounded-full border border-[#1C2331]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Microphone streaming: speak naturally at your own pace...</span>
              </div>
            ) : null}
          </div>
        </section>

        {/* RIGHT COLUMN: Biometrics, Camera Preview & Facial Action Units (EEG Mode Only) */}
        {viewMode === 'eeg' && (
          <section
            className={`w-72 sm:w-80 shrink-0 h-full p-3.5 space-y-3.5 overflow-y-auto bg-[#0A0D14] border-l border-[#1C2331] z-10 ${
              mobileTab === 'telemetry'
                ? 'absolute inset-0 z-20 flex flex-col w-full'
                : 'hidden md:flex flex-col'
            }`}
          >
            {/* Live Camera View with MediaPipe Landmarks (Full uncropped aspect ratio) */}
            <CameraPanel
              streamUrl="/api/camera/stream"
              isAvailable={isCameraActive && status.cameraAvailable}
              telemetry={facialTelemetry}
              variant="panel"
            />

            {/* Prefrontal EEG Spectral Power Telemetry */}
            <BiometricsPanel telemetry={eegTelemetry} />

            {/* BioAmp EEG Dataset Collection & Model Training */}
            <EEGTrainingPanel />

            {/* Facial Emotion Units & Incongruence Monitor */}
            <EmotionPanel facial={facialTelemetry} eeg={eegTelemetry} />
          </section>
        )}
      </main>

      {/* 3. Mobile Navigation Tab Bar */}
      <div className="flex md:hidden h-12 bg-[#10141B] border-t border-[#1C2331] items-center justify-around text-xs text-slate-400 z-30">
        <button
          onClick={() => setMobileTab('orb')}
          className={`flex items-center gap-1.5 py-2 px-3 rounded-lg ${
            mobileTab === 'orb' ? 'text-cyan-400 font-bold bg-slate-900' : ''
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>KAI Orb</span>
        </button>
        <button
          onClick={() => setMobileTab('chat')}
          className={`flex items-center gap-1.5 py-2 px-3 rounded-lg ${
            mobileTab === 'chat' ? 'text-cyan-400 font-bold bg-slate-900' : ''
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Transcript</span>
        </button>
        <button
          onClick={() => setMobileTab('telemetry')}
          className={`flex items-center gap-1.5 py-2 px-3 rounded-lg ${
            mobileTab === 'telemetry' ? 'text-cyan-400 font-bold bg-slate-900' : ''
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Biometrics</span>
        </button>
      </div>

      {/* 4. Bottom Video-Conference Call Controls */}
      <CallControls
        sessionActive={status.sessionActive}
        isSpeaking={operationalState === 'speaking' || isAudioPlaying}
        isMicMuted={isMicMuted}
        isCameraActive={isCameraActive}
        isAudioMuted={isAudioMuted}
        viewMode={viewMode}
        isChatOpen={isVideoChatOpen}
        onToggleSession={toggleSession}
        onStopSpeaking={stopSpeaking}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onToggleAudio={toggleAudio}
        onToggleViewMode={() => setViewMode((prev) => (prev === 'video' ? 'eeg' : 'video'))}
        onToggleChat={() => setIsVideoChatOpen((prev) => !prev)}
      />
    </div>
  );
}
