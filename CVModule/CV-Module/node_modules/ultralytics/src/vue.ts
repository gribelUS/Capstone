import { ref, onMounted, onUnmounted } from 'vue';

/**
 * Configuration options for the Ultralytics Vue composable
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
 * Return type for the useUltralytics composable
 */
export interface UseUltralyticsReturn {
  /** Track a custom event */
  track: (name: string, properties?: Record<string, unknown>) => Promise<void>;
  /** Identify a user */
  identify: (userId: string, traits?: Record<string, unknown>) => Promise<void>;
  /** Track a page view */
  trackPageView: (pageName?: string) => Promise<void>;
  /** Check if initialized */
  isInitialized: Readonly<import('vue').Ref<boolean>>;
  /** Current session ID */
  sessionId: Readonly<import('vue').Ref<string | null>>;
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

/**
 * Vue 3 composable for Ultralytics analytics
 * 
 * @example
 * ```vue
 * <script setup>
 * import { useUltralytics } from 'ultralytics/vue';
 * 
 * const { track, identify, trackPageView, isInitialized } = useUltralytics({
 *   endpoint: 'https://analytics.example.com',
 *   apiKey: 'your-api-key'
 * });
 * 
 * const handleClick = () => {
 *   track('button_clicked', { buttonId: 'signup' });
 * };
 * </script>
 * 
 * <template>
 *   <button @click="handleClick">Sign Up</button>
 * </template>
 * ```
 */
export function useUltralytics(config: UltralyticsConfig): UseUltralyticsReturn {
  const isInitialized = ref(false);
  const sessionId = ref<string | null>(null);
  const currentUserId = ref<string | null>(null);

  onMounted(() => {
    // Generate session ID on mount
    sessionId.value = generateSessionId();
    isInitialized.value = true;

    if (config.debug) {
      console.log('[Ultralytics] Initialized with session:', sessionId.value);
    }

    // Auto track page views
    if (config.autoTrackPageViews) {
      sendEvent(
        config,
        'page_view',
        {
          page: window.location.pathname,
          referrer: document.referrer,
          title: document.title
        },
        sessionId.value,
        currentUserId.value
      );
    }
  });

  onUnmounted(() => {
    if (config.debug) {
      console.log('[Ultralytics] Unmounted');
    }
  });

  /**
   * Track a custom event
   */
  async function track(name: string, properties?: Record<string, unknown>): Promise<void> {
    if (config.debug) {
      console.log('[Ultralytics] Track:', name, properties);
    }
    await sendEvent(config, name, properties || {}, sessionId.value, currentUserId.value);
  }

  /**
   * Identify a user
   */
  async function identify(userId: string, traits?: Record<string, unknown>): Promise<void> {
    currentUserId.value = userId;
    if (config.debug) {
      console.log('[Ultralytics] Identify:', userId, traits);
    }
    await sendEvent(
      config,
      'identify',
      { ...traits, userId },
      sessionId.value,
      userId
    );
  }

  /**
   * Track a page view manually
   */
  async function trackPageView(pageName?: string): Promise<void> {
    const page = pageName || window.location.pathname;
    if (config.debug) {
      console.log('[Ultralytics] Page view:', page);
    }
    await sendEvent(
      config,
      'page_view',
      {
        page,
        referrer: document.referrer,
        title: document.title
      },
      sessionId.value,
      currentUserId.value
    );
  }

  return {
    track,
    identify,
    trackPageView,
    isInitialized,
    sessionId
  };
}

export default useUltralytics;
