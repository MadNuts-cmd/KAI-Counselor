/**
 * BioAmp EEG API Client for Project KAI
 * Connects the web frontend to the backend EEG adapter service.
 */

export interface EEGDatasetSummary {
  exists: boolean;
  totalSamples: number;
  classCounts: {
    Relaxed: number;
    High_Load: number;
    Fatigued: number;
    Agitated: number;
    [key: string]: number;
  };
  distinctClasses: number;
  isTrainable: boolean;
  lastModified?: number | null;
  error?: string;
}

export interface EEGStatus {
  connected: boolean;
  dataSource: 'hardware' | 'simulation';
  port: string | null;
  baudrate: number;
  samplingRate: number;
  isRecording: boolean;
  isTraining: boolean;
  availableLabels: string[];
  modelTrained: boolean;
  lastTrainingResult?: {
    status: string;
    timestamp: string | null;
    message: string;
    samplesUsed: number;
    classesCount: number;
  };
  datasetSummary?: EEGDatasetSummary;
  error?: string | null;
}

export interface EEGTelemetryResponse {
  theta: number;
  alpha: number;
  beta: number;
  arousalRatio: number;
  predictedState: string;
  timestamp: string;
  isHardwareConnected: boolean;
  dataSource: 'hardware' | 'simulation';
  samplingRate: number;
}

export interface RecordSampleResponse {
  success: boolean;
  label: string;
  features: {
    theta: number;
    alpha: number;
    beta: number;
    ratio: number;
  };
  dataSource: 'hardware' | 'simulation_test';
  message: string;
  datasetSummary: EEGDatasetSummary;
  timestamp: string;
}

export interface TrainModelResponse {
  success: boolean;
  message: string;
  modelTrained: boolean;
  totalSamples: number;
  distinctClasses: number;
  classCounts: Record<string, number>;
  timestamp: string;
}

class EEGClient {
  private getBaseUrl(): string {
    const loc = window.location;
    // In dev mode (Vite on port 3000), route to 8000
    if (loc.port === '3000') {
      return 'http://127.0.0.1:8000';
    }
    return '';
  }

  public async getStatus(): Promise<EEGStatus> {
    const res = await fetch(`${this.getBaseUrl()}/api/eeg/status`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}: Failed to fetch EEG hardware status`);
    }
    return res.json();
  }

  public async getTelemetry(): Promise<EEGTelemetryResponse> {
    const res = await fetch(`${this.getBaseUrl()}/api/eeg/telemetry`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}: Failed to fetch EEG telemetry`);
    }
    return res.json();
  }

  public async getDataset(): Promise<EEGDatasetSummary> {
    const res = await fetch(`${this.getBaseUrl()}/api/eeg/dataset`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}: Failed to fetch dataset summary`);
    }
    return res.json();
  }

  public async recordSample(label: string, allowSimulation = false): Promise<RecordSampleResponse> {
    const res = await fetch(`${this.getBaseUrl()}/api/eeg/samples`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, allow_simulation_test: allowSimulation }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || `HTTP ${res.status}: Failed to record sample`);
    }
    return data;
  }

  public async trainModel(): Promise<TrainModelResponse> {
    const res = await fetch(`${this.getBaseUrl()}/api/eeg/train`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || `HTTP ${res.status}: Model training failed`);
    }
    return data;
  }

  public async reconnect(): Promise<{ success: boolean; connected: boolean; port: string | null; message: string }> {
    const res = await fetch(`${this.getBaseUrl()}/api/eeg/reconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || `HTTP ${res.status}: Failed to reconnect hardware`);
    }
    return data;
  }
}

export const eegClient = new EEGClient();
