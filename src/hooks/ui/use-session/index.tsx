import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { ApiRequestError } from '@/lib/api-error';
import { getTensrWebSocketUrl } from '@/lib/tensr-api-url';
import { getIdToken } from '@/utils/auth';

type Listener<T> = (value: T) => void;

class EventEmitter<T> {
  private listeners: Listener<T>[] = [];

  subscribe(listener: Listener<T>) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  emit(value: T) {
    this.listeners.forEach(listener => listener(value));
  }
}

interface Session {
  id: string;
  datasetId?: string;
  fileName: string;
  filePath: string;
  ownerName: string;
  participantCount: number;
  participants: Array<{ userId: string; userName: string }>;
  created: number;
  clientId?: string;
}

interface UserPresence {
  userId: string;
  userName: string;
  cursor?: {
    x: number;
    y: number;
    tabId?: string;
    element?: string;
  } | null;
  lastActive: number;
}

class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  public userId: string = crypto.randomUUID();
  public userName: string = `User ${Math.floor(Math.random() * 1000)}`;

  private wsReadyEmitter = new EventEmitter<boolean>();
  private sessionEmitter = new EventEmitter<Session | null>();
  private presenceEmitter = new EventEmitter<Map<string, UserPresence>>();
  private _wsReady: boolean = false;
  private _session: Session | null = null;
  private _presence = new Map<string, UserPresence>();

  private handlePresenceUpdate(message: { presence: UserPresence }) {
    const { presence: incomingPresence } = message;

    // Process all presence updates, not just our own
    if (incomingPresence.cursor === null) {
      this._presence.delete(incomingPresence.userId);
    } else {
      // Update presence for all users
      this._presence.set(incomingPresence.userId, {
        ...incomingPresence,
        lastActive: Date.now(),
      });
    }

    // Create new Map to ensure reference changes
    const updatedPresence = new Map(this._presence);
    this.presenceEmitter.emit(updatedPresence);
  }

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  setupWebSocket(sessionId: string) {
    if (this.ws) {
      this.ws.close();
    }

    const token = getIdToken();
    const wsBase =
      process.env.NEXT_PUBLIC_WEBSOCKET_URL?.replace(/\/$/, '') || getTensrWebSocketUrl('/ws');
    const wsUrl = token
      ? `${wsBase}${wsBase.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`
      : wsBase;
    if (!token) {
      console.warn('Authentication required for collaboration WebSocket');
      return;
    }

    // Clear presence when setting up new connection
    this._presence.clear();

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this._wsReady = true;
      this.wsReadyEmitter.emit(true);

      this.ws?.send(
        JSON.stringify({
          type: 'join',
          sessionId,
          userId: this.userId,
          userName: this.userName,
        })
      );
    };

    this.ws.onmessage = event => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'initial_state':
            this._session = message.session;
            if (message.presence) {
              // Handle initial presence state
              this._presence.clear();
              Object.entries(message.presence).forEach(([userId, data]) => {
                this._presence.set(userId, data as UserPresence);
              });
              // Create new Map to ensure reference change
              this.presenceEmitter.emit(new Map(this._presence));
            }
            this.sessionEmitter.emit(message.session);
            this.wsReadyEmitter.emit(true);
            break;

          case 'presence_update':
            this.handlePresenceUpdate(message);
            break;

          case 'participant_joined':
            if (message.session) {
              this._session = message.session;
              this.sessionEmitter.emit(message.session);
            }
            break;

          case 'cell_update':
            break;

          case 'participant_left':
            if (message.session) {
              this._session = message.session;
              this.sessionEmitter.emit(message.session);
            }
            if (message.userId) {
              this._presence.delete(message.userId);
              this.presenceEmitter.emit(new Map(this._presence));
            }
            break;

          case 'session_ended':
            this._session = null;
            this._presence.clear();
            this.sessionEmitter.emit(null);
            this.presenceEmitter.emit(new Map());
            break;
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    this.ws.onclose = () => {
      this._wsReady = false;
      this._presence.clear();
      this.wsReadyEmitter.emit(false);
      this.presenceEmitter.emit(new Map());

      setTimeout(() => {
        if (this._session) {
          this.setupWebSocket(sessionId);
        }
      }, 3000);
    };

    this.ws.onerror = error => {};
  }

  updatePresence(cursor: UserPresence['cursor']) {
    if (!this._wsReady || !this.ws) {
      return;
    }

    const presence: UserPresence = {
      userId: this.userId,
      userName: this.userName,
      cursor,
      lastActive: Date.now(),
    };

    // Update local presence immediately
    if (cursor === null) {
      this._presence.delete(this.userId);
    } else {
      this._presence.set(this.userId, presence);
    }

    // Send to server
    try {
      const message = {
        type: 'presence_update',
        presence,
        userId: this.userId,
      };
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending presence update:', error);
    }

    // Emit with new Map to ensure reference change
    this.presenceEmitter.emit(new Map(this._presence));
  }

  sendCellUpdate(tabId: string, rowIndex: number, columnId: string, value: any) {
    if (this._wsReady && this.ws) {
      const message = {
        type: 'cell_update',
        tabId,
        rowIndex,
        columnId,
        value,
        timestamp: Date.now(),
        userId: this.userId,
      };
      this.ws.send(JSON.stringify(message));
    } else {
    }
  }

  async leaveSession() {
    if (!this._session || !this.ws) {
      return;
    }

    try {
      await apiClient.collaboration.leaveSession(this._session.id);

      // Close WebSocket connection
      this.ws.close();

      // Clear local state
      this._session = null;
      this._presence.clear();
      this._wsReady = false;

      // Emit updates
      this.sessionEmitter.emit(null);
      this.presenceEmitter.emit(new Map());
      this.wsReadyEmitter.emit(false);
    } catch (error) {
      console.error('Error leaving session:', error);
      throw error;
    }
  }

  onWsReady(callback: (ready: boolean) => void) {
    return this.wsReadyEmitter.subscribe(callback);
  }

  onSessionChange(callback: (session: Session | null) => void) {
    return this.sessionEmitter.subscribe(callback);
  }

  onPresenceChange(callback: (presence: Map<string, UserPresence>) => void) {
    return this.presenceEmitter.subscribe(callback);
  }

  get currentSession() {
    return this._session;
  }

  get isReady() {
    return this._wsReady;
  }

  get socket() {
    return this.ws;
  }

  get presence() {
    return this._presence;
  }
}

