import { writable, derived, get } from 'svelte/store';
import type { Readable, Writable } from 'svelte/store';

/**
 * Configuration options for the Ultralytics Svelte store
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
 * Ultralytics store state
 */
export interface UltralyticsState {
  isInitialized: boolean;
  sessionId: string | null;
  userId: string | null;
  eventsSent: number;
  errors: number;
}

/**
 * Return type for the createUltralytics function
 */
export interface UltralyticsStore {
  /** Store subscription */
  subscribe: Readable<UltralyticsState>['subscribe'];
  /** Initialize the analytics client */
  init: () => void;
  /** Track a custom event */
  track: (name: string, properties?: Record<string, unknown>) => Promise<void>;
  /** Identify a user */
  identify: (userId: string, traits?: Record<string, unknown>) => Promise<void>;
  /** Track a page view */
  trackPageView: (pageName?: string) => Promise<void>;
  /** Reset the store state */
  reset: () => void;
  /** Derived store for initialization status */
  isInitialized: Readable<boolean>;
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
): Promise<boolean> {
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
        userId,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      if (config.debug) {
        console.error('[Ultralytics] Failed to send event:', response.status);
      }
      return false;
    }

    return true;
  } catch (error) {
    if (config.debug) {
      console.error('[Ultralytics] Error sending event:', error);
    }
    return false;
  }
}

/**
 * Create a Svelte store for Ultralytics analytics
 * 
 * @example
 * ```svelte
 * <script>
 *   import { createUltralytics } from 'ultralytics/svelte';
 *   import { onMount } from 'svelte';
 * 
 *   const analytics = createUltralytics({
 *     endpoint: 'https://analytics.example.com',
 *     apiKey: 'your-api-key'
 *   });
 * 
 *   onMount(() => {
 *     analytics.init();
 *   });
 * 
 *   function handleClick() {
 *     analytics.track('button_clicked', { buttonId: 'signup' });
 *   }
 * </script>
 * 
 * <button on:click={handleClick}>Sign Up</button>
 * 
 * {#if $analytics.isInitialized}
 *   <p>Session: {$analytics.sessionId}</p>
 * {/if}
 * ```
 */
export function createUltralytics(config: UltralyticsConfig): UltralyticsStore {
  const initialState: UltralyticsState = {
    isInitialized: false,
    sessionId: null,
    userId: null,
    eventsSent: 0,
    errors: 0
  };

  const store: Writable<UltralyticsState> = writable(initialState);
  const { subscribe, update, set } = store;

  // Derived store for initialization status
  const isInitialized: Readable<boolean> = derived(store, $store => $store.isInitialized);

  /**
   * Initialize the analytics client
   */
  function init(): void {
    const sessionId = generateSessionId();
    
    update(state => ({
      ...state,
      isInitialized: true,
      sessionId
    }));

    if (config.debug) {
      console.log('[Ultralytics] Initialized with session:', sessionId);
    }

    // Auto track initial page view
    if (config.autoTrackPageViews) {
      trackPageView();
    }
  }

  /**
   * Track a custom event
   */
  async function track(name: string, properties?: Record<string, unknown>): Promise<void> {
    const state = get(store);
    
    if (!state.isInitialized) {
      if (config.debug) {
        console.warn('[Ultralytics] Not initialized. Call init() first.');
      }
      return;
    }

    if (config.debug) {
      console.log('[Ultralytics] Track:', name, properties);
    }

    const success = await sendEvent(
      config,
      name,
      properties || {},
      state.sessionId,
      state.userId
    );

    update(s => ({
      ...s,
      eventsSent: success ? s.eventsSent + 1 : s.eventsSent,
      errors: success ? s.errors : s.errors + 1
    }));
  }

  /**
   * Identify a user
   */
  async function identify(userId: string, traits?: Record<string, unknown>): Promise<void> {
    const state = get(store);
    
    if (!state.isInitialized) {
      if (config.debug) {
        console.warn('[Ultralytics] Not initialized. Call init() first.');
      }
      return;
    }

    update(s => ({ ...s, userId }));

    if (config.debug) {
      console.log('[Ultralytics] Identify:', userId, traits);
    }

    const success = await sendEvent(
      config,
      'identify',
      { ...traits, userId },
      state.sessionId,
      userId
    );

    update(s => ({
      ...s,
      eventsSent: success ? s.eventsSent + 1 : s.eventsSent,
      errors: success ? s.errors : s.errors + 1
    }));
  }

  /**
   * Track a page view
   */
  async function trackPageView(pageName?: string): Promise<void> {
    const page = pageName || (typeof window !== 'undefined' ? window.location.pathname : '/');
    
    if (config.debug) {
      console.log('[Ultralytics] Page view:', page);
    }

    const state = get(store);
    
    const success = await sendEvent(
      config,
      'page_view',
      {
        page,
        referrer: typeof document !== 'undefined' ? document.referrer : '',
        title: typeof document !== 'undefined' ? document.title : ''
      },
      state.sessionId,
      state.userId
    );

    update(s => ({
      ...s,
      eventsSent: success ? s.eventsSent + 1 : s.eventsSent,
      errors: success ? s.errors : s.errors + 1
    }));
  }

  /**
   * Reset the store to initial state
   */
  function reset(): void {
    if (config.debug) {
      console.log('[Ultralytics] Reset');
    }
    set(initialState);
  }

  return {
    subscribe,
    init,
    track,
    identify,
    trackPageView,
    reset,
    isInitialized
  };
}

/**
 * Svelte action for automatic page view tracking on navigation
 * 
 * @example
 * ```svelte
 * <script>
 *   import { createUltralytics, trackPageViews } from 'ultralytics/svelte';
 *   
 *   const analytics = createUltralytics({ endpoint: '...' });
 * </script>
 * 
 * <div use:trackPageViews={analytics}>
 *   <!-- Your app content -->
 * </div>
 * ```
 */
export function trackPageViews(node: HTMLElement, analytics: UltralyticsStore): { destroy: () => void } {
  let lastPath = typeof window !== 'undefined' ? window.location.pathname : '';

  const observer = new MutationObserver(() => {
    const currentPath = window.location.pathname;
    if (currentPath !== lastPath) {
      lastPath = currentPath;
      analytics.trackPageView(currentPath);
    }
  });

  // Observe URL changes via history API
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    const currentPath = window.location.pathname;
    if (currentPath !== lastPath) {
      lastPath = currentPath;
      analytics.trackPageView(currentPath);
    }
  };

  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    const currentPath = window.location.pathname;
    if (currentPath !== lastPath) {
      lastPath = currentPath;
      analytics.trackPageView(currentPath);
    }
  };

  // Handle popstate (back/forward navigation)
  const handlePopState = (): void => {
    const currentPath = window.location.pathname;
    if (currentPath !== lastPath) {
      lastPath = currentPath;
      analytics.trackPageView(currentPath);
    }
  };

  window.addEventListener('popstate', handlePopState);

  return {
    destroy() {
      observer.disconnect();
      window.removeEventListener('popstate', handlePopState);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    }
  };
}

export default createUltralytics;
