import { useEffect, useCallback, useRef } from 'react';

/**
 * Configuration options for the Ultralytics React hook
 */
export interface UltralyticsConfig {
  /** Server endpoint URL */
  endpoint: string;
  /** API key for authentication */
  apiKey?: string;
  /** Enable automatic page view tracking */
  autoTrackPageViews?: boolean;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Event tracking options
 */
export interface TrackOptions {
  /** Event name */
  name: string;
  /** Additional event properties */
  properties?: Record<string, unknown>;
}

/**
 * User identification options
 */
export interface IdentifyOptions {
  /** Unique user identifier */
  userId: string;
  /** Additional user traits */
  traits?: Record<string, unknown>;
}

/**
 * Return type for the useUltralytics hook
 */
export interface UseUltralyticsReturn {
  /** Track a custom event */
  track: (name: string, properties?: Record<string, unknown>) => Promise<void>;
  /** Identify a user */
  identify: (userId: string, traits?: Record<string, unknown>) => Promise<void>;
  /** Track a page view */
  trackPageView: (pageName?: string) => Promise<void>;
  /** Check if initialized */
  isInitialized: boolean;
}

/**
 * React hook for Ultralytics analytics
 * 
 * @example
 * ```tsx
 * function App() {
 *   const { track, identify, trackPageView } = useUltralytics({
 *     endpoint: 'https://analytics.example.com',
 *     apiKey: 'your-api-key'
 *   });
 * 
 *   const handleClick = () => {
 *     track('button_clicked', { buttonId: 'signup' });
 *   };
 * 
 *   return <button onClick={handleClick}>Sign Up</button>;
 * }
 * ```
 */
export function useUltralytics(config: UltralyticsConfig): UseUltralyticsReturn {
  const isInitialized = useRef(false);
  const sessionId = useRef<string | null>(null);
  const userId = useRef<string | null>(null);

  // Generate session ID on mount
  useEffect(() => {
    if (!sessionId.current) {
      sessionId.current = generateSessionId();
    }
    isInitialized.current = true;

    if (config.debug) {
      console.log('[Ultralytics] Initialized with session:', sessionId.current);
    }
  }, [config.debug]);

  // Auto track page views
  useEffect(() => {
    if (config.autoTrackPageViews && isInitialized.current) {
      sendEvent(config, 'page_view', {
        page: window.location.pathname,
        referrer: document.referrer,
        title: document.title
      }, sessionId.current, userId.current);
    }
  }, [config]);

  const track = useCallback(async (name: string, properties?: Record<string, unknown>) => {
    if (config.debug) {
      console.log('[Ultralytics] Track:', name, properties);
    }
    await sendEvent(config, name, properties || {}, sessionId.current, userId.current);
  }, [config]);

  const identify = useCallback(async (newUserId: string, traits?: Record<string, unknown>) => {
    userId.current = newUserId;
    if (config.debug) {
      console.log('[Ultralytics] Identify:', newUserId, traits);
    }
    await sendEvent(config, 'identify', { ...traits, userId: newUserId }, sessionId.current, newUserId);
  }, [config]);

  const trackPageView = useCallback(async (pageName?: string) => {
    const page = pageName || window.location.pathname;
    if (config.debug) {
      console.log('[Ultralytics] Page view:', page);
    }
    await sendEvent(config, 'page_view', {
      page,
      referrer: document.referrer,
      title: document.title
    }, sessionId.current, userId.current);
  }, [config]);

  return {
    track,
    identify,
    trackPageView,
    isInitialized: isInitialized.current
  };
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Send event to the Ultralytics server
 */
async function sendEvent(
  config: UltralyticsConfig,
  name: string,
  properties: Record<string, unknown>,
  sessionId: string | null,
  userId: string | null
): Promise<void> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (config.apiKey) {
      headers['X-API-Key'] = config.apiKey;
    }

    const response = await fetch(`${config.endpoint}/api/events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        properties,
        sessionId,
        userId
      })
    });

    if (!response.ok && config.debug) {
      console.error('[Ultralytics] Failed to send event:', response.status);
    }
  } catch (error) {
    if (config.debug) {
      console.error('[Ultralytics] Error sending event:', error);
    }
  }
}

export default useUltralytics;
