import React from 'react';
import { Activity, Brain, Radio, Zap } from 'lucide-react';
import type { EEGTelemetry } from '../types/events';

interface BiometricsPanelProps {
  telemetry: EEGTelemetry;
  className?: string;
}

export const BiometricsPanel: React.FC<BiometricsPanelProps> = ({
  telemetry,
  className = '',
}) => {
  // Normalize band powers for visually proportional bar indicators
  const maxPower = Math.max(telemetry.theta, telemetry.alpha, telemetry.beta, 1.0);
  const thetaPct = Math.min(100, Math.round((telemetry.theta / maxPower) * 100));
  const alphaPct = Math.min(100, Math.round((telemetry.alpha / maxPower) * 100));
  const betaPct = Math.min(100, Math.round((telemetry.beta / maxPower) * 100));

  const getArousalBadge = () => {
    switch (telemetry.state.toLowerCase()) {
      case 'calm':
        return 'bg-emerald-950/60 border-emerald-800/40 text-emerald-400';
      case 'fatigued':
        return 'bg-purple-950/60 border-purple-800/40 text-purple-400';
      case 'high_load':
      case 'agitated':
        return 'bg-amber-950/60 border-amber-800/40 text-amber-400';
      default:
        return 'bg-slate-900 border-slate-800 text-slate-300';
    }
  };

  return (
    <div
      className={`flex flex-col bg-[#10141B] border border-[#1C2331] rounded-xl p-3.5 shadow-lg select-none ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#1C2331]">
        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
          <Brain className="w-3.5 h-3.5 text-cyan-400" />
          <span>Prefrontal EEG Telemetry</span>
        </div>

        {/* Hardware Status Pill */}
        <div className="flex items-center gap-1 text-[10px] font-mono">
          {telemetry.isHardwareConnected ? (
            <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/30">
              <Zap className="w-2.5 h-2.5" />
              Arduino 512Hz
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              <Radio className="w-2.5 h-2.5 text-slate-400" />
              Simulated Mode
            </span>
          )}
        </div>
      </div>

      {/* State & Ratio Spotlight */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* Arousal Ratio */}
        <div className="bg-[#151A23] p-2.5 rounded-lg border border-[#1C2331]/80">
          <div className="text-[10px] text-slate-400 font-mono mb-1">AROUSAL (β / α)</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold font-mono text-cyan-300">
              {telemetry.arousalRatio.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">ratio</span>
          </div>
        </div>

        {/* Cognitive State */}
        <div className="bg-[#151A23] p-2.5 rounded-lg border border-[#1C2331]/80 flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 font-mono mb-1">PREDICTED STATE</div>
          <div
            className={`px-2 py-1 rounded text-center text-xs font-semibold font-mono border ${getArousalBadge()}`}
          >
            {telemetry.state}
          </div>
        </div>
      </div>

      {/* Spectral Band Power Meters */}
      <div className="space-y-2 text-xs">
        {/* Theta */}
        <div>
          <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span>Theta (θ: 4–8 Hz)</span>
            <span className="text-slate-300">{telemetry.theta.toFixed(1)} µV²</span>
          </div>
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/60">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-300 rounded-full"
              style={{ width: `${thetaPct}%` }}
            />
          </div>
        </div>

        {/* Alpha */}
        <div>
          <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span>Alpha (α: 8–13 Hz)</span>
            <span className="text-slate-300">{telemetry.alpha.toFixed(1)} µV²</span>
          </div>
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/60">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300 rounded-full"
              style={{ width: `${alphaPct}%` }}
            />
          </div>
        </div>

        {/* Beta */}
        <div>
          <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span>Beta (β: 13–30 Hz)</span>
            <span className="text-slate-300">{telemetry.beta.toFixed(1)} µV²</span>
          </div>
          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/60">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-rose-400 transition-all duration-300 rounded-full"
              style={{ width: `${betaPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
