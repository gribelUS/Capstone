/**
 * Ultralytics Type Definitions
 */

/**
 * Configuration options for initializing Ultralytics
 */
export interface UltralyticsOptions {
  /** The server endpoint URL */
  endpoint: string;
  /** Enable automatic page view tracking (default: false) */
  autoTrack?: boolean;
  /** Track on initial page load when autoTrack is enabled (default: true) */
  trackInitialPageView?: boolean;
  /** Enable debug mode for verbose logging (default: false) */
  debug?: boolean;
  /** Session timeout in milliseconds (default: 30 minutes) */
  sessionTimeout?: number;
  /** Respect Do Not Track browser setting (default: true) */
  respectDoNotTrack?: boolean;
  /** Custom session ID (optional - auto-generated if not provided) */
  sessionId?: string;
}

/**
 * Event properties - can be any key-value pairs
 */
export interface EventProperties {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * User traits for identify calls
 */
export interface UserTraits {
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Page view properties
 */
export interface PageViewProperties extends EventProperties {
  url?: string;
  path?: string;
  title?: string;
  referrer?: string | null;
}

/**
 * Event object for batch tracking
 */
export interface BatchEvent {
  /** Event name */
  name: string;
  /** Optional event properties */
  properties?: EventProperties;
  /** Optional timestamp (defaults to current time) */
  timestamp?: string;
}

/**
 * Internal event data structure sent to server
 */
export interface EventData {
  name: string;
  properties: EventProperties;
  sessionId: string;
  userId: string | null;
  timestamp: string;
}

/**
 * Stored session data
 */
export interface StoredSession {
  id: string;
  lastActivity: number;
}

/**
 * Batch request result
 */
export interface BatchResult {
  success: boolean;
  processed?: number;
}

/**
 * Callback function for batch operations
 */
export type BatchCallback = (error: Error | null, result?: BatchResult) => void;

/**
 * Client statistics
 */
export interface ClientStats {
  /** Total events sent successfully */
  sent: number;
  /** Total errors encountered */
  errors: number;
  /** Events currently pending */
  pending: number;
}

/**
 * Debug information about client state
 */
export interface DebugInfo {
  initialized: boolean;
  endpoint: string | null;
  sessionId: string | null;
  userId: string | null;
  autoTrack: boolean;
  lastActivity: number | null;
  sessionAge: number | null;
  pendingEvents: number;
}
