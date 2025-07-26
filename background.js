// Kindle Highlights Reminder - Background Service Worker
// Handles extension lifecycle, alarms, and message passing

// Import modules
importScripts('lib/database.js');
importScripts('lib/simple-email.js');
importScripts('lib/highlight-selector.js');
importScripts('lib/email-scheduler.js');

class BackgroundService {
  constructor() {
    this.isInitialized = false;
    this.emailService = simpleEmailService;
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
      
      // Show welcome page on install
      if (details.reason === 'install') {
        await this.showWelcomePage();
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
          console.log('Handling get-stats request...');
          const stats = await this.getHighlightStats();
          console.log('Sending stats response...');
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
          console.log('Handling get-settings request...');
          const settings = await this.getSettings();
          console.log('Sending settings response...');
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
    console.log('Cleared all existing alarms');
    
    const settings = await this.getSettings();
    console.log('Setting up alarms with settings:', {
      enableAutoSync: settings.enableAutoSync,
      syncFrequency: settings.syncFrequency,
      emailFrequency: settings.emailFrequency
    });
    
    // Set up sync alarm if auto-sync is enabled
    if (settings.enableAutoSync) {
      const periodInMinutes = settings.syncFrequency * 60;
      await chrome.alarms.create('sync-highlights', {
        periodInMinutes: periodInMinutes
      });
      console.log(`Created sync-highlights alarm with period: ${periodInMinutes} minutes (${settings.syncFrequency} hours)`);
    } else {
      console.log('Auto-sync is disabled, not creating sync alarm');
    }
    
    // Set up email scheduling via email scheduler
    if (settings.emailFrequency !== 'manual') {
      await this.emailScheduler.scheduleEmails(settings);
      console.log('Email scheduling set up');
    } else {
      console.log('Email frequency is manual, not scheduling emails');
    }
    
    // Log all current alarms
    const allAlarms = await chrome.alarms.getAll();
    console.log('All active alarms after setup:', allAlarms.map(a => ({
      name: a.name,
      scheduledTime: new Date(a.scheduledTime).toLocaleString(),
      periodInMinutes: a.periodInMinutes
    })));
  }

  async restoreAlarms() {
    const alarms = await chrome.alarms.getAll();
    console.log('Existing alarms:', alarms.map(a => a.name));
    
    // If no alarms exist, set them up
    if (alarms.length === 0) {
      await this.setupDefaultAlarms();
    }
  }

  async showWelcomePage() {
    try {
      // Open welcome page in new tab
      await chrome.tabs.create({
        url: chrome.runtime.getURL('onboarding/welcome.html'),
        active: true
      });
    } catch (error) {
      console.error('Failed to open welcome page:', error);
      // Fallback to notification
      if ('notifications' in chrome) {
        chrome.notifications.create('welcome', {
          type: 'basic',
          iconUrl: 'icons/icon-48.png',
          title: 'Kindle Highlights Reminder',
          message: 'Extension installed! Click the extension icon to get started.'
        });
      }
    }
  }

  async getHighlightStats() {
    try {
      console.log('Getting highlight stats...');
      
      // Initialize database with timeout
      const initPromise = database.init();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database init timeout')), 5000)
      );
      
      await Promise.race([initPromise, timeoutPromise]);
      console.log('Database initialized successfully');
      
      // Get actual stats from database with timeout
      const statsPromise = database.getStats();
      const statsTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Stats query timeout')), 5000)
      );
      
      const stats = await Promise.race([statsPromise, statsTimeoutPromise]);
      console.log('Stats retrieved:', stats);
      
      return stats;
    } catch (error) {
      console.error('Failed to get highlight stats:', error);
      return {
        totalHighlights: 0,
        totalBooks: 0,
        lastSyncTime: null,
        syncStatus: 'error',
        error: error.message
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
        
        // Wait for tab to be ready and content script to load
        await this.waitForTabReady(existingTab.id);
        
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

  async waitForTabReady(tabId) {
    console.log(`Waiting for tab ${tabId} to be ready...`);
    
    // Check tab status
    try {
      const tab = await chrome.tabs.get(tabId);
      console.log(`Tab status: ${tab.status}, URL: ${tab.url}`);
      
      if (tab.status !== 'complete') {
        console.log('Tab not complete, waiting...');
        await new Promise(resolve => {
          const listener = (changedTabId, changeInfo) => {
            if (changedTabId === tabId && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
          
          // Timeout after 10 seconds
          setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }, 10000);
        });
      }
      
      // Additional wait for content script to initialize
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.error('Error waiting for tab:', error);
    }
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
    console.log(`Performing sync on tab ${tabId}...`);
    
    // Wait for content script to load and try multiple times
    return this.performSyncWithRetry(tabId, 3);
  }

  async performSyncWithRetry(tabId, maxRetries) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`Sync attempt ${attempt}/${maxRetries} on tab ${tabId}...`);
      
      // Wait a bit longer on subsequent attempts
      if (attempt > 1) {
        const delay = attempt * 2000; // 2s, 4s, 6s
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const result = await this.trySyncOnTab(tabId);
      
      if (result.status !== 'error' || !result.message.includes('Could not establish connection')) {
        return result;
      }
      
      if (attempt === maxRetries) {
        return {
          status: 'error',
          message: 'Content script failed to load after multiple attempts. Please refresh the Amazon page and try again.'
        };
      }
      
      console.log(`Attempt ${attempt} failed, retrying...`);
    }
  }

