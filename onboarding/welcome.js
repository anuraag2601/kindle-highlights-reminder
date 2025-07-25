// Welcome/Onboarding JavaScript - Milestone 5
// Handles user onboarding flow and initial setup

class WelcomeController {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 5;
    this.userData = {
      email: '',
      emailTime: '09:00',
      emailFrequency: 'daily',
      highlightsPerEmail: 5
    };
    this.init();
  }

  init() {
    this.bindEventListeners();
    this.updateProgress();
    this.loadUserData();
  }

  bindEventListeners() {
    // Range input for highlights count
    const countRange = document.getElementById('welcome-count');
    const countValue = document.getElementById('count-value');
    
    if (countRange && countValue) {
      countRange.addEventListener('input', (e) => {
        countValue.textContent = e.target.value;
        this.userData.highlightsPerEmail = parseInt(e.target.value);
      });
    }

    // Form inputs
    const emailInput = document.getElementById('welcome-email');
    const timeInput = document.getElementById('welcome-time');
    const frequencySelect = document.getElementById('welcome-frequency');

    if (emailInput) {
      emailInput.addEventListener('change', (e) => {
        this.userData.email = e.target.value;
        this.validateEmail();
      });
    }

    if (timeInput) {
      timeInput.addEventListener('change', (e) => {
        this.userData.emailTime = e.target.value;
      });
    }

    if (frequencySelect) {
      frequencySelect.addEventListener('change', (e) => {
        this.userData.emailFrequency = e.target.value;
      });
    }

    // Modal close
    window.addEventListener('click', (e) => {
      const modal = document.getElementById('email-preview-modal');
      if (e.target === modal) {
        this.closeModal();
      }
    });
  }

  async loadUserData() {
    try {
      // Try to load existing settings
      const result = await chrome.storage.local.get('settings');
      if (result.settings) {
        const settings = result.settings;
        this.userData = {
          email: settings.email || '',
          emailTime: settings.emailTime || '09:00',
          emailFrequency: settings.emailFrequency || 'daily',
          highlightsPerEmail: settings.highlightsPerEmail || 5
        };
        this.populateForm();
      }
    } catch (error) {
      console.warn('Could not load existing settings:', error);
    }
  }

  populateForm() {
    const emailInput = document.getElementById('welcome-email');
    const timeInput = document.getElementById('welcome-time');
    const frequencySelect = document.getElementById('welcome-frequency');
    const countRange = document.getElementById('welcome-count');
    const countValue = document.getElementById('count-value');

    if (emailInput) emailInput.value = this.userData.email;
    if (timeInput) timeInput.value = this.userData.emailTime;
    if (frequencySelect) frequencySelect.value = this.userData.emailFrequency;
    if (countRange) countRange.value = this.userData.highlightsPerEmail;
    if (countValue) countValue.textContent = this.userData.highlightsPerEmail;
  }

  nextStep() {
    if (this.currentStep < this.totalSteps) {
      // Validate current step before proceeding
      if (this.validateCurrentStep()) {
        this.hideStep(this.currentStep);
        this.currentStep++;
        this.showStep(this.currentStep);
        this.updateProgress();
        this.saveUserData();
      }
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.hideStep(this.currentStep);
      this.currentStep--;
      this.showStep(this.currentStep);
      this.updateProgress();
    }
  }

  showStep(stepNumber) {
    const step = document.getElementById(`step-${stepNumber}`);
    if (step) {
      step.classList.add('active');
      
      // Special handling for specific steps
      if (stepNumber === 4) {
        this.updateConfigDisplay();
      } else if (stepNumber === 5) {
        this.updateCompletionStats();
      }
    }
  }

  hideStep(stepNumber) {
    const step = document.getElementById(`step-${stepNumber}`);
    if (step) {
      step.classList.remove('active');
    }
  }

  updateProgress() {
    const progressFill = document.getElementById('progress-fill');
    const currentStepSpan = document.getElementById('current-step');
    
    if (progressFill) {
      const percentage = (this.currentStep / this.totalSteps) * 100;
      progressFill.style.width = `${percentage}%`;
    }
    
    if (currentStepSpan) {
      currentStepSpan.textContent = this.currentStep;
    }
  }

  validateCurrentStep() {
    switch (this.currentStep) {
      case 2: // Email setup
        return this.validateEmail();
      case 3: // Sync setup
        // Don't require sync to proceed
        return true;
      default:
        return true;
    }
  }

  validateEmail() {
    const email = this.userData.email;
    if (email && !this.isValidEmail(email)) {
      this.showMessage('Please enter a valid email address', 'error');
      return false;
    }
    return true;
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async saveUserData() {
    try {
      // Get existing settings and merge with user data
      const result = await chrome.storage.local.get('settings');
      const currentSettings = result.settings || {};
      
      const updatedSettings = {
        ...currentSettings,
        ...this.userData,
        onboardingCompleted: this.currentStep >= this.totalSteps
      };

      await chrome.storage.local.set({ settings: updatedSettings });
    } catch (error) {
      console.error('Failed to save user data:', error);
    }
  }

  async openAmazon() {
    try {
      const tab = await chrome.tabs.create({
        url: 'https://read.amazon.com/notebook',
        active: true
      });
      
      // Enable sync button after opening Amazon
      const syncBtn = document.getElementById('sync-btn');
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.textContent = '🔄 Sync My Highlights';
      }
      
      this.showSyncStatus('Amazon Kindle notebook opened. Make sure you\'re logged in, then click "Sync My Highlights"', 'info');
    } catch (error) {
      this.showSyncStatus('Failed to open Amazon page. Please go to read.amazon.com/notebook manually.', 'error');
    }
  }

  async startSync() {
    const syncBtn = document.getElementById('sync-btn');
    const step3Next = document.getElementById('step3-next');
    
    if (syncBtn) {
      syncBtn.disabled = true;
      syncBtn.textContent = '🔄 Syncing...';
    }
    
    this.showSyncStatus('Starting sync...', 'info');
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'sync-now' });
      
      if (response.success) {
        if (response.data.status === 'success') {
          this.showSyncStatus(
            `✅ Sync completed! Found ${response.data.totalHighlights || 0} highlights from ${response.data.totalBooks || 0} books.`,
            'success'
          );
          if (step3Next) step3Next.disabled = false;
        } else if (response.data.status === 'redirect') {
          this.showSyncStatus(response.data.message, 'info');
        } else {
          this.showSyncStatus('Sync completed with some issues. You can continue with setup.', 'info');
          if (step3Next) step3Next.disabled = false;
        }
      } else {
        throw new Error(response.error || 'Sync failed');
      }
    } catch (error) {
      this.showSyncStatus(`Sync failed: ${error.message}. You can continue and try syncing later.`, 'error');
      if (step3Next) step3Next.disabled = false;
    } finally {
      if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.textContent = '🔄 Sync My Highlights';
      }
    }
  }

  showSyncStatus(message, type) {
    const statusDiv = document.getElementById('sync-status');
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = `sync-status ${type}`;
    }
  }

  async sendTestEmail() {
    const testBtn = document.getElementById('test-email-btn');
    
    if (testBtn) {
      testBtn.disabled = true;
      testBtn.textContent = '📧 Sending...';
    }
    
    this.showTestStatus('Sending test email...', 'info');
    
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'send-test-email',
        email: this.userData.email
      });
      
      if (response.success && response.data.status === 'success') {
        this.showTestStatus('✅ Test email sent successfully! Check your inbox.', 'success');
      } else {
        throw new Error(response.data?.message || response.error || 'Test email failed');
      }
    } catch (error) {
      this.showTestStatus(`❌ Test email failed: ${error.message}`, 'error');
    } finally {
      if (testBtn) {
        testBtn.disabled = false;
        testBtn.textContent = '📧 Send Test Email';
      }
    }
  }

  async previewEmail() {
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'preview-email',
        count: this.userData.highlightsPerEmail
      });
      
      if (response.success) {
        this.showEmailPreview(response.data.preview);
      } else {
        throw new Error(response.error || 'Preview failed');
      }
    } catch (error) {
      this.showTestStatus(`Preview failed: ${error.message}`, 'error');
    }
  }

  showEmailPreview(preview) {
    const modal = document.getElementById('email-preview-modal');
    const content = document.getElementById('email-preview-content');
    
    if (modal && content) {
      content.innerHTML = preview.htmlContent || '<p>No preview available</p>';
      modal.style.display = 'block';
    }
  }

  closeModal() {
    const modal = document.getElementById('email-preview-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  showTestStatus(message, type) {
    const statusDiv = document.getElementById('test-status');
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = `test-status ${type}`;
    }
  }

  updateConfigDisplay() {
    const display = document.getElementById('config-display');
    if (display) {
      display.innerHTML = `
        <strong>Email:</strong> ${this.userData.email || 'Not set'}<br>
        <strong>Time:</strong> ${this.userData.emailTime}<br>
        <strong>Frequency:</strong> ${this.userData.emailFrequency}<br>
        <strong>Highlights per email:</strong> ${this.userData.highlightsPerEmail}
      `;
    }
  }

  async updateCompletionStats() {
    const statsDiv = document.getElementById('completion-stats');
    if (!statsDiv) return;
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'get-stats' });
      const stats = response.success ? response.data : {};
      
      statsDiv.innerHTML = `
        <h3>🎉 Your Setup is Complete!</h3>
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-number">${stats.totalBooks || 0}</span>
            <span class="stat-label">Books</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">${stats.totalHighlights || 0}</span>
            <span class="stat-label">Highlights</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">${this.userData.email ? '✓' : '✗'}</span>
            <span class="stat-label">Email Setup</span>
          </div>
          <div class="stat-item">
            <span class="stat-number">${this.userData.highlightsPerEmail}</span>
            <span class="stat-label">Per Email</span>
          </div>
        </div>
      `;
    } catch (error) {
      statsDiv.innerHTML = `
        <h3>🎉 Your Setup is Complete!</h3>
        <p>Ready to start learning with your Kindle highlights!</p>
      `;
    }
  }

  async openSettings() {
    try {
      await chrome.runtime.openOptionsPage();
    } catch (error) {
      // Fallback: open settings in new tab
      chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
    }
  }

  openExtension() {
    // This will close the onboarding and let user access the extension popup
    window.close();
  }

  async finishOnboarding() {
    try {
      await this.saveUserData();
      
      // Mark onboarding as completed
      const result = await chrome.storage.local.get('settings');
      const settings = result.settings || {};
      settings.onboardingCompleted = true;
      settings.welcomeShown = true;
      await chrome.storage.local.set({ settings });
      
      // Close onboarding window
      window.close();
    } catch (error) {
      console.error('Failed to finish onboarding:', error);
      // Still close the window
      window.close();
    }
  }

  showMessage(message, type) {
    // Create a temporary message element
    const messageDiv = document.createElement('div');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 15px 20px;
      border-radius: 10px;
      color: white;
      font-weight: 600;
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
    `;
    
    if (type === 'error') {
      messageDiv.style.background = '#dc3545';
    } else if (type === 'success') {
      messageDiv.style.background = '#28a745';
    } else {
      messageDiv.style.background = '#17a2b8';
    }
    
    document.body.appendChild(messageDiv);
    
    // Remove after 5 seconds
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv);
      }
    }, 5000);
  }
}

// Global functions for HTML onclick handlers
let welcomeController;

function nextStep() {
  welcomeController.nextStep();
}

function prevStep() {
  welcomeController.prevStep();
}

function openAmazon() {
  welcomeController.openAmazon();
}

function startSync() {
  welcomeController.startSync();
}

function sendTestEmail() {
  welcomeController.sendTestEmail();
}

function previewEmail() {
  welcomeController.previewEmail();
}

function closeModal() {
  welcomeController.closeModal();
}

function openSettings() {
  welcomeController.openSettings();
}

function openExtension() {
  welcomeController.openExtension();
}

function finishOnboarding() {
  welcomeController.finishOnboarding();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  welcomeController = new WelcomeController();
});