export const wsService = WebSocketService.getInstance();

export function useSession() {
  const [wsReady, setWsReady] = useState(wsService.isReady);
  const [currentSession, setCurrentSession] = useState<Session | null>(wsService.currentSession);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [presence, setPresence] = useState<Map<string, UserPresence>>(new Map());

  useEffect(() => {
    const wsReadyCleanup = wsService.onWsReady(ready => {
      setWsReady(ready);
    });

    const sessionCleanup = wsService.onSessionChange(session => {
      setCurrentSession(session);
    });

    const presenceCleanup = wsService.onPresenceChange(newPresence => {
      setPresence(newPresence);
    });

    // Fetch available sessions initially and then periodically
    let collaborationUnavailable = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const fetchSessions = async () => {
      if (collaborationUnavailable) return;
      try {
        const response = await apiClient.collaboration.sessions();
        setSessions(response || []);
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404) {
          // AuthStack must be redeployed with /api/sessions routes (see tensr-api/infra/stacks/auth_stack.py).
          collaborationUnavailable = true;
          if (interval) clearInterval(interval);
          return;
        }
        console.warn('Collaboration sessions unavailable:', error);
        setSessions([]);
      }
    };

    void fetchSessions();
    interval = setInterval(fetchSessions, 5000);

    return () => {
      wsReadyCleanup();
      sessionCleanup();
      presenceCleanup();
      if (interval) clearInterval(interval);
    };
  }, []);

  const createSession = async (params: {
    datasetId?: string;
    filePath?: string;
    fileName: string;
  }) => {
    try {
      const idToken = getIdToken();
      if (!idToken) {
        throw new Error('Authentication required');
      }

      const session = await apiClient.collaboration.createSession({
        ...params,
        userName: wsService.userName,
      });

      wsService.setupWebSocket(session.id);
      return session;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  };

  const joinSession = async (sessionId: string, options?: { userName?: string }) => {
    try {
      const idToken = getIdToken();
      if (!idToken) {
        throw new Error('Authentication required');
      }

      const userName = options?.userName?.trim() || wsService.userName;
      if (userName) {
        wsService.userName = userName;
      }

      const session = await apiClient.collaboration.joinSession(sessionId, { userName });
      wsService.setupWebSocket(session.id);
      return session;
    } catch (error) {
      console.error('Failed to join session:', error);
      throw error;
    }
  };

  const leaveSession = async () => {
    try {
      await wsService.leaveSession();
    } catch (error) {
      console.error('Failed to leave session:', error);
      throw error;
    }
  };

  return {
    wsReady,
    currentSession,
    sessions,
    createSession,
    joinSession,
    leaveSession,
    ws: wsService.socket,
    presence,
    updatePresence: wsService.updatePresence.bind(wsService),
    clientId: wsService.userId,
  };
}
