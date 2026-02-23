/**
 * Ultralytics Browser Client
 * A lightweight analytics tracking library
 */

import type {
  UltralyticsOptions,
  EventProperties,
  UserTraits,
  PageViewProperties,
  BatchEvent,
  EventData,
  StoredSession,
  BatchResult,
  BatchCallback,
  ClientStats,
  DebugInfo,
} from './types';

interface BoundHandlers {
  visibilityChange?: () => void;
  beforeUnload?: () => void;
  popState?: () => void;
}

// Storage keys as constants to reduce duplicate strings
const STORAGE_SESSION = 'ultralytics_session';
const STORAGE_USER = 'ultralytics_user_id';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class UltralyticsClient {
  private _initialized = false;
  private _endpoint: string | null = null;
  private _sessionId: string | null = null;
  private _userId: string | null = null;
  private _sessionTimeout = 30 * 60 * 1000; // 30 minutes
  private _lastActivity: number | null = null;
  private _boundHandlers: BoundHandlers = {};
  private _autoTrack = false;
  private _lastTrackedPath: string | null = null;
  private _debug = false;
  private _pendingEvents = 0;
  private _eventsSent = 0;
  private _errorCount = 0;

  /**
   * Log with level and formatting when debug mode is enabled
   */
  private _log(level: LogLevel, message: string, data?: unknown): void {
    if (!this._debug) return;
    
    const timestamp = new Date().toISOString();
    const prefix = `[Ultralytics ${timestamp}]`;
    
    const logFn = level === 'error' ? console.error 
                : level === 'warn' ? console.warn 
                : console.log;
    
    if (data !== undefined) {
      logFn(`${prefix} ${message}`, data);
    } else {
      logFn(`${prefix} ${message}`);
    }
  }

  /**
   * Log debug level message
   */
  private _logDebug(message: string, data?: unknown): void {
    this._log('debug', message, data);
  }

  /**
   * Log info level message
   */
  private _logInfo(message: string, data?: unknown): void {
    this._log('info', message, data);
  }

  /**
   * Log warning message
   */
  private _logWarn(message: string, data?: unknown): void {
    this._log('warn', message, data);
  }

  /**
   * Log error message
   */
  private _logError(message: string, data?: unknown): void {
    this._log('error', message, data);
    this._errorCount++;
  }

  /**
   * Get debug information about the client state
   */
  getDebugInfo(): DebugInfo {
    return {
      initialized: this._initialized,
      endpoint: this._endpoint,
      sessionId: this._sessionId,
      userId: this._userId,
      autoTrack: this._autoTrack,
      lastActivity: this._lastActivity,
      sessionAge: this._lastActivity ? Date.now() - this._lastActivity : null,
      pendingEvents: this._pendingEvents
    };
  }

  /**
   * Get event statistics (useful for debugging)
   */
  getStats(): ClientStats {
    return {
      sent: this._eventsSent,
      errors: this._errorCount,
      pending: this._pendingEvents
    };
  }

  /**
   * Initialize the Ultralytics client
   * @param options - Configuration options
   */
  init(options: UltralyticsOptions): void {
    if (!options?.endpoint) {
      console.error('Ultralytics: endpoint is required');
      return;
    }

    // Respect Do Not Track if enabled (default: true)
    if (options.respectDoNotTrack !== false && this._isDoNotTrackEnabled()) {
      this._logInfo('Do Not Track is enabled, tracking disabled');
      return;
    }

    // Clean up any existing listeners
    if (this._initialized) this._removeEventListeners();

    this._endpoint = options.endpoint.replace(/\/$/, '');
    this._lastActivity = Date.now();
    this._autoTrack = options.autoTrack || false;
    this._debug = options.debug || false;
    
    // Set session timeout if provided
    if (options.sessionTimeout) {
      this._sessionTimeout = options.sessionTimeout;
    }

    // Initialize session (use provided sessionId or generate new)
    this._initSession(options.sessionId);
    this._initialized = true;
    this._restoreUserId();

    // Bind event handlers
    this._boundHandlers.visibilityChange = (): void => {
      if (document.visibilityState === 'visible') this._checkSession();
    };
    this._boundHandlers.beforeUnload = (): void => {
      this._lastActivity = Date.now();
    };

    document.addEventListener('visibilitychange', this._boundHandlers.visibilityChange);
    window.addEventListener('beforeunload', this._boundHandlers.beforeUnload);

    if (this._autoTrack) {
      this._setupAutoTracking(options.trackInitialPageView !== false);
    }

    this._logInfo('Client initialized', {
      endpoint: this._endpoint,
      autoTrack: this._autoTrack,
      sessionId: this._sessionId
    });
  }

  /**
   * Check if Do Not Track is enabled in browser
   */
  private _isDoNotTrackEnabled(): boolean {
    const nav = navigator as Navigator & { doNotTrack?: string; msDoNotTrack?: string };
    const win = window as Window & { doNotTrack?: string };
    return nav.doNotTrack === '1' || 
           nav.doNotTrack === 'yes' || 
           nav.msDoNotTrack === '1' ||
           win.doNotTrack === '1';
  }

  /**
   * Initialize or restore session
   * @param providedSessionId - Optional session ID to use instead of generating
   */
  private _initSession(providedSessionId?: string): void {
    if (providedSessionId) {
      this._sessionId = providedSessionId;
      this._logDebug('Using provided session ID', { sessionId: this._sessionId });
      this._storeSession();
      return;
    }

    const stored = this._getStoredSession();
    if (stored && (Date.now() - stored.lastActivity) < this._sessionTimeout) {
      this._sessionId = stored.id;
      this._lastActivity = stored.lastActivity;
      this._logDebug('Session restored', { sessionId: this._sessionId });
    } else {
      this._sessionId = this._generateId();
      this._logDebug('New session created', { sessionId: this._sessionId });
    }
    this._storeSession();
  }

  /**
   * Check if session is still valid
   */
  private _checkSession(): void {
    if (!this._lastActivity || (Date.now() - this._lastActivity) > this._sessionTimeout) {
      const oldSessionId = this._sessionId;
      this._sessionId = this._generateId();
      this._logDebug('Session expired, created new session', { 
        oldSessionId, 
        newSessionId: this._sessionId 
      });
    }
    this._lastActivity = Date.now();
    this._storeSession();
  }

  /**
   * Set up automatic page view tracking
   */
  private _setupAutoTracking(trackInitial: boolean): void {
    if (trackInitial) {
      this._lastTrackedPath = window.location.pathname;
      this.trackPageView();
    }

    this._boundHandlers.popState = (): void => this._onHistoryChange();
    window.addEventListener('popstate', this._boundHandlers.popState);

    // Intercept history methods for SPA navigation
    const self = this;
    const wrap = (fn: typeof history.pushState): typeof history.pushState => {
      return function(this: History, ...args): void {
        fn.apply(this, args);
        self._onHistoryChange();
      };
    };

    history.pushState = wrap(history.pushState.bind(history));
    history.replaceState = wrap(history.replaceState.bind(history));
  }

  /**
   * Handle history changes for SPA navigation
   */
  private _onHistoryChange(): void {
    const path = window.location.pathname;
    if (path !== this._lastTrackedPath) {
      this._lastTrackedPath = path;
      this._logDebug('History change detected, tracking page view', { path });
      this.trackPageView();
    }
  }

  /**
   * Generate a UUID v4
   */
  private _generateId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  /**
   * Safe localStorage access
   */
  private _storage = {
    get: (key: string): string | null => {
      try { return localStorage.getItem(key); } 
      catch { return null; }
    },
    set: (key: string, value: string): void => {
      try { localStorage.setItem(key, value); } 
      catch { /* ignore */ }
    },
    remove: (key: string): void => {
      try { localStorage.removeItem(key); } 
      catch { /* ignore */ }
    }
  };

  /**
   * Store session in localStorage
   */
  private _storeSession(): void {
    this._storage.set(STORAGE_SESSION, JSON.stringify({
      id: this._sessionId,
      lastActivity: this._lastActivity
    }));
  }

  /**
   * Get stored session from localStorage
   */
  private _getStoredSession(): StoredSession | null {
    const stored = this._storage.get(STORAGE_SESSION);
    return stored ? JSON.parse(stored) as StoredSession : null;
  }

  /**
   * Restore user ID from localStorage
   */
  private _restoreUserId(): void {
    const userId = this._storage.get(STORAGE_USER);
    if (userId) this._userId = userId;
  }

  /**
   * Track an event
   */
  track(name: string, properties?: EventProperties): void {
    if (!this._initialized) {
      console.error('Ultralytics: not initialized. Call init() first.');
      return;
    }

    if (!this._sessionId) {
      this._sessionId = this._generateId();
      this._storeSession();
      this._logDebug('Session created on track', { sessionId: this._sessionId });
    }

    this._lastActivity = Date.now();
    this._storeSession();

    const eventData = {
      name,
      properties: properties || {},
      sessionId: this._sessionId,
      userId: this._userId,
      timestamp: new Date().toISOString()
    };

    this._logDebug('Tracking event', { name, properties });
    this._send('/api/events', eventData);
  }

  /**
   * Track a page view
   */
  trackPageView(properties?: PageViewProperties): void {
    this.track('page_view', {
      url: window.location.href,
      path: window.location.pathname,
      title: document.title,
      referrer: document.referrer || null,
      ...properties
    });
  }

  /**
   * Remove event listeners
   */
  private _removeEventListeners(): void {
    const h = this._boundHandlers;
    if (h.visibilityChange) document.removeEventListener('visibilitychange', h.visibilityChange);
    if (h.beforeUnload) window.removeEventListener('beforeunload', h.beforeUnload);
    if (h.popState) window.removeEventListener('popstate', h.popState);
    this._boundHandlers = {};
  }

  /**
   * Clean up and reset state
   */
  destroy(): void {
    if (!this._initialized) return;
    this._logInfo('Destroying client', this.getStats());
    this._removeEventListeners();
    this._initialized = false;
    this._endpoint = null;
    this._sessionId = null;
    this._userId = null;
    this._autoTrack = false;
    this._lastTrackedPath = null;
  }

  /**
   * Track a custom event (alias with eventType)
   * @deprecated Use track() directly instead. This method will be removed in v2.0.0.
   */
  trackEvent(eventName: string, properties?: EventProperties): void {
    console.warn('Ultralytics: trackEvent() is deprecated. Use track() instead.');
    this.track(eventName, { eventType: 'custom', ...properties });
  }

  /**
   * Reset the client state without destroying listeners
   * Useful for single-page apps when a user logs out
   */
  reset(): void {
    this._logInfo('Resetting client state');
    this._sessionId = this._generateId();
    this._userId = null;
    this._storage.remove(STORAGE_USER);
    this._storeSession();
    this._eventsSent = 0;
    this._errorCount = 0;
  }

  /**
   * Identify a user
   */
  identify(userId: string, traits?: UserTraits): void {
    if (!this._initialized) {
      console.error('Ultralytics: not initialized. Call init() first.');
      return;
    }
    if (!userId) {
      console.error('Ultralytics: userId is required for identify()');
      return;
    }

    this._userId = userId;
    this._storage.set(STORAGE_USER, userId);

    if (traits) this.track('identify', traits);
    this._logInfo('User identified', { userId, hasTraits: !!traits });
  }

  /**
   * Get the current user ID
   */
  getUserId(): string | null {
    return this._userId;
  }

  /**
   * Clear the current user
   */
  clearUser(): void {
    this._userId = null;
    this._storage.remove(STORAGE_USER);
  }

  /**
   * Track multiple events in a batch
   */
  trackBatch(events: BatchEvent[], callback?: BatchCallback): void {
    if (!this._initialized) {
      const err = new Error('Ultralytics: not initialized. Call init() first.');
      console.error(err.message);
      callback?.(err);
      return;
    }

    if (!Array.isArray(events) || !events.length) {
      const err = new Error('Ultralytics: events must be a non-empty array');
      console.error(err.message);
      callback?.(err);
      return;
    }

    this._lastActivity = Date.now();
    this._storeSession();

    const prepared: EventData[] = events.map(e => ({
      name: e.name,
      properties: e.properties || {},
      sessionId: this._sessionId!,
      userId: this._userId,
      timestamp: e.timestamp || new Date().toISOString()
    }));

    this._logDebug('Tracking batch', { eventCount: events.length });
    this._sendBatch(prepared, callback);
  }

  /**
   * Send batch to server
   */
  private _sendBatch(events: EventData[], callback?: BatchCallback): void {
    this._pendingEvents += events.length;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', this._endpoint + '/api/events/batch', true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onreadystatechange = (): void => {
      if (xhr.readyState !== 4) return;
      this._pendingEvents -= events.length;
      
      if (xhr.status >= 200 && xhr.status < 300) {
        this._eventsSent += events.length;
        this._logDebug('Batch sent successfully', { 
          count: events.length, 
          status: xhr.status 
        });
        try {
          callback?.(null, JSON.parse(xhr.responseText) as BatchResult);
        } catch {
          callback?.(null, { success: true });
        }
      } else {
        this._logError('Batch send failed', { 
          status: xhr.status, 
          response: xhr.responseText,
          eventCount: events.length
        });
        callback?.(new Error('Batch failed: ' + xhr.status));
      }
    };

    xhr.send(JSON.stringify({ events }));
  }

  /**
   * Send single event to server
   */
  private _send(path: string, data: EventData): void {
    this._pendingEvents++;
    const xhr = new XMLHttpRequest();
    xhr.open('POST', this._endpoint + path, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onreadystatechange = (): void => {
      if (xhr.readyState !== 4) return;
      this._pendingEvents--;
      
      if (xhr.status >= 200 && xhr.status < 300) {
        this._eventsSent++;
        this._logDebug('Event sent successfully', { 
          name: data.name, 
          status: xhr.status 
        });
      } else {
        this._logError('Event send failed', { 
          name: data.name,
          status: xhr.status, 
          response: xhr.responseText 
        });
      }
    };

    xhr.send(JSON.stringify(data));
  }
}

// Create singleton instance
const Ultralytics = new UltralyticsClient();

// Export for module usage
export { Ultralytics, UltralyticsClient };

// Expose to window for script tag usage
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).Ultralytics = Ultralytics;
}

export default Ultralytics;
