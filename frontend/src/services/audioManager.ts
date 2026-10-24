/**
 * Web Audio Analysis and Playback Manager for Project KAI
 * Connects TTS audio playback to an AnalyserNode to drive the 3D Orb visualizer.
 * 
 * Features:
 * - True time-domain RMS amplitude estimation
 * - Adaptive noise floor and dynamic range normalization
 * - Separate asymmetric attack (45ms) and release (160ms) smoothing
 * - Three independent frequency bands (Low/Bass, Mid/Travelling Waves, High/Treble Ripples)
 * - Immediate clean interruption without stale audio resumption
 * - Awaited natural playback completion without premature listening drop
 */

export interface AudioMetrics {
  intensity: number;      // Overall smoothed RMS envelope (0.0 to 1.0)
  bass: number;           // Low-frequency band (20Hz - 250Hz, 0.0 to 1.0)
  mid: number;            // Mid-frequency band (250Hz - 2.5kHz, 0.0 to 1.0)
  treble: number;         // High-frequency band (2.5kHz - 8kHz, 0.0 to 1.0)
  isPlaying: boolean;
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private fallbackAudio: HTMLAudioElement | null = null;

  private timeData: Uint8Array<ArrayBuffer> | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;

  // Smoothed metric states
  private smoothedIntensity = 0;
  private smoothedBass = 0;
  private smoothedMid = 0;
  private smoothedTreble = 0;

  // Adaptive range calibration
  private readonly minRMS = 0.015;
  private readonly maxRMS = 0.28;

  // Timing & Active speech identity
  private lastUpdateTime = performance.now();
  private currentSpeechId = 0;
  private isInterrupted = false;

  private onPlaybackEndedCallbacks: Array<() => void> = [];

  constructor() {
    // AudioContext is initialized on user interaction
  }

  public initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.4;

      this.timeData = new Uint8Array(this.analyser.fftSize);
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public onPlaybackEnded(cb: () => void) {
    this.onPlaybackEndedCallbacks.push(cb);
  }

  public isPlaying(): boolean {
    return this.currentSource !== null || (this.fallbackAudio !== null && !this.fallbackAudio.paused);
  }

  /**
   * Fetches the generated TTS MP3, decodes into AudioBuffer, and plays via Web Audio.
   * Returns a Promise that resolves ONLY when playback naturally completes or is interrupted.
   */
  public async playSpeechUrl(url: string, speechId: number): Promise<boolean> {
    const ctx = this.initContext();

    // 1. Terminate any previous audio source directly without invalidating the new speechId
    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {}
      this.currentSource = null;
    }
    if (this.fallbackAudio) {
      try {
        this.fallbackAudio.pause();
        this.fallbackAudio.currentTime = 0;
        this.fallbackAudio.src = '';
      } catch {}
      this.fallbackAudio = null;
    }

    // 2. Set new valid playback session
    this.isInterrupted = false;
    this.currentSpeechId = speechId;

    const tStart = performance.now();
    console.log(`[AudioManager] [${new Date().toISOString()}] Initiating playback for speechId=${speechId}`);

    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();

      // Check if user interrupted while downloading
      if (this.isInterrupted || speechId !== this.currentSpeechId) {
        console.log(`[AudioManager] Speech ${speechId} cancelled during fetch (${(performance.now() - tStart).toFixed(0)}ms)`);
        return false;
      }

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // Check if user interrupted while decoding
      if (this.isInterrupted || speechId !== this.currentSpeechId) {
        console.log(`[AudioManager] Speech ${speechId} cancelled during decode`);
        return false;
      }

      console.log(
        `[AudioManager] Audio decoded: speechId=${speechId}, duration=${audioBuffer.duration.toFixed(2)}s, sampleRate=${audioBuffer.sampleRate}Hz`
      );

      // Create BufferSource
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      this.currentSource = source;

      if (this.analyser) {
        source.connect(this.analyser);
        this.analyser.connect(ctx.destination);
      } else {
        source.connect(ctx.destination);
      }

