import React from 'react';
import { Smile, AlertTriangle, Gauge, HeartHandshake } from 'lucide-react';
import type { FacialTelemetry, EEGTelemetry } from '../types/events';

interface EmotionPanelProps {
  facial: FacialTelemetry;
  eeg: EEGTelemetry;
  className?: string;
}

export const EmotionPanel: React.FC<EmotionPanelProps> = ({
  facial,
  eeg,
  className = '',
}) => {
  // Affective Incongruence condition (Signature Feature of Project KAI):
  // User is smiling outwardly, but EEG biometrics reveal fatigue or acute load!
  const hasIncongruence =
    facial.mood.includes('Smiling') &&
    (eeg.state === 'Fatigued' || eeg.state === 'High_Load' || eeg.state === 'Agitated' || eeg.arousalRatio > 1.25);

  const getMoodColor = () => {
    if (facial.mood.includes('Smiling')) return 'text-emerald-300 bg-emerald-950/40 border-emerald-800/40';
    if (facial.mood.includes('Tense')) return 'text-rose-300 bg-rose-950/40 border-rose-800/40';
    return 'text-cyan-300 bg-cyan-950/40 border-cyan-800/40';
  };

  return (
    <div
      className={`flex flex-col bg-[#10141B] border border-[#1C2331] rounded-xl p-3.5 shadow-lg select-none ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#1C2331]">
        <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
          <Smile className="w-3.5 h-3.5 text-purple-400" />
          <span>Facial Action Units & Affect</span>
        </div>

        <div className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${getMoodColor()}`}>
          {facial.mood}
        </div>
      </div>

      {/* Affective Incongruence Alert (Clinical Highlight) */}
      {hasIncongruence && (
        <div className="mb-3 p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-200 flex items-start gap-2 animate-pulse-subtle">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-[11px] font-bold text-rose-300 uppercase tracking-wider">
              Affective Masking Detected
            </div>
            <p className="text-[10px] text-rose-200/90 leading-tight mt-0.5">
              Subject shows outward smile, but EEG reveals genuine cognitive fatigue. KAI prompt prioritizing radical validation.
            </p>
          </div>
        </div>
      )}

      {/* Tension Meter & Biometrics Grid */}
      <div className="space-y-2.5 text-xs">
        {/* Tension Meter */}
        <div>
          <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <Gauge className="w-3 h-3 text-slate-400" />
              Facial Strain / Tension
            </span>
            <span className="font-semibold text-slate-200">{facial.tension.toFixed(2)}</span>
          </div>
          <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/60">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                facial.tension > 0.4
                  ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                  : 'bg-gradient-to-r from-emerald-500 to-cyan-400'
              }`}
              style={{ width: `${Math.min(100, Math.round(facial.tension * 100))}%` }}
            />
          </div>
        </div>

        {/* Micro-metrics Grid */}
        <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
          <div className="bg-[#151A23] p-2 rounded border border-[#1C2331]/80">
            <span className="text-[10px] text-slate-400 block">SMILE LIFT</span>
            <span className="text-slate-200 font-bold">
              {facial.smileLift >= 0 ? `+${facial.smileLift.toFixed(3)}` : facial.smileLift.toFixed(3)}
            </span>
          </div>

          <div className="bg-[#151A23] p-2 rounded border border-[#1C2331]/80">
            <span className="text-[10px] text-slate-400 block">BROW TENSION</span>
            <span className="text-slate-200 font-bold">
              {facial.browContraction.toFixed(3)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
