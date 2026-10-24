export type OperationalState = 
  | 'disconnected' 
  | 'idle' 
  | 'listening' 
  | 'thinking' 
  | 'generating_speech'
  | 'speaking' 
  | 'interrupted' 
  | 'error';

export type AffectiveState = 
  | 'neutral' 
  | 'calm' 
  | 'empathetic' 
  | 'fatigued' 
  | 'tense' 
  | 'smiling';

export interface ChatMessage {
  id: string;
  speaker: 'user' | 'kai' | 'system';
  text: string;
  timestamp: string;
  emotionTag?: string;
  eegState?: string;
  facialState?: string;
  isStreaming?: boolean;
}

export interface FacialTelemetry {
  mood: string;
  tension: number;
  browContraction: number;
  smileLift: number;
  isCalibrated: boolean;
  calibrationProgress: number;
  isFaceDetected: boolean;
  landmarksCount: number;
}

export interface EEGTelemetry {
  theta: number;
  alpha: number;
  beta: number;
  arousalRatio: number;
  state: string;
  isHardwareConnected: boolean;
  samplingRate: number;
}

export interface BackendStatus {
  connected: boolean;
  hardwarePort: string | null;
  cameraAvailable: boolean;
  ollamaAvailable: boolean;
  sessionActive: boolean;
  audioActive: boolean;
  activeSpeechId: number;
  fps?: number;
}

export interface WebSocketEvent {
  type: 
    | 'session_state'
    | 'transcript'
    | 'facial_telemetry'
    | 'eeg_telemetry'
    | 'audio_available'
    | 'speech_interrupted'
    | 'system_status'
    | 'error';
  payload: any;
}
