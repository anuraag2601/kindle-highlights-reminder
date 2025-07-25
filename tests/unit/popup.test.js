// Unit tests for Popup functionality
/**
 * @jest-environment jsdom
 */

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    openOptionsPage: jest.fn()
  }
};

global.chrome = mockChrome;

// Load popup HTML and JS
const fs = require('fs');
const path = require('path');

describe('Popup Controller', () => {
  let PopupController;
  let popupController;
  let mockElements;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Load popup HTML
    const popupHtml = fs.readFileSync(
      path.join(__dirname, '../../popup/popup.html'), 
      'utf8'
    );
    document.body.innerHTML = popupHtml;

    // Load popup JS
    delete require.cache[require.resolve('../../popup/popup.js')];
    const popupModule = require('../../popup/popup.js');
    PopupController = popupModule.PopupController;

    // Create controller instance
    popupController = new PopupController();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Initialization', () => {
    test('should bind all required elements', () => {
      expect(popupController.elements.syncStatus).toBeTruthy();
      expect(popupController.elements.totalHighlights).toBeTruthy();
      expect(popupController.elements.totalBooks).toBeTruthy();
      expect(popupController.elements.syncNowButton).toBeTruthy();
      expect(popupController.elements.testEmailButton).toBeTruthy();
      expect(popupController.elements.autoSyncToggle).toBeTruthy();
    });

    test('should have bound event listeners', () => {
      const syncButton = popupController.elements.syncNowButton;
      const testEmailButton = popupController.elements.testEmailButton;

      // Test that clicking buttons calls the handlers (indirectly tests event binding)
      const originalHandleSyncNow = popupController.handleSyncNow;
      const originalHandleTestEmail = popupController.handleTestEmail;
      
      popupController.handleSyncNow = jest.fn();
      popupController.handleTestEmail = jest.fn();

      syncButton.click();
      testEmailButton.click();

      expect(popupController.handleSyncNow).toHaveBeenCalled();
      expect(popupController.handleTestEmail).toHaveBeenCalled();

      // Restore original methods
      popupController.handleSyncNow = originalHandleSyncNow;
      popupController.handleTestEmail = originalHandleTestEmail;
    });
  });

  describe('Stats Display', () => {
    test('should update stats correctly', () => {
      const testStats = {
        totalHighlights: 42,
        totalBooks: 5,
        lastSyncTime: Date.now() - 3600000, // 1 hour ago
        syncStatus: 'success'
      };

      popupController.updateStats(testStats);

      expect(popupController.elements.totalHighlights.textContent).toBe('42');
      expect(popupController.elements.totalBooks.textContent).toBe('5');
      expect(popupController.elements.syncIndicator.className).toContain('success');
    });

    test('should handle never synced state', () => {
      const testStats = {
        totalHighlights: 0,
        totalBooks: 0,
        lastSyncTime: null,
        syncStatus: 'never_synced'
      };

      popupController.updateStats(testStats);

      expect(popupController.elements.syncText.textContent).toBe('Never synced');
      expect(popupController.elements.syncIndicator.className)
        .toBe('sync-indicator');
    });
  });

  describe('Time Display', () => {
    test('should format time ago correctly', () => {
      const now = Date.now();
      
      // Test various time differences
      expect(popupController.getTimeAgo(now - 30000)).toBe('Just now'); // 30 seconds
      expect(popupController.getTimeAgo(now - 120000)).toBe('2 minutes ago'); // 2 minutes
      expect(popupController.getTimeAgo(now - 3600000)).toBe('1 hour ago'); // 1 hour
      expect(popupController.getTimeAgo(now - 7200000)).toBe('2 hours ago'); // 2 hours
      expect(popupController.getTimeAgo(now - 86400000)).toBe('1 day ago'); // 1 day
      expect(popupController.getTimeAgo(now - 172800000)).toBe('2 days ago'); // 2 days
    });
  });

  describe('Button States', () => {
    test('should set button loading state correctly', () => {
      const button = popupController.elements.syncNowButton;
      const icon = button.querySelector('.button-icon');

      // Set loading state
      popupController.setButtonLoading(button, true);
      expect(button.disabled).toBe(true);
      expect(icon.textContent).toBe('⏳');

      // Clear loading state
      popupController.setButtonLoading(button, false);
      expect(button.disabled).toBe(false);
      expect(icon.textContent).toBe('🔄');
    });
  });

  describe('Message Handling', () => {
    test('should send messages to background script', async () => {
      const testMessage = { action: 'test' };
      const mockResponse = { success: true, data: 'test' };

      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback(mockResponse);
      });

      const result = await popupController.sendMessage(testMessage);
      
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        testMessage, 
        expect.any(Function)
      );
      expect(result).toEqual(mockResponse);
    });

    test('should handle missing response', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback(null);
      });

      const result = await popupController.sendMessage({ action: 'test' });
      
      expect(result).toEqual({ success: false, error: 'No response' });
    });
  });

  describe('Settings Updates', () => {
    test('should update settings display', () => {
      const testSettings = {
        enableAutoSync: true,
        email: 'test@example.com'
      };

      popupController.updateSettings(testSettings);

      expect(popupController.elements.autoSyncToggle.checked).toBe(true);
    });

    test('should handle auto-sync toggle', async () => {
      const mockResponse = { success: true };
      mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
        callback(mockResponse);
      });

      await popupController.handleAutoSyncToggle(true);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        {
          action: 'save-settings',
          settings: { enableAutoSync: true }
        },
        expect.any(Function)
      );
    });
  });

  describe('Navigation', () => {
    test('should open settings page', () => {
      // Mock window.close
      global.window.close = jest.fn();

      popupController.openSettingsPage();

      expect(mockChrome.runtime.openOptionsPage).toHaveBeenCalled();
      expect(window.close).toHaveBeenCalled();
    });
  });

  describe('Message Display', () => {
    test('should show messages correctly', () => {
      const messageElement = popupController.elements.message;

      popupController.showMessage('Test message', 'success');

      expect(messageElement.textContent).toBe('Test message');
      expect(messageElement.className).toContain('success');
      expect(messageElement.className).toContain('visible');
    });
    
    test('should show different message types', () => {
      const messageElement = popupController.elements.message;

      // Test error message
      popupController.showMessage('Error message', 'error');
      expect(messageElement.className).toContain('error');
      
      // Test info message
      popupController.showMessage('Info message', 'info');
      expect(messageElement.className).toContain('info');
    });
  });

  describe('Loading States', () => {
    test('should show and hide loading overlay', () => {
      const loadingOverlay = popupController.elements.loadingOverlay;
      const loadingText = popupController.elements.loadingText;

      popupController.showLoading('Testing...');
      expect(loadingOverlay.className).toContain('visible');
      expect(loadingText.textContent).toBe('Testing...');

      popupController.hideLoading();
      expect(loadingOverlay.className).not.toContain('visible');
    });
  });
});