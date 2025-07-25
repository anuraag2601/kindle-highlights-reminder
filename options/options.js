// Kindle Highlights Reminder - Options Page JavaScript

class OptionsController {
  constructor() {
    this.elements = {};
    this.init();
  }

  init() {
    this.bindElements();
    this.bindEventListeners();
    this.loadSettings();
  }

  bindElements() {
    this.elements = {
      email: document.getElementById('email'),
      emailTime: document.getElementById('email-time'),
      highlightsCount: document.getElementById('highlights-count'),
      autoSync: document.getElementById('auto-sync'),
      syncFrequency: document.getElementById('sync-frequency'),
      selectionMode: document.getElementById('selection-mode'),
      saveButton: document.getElementById('save-settings'),
      statusMessage: document.getElementById('status-message')
    };
  }

  bindEventListeners() {
    this.elements.saveButton.addEventListener('click', () => {
      this.saveSettings();
    });

    // Auto-save on input changes (with debouncing)
    Object.values(this.elements).forEach(element => {
      if (element && element.addEventListener) {
        element.addEventListener('input', () => {
          this.debounceAutoSave();
        });
      }
    });
  }

  async loadSettings() {
    try {
      const result = await this.sendMessage({ action: 'get-settings' });
      
      if (result.success) {
        this.populateSettings(result.data);
      } else {
        this.showStatus('Failed to load settings', 'error');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showStatus('Failed to load settings', 'error');
    }
  }

  populateSettings(settings) {
    if (settings.email) {
      this.elements.email.value = settings.email;
    }
    
    if (settings.emailTime) {
      this.elements.emailTime.value = settings.emailTime;
    }
    
    if (settings.highlightsPerEmail) {
      this.elements.highlightsCount.value = settings.highlightsPerEmail;
    }
    
    if (typeof settings.enableAutoSync === 'boolean') {
      this.elements.autoSync.checked = settings.enableAutoSync;
    }
    
    if (settings.syncFrequency) {
      this.elements.syncFrequency.value = settings.syncFrequency;
    }
    
    if (settings.highlightSelectionMode) {
      this.elements.selectionMode.value = settings.highlightSelectionMode;
    }
  }

  async saveSettings() {
    try {
      this.elements.saveButton.disabled = true;
      this.elements.saveButton.textContent = 'Saving...';

      const settings = this.collectSettings();
      const result = await this.sendMessage({ 
        action: 'save-settings', 
        settings 
      });

      if (result.success) {
        this.showStatus('Settings saved successfully!', 'success');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showStatus('Failed to save settings: ' + error.message, 'error');
    } finally {
      this.elements.saveButton.disabled = false;
      this.elements.saveButton.textContent = 'Save Settings';
    }
  }

  collectSettings() {
    return {
      email: this.elements.email.value.trim(),
      emailTime: this.elements.emailTime.value,
      highlightsPerEmail: parseInt(this.elements.highlightsCount.value, 10),
      enableAutoSync: this.elements.autoSync.checked,
      syncFrequency: parseInt(this.elements.syncFrequency.value, 10),
      highlightSelectionMode: this.elements.selectionMode.value
    };
  }

  debounceAutoSave() {
    clearTimeout(this.autoSaveTimeout);
    this.autoSaveTimeout = setTimeout(() => {
      this.saveSettings();
    }, 1000);
  }

  sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }

  showStatus(message, type = 'success') {
    this.elements.statusMessage.textContent = message;
    this.elements.statusMessage.className = `status-message visible ${type}`;

    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.elements.statusMessage.classList.remove('visible');
    }, 3000);
  }
}

// Initialize options controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OptionsController();
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OptionsController };
}