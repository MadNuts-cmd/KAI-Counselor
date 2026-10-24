import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  Wifi,
  WifiOff,
  Cpu,
  Clock,
  Activity,
  Menu,
  X,
  Video,
  Brain,
  Check,
} from 'lucide-react';
import type { BackendStatus, OperationalState } from '../types/events';

interface TopBarProps {
  status: BackendStatus;
  operationalState: OperationalState;
  sessionDuration: number;
  viewMode: 'video' | 'eeg';
  onViewModeChange: (mode: 'video' | 'eeg') => void;
  onOpenSettings?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  status,
  operationalState,
  sessionDuration,
  viewMode,
  onViewModeChange,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside or Esc key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStateColor = () => {
    switch (operationalState) {
      case 'speaking':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'generating_speech':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'listening':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'thinking':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'interrupted':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'error':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'disconnected':
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  return (
    <header className="h-14 border-b border-[#1C2331] bg-[#10141B]/95 backdrop-blur-md px-4 sm:px-5 flex items-center justify-between select-none z-40 relative">
      {/* Left: Hamburger Mode Menu + Brand Identity */}
      <div className="flex items-center gap-3">
        {/* Hamburger Menu Toggle Button */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((prev) => !prev)}
            className={`p-2 rounded-lg border transition flex items-center justify-center ${
              menuOpen
                ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300'
                : 'bg-[#151A23] border-[#1C2331] text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            title="Switch Workspace Mode (☰)"
            aria-label="Workspace Menu"
          >
            {menuOpen ? <X className="w-4 h-4 text-cyan-400" /> : <Menu className="w-4 h-4" />}
          </button>

          {/* Hamburger Dropdown Modal */}
          {menuOpen && (
            <div className="absolute left-0 top-12 w-80 bg-[#0E131C] border border-cyan-500/30 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] p-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3 py-2 border-b border-slate-800/80 mb-2">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                  Select Interface Mode
                </span>
              </div>

              {/* Video Call Mode Option */}
              <button
                onClick={() => {
                  onViewModeChange('video');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-start gap-3 p-3 rounded-xl transition text-left ${
                  viewMode === 'video'
                    ? 'bg-cyan-950/60 border border-cyan-500/40 text-cyan-100'
                    : 'hover:bg-slate-800/60 text-slate-300 hover:text-white'
                }`}
              >
                <div
                  className={`p-2 rounded-lg mt-0.5 ${
                    viewMode === 'video' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Video className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs tracking-wide">Video Call Mode</span>
                    {viewMode === 'video' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                    Focused AI video call. Large 3D KAI orb (75% focus), floating PiP camera & compact dialogue.
                  </p>
                </div>
              </button>

              {/* EEG Mode Option */}
              <button
                onClick={() => {
                  onViewModeChange('eeg');
                  setMenuOpen(false);
                }}
                className={`w-full flex items-start gap-3 p-3 rounded-xl transition text-left mt-1 ${
                  viewMode === 'eeg'
                    ? 'bg-purple-950/60 border border-purple-500/40 text-purple-100'
                    : 'hover:bg-slate-800/60 text-slate-300 hover:text-white'
                }`}
              >
                <div
                  className={`p-2 rounded-lg mt-0.5 ${
                    viewMode === 'eeg' ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Brain className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs tracking-wide">EEG & Biometrics Mode</span>
                    {viewMode === 'eeg' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                    Technical workspace with prefrontal EEG bands (θ, α, β), facial action units & full transcript.
                  </p>
                </div>
              </button>

              <div className="mt-2 pt-2 border-t border-slate-800/80 px-2 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>Press Esc to close</span>
                <span className="text-cyan-400">Zero backend reload</span>
              </div>
            </div>
          )}
        </div>

        {/* Brand Logo & Title */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-600/20 border border-cyan-500/30 shadow-[0_0_12px_rgba(54,207,255,0.2)]">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-sm tracking-wide text-white">PROJECT KAI</h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 font-mono font-medium">
                AFFECTIVE v2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400 -mt-0.5 hidden sm:block">
              Multimodal Edge Brain-Computer Interface Counselor
            </p>
          </div>
        </div>

        {/* Quick Mode Toggle Pill */}
        <div className="hidden md:flex items-center bg-[#0B0F17] p-1 rounded-xl border border-[#1C2331] ml-2">
          <button
            onClick={() => onViewModeChange('video')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              viewMode === 'video'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Video Call</span>
          </button>
          <button
            onClick={() => onViewModeChange('eeg')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              viewMode === 'eeg'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>EEG Workspace</span>
          </button>
        </div>
      </div>

      {/* Center: Operational State Badge */}
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${getStateColor()} transition-colors duration-300`}
        >
          <span className="w-2 h-2 rounded-full bg-current animate-ping opacity-75" />
          <span className="capitalize">{operationalState.replace('_', ' ')}</span>
        </div>

        {status.sessionActive && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatDuration(sessionDuration)}</span>
          </div>
        )}
      </div>

      {/* Right: Telemetry & Hardware Status Badges */}
      <div className="flex items-center gap-3">
        {/* Backend Connection */}
        <div className="flex items-center gap-1.5 text-xs">
          {status.connected ? (
            <div className="flex items-center gap-1 text-emerald-400 font-mono">
              <Wifi className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Core Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-rose-400 font-mono animate-pulse">
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Connecting...</span>
            </div>
          )}
        </div>

        {/* AI Engine Status */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 border-l border-[#1C2331] pl-3">
          <Cpu className="w-3.5 h-3.5 text-purple-400" />
          <span className="font-mono text-slate-300">
            {status.ollamaAvailable ? 'Llama-3-8B' : 'Ollama Offline'}
          </span>
        </div>

        {/* Zero-Cloud Privacy Badge */}
        <div className="hidden xl:flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/30 text-emerald-300 text-[11px]">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>Local Sovereignty</span>
        </div>
      </div>
    </header>
  );
};
