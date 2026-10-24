import { useState, useEffect, useCallback, useRef } from 'react';
import {
  OperationalState,
  AffectiveState,
  ChatMessage,
  FacialTelemetry,
  EEGTelemetry,
  BackendStatus,
  WebSocketEvent,
} from '../types/events';
import { backendClient } from '../services/backendClient';
import { audioManager } from '../services/audioManager';

const DEFAULT_STATUS: BackendStatus = {
  connected: false,
  hardwarePort: null,
  cameraAvailable: true,
  ollamaAvailable: false,
  sessionActive: false,
  audioActive: false,
  activeSpeechId: 0,
};

const DEFAULT_FACIAL: FacialTelemetry = {
  mood: 'Neutral / Focused',
  tension: 0.12,
  browContraction: 0.0,
  smileLift: 0.0,
  isCalibrated: false,
  calibrationProgress: 0,
  isFaceDetected: true,
  landmarksCount: 468,
};

const DEFAULT_EEG: EEGTelemetry = {
  theta: 8.5,
  alpha: 14.2,
  beta: 9.1,
  arousalRatio: 0.64,
  state: 'Calm',
  isHardwareConnected: false,
  samplingRate: 512,
};

export function useBackend() {
  const [operationalState, setOperationalState] = useState<OperationalState>('disconnected');
  const [affectiveState, setAffectiveState] = useState<AffectiveState>('neutral');
  const [status, setStatus] = useState<BackendStatus>(DEFAULT_STATUS);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [facialTelemetry, setFacialTelemetry] = useState<FacialTelemetry>(DEFAULT_FACIAL);
  const [eegTelemetry, setEEGTelemetry] = useState<EEGTelemetry>(DEFAULT_EEG);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);

  const durationTimerRef = useRef<number | null>(null);

  // Load initial memory history
  useEffect(() => {
    fetch('/api/history')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.history)) {
          const formatted: ChatMessage[] = [];
          data.history.forEach((item: any, idx: number) => {
            if (item.user_uttered) {
              formatted.push({
                id: `hist-u-${idx}`,
                speaker: 'user',
                text: item.user_uttered,
                timestamp: item.timestamp || 'Previous session',
              });
            }
            if (item.ai_response) {
              formatted.push({
                id: `hist-k-${idx}`,
                speaker: 'kai',
                text: item.ai_response,
                timestamp: item.timestamp || 'Previous session',
                eegState: item.eeg_state,
                facialState: item.facial_state,
              });
            }
          });
          setMessages(formatted.slice(-15));
        }
      })
      .catch(() => {});
  }, []);

  // Connect to WebSocket client
  useEffect(() => {
    backendClient.connect();

    const unsubscribe = backendClient.subscribe((event: WebSocketEvent) => {
      switch (event.type) {
        case 'system_status': {
          setStatus((prev) => ({ ...prev, ...event.payload }));
          if (event.payload.connected !== undefined) {
            setOperationalState(event.payload.connected ? 'idle' : 'disconnected');
          }
          break;
        }

        case 'session_state': {
          const newState = event.payload.state as OperationalState;
          // CRITICAL: Prevent premature listening transition if audio is actively playing in the browser!
          if (newState === 'listening' && audioManager.isPlaying()) {
            console.log('[useBackend] Suppressing premature listening state while audio is actively playing');
            return;
          }
          setOperationalState(newState);
          setStatus((prev) => ({ ...prev, sessionActive: newState !== 'disconnected' && newState !== 'idle' }));
          break;
        }

        case 'transcript': {
          const { speaker, text, timestamp, emotionTag, eegState, facialState } = event.payload;
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              speaker: speaker || 'kai',
              text: text || '',
              timestamp: timestamp || new Date().toLocaleTimeString(),
              emotionTag,
              eegState,
              facialState,
            },
          ]);

          if (emotionTag) {
            const tagLower = emotionTag.toLowerCase();
            if (tagLower.includes('empath') || tagLower.includes('warm') || tagLower.includes('gentle')) {
              setAffectiveState('empathetic');
            } else if (tagLower.includes('calm')) {
              setAffectiveState('calm');
            }
          }
          break;
        }

        case 'facial_telemetry': {
          setFacialTelemetry((prev) => ({ ...prev, ...event.payload }));
          break;
        }

        case 'eeg_telemetry': {
          setEEGTelemetry((prev) => ({ ...prev, ...event.payload }));
          break;
        }

        case 'audio_available': {
          const { url, speechId } = event.payload;
          if (!isAudioMuted && url) {
            setIsAudioPlaying(true);
            setOperationalState('speaking');
            console.log(`[useBackend] Playing speech audio for speechId=${speechId}`);
            audioManager
              .playSpeechUrl(url, speechId)
              .then((completed) => {
                console.log(`[useBackend] Speech playback ended for speechId=${speechId}, completed=${completed}`);
                setIsAudioPlaying(false);
                // Inform backend that client finished playback
                backendClient.sendAction('playback_finished', { speechId });
                if (completed) {
                  setOperationalState('listening');
                }
              })
              .catch((err) => {
                console.warn(`[useBackend] Playback failed for speechId=${speechId}:`, err);
                setIsAudioPlaying(false);
                backendClient.sendAction('playback_finished', { speechId });
                setOperationalState('listening');
              });
          }
          break;
        }

        case 'speech_interrupted': {
          audioManager.stopPlayback();
          setIsAudioPlaying(false);
          setOperationalState('interrupted');
          break;
        }
      }
    });

    audioManager.onPlaybackEnded(() => {
      setIsAudioPlaying(false);
      setOperationalState('listening');
    });

    return () => {
      unsubscribe();
      backendClient.disconnect();
    };
  }, [isAudioMuted]);

  // Session Duration Timer
  useEffect(() => {
    if (status.sessionActive) {
      durationTimerRef.current = window.setInterval(() => {
        setSessionDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      setSessionDuration(0);
    }

    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [status.sessionActive]);

  // Control Handlers
  const toggleSession = useCallback(() => {
    if (status.sessionActive) {
      backendClient.sendAction('stop');
      setStatus((prev) => ({ ...prev, sessionActive: false }));
      setOperationalState('idle');
      audioManager.stopPlayback();
      setIsAudioPlaying(false);
    } else {
      backendClient.sendAction('start');
      setStatus((prev) => ({ ...prev, sessionActive: true }));
      setOperationalState('listening');
    }
  }, [status.sessionActive]);

  const stopSpeaking = useCallback(() => {
    // 1. Immediately kill local Web Audio playback
    audioManager.stopPlayback();
    setIsAudioPlaying(false);
    setOperationalState('interrupted');

    // 2. Transmit immediate stop command to Python backend
    backendClient.sendAction('stop_speaking');
  }, []);

  const toggleMic = useCallback(() => {
    setIsMicMuted((prev) => !prev);
    backendClient.sendAction('toggle_mic', { muted: !isMicMuted });
  }, [isMicMuted]);

  const toggleCamera = useCallback(() => {
    setIsCameraActive((prev) => !prev);
  }, []);

  const toggleAudio = useCallback(() => {
    if (!isAudioMuted) {
      audioManager.stopPlayback();
      setIsAudioPlaying(false);
    }
    setIsAudioMuted((prev) => !prev);
  }, [isAudioMuted]);

  return {
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
  };
}
