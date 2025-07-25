// Kindle Highlights Reminder - Popup JavaScript

class PopupController {
  constructor() {
    this.elements = {};
    this.currentStats = null;
    this.init();
  }

  init() {
    this.bindElements();
    this.bindEventListeners();
    this.loadInitialData();
  }

  bindElements() {
    this.elements = {
      syncStatus: document.getElementById('sync-status'),
      syncText: document.getElementById('sync-text'),
      syncIndicator: document.getElementById('sync-indicator'),
      totalHighlights: document.getElementById('total-highlights'),
      totalBooks: document.getElementById('total-books'),
      syncNowButton: document.getElementById('sync-now'),
      testEmailButton: document.getElementById('send-test-email'),
      autoSyncToggle: document.getElementById('auto-sync-toggle'),
      openSettingsLink: document.getElementById('open-settings'),
      viewHighlightsLink: document.getElementById('view-highlights'),
      loadingOverlay: document.getElementById('loading-overlay'),
      loadingText: document.getElementById('loading-text'),
      messageContainer: document.getElementById('message-container'),
      message: document.getElementById('message')
    };
  }

  bindEventListeners() {
    // Action buttons
    this.elements.syncNowButton.addEventListener('click', () => {
      this.handleSyncNow();
    });

    this.elements.testEmailButton.addEventListener('click', () => {
      this.handleTestEmail();
    });

    // Settings toggle
    this.elements.autoSyncToggle.addEventListener('change', (e) => {
      this.handleAutoSyncToggle(e.target.checked);
    });

    // Navigation links
    this.elements.openSettingsLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.openSettingsPage();
    });

    this.elements.viewHighlightsLink.addEventListener('click', (e) => {
      e.preventDefault();
      this.viewAllHighlights();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.handleSyncNow();
      }
    });
  }

  async loadInitialData() {
    try {
      this.showLoading('Loading stats...');

      // Load stats and settings in parallel
      const [statsResult, settingsResult] = await Promise.all([
        this.sendMessage({ action: 'get-stats' }),
        this.sendMessage({ action: 'get-settings' })
      ]);

      if (statsResult.success) {
        this.updateStats(statsResult.data);
      }

      if (settingsResult.success) {
        this.updateSettings(settingsResult.data);
      }

    } catch (error) {
      console.error('Failed to load initial data:', error);
      this.showMessage('Failed to load data', 'error');
    } finally {
      this.hideLoading();
    }
  }

  updateStats(stats) {
    this.currentStats = stats;
    
    // Update stat numbers
    this.elements.totalHighlights.textContent = stats.totalHighlights || 0;
    this.elements.totalBooks.textContent = stats.totalBooks || 0;

    // Update sync status
    this.updateSyncStatus(stats);
  }

  updateSyncStatus(stats) {
    const { lastSyncTime, syncStatus } = stats;
    
    if (!lastSyncTime) {
      this.elements.syncText.textContent = 'Never synced';
      this.elements.syncIndicator.className = 'sync-indicator';
    } else {
      const timeAgo = this.getTimeAgo(lastSyncTime);
      this.elements.syncText.textContent = `Last sync: ${timeAgo}`;
      
      if (syncStatus === 'success') {
        this.elements.syncIndicator.className = 'sync-indicator success';
      } else if (syncStatus === 'syncing') {
        this.elements.syncIndicator.className = 'sync-indicator syncing';
      } else {
        this.elements.syncIndicator.className = 'sync-indicator';
      }
    }
  }

  updateSettings(settings) {
    // Update auto-sync toggle
    this.elements.autoSyncToggle.checked = settings.enableAutoSync || false;
  }

  async handleSyncNow() {
    try {
      this.setButtonLoading(this.elements.syncNowButton, true);
      this.elements.syncIndicator.className = 'sync-indicator syncing';
      this.elements.syncText.textContent = 'Syncing...';

      const result = await this.sendMessage({ action: 'sync-now' });

      if (result.success) {
        if (result.data.status === 'not_implemented') {
          this.showMessage(result.data.message, 'info');
        } else {
          this.showMessage('Sync completed successfully!', 'success');
          // Reload stats after sync
          setTimeout(() => this.loadInitialData(), 1000);
        }
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('Sync failed:', error);
      this.showMessage('Sync failed: ' + error.message, 'error');
      this.elements.syncIndicator.className = 'sync-indicator';
      this.elements.syncText.textContent = 'Sync failed';
    } finally {
      this.setButtonLoading(this.elements.syncNowButton, false);
    }
  }

  async handleTestEmail() {
    try {
      this.setButtonLoading(this.elements.testEmailButton, true);

      const result = await this.sendMessage({ action: 'send-test-email' });

      if (result.success) {
        if (result.data.status === 'not_implemented') {
          this.showMessage(result.data.message, 'info');
        } else {
          this.showMessage('Test email sent successfully!', 'success');
        }
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('Test email failed:', error);
      this.showMessage('Failed to send test email: ' + error.message, 'error');
    } finally {
      this.setButtonLoading(this.elements.testEmailButton, false);
    }
  }

  async handleAutoSyncToggle(enabled) {
    try {
      const settings = { enableAutoSync: enabled };
      const result = await this.sendMessage({ 
        action: 'save-settings', 
        settings 
      });

      if (result.success) {
        const message = enabled ? 'Auto-sync enabled' : 'Auto-sync disabled';
        this.showMessage(message, 'success');
      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      console.error('Failed to update settings:', error);
      this.showMessage('Failed to update setting', 'error');
      // Revert toggle
      this.elements.autoSyncToggle.checked = !enabled;
    }
  }

  openSettingsPage() {
    chrome.runtime.openOptionsPage();
    window.close();
  }

  viewAllHighlights() {
    // For now, just show a message
    this.showMessage('Highlights viewer will be implemented in a future milestone', 'info');
  }

  // Utility methods
  sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }

  showLoading(text = 'Loading...') {
    this.elements.loadingText.textContent = text;
    this.elements.loadingOverlay.classList.add('visible');
  }

  hideLoading() {
    this.elements.loadingOverlay.classList.remove('visible');
  }

  setButtonLoading(button, loading) {
    if (loading) {
      button.disabled = true;
      const icon = button.querySelector('.button-icon');
      if (icon) {
        icon.textContent = '⏳';
      }
    } else {
      button.disabled = false;
      const icon = button.querySelector('.button-icon');
      if (icon) {
        // Restore original icon
        if (button === this.elements.syncNowButton) {
          icon.textContent = '🔄';
        } else if (button === this.elements.testEmailButton) {
          icon.textContent = '📧';
        }
      }
    }
  }

  showMessage(text, type = 'info') {
    this.elements.message.textContent = text;
    this.elements.message.className = `message ${type} visible`;

    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.elements.message.classList.remove('visible');
    }, 3000);
  }

  getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PopupController };
}