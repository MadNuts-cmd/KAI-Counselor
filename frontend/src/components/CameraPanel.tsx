import React, { useState } from 'react';
import { Camera, CameraOff, Eye, RefreshCw, Minimize2, X, ChevronDown } from 'lucide-react';
import type { FacialTelemetry } from '../types/events';

interface CameraPanelProps {
  streamUrl: string;
  isAvailable: boolean;
  telemetry: FacialTelemetry;
  variant?: 'panel' | 'pip';
  onClose?: () => void;
  className?: string;
}

export const CameraPanel: React.FC<CameraPanelProps> = ({
  streamUrl,
  isAvailable,
  telemetry,
  variant = 'panel',
  onClose,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  const handleRetry = () => {
    setImgError(false);
    setRetryKey((prev) => prev + 1);
  };

  // 1. Picture-in-Picture (PiP) Floating Presentation for Video Mode
  if (variant === 'pip') {
    if (isMinimized) {
      return (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0D121B]/90 backdrop-blur-xl border border-cyan-500/40 shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-xs z-30 transition-all ${className}`}
        >
          <div className="flex items-center gap-1.5 text-cyan-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>468 Mesh</span>
          </div>
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
            title="Expand Camera Feed"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div
        className={`w-72 sm:w-80 rounded-2xl overflow-hidden bg-[#0D121B]/95 backdrop-blur-xl border border-cyan-500/40 shadow-[0_12px_40px_rgba(0,0,0,0.7)] flex flex-col z-30 transition-all select-none ${className}`}
      >
        {/* PiP Header */}
        <div className="h-8 px-3 bg-[#111723]/90 border-b border-cyan-500/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-cyan-300 font-medium">
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] tracking-wide">User Cam • 468 Mesh</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
              title="Minimize PiP"
            >
              <Minimize2 className="w-3 h-3" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                title="Hide Feed"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Video Frame - uncropped object-contain with native 4:3 camera aspect ratio */}
        <div className="relative aspect-[4/3] w-full bg-[#05070B] flex items-center justify-center overflow-hidden">
          {isAvailable && !imgError ? (
            <img
              key={retryKey}
              src={`${streamUrl}?k=${retryKey}`}
              alt="Real-time MediaPipe Facial Landmark Stream"
              className="w-full h-full object-contain"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-3 text-slate-500">
              <CameraOff className="w-6 h-6 mb-1 text-slate-500" />
              <p className="text-[11px] font-medium text-slate-300">Camera Feed Inactive</p>
              <button
                onClick={handleRetry}
                className="mt-2 flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] transition"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>Reconnect</span>
              </button>
            </div>
          )}

          {/* PiP Overlays */}
          {isAvailable && !imgError && (
            <>
              {/* Landmark count pill (anchored top-right inside camera viewport) */}
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md border border-cyan-500/30 text-[9px] font-mono text-cyan-300">
                <Eye className="w-2.5 h-2.5 text-cyan-400" />
                <span>{telemetry.isFaceDetected ? '468 Landmarks' : 'Searching...'}</span>
              </div>

              {/* Baseline indicator pill */}
              <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-md border border-white/10 text-[9px] font-mono">
                {telemetry.isCalibrated ? (
                  <span className="text-emerald-400">Calibrated</span>
                ) : (
                  <span className="text-amber-400">Calibrating</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // 2. Standard Embedded Panel Presentation for EEG Workspace Mode
  return (
    <div
      className={`relative flex flex-col bg-[#10141B] border border-[#1C2331] rounded-xl overflow-hidden shadow-lg ${className}`}
    >
      {/* Panel Sub-Header */}
      <div className="h-9 px-3.5 border-b border-[#1C2331] bg-[#121720] flex items-center justify-between shrink-0 text-xs">
        <div className="flex items-center gap-1.5 text-slate-300 font-medium">
          <Camera className="w-3.5 h-3.5 text-cyan-400" />
          <span>Biometric Vision Matrix</span>
        </div>

        <div className="flex items-center gap-2">
          {isAvailable && !imgError ? (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 text-[10px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>468 Mesh Live</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-800/40 text-rose-400 text-[10px] font-mono">
              <CameraOff className="w-2.5 h-2.5" />
              <span>Camera Inactive</span>
            </div>
          )}
        </div>
      </div>

      {/* Video Viewport Container: object-contain with native aspect ratio prevents forehead/chin cropping */}
      <div className="relative aspect-[4/3] w-full bg-black flex items-center justify-center overflow-hidden">
        {isAvailable && !imgError ? (
          <img
            key={retryKey}
            src={`${streamUrl}?k=${retryKey}`}
            alt="Real-time MediaPipe Facial Landmark Stream"
            className="w-full h-full object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-4 text-slate-500">
            <CameraOff className="w-8 h-8 mb-2 opacity-50 text-slate-400" />
            <p className="text-xs font-medium text-slate-300">Camera Feed Unavailable</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
              Verify camera permissions or physical privacy shutter.
            </p>
            <button
              onClick={handleRetry}
              className="mt-3 flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reconnect Feed</span>
            </button>
          </div>
        )}

        {/* Live Tracking HUD Overlay */}
        {isAvailable && !imgError && (
          <>
            {/* Top Right: Tracking status badge (anchored top-right inside camera viewport) */}
            <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-cyan-300">
              <Eye className="w-3 h-3 text-cyan-400" />
              <span>
                {telemetry.isFaceDetected
                  ? `${telemetry.landmarksCount || 468} Landmarks`
                  : 'Searching Face...'}
              </span>
            </div>

            {/* Bottom Right: Calibration Pill */}
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-[10px] font-mono text-slate-300">
              {telemetry.isCalibrated ? (
                <span className="text-emerald-400">Baseline Calibrated</span>
              ) : (
                <span className="text-amber-400">
                  Calibrating ({telemetry.calibrationProgress}%)
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
