import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  Cpu,
  Database,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Radio,
  Zap,
  Info,
} from 'lucide-react';
import { eegClient, EEGStatus, EEGDatasetSummary, RecordSampleResponse } from '../services/eegClient';

interface EEGTrainingPanelProps {
  className?: string;
  onSampleRecorded?: () => void;
}

const DISPLAY_LABELS = [
  { id: 'Relaxed', label: 'Relaxed', color: 'text-emerald-400 border-emerald-800/40 bg-emerald-950/20' },
  { id: 'High_Load', label: 'High Load', color: 'text-amber-400 border-amber-800/40 bg-amber-950/20' },
  { id: 'Fatigued', label: 'Fatigued', color: 'text-purple-400 border-purple-800/40 bg-purple-950/20' },
  { id: 'Agitated', label: 'Agitated', color: 'text-rose-400 border-rose-800/40 bg-rose-950/20' },
];

export const EEGTrainingPanel: React.FC<EEGTrainingPanelProps> = ({
  className = '',
  onSampleRecorded,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedLabel, setSelectedLabel] = useState<string>('Relaxed');
  const [allowDevSimulation, setAllowDevSimulation] = useState<boolean>(false);

  // Status and dataset states
  const [statusData, setStatusData] = useState<EEGStatus | null>(null);
  const [dataset, setDataset] = useState<EEGDatasetSummary | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(true);

  // Action states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [lastRecorded, setLastRecorded] = useState<RecordSampleResponse | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Fetch status and dataset summary
  const refreshData = useCallback(async () => {
    try {
      const [st, ds] = await Promise.all([eegClient.getStatus(), eegClient.getDataset()]);
      setStatusData(st);
      setDataset(ds);
    } catch (err: any) {
      console.warn('[EEGTrainingPanel] Status fetch error:', err.message);
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 6000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Hardware Reconnection handler
  const handleReconnect = async () => {
    if (isReconnecting) return;
    setIsReconnecting(true);
    setActionMessage({
      type: 'info',
      text: 'Scanning serial COM ports for Arduino BioAmp hardware...',
    });

    try {
      const res = await eegClient.reconnect();
      if (res.connected) {
        setActionMessage({
          type: 'success',
          text: res.message || `Successfully connected to Arduino on ${res.port}.`,
        });
      } else {
        setActionMessage({
          type: 'error',
          text: res.message || 'No Arduino detected. Please check physical USB cable.',
        });
      }
      await refreshData();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to reconnect serial hardware.',
      });
    } finally {
      setIsReconnecting(false);
    }
  };

  // Record labeled sample handler
  const handleRecordSample = async () => {
    if (isRecording) return;

    if (!statusData?.connected && !allowDevSimulation) {
      setActionMessage({
        type: 'error',
        text: 'Physical BioAmp EEG hardware is not connected. Connect Arduino R4 on USB or enable Dev Test Mode below to record simulated data for testing.',
      });
      return;
    }

    setIsRecording(true);
    setActionMessage(null);
    setLastRecorded(null);

    try {
      const res = await eegClient.recordSample(selectedLabel, allowDevSimulation);
      setLastRecorded(res);
      setDataset(res.datasetSummary);
      setActionMessage({
        type: 'success',
        text: `Sample successfully recorded under '${selectedLabel.replace('_', ' ')}'.`,
      });
      if (onSampleRecorded) onSampleRecorded();
      refreshData();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Failed to record EEG sample.',
      });
    } finally {
      setIsRecording(false);
    }
  };

  // Train model handler
  const handleTrainModel = async () => {
    if (isTraining || isRecording) return;

    if (!dataset?.isTrainable) {
      setActionMessage({
        type: 'error',
        text: 'Dataset requires at least 2 distinct emotion classes before training.',
      });
      return;
    }

    setIsTraining(true);
    setActionMessage(null);

    try {
      const res = await eegClient.trainModel();
      setActionMessage({
        type: 'success',
        text: res.message || 'RandomForestClassifier trained successfully and saved to eeg_model.pkl.',
      });
      refreshData();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Model training failed.',
      });
    } finally {
      setIsTraining(false);
    }
  };

  const isHardware = statusData?.connected ?? false;
  const isTrainable = dataset?.isTrainable ?? false;
  const distinctCount = dataset?.distinctClasses ?? 0;
  const totalSamples = dataset?.totalSamples ?? 0;
  const canRecord = Boolean(selectedLabel && !isRecording && (isHardware || allowDevSimulation));

  return (
    <div className={`flex flex-col bg-[#10141B] border border-[#1C2331] rounded-xl shadow-lg select-none text-slate-300 ${className}`}>
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-800/20 transition-colors border-b border-[#1C2331]"
      >
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span>BioAmp Training Center</span>
          {statusData?.modelTrained && (
            <span className="text-[10px] bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 px-1.5 py-0.2 rounded font-mono">
              Model Active
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Hardware status pill */}
          <div className="flex items-center gap-1 text-[10px] font-mono">
            {isHardware ? (
              <span className="flex items-center gap-1 text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <Zap className="w-2.5 h-2.5" />
                {statusData?.port || 'COM3'} Active
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-400/90 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/30">
                <Radio className="w-2.5 h-2.5 text-amber-400" />
                Disconnected
              </span>
            )}
          </div>
          <button className="text-slate-400 hover:text-slate-200">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3.5 space-y-3.5 text-xs">
          {/* Hardware Status Banner */}
          {isHardware ? (
            <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-lg p-2.5 flex items-center justify-between text-[11px] text-emerald-300">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-semibold text-emerald-200">BioAmp Hardware Active</span>
                  <span className="text-[10px] text-emerald-400/80 ml-1.5 font-mono">
                    Arduino R4 on {statusData?.port || 'COM3'} ({statusData?.samplingRate || 512} Hz)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReconnect}
                disabled={isReconnecting}
                className="text-[10px] font-mono text-emerald-400 hover:text-emerald-200 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50 hover:bg-emerald-900/60 transition cursor-pointer flex items-center gap-1"
                title="Rescan and refresh hardware connection"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isReconnecting ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>
            </div>
          ) : (
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 flex items-start gap-2 text-[11px] text-slate-400 leading-relaxed">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-200">Arduino R4 Disconnected</p>
                  <button
                    type="button"
                    onClick={handleReconnect}
                    disabled={isReconnecting}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/60 text-cyan-300 hover:bg-cyan-900/60 text-[10px] font-mono transition cursor-pointer"
                  >
                    {isReconnecting ? (
                      <>
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        <span>Scanning...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-2.5 h-2.5" />
                        <span>Scan & Reconnect</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Plug in the BioAmp Arduino USB cable (default COM3) to capture authentic EEG samples.
                </p>
                {/* Dev Mode Simulation Checkbox */}
                <label className="flex items-center gap-1.5 mt-2 cursor-pointer text-[10px] text-cyan-300 hover:text-cyan-200 select-none">
                  <input
                    id="eeg-dev-simulation-toggle"
                    type="checkbox"
                    checked={allowDevSimulation}
                    onChange={(e) => setAllowDevSimulation(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Allow simulated samples (Dev / Unit Testing Mode)</span>
                </label>
              </div>
            </div>
          )}

          {/* Current State Label Selector */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-mono font-semibold text-slate-300">
                CURRENT STATE LABEL
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {selectedLabel.replace('_', ' ')}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {DISPLAY_LABELS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedLabel(item.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-left font-mono text-[11px] border transition-all cursor-pointer ${
                    selectedLabel === item.id
                      ? `${item.color} font-bold ring-1 ring-cyan-500/40 shadow-sm`
                      : 'bg-[#151A23] border-[#1C2331] text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <p className="text-[10px] text-slate-400 mt-1.5 leading-tight flex items-start gap-1">
              <Info className="w-3 h-3 text-cyan-400/80 shrink-0 mt-0.5" />
              <span>
                Choose the label describing your current condition, then record a sample. Each sample is saved with this label for classifier training.
              </span>
            </p>
          </div>

          {/* Action Buttons: Record & Train */}
          <div className="space-y-1.5 pt-1">
            <div className="grid grid-cols-2 gap-2">
              {/* Record Sample Button */}
              <button
                id="eeg-record-sample-btn"
                type="button"
                onClick={handleRecordSample}
                disabled={!canRecord}
                title={
                  !canRecord
                    ? !isHardware && !allowDevSimulation
                      ? 'BioAmp hardware is disconnected. Connect Arduino or enable Dev Mode below.'
                      : isRecording
                      ? 'Sampling EEG window in progress...'
                      : 'Select a clinical state label above'
                    : `Record 1.5s EEG sample under '${selectedLabel.replace('_', ' ')}'`
                }
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-semibold text-xs transition shadow-sm ${
                  isRecording
                    ? 'bg-cyan-950/70 border border-cyan-800 text-cyan-300 cursor-wait'
                    : !canRecord
                    ? 'bg-slate-900 border border-slate-800 text-slate-400 cursor-not-allowed opacity-60'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 cursor-pointer hover:shadow-cyan-500/20 active:scale-98'
                }`}
              >
                {isRecording ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sampling...</span>
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5" />
                    <span>Record Sample</span>
                  </>
                )}
              </button>

              {/* Train / Retrain Model Button */}
              <button
                id="eeg-train-model-btn"
                type="button"
                onClick={handleTrainModel}
                disabled={isTraining || isRecording || !isTrainable}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg font-semibold text-xs border transition shadow-sm ${
                  isTraining
                    ? 'bg-purple-950/70 border-purple-800 text-purple-300 cursor-wait'
                    : !isTrainable
                    ? 'bg-slate-900 border-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                    : 'bg-purple-600 hover:bg-purple-500 border-purple-500 text-white cursor-pointer hover:shadow-purple-500/20 active:scale-98'
                }`}
                title={
                  !isTrainable
                    ? 'Requires at least 2 distinct emotion classes before training'
                    : 'Retrain RandomForestClassifier on historical CSV dataset'
                }
              >
                {isTraining ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Fitting...</span>
                  </>
                ) : (
                  <>
                    <Brain className="w-3.5 h-3.5" />
                    <span>Train Model</span>
                  </>
                )}
              </button>
            </div>

            {/* Informative Button Status Explanatory Text */}
            <div className="pt-0.5">
              {isRecording ? (
                <p className="text-[10px] text-cyan-300 flex items-center gap-1.5 font-mono">
                  <Loader2 className="w-3 h-3 animate-spin text-cyan-400 shrink-0" />
                  <span>Acquiring 1.5s EEG window from {isHardware ? (statusData?.port || 'hardware') : 'simulated data'}...</span>
                </p>
              ) : !canRecord && !isHardware && !allowDevSimulation ? (
                <p className="text-[10px] text-amber-400/90 flex items-center gap-1.5 font-mono">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>Record disabled: Arduino R4 disconnected. Connect device or enable dev mode.</span>
                </p>
              ) : canRecord && isHardware ? (
                <p className="text-[10px] text-emerald-400/90 flex items-center gap-1.5 font-mono">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>Hardware ready: Click Record to capture 1.5s sample on {statusData?.port || 'COM3'}.</span>
                </p>
              ) : canRecord && allowDevSimulation && !isHardware ? (
                <p className="text-[10px] text-cyan-400/90 flex items-center gap-1.5 font-mono">
                  <Info className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span>Dev Mode active: Simulated sample will be recorded.</span>
                </p>
              ) : null}
            </div>
          </div>

          {/* Action Feedback Alerts */}
          {actionMessage && (
            <div
              className={`p-2.5 rounded-lg border text-[11px] leading-relaxed flex items-start gap-1.5 animate-fade-in ${
                actionMessage.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
                  : actionMessage.type === 'error'
                  ? 'bg-rose-950/40 border-rose-800/50 text-rose-300'
                  : 'bg-cyan-950/40 border-cyan-800/50 text-cyan-300'
              }`}
            >
              {actionMessage.type === 'success' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />}
              {actionMessage.type === 'error' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />}
              {actionMessage.type === 'info' && <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />}
              <div>{actionMessage.text}</div>
            </div>
          )}

          {/* Last Recorded Features Pill */}
          {lastRecorded && (
            <div className="bg-[#151A23] p-2 rounded-lg border border-[#1C2331] text-[10px] font-mono space-y-1">
              <div className="flex justify-between text-slate-400 border-b border-slate-800 pb-1">
                <span>Recorded: {lastRecorded.label}</span>
                <span className="text-cyan-400">{lastRecorded.timestamp}</span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center pt-0.5">
                <div>
                  <span className="text-slate-400">θ: </span>
                  <span className="text-slate-200">{lastRecorded.features.theta}</span>
                </div>
                <div>
                  <span className="text-slate-400">α: </span>
                  <span className="text-slate-200">{lastRecorded.features.alpha}</span>
                </div>
                <div>
                  <span className="text-slate-400">β: </span>
                  <span className="text-slate-200">{lastRecorded.features.beta}</span>
                </div>
                <div>
                  <span className="text-slate-400">β/α: </span>
                  <span className="text-cyan-300">{lastRecorded.features.ratio}</span>
                </div>
              </div>
            </div>
          )}

          {/* Dataset Summary Table */}
          <div className="bg-[#151A23] p-2.5 rounded-lg border border-[#1C2331] space-y-2">
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 border-b border-[#1C2331] pb-1.5">
              <span className="font-semibold text-slate-300 flex items-center gap-1">
                <Database className="w-3 h-3 text-cyan-400" />
                <span>DATASET SUMMARY</span>
              </span>
              <button
                type="button"
                onClick={refreshData}
                className="hover:text-cyan-400 flex items-center gap-1 transition-colors cursor-pointer"
                title="Refresh dataset counts"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>Sync</span>
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="bg-[#0E121A] p-1.5 rounded border border-[#1C2331]">
                <div className="text-[9px] text-slate-400">TOTAL SAMPLES</div>
                <div className="text-sm font-bold text-slate-100">{totalSamples}</div>
              </div>
              <div className="bg-[#0E121A] p-1.5 rounded border border-[#1C2331]">
                <div className="text-[9px] text-slate-400">DISTINCT CLASSES</div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-sm font-bold ${distinctCount >= 2 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {distinctCount}
                  </span>
                  <span className="text-[9px] text-slate-400">/ 4</span>
                </div>
              </div>
            </div>

            {/* Samples Breakdown by Label */}
            <div className="space-y-1 pt-1 text-[10px] font-mono">
              <div className="text-[9px] text-slate-400 font-semibold mb-1">RECORDED PER CLASS:</div>
              {DISPLAY_LABELS.map((item) => {
                const count = dataset?.classCounts[item.id] || 0;
                return (
                  <div key={item.id} className="flex justify-between items-center py-0.5 px-1 rounded bg-[#0E121A]/60">
                    <span className="text-slate-400">{item.label}</span>
                    <span className={`font-semibold ${count > 0 ? 'text-cyan-300' : 'text-slate-400'}`}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Training Readiness Indicator */}
            <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-400">Training Readiness:</span>
              {isTrainable ? (
                <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  Ready (≥ 2 classes)
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="w-3 h-3" />
                  Needs {Math.max(1, 2 - distinctCount)} more class
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