      // Return a Promise that resolves ONLY when audio playback has finished!
      return new Promise<boolean>((resolve) => {
        source.onended = () => {
          console.log(
            `[AudioManager] Playback ended for speechId=${speechId}, naturallyCompleted=${!this.isInterrupted && this.currentSpeechId === speechId}`
          );
          if (this.currentSpeechId === speechId && !this.isInterrupted) {
            this.currentSource = null;
            this.onPlaybackEndedCallbacks.forEach((cb) => cb());
            resolve(true);
          } else {
            resolve(false);
          }
        };

        try {
          source.start(0);
          console.log(`[AudioManager] Source started for speechId=${speechId}`);
        } catch (err) {
          console.error('[AudioManager] Failed to start buffer source:', err);
          this.currentSource = null;
          resolve(false);
        }
      });
    } catch (e) {
      console.warn('[AudioManager] Buffer playback failed, trying HTMLAudio fallback:', e);
      return this.playFallback(url, speechId);
    }
  }

  private playFallback(url: string, speechId: number): Promise<boolean> {
    return new Promise((resolve) => {
      const ctx = this.initContext();
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.src = url;
      this.fallbackAudio = audio;

      if (this.analyser) {
        try {
          const node = ctx.createMediaElementSource(audio);
          node.connect(this.analyser);
          this.analyser.connect(ctx.destination);
        } catch {}
      }

      audio.onended = () => {
        console.log(`[AudioManager] Fallback audio onended for speechId=${speechId}`);
        if (this.currentSpeechId === speechId && !this.isInterrupted) {
          this.fallbackAudio = null;
          this.onPlaybackEndedCallbacks.forEach((cb) => cb());
          resolve(true);
        } else {
          resolve(false);
        }
      };

      audio.onerror = (e) => {
        console.error(`[AudioManager] Fallback audio playback error:`, e);
        this.fallbackAudio = null;
        resolve(false);
      };

      audio.play()
        .then(() => {
          console.log(`[AudioManager] Fallback HTMLAudio started for speechId=${speechId}`);
        })
        .catch((err) => {
          console.error(`[AudioManager] Fallback HTMLAudio play() error:`, err);
          this.fallbackAudio = null;
          resolve(false);
        });
    });
  }

  /**
   * Immediately halts current speech playback without delay or lingering audio.
   */
  public stopPlayback(): void {
    console.log(`[AudioManager] Stopping playback immediately. Active speechId was ${this.currentSpeechId}`);
    this.isInterrupted = true;
    this.currentSpeechId++;

    if (this.currentSource) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {}
      this.currentSource = null;
    }

    if (this.fallbackAudio) {
      try {
        this.fallbackAudio.pause();
        this.fallbackAudio.currentTime = 0;
        this.fallbackAudio.src = '';
      } catch {}
      this.fallbackAudio = null;
    }

    // Reset metric targets
    this.smoothedIntensity = 0;
    this.smoothedBass = 0;
    this.smoothedMid = 0;
    this.smoothedTreble = 0;
  }

  /**
   * Sample-accurate time-domain RMS and frequency analysis loop.
   * Called by Three.js render loop every frame (~60fps).
   */
  public getMetrics(): AudioMetrics {
    const isPlaying = this.isPlaying();

    if (!this.analyser || !this.timeData || !this.freqData || !isPlaying) {
      // Gentle decay to silence
      this.smoothedIntensity *= 0.88;
      this.smoothedBass *= 0.88;
      this.smoothedMid *= 0.88;
      this.smoothedTreble *= 0.88;

      if (this.smoothedIntensity < 0.002) this.smoothedIntensity = 0;
      if (this.smoothedBass < 0.002) this.smoothedBass = 0;
      if (this.smoothedMid < 0.002) this.smoothedMid = 0;
      if (this.smoothedTreble < 0.002) this.smoothedTreble = 0;

      return {
        intensity: this.smoothedIntensity,
        bass: this.smoothedBass,
        mid: this.smoothedMid,
        treble: this.smoothedTreble,
        isPlaying: false,
      };
    }

    const now = performance.now();
    const dt = Math.min((now - this.lastUpdateTime) / 1000, 0.1);
    this.lastUpdateTime = now;

    // 1. Time-domain waveform sampling for true RMS
    this.analyser.getByteTimeDomainData(this.timeData);
    let sumSquares = 0;
    const len = this.timeData.length;
    for (let i = 0; i < len; i++) {
      const norm = (this.timeData[i] - 128) / 128;
      sumSquares += norm * norm;
    }
    const currentRMS = Math.sqrt(sumSquares / len);

    // Dynamic range normalization
    const normalizedRMS = Math.min(
      1.0,
      Math.max(0.0, (currentRMS - this.minRMS) / (this.maxRMS - this.minRMS))
    );

    // 2. Frequency-domain decomposition
    this.analyser.getByteFrequencyData(this.freqData);
    const binCount = this.analyser.frequencyBinCount; // 256 bins for fftSize 512
    const sampleRate = this.ctx?.sampleRate || 44100;
    const binFreq = sampleRate / 512; // ~86.13 Hz per bin

    // Low / Bass: 20Hz - 250Hz (bins 0 to 3)
    let bassSum = 0;
    const bassBins = Math.min(4, binCount);
    for (let i = 0; i < bassBins; i++) {
      bassSum += this.freqData[i] / 255;
    }
    const rawBass = bassBins > 0 ? bassSum / bassBins : 0;

    // Mid / Travelling waves: 250Hz - 2.8kHz (bins 3 to 32)
    let midSum = 0;
    const midStart = 3;
    const midEnd = Math.min(33, binCount);
    for (let i = midStart; i < midEnd; i++) {
      midSum += this.freqData[i] / 255;
    }
    const rawMid = midEnd > midStart ? midSum / (midEnd - midStart) : 0;

    // Treble / Surface ripples: 2.8kHz - 8kHz (bins 33 to 95)
    let trebleSum = 0;
    const trebleStart = 33;
    const trebleEnd = Math.min(95, binCount);
    for (let i = trebleStart; i < trebleEnd; i++) {
      trebleSum += this.freqData[i] / 255;
    }
    const rawTreble = trebleEnd > trebleStart ? trebleSum / (trebleEnd - trebleStart) : 0;

    // 3. Asymmetric temporal smoothing: fast attack (45ms), organic release (160ms)
    const attackTau = 0.045;
    const releaseTau = 0.160;

    const smoothVal = (current: number, target: number) => {
      const tau = target > current ? attackTau : releaseTau;
      const alpha = 1.0 - Math.exp(-dt / tau);
      return current + alpha * (target - current);
    };

    this.smoothedIntensity = smoothVal(this.smoothedIntensity, normalizedRMS);
    this.smoothedBass = smoothVal(this.smoothedBass, rawBass);
    this.smoothedMid = smoothVal(this.smoothedMid, rawMid);
    this.smoothedTreble = smoothVal(this.smoothedTreble, rawTreble);

    return {
      intensity: this.smoothedIntensity,
      bass: this.smoothedBass,
      mid: this.smoothedMid,
      treble: this.smoothedTreble,
      isPlaying: true,
    };
  }
}

export const audioManager = new AudioManager();
