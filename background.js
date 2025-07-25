// Kindle Highlights Reminder - Background Service Worker
// Handles extension lifecycle, alarms, and message passing

// Import database module (we'll create this next)
// import { Database } from './lib/database.js';

class BackgroundService {
  constructor() {
    this.isInitialized = false;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Extension installation/startup
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstalled(details);
    });

    chrome.runtime.onStartup.addListener(() => {
      this.handleStartup();
    });

    // Message handling from popup and content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Alarm handling for scheduled tasks
    chrome.alarms.onAlarm.addListener((alarm) => {
      this.handleAlarm(alarm);
    });

    // Tab updates for Amazon page detection
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });
  }

  async handleInstalled(details) {
    console.log('Extension installed:', details.reason);
    
    try {
      // Initialize default settings
      await this.initializeDefaultSettings();
      
      // Set up default alarms
      await this.setupDefaultAlarms();
      
      // Show welcome notification
      if (details.reason === 'install') {
        await this.showWelcomeNotification();
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize extension:', error);
    }
  }

  async handleStartup() {
    console.log('Extension startup');
    try {
      // Restore alarms and check settings
      await this.restoreAlarms();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to start extension:', error);
    }
  }

  async handleMessage(request, sender, sendResponse) {
    console.log('Received message:', request.action);
    
    try {
      switch (request.action) {
        case 'get-stats':
          const stats = await this.getHighlightStats();
          sendResponse({ success: true, data: stats });
          break;
          
        case 'sync-now':
          const syncResult = await this.initiateSync();
          sendResponse({ success: true, data: syncResult });
          break;
          
        case 'send-test-email':
          const emailResult = await this.sendTestEmail();
          sendResponse({ success: true, data: emailResult });
          break;
          
        case 'get-settings':
          const settings = await this.getSettings();
          sendResponse({ success: true, data: settings });
          break;
          
        case 'save-settings':
          await this.saveSettings(request.settings);
          sendResponse({ success: true });
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Message handling error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleAlarm(alarm) {
    console.log('Alarm triggered:', alarm.name);
    
    try {
      switch (alarm.name) {
        case 'sync-highlights':
          await this.performScheduledSync();
          break;
          
        case 'send-email':
          await this.sendScheduledEmail();
          break;
          
        default:
          console.warn('Unknown alarm:', alarm.name);
      }
    } catch (error) {
      console.error('Alarm handling error:', error);
    }
  }

  handleTabUpdate(tabId, changeInfo, tab) {
    // Check if user navigated to Amazon Kindle notebook
    if (changeInfo.status === 'complete' && 
        tab.url && 
        tab.url.includes('read.amazon.com/notebook')) {
      
      console.log('Amazon notebook page detected');
      // Could show page action or notification here
      this.onAmazonNotebookDetected(tabId, tab);
    }
  }

  async initializeDefaultSettings() {
    const defaultSettings = {
      email: '',
      emailFrequency: 'daily',
      emailTime: '09:00',
      highlightsPerEmail: 5,
      syncFrequency: 6, // hours
      emailService: 'emailjs',
      emailCredentials: {
        publicKey: 'FBGMS4hwXj_Pz5KYH',
        serviceId: 'service_i5a2wlo',
        templateId: 'template_pzja6so'
      },
      enableAutoSync: true,
      enableNotifications: true,
      highlightSelectionMode: 'spaced-repetition',
      lastSyncTime: null,
      totalHighlights: 0,
      totalBooks: 0
    };

    // Only set defaults if no settings exist
    const existing = await chrome.storage.local.get('settings');
    if (!existing.settings) {
      await chrome.storage.local.set({ settings: defaultSettings });
      console.log('Default settings initialized');
    }
  }

  async setupDefaultAlarms() {
    // Clear existing alarms
    await chrome.alarms.clearAll();
    
    const settings = await this.getSettings();
    
    // Set up sync alarm if auto-sync is enabled
    if (settings.enableAutoSync) {
      await chrome.alarms.create('sync-highlights', {
        periodInMinutes: settings.syncFrequency * 60
      });
    }
    
    // Set up email alarm
    const emailTime = this.getNextEmailTime(settings.emailTime);
    await chrome.alarms.create('send-email', {
      when: emailTime
    });
    
    console.log('Default alarms set up');
  }

  async restoreAlarms() {
    const alarms = await chrome.alarms.getAll();
    console.log('Existing alarms:', alarms.map(a => a.name));
    
    // If no alarms exist, set them up
    if (alarms.length === 0) {
      await this.setupDefaultAlarms();
    }
  }

  async showWelcomeNotification() {
    if ('notifications' in chrome) {
      chrome.notifications.create('welcome', {
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Kindle Highlights Reminder',
        message: 'Extension installed! Click the extension icon to get started.'
      });
    }
  }

  async getHighlightStats() {
    // TODO: Implement when database is ready
    // For now, return mock data
    return {
      totalHighlights: 0,
      totalBooks: 0,
      lastSyncTime: null,
      syncStatus: 'never_synced'
    };
  }

  async initiateSync() {
    // TODO: Implement sync logic
    console.log('Sync initiated - not yet implemented');
    return {
      status: 'not_implemented',
      message: 'Sync functionality will be implemented in Milestone 2'
    };
  }

  async sendTestEmail() {
    // TODO: Implement email sending
    console.log('Test email requested - not yet implemented');
    return {
      status: 'not_implemented',
      message: 'Email functionality will be implemented in Milestone 4'
    };
  }

  async getSettings() {
    const result = await chrome.storage.local.get('settings');
    return result.settings || {};
  }

  async saveSettings(newSettings) {
    const currentSettings = await this.getSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };
    await chrome.storage.local.set({ settings: updatedSettings });
    
    // Update alarms if sync settings changed
    if (newSettings.syncFrequency || newSettings.enableAutoSync) {
      await this.setupDefaultAlarms();
    }
    
    console.log('Settings saved');
  }

  async performScheduledSync() {
    console.log('Performing scheduled sync');
    // TODO: Implement in Milestone 2
  }

  async sendScheduledEmail() {
    console.log('Sending scheduled email');
    // TODO: Implement in Milestone 4
  }

  onAmazonNotebookDetected(tabId, tab) {
    console.log('Amazon notebook page detected, could trigger sync');
    // TODO: Show page action or offer to sync
  }

  getNextEmailTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const now = new Date();
    const emailTime = new Date();
    
    emailTime.setHours(hours, minutes, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (emailTime <= now) {
      emailTime.setDate(emailTime.getDate() + 1);
    }
    
    return emailTime.getTime();
  }
}

// Initialize the background service
const backgroundService = new BackgroundService();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BackgroundService };
}