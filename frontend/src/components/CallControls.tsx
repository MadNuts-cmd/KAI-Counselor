import React from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Square,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Brain,
  MessageSquare,
} from 'lucide-react';

interface CallControlsProps {
  sessionActive: boolean;
  isSpeaking: boolean;
  isMicMuted: boolean;
  isCameraActive: boolean;
  isAudioMuted: boolean;
  viewMode?: 'video' | 'eeg';
  isChatOpen?: boolean;
  onToggleSession: () => void;
  onStopSpeaking: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleAudio: () => void;
  onToggleViewMode?: () => void;
  onToggleChat?: () => void;
  className?: string;
}

export const CallControls: React.FC<CallControlsProps> = ({
  sessionActive,
  isSpeaking,
  isMicMuted,
  isCameraActive,
  isAudioMuted,
  viewMode = 'video',
  isChatOpen = false,
  onToggleSession,
  onStopSpeaking,
  onToggleMic,
  onToggleCamera,
  onToggleAudio,
  onToggleViewMode,
  onToggleChat,
  className = '',
}) => {
  return (
    <div
      className={`h-20 bg-[#10141B]/95 backdrop-blur-md border-t border-[#1C2331] px-4 sm:px-6 flex items-center justify-between select-none z-30 ${className}`}
    >
      {/* Left utility toggles */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* Mic Toggle */}
        <button
          onClick={onToggleMic}
          className={`p-3 rounded-full border transition flex items-center justify-center ${
            isMicMuted
              ? 'bg-rose-950/60 border-rose-800/60 text-rose-400 hover:bg-rose-900/60'
              : 'bg-[#151A23] border-[#1C2331] text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          aria-label={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        >
          {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Camera Toggle */}
        <button
          onClick={onToggleCamera}
          className={`p-3 rounded-full border transition flex items-center justify-center ${
            !isCameraActive
              ? 'bg-rose-950/60 border-rose-800/60 text-rose-400 hover:bg-rose-900/60'
              : 'bg-[#151A23] border-[#1C2331] text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title={isCameraActive ? 'Disable Camera Feed' : 'Enable Camera Feed'}
          aria-label={isCameraActive ? 'Disable Camera Feed' : 'Enable Camera Feed'}
        >
          {isCameraActive ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Audio Output Mute */}
        <button
          onClick={onToggleAudio}
          className={`p-3 rounded-full border transition flex items-center justify-center ${
            isAudioMuted
              ? 'bg-rose-950/60 border-rose-800/60 text-rose-400 hover:bg-rose-900/60'
              : 'bg-[#151A23] border-[#1C2331] text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title={isAudioMuted ? 'Unmute Speaker Output' : 'Mute Speaker Output'}
          aria-label={isAudioMuted ? 'Unmute Speaker Output' : 'Mute Speaker Output'}
        >
          {isAudioMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        {/* Dialogue / Chat Toggle */}
        {onToggleChat && (
          <button
            onClick={onToggleChat}
            className={`p-3 rounded-full border transition flex items-center justify-center relative cursor-pointer ${
              isChatOpen
                ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300 shadow-[0_0_12px_rgba(54,207,255,0.3)]'
                : 'bg-[#151A23] border-[#1C2331] text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title={isChatOpen ? 'Close Dialogue History' : 'Open Dialogue History'}
            aria-label={isChatOpen ? 'Close Dialogue History' : 'Open Dialogue History'}
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Center Primary Action Group: Session Start/End & Prominent STOP SPEAKING */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Prominent Stop Speaking Button (Instant interruption) */}
        {isSpeaking && (
          <button
            onClick={onStopSpeaking}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-amber-600 via-rose-600 to-rose-700 hover:from-amber-500 hover:to-rose-600 text-white font-bold text-xs sm:text-sm tracking-wider shadow-[0_0_25px_rgba(244,63,94,0.5)] animate-pulse transition-all transform hover:scale-105 cursor-pointer"
            title="Interrupt and halt KAI speaking immediately"
          >
            <Square className="w-4 h-4 fill-white text-white" />
            <span>STOP SPEAKING</span>
          </button>
        )}

        {/* Main Consultation Toggle Button */}
        <button
          onClick={onToggleSession}
          className={`flex items-center gap-2.5 px-6 sm:px-8 py-3 rounded-full font-semibold text-xs sm:text-sm tracking-wide transition-all shadow-lg transform hover:scale-102 cursor-pointer ${
            sessionActive
              ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]'
              : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold shadow-[0_0_25px_rgba(54,207,255,0.35)]'
          }`}
        >
          {sessionActive ? (
            <>
              <PhoneOff className="w-4 h-4" />
              <span>END CONSULTATION</span>
            </>
          ) : (
            <>
              <Phone className="w-4 h-4 fill-current" />
              <span>START CONSULTATION</span>
            </>
          )}
        </button>
      </div>

      {/* Right: Quick Workspace Switcher or Voice Status */}
      <div className="flex items-center gap-3">
        {onToggleViewMode && (
          <button
            onClick={onToggleViewMode}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#141A24] hover:bg-[#1A2230] border border-[#232D3F] text-xs text-slate-300 hover:text-cyan-300 transition"
            title={`Switch to ${viewMode === 'video' ? 'EEG Mode' : 'Video Mode'}`}
          >
            {viewMode === 'video' ? (
              <>
                <Brain className="w-3.5 h-3.5 text-purple-400" />
                <span>EEG Mode</span>
              </>
            ) : (
              <>
                <Video className="w-3.5 h-3.5 text-cyan-400" />
                <span>Video Mode</span>
              </>
            )}
          </button>
        )}

        <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>Neural Audio Matrix</span>
        </div>
      </div>
    </div>
  );
};
