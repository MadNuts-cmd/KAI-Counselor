import { WebSocketEvent, BackendStatus } from '../types/events';

type EventListener = (event: WebSocketEvent) => void;

class BackendClient {
  private ws: WebSocket | null = null;
  private listeners: Set<EventListener> = new Set();
  private reconnectTimeout: number | null = null;
  private reconnectAttempts = 0;
  private isExplicitlyClosed = false;

  private getWsUrl(): string {
    const loc = window.location;
    const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    // In dev mode (Vite on port 3000), connect to 8000
    if (loc.port === '3000') {
      return 'ws://127.0.0.1:8000/ws';
    }
    return `${protocol}//${loc.host}/ws`;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    const url = this.getWsUrl();

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.emit({
          type: 'system_status',
          payload: { connected: true },
        });
      };

      this.ws.onmessage = (ev) => {
        try {
          const data: WebSocketEvent = JSON.parse(ev.data);
          this.emit(data);
        } catch (e) {
          console.warn('[WS Parse Error]', e);
        }
      };

      this.ws.onclose = () => {
        this.emit({
          type: 'system_status',
          payload: { connected: false },
        });
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        try {
          this.ws?.close();
        } catch {}
      };
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout !== null) return;
    this.reconnectAttempts++;
    // Bounded exponential backoff: min 1.5s, max 8s
    const delay = Math.min(8000, 1500 * Math.pow(1.3, this.reconnectAttempts)) + Math.random() * 500;

    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }

  public subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: WebSocketEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[Listener Error]', err);
      }
    });
  }

  public sendAction(action: string, data: any = {}): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, ...data }));
    } else {
      // Fallback to REST endpoint
      fetch(`/api/session/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => {});
    }
  }

  public async fetchStatus(): Promise<BackendStatus | null> {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        return await res.json();
      }
    } catch {}
    return null;
  }
}

export const backendClient = new BackendClient();
