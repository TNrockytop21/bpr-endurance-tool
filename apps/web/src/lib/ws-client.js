const RECONNECT_DELAY = 2000;

class WSClient {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.connected = false;
    this._reconnectTimer = null;
    this._url = null;
  }

  connect(url) {
    this._url = url;
    this._doConnect();
  }

  _doConnect() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }

    this.ws = new WebSocket(this._url);

    this.ws.onopen = () => {
      this.connected = true;
      this._emit('_connected', true);
      console.log('[ws] connected');
    };

    this.ws.onclose = () => {
      this.connected = false;
      this._emit('_connected', false);
      console.log('[ws] disconnected, reconnecting...');
      this._reconnectTimer = setTimeout(() => this._doConnect(), RECONNECT_DELAY);
    };

    this.ws.onerror = () => {};

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._emit(msg.type, msg.payload);
      } catch {
        // ignore malformed messages
      }
    };
  }

  send(type, payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(callback);
    return () => this.listeners.get(type)?.delete(callback);
  }

  _emit(type, payload) {
    const cbs = this.listeners.get(type);
    if (cbs) {
      for (const cb of cbs) cb(payload);
    }
  }

  disconnect() {
    clearTimeout(this._reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.connected = false;
  }
}

export const wsClient = new WSClient();
