// Kindle Highlights Reminder - Background Service Worker
// Handles extension lifecycle, alarms, and message passing

// Import modules
importScripts('lib/database.js');
importScripts('lib/email-service.js');
importScripts('lib/highlight-selector.js');
importScripts('lib/email-scheduler.js');

class BackgroundService {
  constructor() {
    this.isInitialized = false;
    this.emailService = emailService;
    this.highlightSelector = new HighlightSelector(database);
    this.emailScheduler = emailScheduler;
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
      
      // Initialize email system
      await this.initializeEmailSystem();
      
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
          const emailResult = await this.sendTestEmail(request.email);
          sendResponse({ success: emailResult.status === 'success', data: emailResult });
          break;
          
        case 'send-email-now':
          const immediateResult = await this.sendEmailNow();
          sendResponse({ success: immediateResult.status === 'success', data: immediateResult });
          break;
          
        case 'preview-email':
          const previewResult = await this.previewEmail(request.count);
          sendResponse({ success: previewResult.status === 'success', data: previewResult });
          break;
          
        case 'get-email-stats':
          const statsResult = await this.getEmailStats();
          sendResponse({ success: statsResult.status === 'success', data: statsResult });
          break;
          
        case 'get-settings':
          const settings = await this.getSettings();
          sendResponse({ success: true, data: settings });
          break;
          
        case 'save-settings':
          await this.saveSettings(request.settings);
          // Update email schedule when settings change
          await this.updateEmailSchedule(request.settings);
          sendResponse({ success: true });
          break;

        case 'scraping-progress':
          // Handle progress updates from content script
          this.handleScrapingProgress(request.progress);
          sendResponse({ success: true });
          break;

        case 'page-detected':
          // Handle page detection from content script
          console.log('Kindle notebook page detected:', request.url);
          sendResponse({ success: true });
          break;

        case 'auth-required':
          // Handle authentication required
          console.log('Authentication required for scraping');
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
          
        case 'kindle-highlights-reminder':
          await this.emailScheduler.handleAlarmTriggered(alarm);
          break;
          
        default:
          // Handle other alarms (like test alarms)
          if (alarm.name.startsWith('test-')) {
            console.log('Test alarm triggered:', alarm.name);
          } else {
            console.warn('Unknown alarm:', alarm.name);
          }
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
    
    // Set up email scheduling via email scheduler
    if (settings.emailFrequency !== 'manual') {
      await this.emailScheduler.scheduleEmails(settings);
    }
    
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
    try {
      // Initialize database if needed
      await database.init();
      
      // Get actual stats from database
      const stats = await database.getStats();
      
      return stats;
    } catch (error) {
      console.error('Failed to get highlight stats:', error);
      return {
        totalHighlights: 0,
        totalBooks: 0,
        lastSyncTime: null,
        syncStatus: 'error'
      };
    }
  }