  async testContentScript(tabId) {
    return new Promise((resolve) => {
      console.log('Testing if content script is available...');
      chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Content script not available:', chrome.runtime.lastError.message);
          resolve(false);
        } else {
          console.log('Content script responded to ping');
          resolve(true);
        }
      });
    });
  }

  async trySyncOnTab(tabId) {
    // First, test if content script is available
    const isAvailable = await this.testContentScript(tabId);
    if (!isAvailable) {
      return {
        status: 'error',
        message: 'Content script not available on this tab'
      };
    }
    
    return new Promise((resolve) => {
      // Send message to content script to start scraping
      console.log('Sending start-scraping message to content script...');
      chrome.tabs.sendMessage(tabId, { action: 'start-scraping' }, async (response) => {
        if (chrome.runtime.lastError) {
          console.error('Chrome runtime error:', chrome.runtime.lastError);
          resolve({
            status: 'error',
            message: 'Failed to communicate with content script: ' + chrome.runtime.lastError.message
          });
          return;
        }

        if (!response) {
          console.error('No response from content script');
          resolve({
            status: 'error',
            message: 'No response from content script. Make sure you are on the Amazon Kindle notebook page.'
          });
          return;
        }

        console.log('Received response from content script:', response);

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
          message: 'No email address configured. Please set your email in Settings.'
        };
      }

      console.log('Sending test email to:', email);
      const result = await this.emailService.sendTestEmail(email);
      
      // If the email service returned a mailto link, open it
      if (result.status === 'success' && result.mailto) {
        try {
          await chrome.tabs.create({ url: result.mailto });
          return {
            status: 'success',
            message: 'Email client opened with test highlights. Please send the email from your email client.',
            highlightCount: result.highlightCount
          };
        } catch (tabError) {
          console.error('Failed to open email client:', tabError);
          return {
            status: 'error',
            message: 'Failed to open email client. Please check your default email application.'
          };
        }
      }
      
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
          message: 'No email address configured. Please set your email in Settings.'
        };
      }

      console.log('Sending email immediately');
      
      // Get highlights from database
      await database.init();
      const highlights = await this.highlightSelector.selectHighlights(
        settings.highlightsPerEmail || 5,
        settings
      );
      
      if (highlights.length === 0) {
        return {
          status: 'error',
          message: 'No highlights available to send. Please sync your Kindle highlights first.'
        };
      }
      
      // Generate email
      const result = await this.emailService.sendHighlightEmail(highlights, settings);
      
      // If the email service returned a mailto link, open it
      if (result.status === 'success' && result.mailto) {
        try {
          await chrome.tabs.create({ url: result.mailto });
          
          // Update last shown timestamps for spaced repetition
          await this.highlightSelector.updateLastShownTimestamps(highlights);
          
          return {
            status: 'success',
            message: `Email client opened with ${highlights.length} highlights. Please send the email from your email client.`,
            highlightCount: highlights.length
          };
        } catch (tabError) {
          console.error('Failed to open email client:', tabError);
          return {
            status: 'error',
            message: 'Failed to open email client. Please check your default email application.'
          };
        }
      }
      
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
    try {
      console.log('Getting settings...');
      const result = await chrome.storage.local.get('settings');
      console.log('Settings retrieved:', result.settings ? 'Found' : 'Not found');
      return result.settings || {};
    } catch (error) {
      console.error('Failed to get settings:', error);
      return {};
    }
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
    console.log('Performing scheduled auto-sync...');
    
    try {
      // Get settings to check if auto-sync is enabled
      const settings = await this.getSettings();
      
      if (!settings.enableAutoSync) {
        console.log('Auto-sync is disabled, skipping scheduled sync');
        return { status: 'disabled', message: 'Auto-sync is disabled' };
      }
      
      // Check if user is on Amazon Kindle notebook page
      const tabs = await this.getKindleNotebookTabs();
      
      if (tabs.length === 0) {
        console.log('No Kindle notebook tabs found for auto-sync, skipping');
        return {
          status: 'skipped',
          message: 'No Amazon Kindle notebook page found for auto-sync'
        };
      }
      
      // Use the first available tab
      const tab = tabs[0];
      console.log(`Performing scheduled sync on tab ${tab.id}`);
      
      // For auto-sync, don't bring tab to focus to avoid interrupting user
      // Perform the sync
      const result = await this.performSyncOnTab(tab.id);
      
      console.log('Scheduled sync completed:', result);
      return result;
      
    } catch (error) {
      console.error('Scheduled sync failed:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
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