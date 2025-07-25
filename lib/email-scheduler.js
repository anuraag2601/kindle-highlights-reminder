// Kindle Highlights Reminder - Email Scheduler
// Handles scheduled email sending using Chrome alarms API

class EmailScheduler {
  constructor() {
    this.alarmName = 'kindle-highlights-reminder';
    this.database = null;
    this.emailService = null;
    this.highlightSelector = null;
  }

  // Initialize scheduler with dependencies
  async init(database, emailService, highlightSelector) {
    try {
      this.database = database;
      this.emailService = emailService;
      this.highlightSelector = highlightSelector;
      
      // Initialize email service
      await this.emailService.init(database);
      
      console.log('Email scheduler initialized');
      return { status: 'success' };
      
    } catch (error) {
      console.error('Failed to initialize email scheduler:', error);
      return { status: 'error', message: error.message };
    }
  }

  // Schedule emails based on user settings
  async scheduleEmails(userSettings) {
    try {
      // Clear existing alarms
      await this.clearScheduledEmails();
      
      // Don't schedule if email frequency is manual
      if (userSettings.emailFrequency === 'manual') {
        console.log('Email frequency set to manual, no scheduling');
        return { status: 'success', message: 'Email scheduling disabled (manual mode)' };
      }

      // Calculate when to send the next email
      const nextEmailTime = this.calculateNextEmailTime(userSettings);
      
      if (!nextEmailTime) {
        throw new Error('Failed to calculate next email time');
      }

      // Create Chrome alarm
      if (typeof chrome !== 'undefined' && chrome.alarms) {
        chrome.alarms.create(this.alarmName, {
          when: nextEmailTime,
          periodInMinutes: this.getAlarmPeriod(userSettings.emailFrequency)
        });
        
        console.log(`Email scheduled for: ${new Date(nextEmailTime).toLocaleString()}`);
        
        return {
          status: 'success',
          nextEmailTime: nextEmailTime,
          frequency: userSettings.emailFrequency,
          message: `Next email scheduled for ${new Date(nextEmailTime).toLocaleString()}`
        };
      } else {
        console.warn('Chrome alarms API not available');
        return {
          status: 'error',
          message: 'Chrome alarms API not available'
        };
      }

    } catch (error) {
      console.error('Failed to schedule emails:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  // Calculate next email time based on user settings
  calculateNextEmailTime(userSettings) {
    const now = new Date();
    const [hours, minutes] = userSettings.emailTime.split(':').map(Number);
    
    // Create target time for today
    const today = new Date(now);
    today.setHours(hours, minutes, 0, 0);
    
    // If target time has passed today, schedule for tomorrow
    const targetTime = today.getTime() <= now.getTime() 
      ? new Date(today.getTime() + 24 * 60 * 60 * 1000)
      : today;
    
    // For weekly emails, find next occurrence of the target day
    if (userSettings.emailFrequency === 'weekly') {
      const targetDay = userSettings.emailDay || 1; // Default to Monday
      const currentDay = targetTime.getDay();
      const daysUntilTarget = (targetDay - currentDay + 7) % 7;
      
      if (daysUntilTarget > 0 || (daysUntilTarget === 0 && targetTime.getTime() <= now.getTime())) {
        targetTime.setDate(targetTime.getDate() + (daysUntilTarget || 7));
      }
    }
    
    return targetTime.getTime();
  }

  // Get alarm period in minutes for Chrome alarms
  getAlarmPeriod(frequency) {
    switch (frequency) {
      case 'daily':
        return 24 * 60; // 24 hours in minutes
      case 'weekly':
        return 7 * 24 * 60; // 7 days in minutes
      default:
        return null; // No periodic alarm
    }
  }

  // Clear scheduled emails
  async clearScheduledEmails() {
    try {
      if (typeof chrome !== 'undefined' && chrome.alarms) {
        return new Promise((resolve) => {
          chrome.alarms.clear(this.alarmName, (wasCleared) => {
            console.log(`Email alarm cleared: ${wasCleared}`);
            resolve({ status: 'success', wasCleared });
          });
        });
      } else {
        return { status: 'error', message: 'Chrome alarms API not available' };
      }
    } catch (error) {
      console.error('Failed to clear scheduled emails:', error);
      return { status: 'error', message: error.message };
    }
  }

  // Handle alarm triggered event (call from background script)
  async handleAlarmTriggered(alarm) {
    try {
      if (alarm.name !== this.alarmName) {
        return { status: 'ignored', message: 'Not our alarm' };
      }

      console.log('Email reminder alarm triggered');
      
      // Get user settings
      const userSettings = await this.getUserSettings();
      if (!userSettings) {
        throw new Error('Failed to get user settings');
      }

      // Send scheduled email
      const result = await this.sendScheduledEmail(userSettings);
      
      // Log the result
      console.log('Scheduled email result:', result);
      
      return result;

    } catch (error) {
      console.error('Failed to handle alarm trigger:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  // Send scheduled email
  async sendScheduledEmail(userSettings) {
    try {
      // Select highlights for the email
      const selectionResult = await this.highlightSelector.selectHighlights(
        userSettings.highlightsPerEmail || 5,
        userSettings
      );

      if (selectionResult.status !== 'success') {
        throw new Error(`Failed to select highlights: ${selectionResult.message}`);
      }

      if (selectionResult.highlights.length === 0) {
        return {
          status: 'success',
          message: 'No highlights available for email',
          highlightCount: 0
        };
      }

      // Send the email
      const emailResult = await this.emailService.sendHighlightEmail(
        selectionResult.highlights,
        userSettings
      );

      if (emailResult.status === 'success') {
        // Mark highlights as shown
        await this.highlightSelector.markHighlightsAsShown(
          selectionResult.highlights.map(h => h.id)
        );

        // Show notification if enabled
        if (userSettings.enableNotifications) {
          this.showNotification(emailResult.highlightCount, userSettings.email);
        }
      }

      return {
        status: emailResult.status,
        message: emailResult.status === 'success' 
          ? `Email sent successfully with ${emailResult.highlightCount} highlights`
          : emailResult.message,
        highlightCount: emailResult.highlightCount,
        recipient: emailResult.recipient
      };

    } catch (error) {
      console.error('Failed to send scheduled email:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  // Get user settings from storage
  async getUserSettings() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        return new Promise((resolve, reject) => {
          chrome.storage.local.get('settings', (result) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(result.settings || null);
            }
          });
        });
      } else {
        throw new Error('Chrome storage API not available');
      }
    } catch (error) {
      console.error('Failed to get user settings:', error);
      return null;
    }
  }

  // Show browser notification
  showNotification(highlightCount, recipient) {
    try {
      if (typeof chrome !== 'undefined' && chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: '/icons/icon48.png',
          title: 'Kindle Highlights Reminder',
          message: `📧 Sent ${highlightCount} highlights to ${recipient}`
        });
      }
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  // Get next scheduled email info
  async getNextScheduledEmail() {
    try {
      if (typeof chrome !== 'undefined' && chrome.alarms) {
        return new Promise((resolve) => {
          chrome.alarms.get(this.alarmName, (alarm) => {
            if (alarm) {
              resolve({
                status: 'success',
                nextEmailTime: alarm.scheduledTime,
                periodInMinutes: alarm.periodInMinutes,
                formattedTime: new Date(alarm.scheduledTime).toLocaleString()
              });
            } else {
              resolve({
                status: 'success',
                nextEmailTime: null,
                message: 'No email scheduled'
              });
            }
          });
        });
      } else {
        return {
          status: 'error',
          message: 'Chrome alarms API not available'
        };
      }
    } catch (error) {
      console.error('Failed to get next scheduled email:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  // Send email immediately (manual trigger)
  async sendEmailNow(userSettings) {
    try {
      console.log('Sending email immediately');
      
      const result = await this.sendScheduledEmail(userSettings);
      
      // If successful and auto-schedule is enabled, reschedule next email
      if (result.status === 'success' && userSettings.emailFrequency !== 'manual') {
        await this.scheduleEmails(userSettings);
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

  // Test email scheduling (for development/testing)
  async testScheduling(delayMinutes = 1) {
    try {
      if (typeof chrome !== 'undefined' && chrome.alarms) {
        const testAlarmName = 'test-email-reminder';
        const when = Date.now() + (delayMinutes * 60 * 1000);
        
        chrome.alarms.create(testAlarmName, { when });
        
        console.log(`Test email scheduled for ${delayMinutes} minute(s) from now`);
        
        return {
          status: 'success',
          testAlarmName,
          scheduledTime: when,
          message: `Test alarm set for ${new Date(when).toLocaleString()}`
        };
      } else {
        return {
          status: 'error',
          message: 'Chrome alarms API not available'
        };
      }
    } catch (error) {
      console.error('Failed to test scheduling:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  // Get scheduling statistics
  async getSchedulingStats() {
    try {
      const nextEmail = await this.getNextScheduledEmail();
      const emailStats = await this.emailService.getEmailStats();
      
      return {
        status: 'success',
        scheduling: {
          nextEmailTime: nextEmail.nextEmailTime,
          formattedTime: nextEmail.formattedTime,
          isScheduled: !!nextEmail.nextEmailTime
        },
        emailStats: emailStats.status === 'success' ? emailStats.stats : null
      };

    } catch (error) {
      console.error('Failed to get scheduling stats:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  // Update schedule when settings change
  async updateSchedule(newSettings) {
    try {
      console.log('Updating email schedule with new settings');
      
      const result = await this.scheduleEmails(newSettings);
      
      return {
        status: result.status,
        message: `Schedule updated: ${result.message}`,
        nextEmailTime: result.nextEmailTime
      };

    } catch (error) {
      console.error('Failed to update schedule:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  // Emergency stop all scheduling
  async emergencyStop() {
    try {
      await this.clearScheduledEmails();
      
      console.log('Email scheduling emergency stop executed');
      
      return {
        status: 'success',
        message: 'All email scheduling stopped'
      };

    } catch (error) {
      console.error('Failed to execute emergency stop:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }
}

// Create singleton instance
const emailScheduler = new EmailScheduler();

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment (for testing)
  module.exports = { EmailScheduler, emailScheduler };
} else if (typeof self !== 'undefined') {
  // Web Worker environment
  self.EmailScheduler = EmailScheduler;
  self.emailScheduler = emailScheduler;
} else {
  // Browser environment
  window.EmailScheduler = EmailScheduler;
  window.emailScheduler = emailScheduler;
}