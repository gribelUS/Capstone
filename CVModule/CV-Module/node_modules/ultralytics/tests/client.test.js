/**
 * @jest-environment jsdom
 */

// Mock XMLHttpRequest
const mockXHR = {
  open: jest.fn(),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  readyState: 4,
  status: 200,
  responseText: '{"success": true, "eventId": 1}'
};

global.XMLHttpRequest = jest.fn(() => mockXHR);

// Load the client
require('../src/client');

describe('Ultralytics Client', () => {
  let originalLocalStorage;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockXHR.status = 200;
    mockXHR.readyState = 4;
    mockXHR.responseText = '{"success": true, "eventId": 1}';

    // Reset Ultralytics state
    if (window.Ultralytics._initialized) {
      window.Ultralytics.destroy();
    }

    // Mock localStorage
    originalLocalStorage = window.localStorage;
    const store = {};
    const mockLocalStorage = {
      getItem: jest.fn((key) => store[key] || null),
      setItem: jest.fn((key, value) => { store[key] = value; }),
      removeItem: jest.fn((key) => { delete store[key]; }),
      clear: jest.fn(() => { Object.keys(store).forEach(k => delete store[k]); })
    };
    Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, writable: true });
  });

  afterEach(() => {
    if (window.Ultralytics._initialized) {
      window.Ultralytics.destroy();
    }
    Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true });
  });

  describe('init()', () => {
    it('should require endpoint option', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      window.Ultralytics.init();
      expect(consoleSpy).toHaveBeenCalledWith('Ultralytics: endpoint is required');
      expect(window.Ultralytics._initialized).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should initialize with valid endpoint', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      window.Ultralytics.init({ endpoint: 'https://analytics.example.com' });
      
      expect(window.Ultralytics._initialized).toBe(true);
      expect(window.Ultralytics._endpoint).toBe('https://analytics.example.com');
      expect(consoleSpy).toHaveBeenCalledWith('Ultralytics initialized');

      consoleSpy.mockRestore();
    });

    it('should strip trailing slash from endpoint', () => {
      window.Ultralytics.init({ endpoint: 'https://analytics.example.com/' });
      expect(window.Ultralytics._endpoint).toBe('https://analytics.example.com');
    });

    it('should generate a session ID', () => {
      window.Ultralytics.init({ endpoint: 'https://analytics.example.com' });
      expect(window.Ultralytics._sessionId).toBeDefined();
      expect(window.Ultralytics._sessionId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('track()', () => {
    beforeEach(() => {
      window.Ultralytics.init({ endpoint: 'https://analytics.example.com' });
    });

    it('should send event to server', () => {
      window.Ultralytics.track('button_click', { buttonId: 'cta' });

      expect(mockXHR.open).toHaveBeenCalledWith(
        'POST',
        'https://analytics.example.com/api/events',
        true
      );
      expect(mockXHR.setRequestHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/json'
      );
      expect(mockXHR.send).toHaveBeenCalled();

      const sentData = JSON.parse(mockXHR.send.mock.calls[0][0]);
      expect(sentData.name).toBe('button_click');
      expect(sentData.properties.buttonId).toBe('cta');
      expect(sentData.sessionId).toBeDefined();
    });

    it('should error if not initialized', () => {
      window.Ultralytics.destroy();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      window.Ultralytics.track('test_event');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Ultralytics: not initialized. Call init() first.'
      );
      expect(mockXHR.open).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('trackPageView()', () => {
    beforeEach(() => {
      window.Ultralytics.init({ endpoint: 'https://analytics.example.com' });
    });

    it('should track page view with URL info', () => {
      window.Ultralytics.trackPageView();

      expect(mockXHR.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockXHR.send.mock.calls[0][0]);
      expect(sentData.name).toBe('page_view');
      expect(sentData.properties.url).toBeDefined();
      expect(sentData.properties.path).toBeDefined();
    });

    it('should merge custom properties', () => {
      window.Ultralytics.trackPageView({ section: 'blog' });

      const sentData = JSON.parse(mockXHR.send.mock.calls[0][0]);
      expect(sentData.properties.section).toBe('blog');
      expect(sentData.properties.url).toBeDefined();
    });
  });

  describe('identify()', () => {
    beforeEach(() => {
      window.Ultralytics.init({ endpoint: 'https://analytics.example.com' });
    });

    it('should set user ID', () => {
      window.Ultralytics.identify('user-123');
      
      expect(window.Ultralytics._userId).toBe('user-123');
      expect(window.Ultralytics.getUserId()).toBe('user-123');
    });

    it('should persist user ID to localStorage', () => {
      window.Ultralytics.identify('user-123');
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'ultralytics_user_id',
        'user-123'
      );
    });

    it('should track identify event with traits', () => {
      window.Ultralytics.identify('user-123', { email: 'test@example.com' });

      const sentData = JSON.parse(mockXHR.send.mock.calls[0][0]);
      expect(sentData.name).toBe('identify');
      expect(sentData.properties.email).toBe('test@example.com');
    });

    it('should require userId', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      window.Ultralytics.identify();
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'Ultralytics: userId is required for identify()'
      );
      consoleSpy.mockRestore();
    });
  });

  describe('clearUser()', () => {
    beforeEach(() => {
      window.Ultralytics.init({ endpoint: 'https://analytics.example.com' });
      window.Ultralytics.identify('user-123');
    });

    it('should clear user ID', () => {
      window.Ultralytics.clearUser();
      
      expect(window.Ultralytics._userId).toBeNull();
      expect(window.Ultralytics.getUserId()).toBeNull();
    });

    it('should remove from localStorage', () => {
      window.Ultralytics.clearUser();
      
      expect(localStorage.removeItem).toHaveBeenCalledWith('ultralytics_user_id');
    });
  });

  describe('trackBatch()', () => {
    beforeEach(() => {
      window.Ultralytics.init({ endpoint: 'https://analytics.example.com' });
    });

    it('should send multiple events in one request', () => {
      window.Ultralytics.trackBatch([
        { name: 'event1', properties: { a: 1 } },
        { name: 'event2', properties: { b: 2 } }
      ]);

      expect(mockXHR.open).toHaveBeenCalledWith(
        'POST',
        'https://analytics.example.com/api/events/batch',
        true
      );

      const sentData = JSON.parse(mockXHR.send.mock.calls[0][0]);
      expect(sentData.events).toHaveLength(2);
      expect(sentData.events[0].name).toBe('event1');
      expect(sentData.events[1].name).toBe('event2');
    });

    it('should reject empty events array', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const callback = jest.fn();

      window.Ultralytics.trackBatch([], callback);

      expect(consoleSpy).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(expect.any(Error));
      expect(mockXHR.open).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('destroy()', () => {
    it('should clean up state', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      window.Ultralytics.init({ endpoint: 'https://analytics.example.com' });
      window.Ultralytics.destroy();

      expect(window.Ultralytics._initialized).toBe(false);
      expect(window.Ultralytics._endpoint).toBeNull();
      expect(window.Ultralytics._sessionId).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Ultralytics destroyed');

      consoleSpy.mockRestore();
    });
  });

  describe('session management', () => {
    it('should generate valid UUID format session IDs', () => {
      window.Ultralytics.init({ endpoint: 'https://analytics.example.com' });
      
      const sessionId = window.Ultralytics._sessionId;
      expect(sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });

    it('should store session in localStorage', () => {
      window.Ultralytics.init({ endpoint: 'https://analytics.example.com' });
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'ultralytics_session',
        expect.any(String)
      );
    });
  });
});