  async initiateSync() {
    console.log('Initiating sync with Amazon Kindle notebook...');
    
    try {
      // Check if user is already on Amazon Kindle notebook page
      const tabs = await this.getKindleNotebookTabs();
      
      if (tabs.length === 0) {
        // No existing notebook tab found - guide user to Amazon using existing session
        const guideResult = await this.guideUserToAmazon();
        
        // Return guide result - user will need to click sync again after logging in
        return {
          status: 'redirect',
          message: guideResult.message,
          tabId: guideResult.tabId,
          action: 'manual_sync_required'
        };
      } else {
        // Use existing tab - this should have the proper login session
        const existingTab = tabs[0];
        
        // Bring the tab to focus so user can see what's happening
        await chrome.tabs.update(existingTab.id, { active: true });
        
        // Small delay to ensure tab is focused and content script loads
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        return this.performSyncOnTab(existingTab.id);
      }
      
    } catch (error) {
      console.error('Sync initiation failed:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  async getKindleNotebookTabs() {
    const tabs = await chrome.tabs.query({
      url: ['*://read.amazon.com/notebook*', '*://read.amazon.com/kp/notebook*']
    });
    return tabs;
  }

  // Alternative sync method: Guide user to open Amazon in their current session
  async guideUserToAmazon() {
    try {
      // First, try to find any Amazon tab that's already logged in
      const amazonTabs = await chrome.tabs.query({
        url: ['*://amazon.com/*', '*://*.amazon.com/*']
      });

      if (amazonTabs.length > 0) {
        // User has Amazon tabs open - navigate one to the notebook page
        const amazonTab = amazonTabs[0];
        await chrome.tabs.update(amazonTab.id, {
          url: 'https://read.amazon.com/notebook',
          active: true
        });
        
        return {
          status: 'navigated',
          message: 'Navigated to Kindle notebook page. Once you can see your books, click "Sync Now" again.',
          tabId: amazonTab.id
        };
      } else {
        // No Amazon tabs - open a new one
        const tab = await chrome.tabs.create({
          url: 'https://read.amazon.com/notebook',
          active: true
        });
        
        return {
          status: 'created',
          message: 'Opened Amazon Kindle notebook page. Please log in if needed, then click "Sync Now" again.',
          tabId: tab.id
        };
      }
    } catch (error) {
      console.error('Failed to guide user to Amazon:', error);
      return {
        status: 'error',
        message: 'Please manually go to read.amazon.com/notebook and try sync again.'
      };
    }
  }

  async performSyncOnTab(tabId) {
    return new Promise((resolve) => {
      // Send message to content script to start scraping
      chrome.tabs.sendMessage(tabId, { action: 'start-scraping' }, async (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            status: 'error',
            message: 'Failed to communicate with content script: ' + chrome.runtime.lastError.message
          });
          return;
        }

        if (!response) {
          resolve({
            status: 'error',
            message: 'No response from content script'
          });
          return;
        }

        if (response.status === 'success') {
          // Store the scraped data in the database
          const storeResult = await this.storeScrapedData(response.data);
          
          // Record sync history
          await this.recordSyncHistory(response.data, storeResult);
          
          // Update settings with new stats
          await this.updateSyncStats(response.data);
          
          resolve({
            status: 'success',
            message: `Successfully synced ${response.data.highlights.length} highlights from ${response.data.books.length} books`,
            data: {
              totalBooks: response.data.books.length,
              totalHighlights: response.data.highlights.length,
              errors: response.data.stats?.errors || []
            }
          });
        } else {
          resolve(response);
        }
      });
    });
  }

  async storeScrapedData(scrapedData) {
    const { books, highlights } = scrapedData;
    const results = {
      booksAdded: 0,
      highlightsAdded: 0,
      errors: []
    };

    try {
      // Initialize database
      await database.init();

      // Store books first
      for (const book of books) {
        try {
          // Remove sourceElement before storing
          const cleanBook = { ...book };
          delete cleanBook.sourceElement;
          
          await database.addBook(cleanBook);
          results.booksAdded++;
        } catch (error) {
          console.warn('Error storing book:', error);
          results.errors.push({
            type: 'book',
            item: book.title,
            error: error.message
          });
        }
      }

      // Store highlights
      for (const highlight of highlights) {
        try {
          await database.addHighlight(highlight);
          results.highlightsAdded++;
        } catch (error) {
          console.warn('Error storing highlight:', error);
          results.errors.push({
            type: 'highlight',
            item: highlight.text.substring(0, 50) + '...',
            error: error.message
          });
        }
      }

      console.log(`Stored ${results.booksAdded} books and ${results.highlightsAdded} highlights`);
      return results;

    } catch (error) {
      console.error('Database storage failed:', error);
      results.errors.push({
        type: 'database',
        item: 'initialization',
        error: error.message
      });
      return results;
    }
  }

  async recordSyncHistory(scrapedData, storeResult) {
    try {
      await database.addSyncRecord({
        highlightsAdded: storeResult.highlightsAdded,
        highlightsTotal: scrapedData.highlights.length,
        status: storeResult.errors.length > 0 ? 'partial' : 'success',
        errorMessage: storeResult.errors.length > 0 ? 
          `${storeResult.errors.length} items failed to store` : ''
      });
    } catch (error) {
      console.error('Failed to record sync history:', error);
    }
  }

  async updateSyncStats(scrapedData) {
    try {
      const currentSettings = await this.getSettings();
      await this.saveSettings({
        ...currentSettings,
        lastSyncTime: Date.now(),
        totalBooks: scrapedData.books.length,
        totalHighlights: scrapedData.highlights.length
      });
    } catch (error) {
      console.error('Failed to update sync stats:', error);
    }
  }

  async initializeEmailSystem() {
    try {
      await database.init();
      await this.emailScheduler.init(database, this.emailService, this.highlightSelector);
      console.log('Email system initialized');
    } catch (error) {
      console.error('Failed to initialize email system:', error);
    }
  }

  async sendTestEmail(email) {
    try {
      if (!email) {
        const settings = await this.getSettings();
        email = settings.email;
      }
      
      if (!email) {
        return {
          status: 'error',
          message: 'No email address provided'
        };
      }

      console.log('Sending test email to:', email);
      const result = await this.emailService.sendTestEmail(email);
      
      return result;
    } catch (error) {
      console.error('Failed to send test email:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  async sendEmailNow() {
    try {
      const settings = await this.getSettings();
      
      if (!settings.email) {
        return {
          status: 'error',
          message: 'No email address configured'
        };
      }

      console.log('Sending email immediately');
      const result = await this.emailScheduler.sendEmailNow(settings);
      
      return result;
    } catch (error) {
      console.error('Failed to send email now:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  async previewEmail(count = 5) {
    try {
      const settings = await this.getSettings();
      
      // Select highlights for preview
      const selectionResult = await this.highlightSelector.previewSelection(
        count,
        settings
      );

      if (selectionResult.status !== 'success') {
        return selectionResult;
      }

      // Generate email preview  
      const previewResult = await this.emailService.generateEmailPreview(
        selectionResult.highlights,
        settings
      );

      return {
        status: 'success',
        preview: previewResult.preview,
        selectionInfo: {
          totalAvailable: selectionResult.totalAvailable,
          filteredCount: selectionResult.filteredCount,
          algorithm: selectionResult.algorithm
        }
      };
    } catch (error) {
      console.error('Failed to preview email:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  async getEmailStats() {
    try {
      const [emailStats, schedulingStats] = await Promise.all([
        this.emailService.getEmailStats(),
        this.emailScheduler.getSchedulingStats()
      ]);

      return {
        status: 'success',
        emailStats: emailStats.status === 'success' ? emailStats.stats : null,
        scheduling: schedulingStats.status === 'success' ? schedulingStats.scheduling : null
      };
    } catch (error) {
      console.error('Failed to get email stats:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  async updateEmailSchedule(settings) {
    try {
      if (settings.emailFrequency && settings.emailTime) {
        await this.emailScheduler.updateSchedule(settings);
        console.log('Email schedule updated');
      }
    } catch (error) {
      console.error('Failed to update email schedule:', error);
    }
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

  handleScrapingProgress(progress) {
    console.log('Scraping progress:', progress);
    
    // Could show progress notification or update popup if needed
    if (progress.errors > 0) {
      console.warn(`Scraping has ${progress.errors} errors so far`);
    }
    
    // Store progress for popup to show
    this.currentScrapingProgress = progress;
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