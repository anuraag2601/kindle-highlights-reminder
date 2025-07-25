// Kindle Highlights Reminder - Enhanced Options Page Script
// Handles settings management, data operations, and analytics

class OptionsManager {
  constructor() {
    this.database = window.database;
    this.loadSettings();
    this.loadStatistics();
    this.loadAnalytics();
    this.attachEventListeners();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get('settings');
      const settings = result.settings || this.getDefaultSettings();
      
      this.populateForm(settings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.showStatus('Failed to load settings', 'error');
    }
  }

  async loadStatistics() {
    try {
      await this.database.init();
      const stats = await this.database.getStats();
      
      document.getElementById('total-books').textContent = stats.totalBooks;
      document.getElementById('total-highlights').textContent = stats.totalHighlights;
      
      const lastSyncElement = document.getElementById('last-sync');
      if (stats.lastSyncTime) {
        const date = new Date(stats.lastSyncTime);
        lastSyncElement.textContent = date.toLocaleDateString();
      } else {
        lastSyncElement.textContent = 'Never';
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }

  async loadAnalytics() {
    try {
      await this.database.init();
      const analytics = await this.database.getAdvancedStats();
      
      this.renderAnalytics(analytics);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      this.showAnalyticsError();
    }
  }

  renderAnalytics(analytics) {
    const container = document.getElementById('analytics-container');
    
    if (analytics.totalHighlights === 0) {
      container.innerHTML = '<p class="loading">No data available. Sync your highlights to see analytics.</p>';
      return;
    }

    container.innerHTML = `
      <div class="analytics-grid">
        <div class="analytics-card">
          <h4>📚 Reading Overview</h4>
          <div class="analytics-value">${analytics.booksWithHighlights}</div>
          <div class="analytics-label">Books with highlights</div>
          <div class="analytics-value">${analytics.averageHighlightsPerBook}</div>
          <div class="analytics-label">Avg highlights per book</div>
        </div>
        
        <div class="analytics-card">
          <h4>🎨 Highlight Colors</h4>
          <div class="color-distribution">
            ${Object.entries(analytics.colorDistribution || {}).map(([color, count]) => 
              `<span class="color-badge ${color}">${color}: ${count}</span>`
            ).join('')}
          </div>
          <div class="analytics-label">Most used: ${analytics.mostUsedColor}</div>
        </div>
        
        <div class="analytics-card">
          <h4>📝 Notes & Tags</h4>
          <div class="analytics-value">${analytics.highlightsWithNotes || 0}</div>
          <div class="analytics-label">Highlights with notes</div>
          <div class="analytics-value">${analytics.uniqueTags || 0}</div>
          <div class="analytics-label">Unique tags</div>
        </div>
        
        <div class="analytics-card">
          <h4>📊 Activity</h4>
          <div class="analytics-value">${analytics.averageHighlightsPerDay || 0}</div>
          <div class="analytics-label">Avg highlights per day</div>
          <div class="analytics-value">${analytics.highlightingSpan || 0}</div>
          <div class="analytics-label">Days of highlighting</div>
        </div>
        
        ${analytics.mostHighlightedBook ? `
        <div class="analytics-card">
          <h4>⭐ Top Book</h4>
          <div class="analytics-value">${analytics.mostHighlightedBook.highlightCount}</div>
          <div class="analytics-label">${analytics.mostHighlightedBook.title}</div>
          <div class="analytics-label">by ${analytics.mostHighlightedBook.author}</div>
        </div>
        ` : ''}
      </div>
    `;
  }

  showAnalyticsError() {
    const container = document.getElementById('analytics-container');
    container.innerHTML = '<p class="loading">Failed to load analytics. Please try refreshing.</p>';
  }

  getDefaultSettings() {
    return {
      email: '',
      emailTime: '09:00',
      emailFrequency: 'daily',
      highlightsPerEmail: 5,
      enableAutoSync: true,
      syncFrequency: 6,
      enableNotifications: true,
      highlightSelectionMode: 'spaced-repetition',
      prioritizeNotes: true,
      includeBookInfo: true
    };
  }

  populateForm(settings) {
    const elements = {
      email: document.getElementById('email'),
      emailTime: document.getElementById('email-time'), 
      emailFrequency: document.getElementById('email-frequency'),
      highlightsCount: document.getElementById('highlights-count'),
      autoSync: document.getElementById('auto-sync'),
      syncFrequency: document.getElementById('sync-frequency'),
      enableNotifications: document.getElementById('enable-notifications'),
      selectionMode: document.getElementById('selection-mode'),
      prioritizeNotes: document.getElementById('prioritize-notes'),
      includeBookInfo: document.getElementById('include-book-info')
    };

    Object.entries(elements).forEach(([key, element]) => {
      if (element) {
        const settingKey = this.mapFieldToSetting(key);
        if (element.type === 'checkbox') {
          element.checked = settings[settingKey] !== false;
        } else {
          element.value = settings[settingKey] || '';
        }
      }
    });
  }

  mapFieldToSetting(fieldName) {
    const mapping = {
      email: 'email',
      emailTime: 'emailTime',
      emailFrequency: 'emailFrequency',
      highlightsCount: 'highlightsPerEmail',
      autoSync: 'enableAutoSync',
      syncFrequency: 'syncFrequency',
      enableNotifications: 'enableNotifications',
      selectionMode: 'highlightSelectionMode',
      prioritizeNotes: 'prioritizeNotes',
      includeBookInfo: 'includeBookInfo'
    };
    return mapping[fieldName] || fieldName;
  }

  attachEventListeners() {
    // Save settings
    const saveButton = document.getElementById('save-settings');
    if (saveButton) {
      saveButton.addEventListener('click', () => this.saveSettings());
    }

    // Auto-save on change
    const formElements = document.querySelectorAll('input, select');
    formElements.forEach(element => {
      element.addEventListener('change', () => this.autoSave());
      element.addEventListener('input', () => this.validateField(element));
    });

    // Test email
    const testEmailButton = document.getElementById('test-email');
    if (testEmailButton) {
      testEmailButton.addEventListener('click', () => this.sendTestEmail());
    }

    // Preview email
    const previewEmailButton = document.getElementById('preview-email');
    if (previewEmailButton) {
      previewEmailButton.addEventListener('click', () => this.previewEmail());
    }

    // Send email now
    const sendEmailNowButton = document.getElementById('send-email-now');
    if (sendEmailNowButton) {
      sendEmailNowButton.addEventListener('click', () => this.sendEmailNow());
    }

    // Sync now
    const syncNowButton = document.getElementById('sync-now');
    if (syncNowButton) {
      syncNowButton.addEventListener('click', () => this.syncNow());
    }

    // Export data
    const exportButton = document.getElementById('export-data');
    if (exportButton) {
      exportButton.addEventListener('click', () => this.exportData());
    }

    // Import data
    const importFile = document.getElementById('import-file');
    if (importFile) {
      importFile.addEventListener('change', (e) => this.importData(e));
    }

    // Cleanup data
    const cleanupButton = document.getElementById('cleanup-data');
    if (cleanupButton) {
      cleanupButton.addEventListener('click', () => this.cleanupDatabase());
    }

    // Clear data
    const clearButton = document.getElementById('clear-data');
    if (clearButton) {
      clearButton.addEventListener('click', () => this.clearAllData());
    }

    // Refresh stats
    const refreshButton = document.getElementById('refresh-stats');
    if (refreshButton) {
      refreshButton.addEventListener('click', () => this.refreshStatistics());
    }

    // Highlight management event listeners
    this.attachHighlightManagementListeners();
  }

  attachHighlightManagementListeners() {
    // Search highlights
    const searchButton = document.getElementById('search-highlights');
    if (searchButton) {
      searchButton.addEventListener('click', () => this.searchHighlights());
    }

    // Clear filters
    const clearFiltersButton = document.getElementById('clear-filters');
    if (clearFiltersButton) {
      clearFiltersButton.addEventListener('click', () => this.clearFilters());
    }

    // Bulk actions toggle
    const bulkActionsToggle = document.getElementById('bulk-actions-toggle');
    if (bulkActionsToggle) {
      bulkActionsToggle.addEventListener('click', () => this.toggleBulkActions());
    }

    // Bulk actions
    const bulkTagButton = document.getElementById('bulk-tag');
    if (bulkTagButton) {
      bulkTagButton.addEventListener('click', () => this.bulkAddTags());
    }

    const bulkDeleteButton = document.getElementById('bulk-delete');
    if (bulkDeleteButton) {
      bulkDeleteButton.addEventListener('click', () => this.bulkDeleteHighlights());
    }

    const selectAllButton = document.getElementById('select-all');
    if (selectAllButton) {
      selectAllButton.addEventListener('click', () => this.selectAllHighlights());
    }

    const selectNoneButton = document.getElementById('select-none');
    if (selectNoneButton) {
      selectNoneButton.addEventListener('click', () => this.selectNoHighlights());
    }

    // Pagination
    const prevPageButton = document.getElementById('prev-page');
    if (prevPageButton) {
      prevPageButton.addEventListener('click', () => this.previousPage());
    }

    const nextPageButton = document.getElementById('next-page');
    if (nextPageButton) {
      nextPageButton.addEventListener('click', () => this.nextPage());
    }

    // Load book options for filter
    this.loadBookOptions();

    // Initialize highlight management state
    this.currentPage = 1;
    this.pageSize = 10;
    this.selectedHighlights = new Set();
    this.bulkActionsVisible = false;
  }

  validateField(element) {
    const value = element.value;
    let isValid = true;
    let errorMessage = '';

    // Clear previous error state
    element.classList.remove('error', 'success');
    const errorElement = document.getElementById(element.id + '-error');
    if (errorElement) {
      errorElement.classList.remove('visible');
    }

    switch (element.type) {
      case 'email':
        isValid = this.isValidEmail(value);
        errorMessage = 'Please enter a valid email address';
        break;
      
      case 'number':
        const num = parseInt(value);
        if (element.id === 'highlights-count') {
          isValid = num >= 1 && num <= 20;
          errorMessage = 'Must be between 1 and 20';
        } else if (element.id === 'sync-frequency') {
          isValid = num >= 1 && num <= 24;
          errorMessage = 'Must be between 1 and 24 hours';
        }
        break;
    }

    if (value && !isValid) {
      element.classList.add('error');
      if (errorElement) {
        errorElement.textContent = errorMessage;
        errorElement.classList.add('visible');
      }
    } else if (value) {
      element.classList.add('success');
    }

    return isValid;
  }

  async autoSave() {
    try {
      await this.saveSettings(true);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }

  async saveSettings(silent = false) {
    try {
      const settings = this.collectFormData();
      
      // Validate settings
      const validation = this.validateSettings(settings);
      if (!validation.valid) {
        if (!silent) this.showStatus(validation.message, 'error');
        return;
      }

      await chrome.storage.local.set({ settings });
      if (!silent) this.showStatus('Settings saved successfully!', 'success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      if (!silent) this.showStatus('Failed to save settings', 'error');
    }
  }

  collectFormData() {
    return {
      email: document.getElementById('email').value,
      emailTime: document.getElementById('email-time').value,
      emailFrequency: document.getElementById('email-frequency').value,
      highlightsPerEmail: parseInt(document.getElementById('highlights-count').value),
      enableAutoSync: document.getElementById('auto-sync').checked,
      syncFrequency: parseInt(document.getElementById('sync-frequency').value),
      enableNotifications: document.getElementById('enable-notifications').checked,
      highlightSelectionMode: document.getElementById('selection-mode').value,
      prioritizeNotes: document.getElementById('prioritize-notes').checked,
      includeBookInfo: document.getElementById('include-book-info').checked
    };
  }

  validateSettings(settings) {
    if (!settings.email || !this.isValidEmail(settings.email)) {
      return { valid: false, message: 'Please enter a valid email address' };
    }

    if (settings.highlightsPerEmail < 1 || settings.highlightsPerEmail > 20) {
      return { valid: false, message: 'Highlights per email must be between 1 and 20' };
    }

    if (settings.syncFrequency < 1 || settings.syncFrequency > 24) {
      return { valid: false, message: 'Sync frequency must be between 1 and 24 hours' };
    }

    return { valid: true };
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async sendTestEmail() {
    const button = document.getElementById('test-email');
    const status = document.getElementById('test-email-status');
    
    try {
      const email = document.getElementById('email').value;
      if (!email) {
        status.textContent = 'Please enter an email address first';
        status.className = 'test-status error';
        return;
      }

      button.disabled = true;
      status.textContent = 'Sending...';
      status.className = 'test-status loading';
      
      const response = await chrome.runtime.sendMessage({
        action: 'send-test-email',
        email: email
      });
      
      if (response.success) {
        status.textContent = 'Test email sent!';
        status.className = 'test-status success';
      } else {
        status.textContent = response.data?.message || 'Failed to send';
        status.className = 'test-status error';
      }
    } catch (error) {
      status.textContent = 'Error: ' + error.message;
      status.className = 'test-status error';
    } finally {
      button.disabled = false;
      setTimeout(() => {
        status.textContent = '';
        status.className = 'test-status';
      }, 3000);
    }
  }

  async syncNow() {
    const button = document.getElementById('sync-now');
    const status = document.getElementById('sync-status');
    
    try {
      button.disabled = true;
      status.textContent = 'Syncing...';
      status.className = 'sync-status loading';
      
      const response = await chrome.runtime.sendMessage({
        action: 'sync-now'
      });
      
      if (response.success) {
        status.textContent = `Synced ${response.data.totalHighlights} highlights!`;
        status.className = 'sync-status success';
        
        // Refresh statistics
        setTimeout(() => {
          this.loadStatistics();
          this.loadAnalytics();
        }, 1000);
      } else {
        status.textContent = response.error || 'Sync failed';
        status.className = 'sync-status error';
      }
    } catch (error) {
      status.textContent = 'Error: ' + error.message;
      status.className = 'sync-status error';
    } finally {
      button.disabled = false;
      setTimeout(() => {
        status.textContent = '';
        status.className = 'sync-status';
      }, 5000);
    }
  }

  async exportData() {
    try {
      await this.database.init();
      const data = await this.database.exportAllData();
      
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kindle-highlights-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showStatus('Data exported successfully!', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      this.showStatus('Export failed: ' + error.message, 'error');
    }
  }

  async importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      await this.database.init();
      const result = await this.database.importData(data, {
        overwrite: false,
        skipDuplicates: true
      });
      
      this.showStatus(
        `Import completed! Books: ${result.books.imported} imported, ${result.books.skipped} skipped. ` +
        `Highlights: ${result.highlights.imported} imported, ${result.highlights.skipped} skipped.`,
        'success'
      );
      
      // Refresh statistics
      setTimeout(() => {
        this.loadStatistics();
        this.loadAnalytics();
      }, 1000);
      
    } catch (error) {
      console.error('Import failed:', error);
      this.showStatus('Import failed: ' + error.message, 'error');
    }
    
    // Reset file input
    event.target.value = '';
  }

  async cleanupDatabase() {
    if (!confirm('This will remove old sync/email records and orphaned data. Continue?')) {
      return;
    }
    
    try {
      await this.database.init();
      const result = await this.database.cleanup();
      
      this.showStatus(
        `Cleanup completed! Removed ${result.syncRecordsRemoved} sync records, ` +
        `${result.emailRecordsRemoved} email records, and ${result.orphanedHighlightsRemoved} orphaned highlights.`,
        'success'
      );
      
      this.loadStatistics();
    } catch (error) {
      console.error('Cleanup failed:', error);
      this.showStatus('Cleanup failed: ' + error.message, 'error');
    }
  }

  async clearAllData() {
    if (!confirm('This will permanently delete ALL your highlights and books. This cannot be undone. Are you sure?')) {
      return;
    }
    
    if (!confirm('This is your final warning. ALL DATA WILL BE LOST. Continue?')) {
      return;
    }
    
    try {
      await this.database.init();
      await this.database.clearAllData();
      
      this.showStatus('All data cleared successfully', 'success');
      
      // Reset statistics
      setTimeout(() => {
        this.loadStatistics();
        this.loadAnalytics();
      }, 500);
      
    } catch (error) {
      console.error('Clear data failed:', error);
      this.showStatus('Failed to clear data: ' + error.message, 'error');
    }
  }

  async refreshStatistics() {
    await this.loadStatistics();
    await this.loadAnalytics();
    this.showStatus('Statistics refreshed!', 'success');
  }

  async previewEmail() {
    const button = document.getElementById('preview-email');
    const status = document.getElementById('test-email-status');
    
    try {
      button.disabled = true;
      status.textContent = 'Generating preview...';
      status.className = 'test-status loading';
      
      const highlightsCount = parseInt(document.getElementById('highlights-count').value) || 5;
      
      const response = await chrome.runtime.sendMessage({
        action: 'preview-email',
        count: highlightsCount
      });
      
      if (response.success) {
        this.showEmailPreview(response.data);
        status.textContent = 'Preview generated!';
        status.className = 'test-status success';
      } else {
        status.textContent = response.data?.message || 'Failed to generate preview';
        status.className = 'test-status error';
      }
    } catch (error) {
      status.textContent = 'Error: ' + error.message;
      status.className = 'test-status error';
    } finally {
      button.disabled = false;
      setTimeout(() => {
        status.textContent = '';
        status.className = 'test-status';
      }, 3000);
    }
  }

  showEmailPreview(previewData) {
    // Create preview modal
    const modal = document.createElement('div');
    modal.className = 'email-preview-modal';
    modal.innerHTML = `
      <div class="email-preview-content">
        <div class="email-preview-header">
          <h3>📧 Email Preview</h3>
          <button class="email-preview-close">&times;</button>
        </div>
        <div class="email-preview-info">
          <p><strong>To:</strong> ${previewData.preview.recipient}</p>
          <p><strong>Subject:</strong> ${previewData.preview.subject}</p>
          <p><strong>Highlights:</strong> ${previewData.preview.highlightCount} selected from ${previewData.selectionInfo?.totalAvailable || 0} available</p>
          <p><strong>Algorithm:</strong> ${previewData.selectionInfo?.algorithm || 'spaced-repetition'}</p>
        </div>
        <div class="email-preview-body">
          <h4>Email Content:</h4>
          <div class="email-content-preview">
            ${previewData.preview.htmlContent}
          </div>
        </div>
        <div class="email-preview-actions">
          <button class="secondary-button email-preview-close-btn">Close</button>
          <button class="action-button" id="send-from-preview">Send This Email</button>
        </div>
      </div>
    `;

    // Add styles for the modal
    if (!document.getElementById('email-preview-styles')) {
      const styles = document.createElement('style');
      styles.id = 'email-preview-styles';
      styles.textContent = `
        .email-preview-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 2000;
        }
        .email-preview-content {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
        }
        .email-preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e9ecef;
        }
        .email-preview-header h3 {
          margin: 0;
          color: #667eea;
        }
        .email-preview-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #999;
        }
        .email-preview-info {
          padding: 20px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }
        .email-preview-info p {
          margin: 5px 0;
          font-size: 14px;
        }
        .email-preview-body {
          padding: 20px;
        }
        .email-preview-body h4 {
          margin-top: 0;
          color: #333;
        }
        .email-content-preview {
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 20px;
          background: #f8f9fa;
          max-height: 400px;
          overflow-y: auto;
        }
        .email-preview-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 20px;
          border-top: 1px solid #e9ecef;
        }
      `;
      document.head.appendChild(styles);
    }

    // Add event listeners
    modal.querySelector('.email-preview-close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.querySelector('.email-preview-close-btn').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.querySelector('#send-from-preview').addEventListener('click', () => {
      document.body.removeChild(modal);
      this.sendEmailNow();
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });

    document.body.appendChild(modal);
  }

  async sendEmailNow() {
    const button = document.getElementById('send-email-now');
    const status = document.getElementById('test-email-status');
    
    try {
      const email = document.getElementById('email').value;
      if (!email) {
        status.textContent = 'Please enter an email address first';
        status.className = 'test-status error';
        return;
      }

      button.disabled = true;
      status.textContent = 'Sending email...';
      status.className = 'test-status loading';
      
      const response = await chrome.runtime.sendMessage({
        action: 'send-email-now'
      });
      
      if (response.success) {
        status.textContent = `Email sent with ${response.data.highlightCount} highlights!`;
        status.className = 'test-status success';
        
        // Refresh analytics after sending
        setTimeout(() => {
          this.loadAnalytics();
        }, 1000);
      } else {
        status.textContent = response.data?.message || 'Failed to send email';
        status.className = 'test-status error';
      }
    } catch (error) {
      status.textContent = 'Error: ' + error.message;
      status.className = 'test-status error';
    } finally {
      button.disabled = false;
      setTimeout(() => {
        status.textContent = '';
        status.className = 'test-status';
      }, 5000);
    }
  }

  showStatus(message, type = 'success') {
    const statusElement = document.getElementById('status-message');
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.className = `status-message visible ${type}`;
      
      setTimeout(() => {
        statusElement.classList.remove('visible');
      }, 5000);
    }
  }

  // Highlight Management Methods
  async loadBookOptions() {
    try {
      await this.database.init();
      const books = await this.database.getAllBooks();
      const bookFilter = document.getElementById('book-filter');
      
      if (bookFilter) {
        // Clear existing options except "All Books"
        bookFilter.innerHTML = '<option value="">All Books</option>';
        
        books.forEach(book => {
          const option = document.createElement('option');
          option.value = book.asin;
          option.textContent = `${book.title} by ${book.author}`;
          bookFilter.appendChild(option);
        });
      }
    } catch (error) {
      console.error('Failed to load book options:', error);
    }
  }

  async searchHighlights() {
    try {
      const container = document.getElementById('highlights-container');
      container.innerHTML = '<div class="highlights-loading"><div class="loading-spinner"></div>Loading highlights...</div>';

      await this.database.init();
      
      // Get search and filter values
      const query = document.getElementById('highlight-search').value.trim();
      const bookAsin = document.getElementById('book-filter').value;
      const color = document.getElementById('color-filter').value;
      const sortBy = document.getElementById('sort-by').value;

      // Build filters object
      const filters = {};
      if (bookAsin) filters.bookAsin = bookAsin;
      if (color) filters.color = color;

      // Search highlights
      let highlights = await this.database.searchHighlights(query, filters);
      
      // Sort highlights
      highlights = this.sortHighlights(highlights, sortBy);
      
      // Store results for pagination
      this.allHighlights = highlights;
      this.currentPage = 1;
      
      // Render highlights
      this.renderHighlights(highlights);
      
    } catch (error) {
      console.error('Search failed:', error);
      const container = document.getElementById('highlights-container');
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">❌</div><div class="empty-state-message">Search failed</div><div class="empty-state-hint">Please try again</div></div>';
    }
  }

  sortHighlights(highlights, sortBy) {
    return highlights.sort((a, b) => {
      switch (sortBy) {
        case 'dateAdded':
          return b.dateAdded - a.dateAdded;
        case 'location':
          return this.database.compareLocations(a.location || '', b.location || '');
        case 'color':
          return a.color.localeCompare(b.color);
        case 'dateHighlighted':
        default:
          return b.dateHighlighted - a.dateHighlighted;
      }
    });
  }

  async renderHighlights(highlights) {
    const container = document.getElementById('highlights-container');
    
    if (highlights.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📖</div>
          <div class="empty-state-message">No highlights found</div>
          <div class="empty-state-hint">Try adjusting your search criteria</div>
        </div>
      `;
      document.getElementById('pagination-container').style.display = 'none';
      return;
    }

    // Get books for reference
    const books = await this.database.getAllBooks();
    const bookMap = new Map(books.map(book => [book.asin, book]));

    // Paginate results
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    const pageHighlights = highlights.slice(startIndex, endIndex);

    // Render highlights
    container.innerHTML = pageHighlights.map(highlight => 
      this.renderHighlightItem(highlight, bookMap.get(highlight.bookAsin))
    ).join('');

    // Update pagination
    this.updatePagination(highlights.length);

    // Attach event listeners to highlight items
    this.attachHighlightItemListeners();
  }

  renderHighlightItem(highlight, book) {
    const bookTitle = book ? book.title : 'Unknown Book';
    const bookAuthor = book ? book.author : 'Unknown Author';
    const date = new Date(highlight.dateHighlighted).toLocaleDateString();
    const tags = highlight.tags && highlight.tags.length > 0 
      ? highlight.tags.map(tag => `<span class="highlight-tag">${tag}</span>`).join('')
      : '';
    const note = highlight.note && highlight.note.trim() 
      ? `<div class="highlight-note">${highlight.note}</div>` 
      : '';

    return `
      <div class="highlight-item" data-highlight-id="${highlight.id}">
        <input type="checkbox" class="highlight-checkbox" data-highlight-id="${highlight.id}" 
               ${this.bulkActionsVisible ? '' : 'style="display: none;"'}>
        <div class="highlight-content">
          <div class="highlight-header">
            <div class="highlight-meta">
              <span class="highlight-book">${bookTitle}</span>
              <span class="highlight-location">${highlight.location || 'Unknown location'}</span>
              <span class="highlight-date">${date}</span>
            </div>
          </div>
          <div class="highlight-text ${highlight.color}">${highlight.text}</div>
          ${note}
          ${tags ? `<div class="highlight-tags">${tags}</div>` : ''}
          <div class="highlight-actions">
            <button class="highlight-action-btn edit-btn" data-action="edit" data-highlight-id="${highlight.id}">
              ✏️ Edit
            </button>
            <button class="highlight-action-btn tag-btn" data-action="tag" data-highlight-id="${highlight.id}">
              🏷️ Tag
            </button>
            <button class="highlight-action-btn delete-btn" data-action="delete" data-highlight-id="${highlight.id}">
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }

  attachHighlightItemListeners() {
    // Action buttons
    document.querySelectorAll('.highlight-action-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        const highlightId = e.target.dataset.highlightId;
        
        switch (action) {
          case 'edit':
            this.editHighlight(highlightId);
            break;
          case 'tag':
            this.tagHighlight(highlightId);
            break;
          case 'delete':
            this.deleteHighlight(highlightId);
            break;
        }
      });
    });

    // Checkboxes
    document.querySelectorAll('.highlight-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const highlightId = e.target.dataset.highlightId;
        if (e.target.checked) {
          this.selectedHighlights.add(highlightId);
        } else {
          this.selectedHighlights.delete(highlightId);
        }
        this.updateSelectedCount();
      });
    });
  }

  updatePagination(totalResults) {
    const totalPages = Math.ceil(totalResults / this.pageSize);
    const paginationContainer = document.getElementById('pagination-container');
    const paginationInfo = document.getElementById('pagination-info');
    const pageNumbers = document.getElementById('page-numbers');
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');

    if (totalPages <= 1) {
      paginationContainer.style.display = 'none';
      return;
    }

    paginationContainer.style.display = 'flex';
    
    // Update info
    const startItem = (this.currentPage - 1) * this.pageSize + 1;
    const endItem = Math.min(this.currentPage * this.pageSize, totalResults);
    paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${totalResults} highlights`;

    // Update buttons
    prevButton.disabled = this.currentPage <= 1;
    nextButton.disabled = this.currentPage >= totalPages;

    // Update page numbers
    const maxPages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(totalPages, startPage + maxPages - 1);
    
    if (endPage - startPage + 1 < maxPages) {
      startPage = Math.max(1, endPage - maxPages + 1);
    }

    let pageNumbersHTML = '';
    for (let i = startPage; i <= endPage; i++) {
      pageNumbersHTML += `
        <span class="page-number ${i === this.currentPage ? 'active' : ''}" 
              data-page="${i}">${i}</span>
      `;
    }
    pageNumbers.innerHTML = pageNumbersHTML;

    // Attach page number listeners
    document.querySelectorAll('.page-number').forEach(pageBtn => {
      pageBtn.addEventListener('click', (e) => {
        this.currentPage = parseInt(e.target.dataset.page);
        this.renderHighlights(this.allHighlights);
      });
    });
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.renderHighlights(this.allHighlights);
    }
  }

  nextPage() {
    const totalPages = Math.ceil(this.allHighlights.length / this.pageSize);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.renderHighlights(this.allHighlights);
    }
  }

  clearFilters() {
    document.getElementById('highlight-search').value = '';
    document.getElementById('book-filter').value = '';
    document.getElementById('color-filter').value = '';
    document.getElementById('sort-by').value = 'dateHighlighted';
    
    const container = document.getElementById('highlights-container');
    container.innerHTML = '<p class="loading">Click "Search" to load highlights...</p>';
    
    document.getElementById('pagination-container').style.display = 'none';
  }

  toggleBulkActions() {
    this.bulkActionsVisible = !this.bulkActionsVisible;
    const panel = document.getElementById('bulk-actions-panel');
    const checkboxes = document.querySelectorAll('.highlight-checkbox');
    
    panel.style.display = this.bulkActionsVisible ? 'block' : 'none';
    checkboxes.forEach(checkbox => {
      checkbox.style.display = this.bulkActionsVisible ? 'block' : 'none';
    });

    if (!this.bulkActionsVisible) {
      this.selectedHighlights.clear();
      this.updateSelectedCount();
    }
  }

  selectAllHighlights() {
    const checkboxes = document.querySelectorAll('.highlight-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
      this.selectedHighlights.add(checkbox.dataset.highlightId);
    });
    this.updateSelectedCount();
  }

  selectNoHighlights() {
    const checkboxes = document.querySelectorAll('.highlight-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
    });
    this.selectedHighlights.clear();
    this.updateSelectedCount();
  }

  updateSelectedCount() {
    const countElement = document.getElementById('selected-count');
    const count = this.selectedHighlights.size;
    countElement.textContent = `${count} highlight${count !== 1 ? 's' : ''} selected`;
  }

  async editHighlight(highlightId) {
    try {
      const highlight = await this.database.getHighlight(highlightId);
      if (!highlight) {
        this.showStatus('Highlight not found', 'error');
        return;
      }

      // Create edit modal
      const modal = this.createEditModal(highlight);
      document.body.appendChild(modal);
      
      // Focus on text area
      const textArea = modal.querySelector('#edit-highlight-text');
      if (textArea) {
        textArea.focus();
        textArea.setSelectionRange(textArea.value.length, textArea.value.length);
      }
    } catch (error) {
      console.error('Edit highlight failed:', error);
      this.showStatus('Failed to edit highlight', 'error');
    }
  }

  createEditModal(highlight) {
    const modal = document.createElement('div');
    modal.className = 'edit-modal';
    modal.innerHTML = `
      <div class="edit-modal-content">
        <div class="edit-modal-header">
          <h3 class="edit-modal-title">Edit Highlight</h3>
          <button class="edit-modal-close">&times;</button>
        </div>
        <form class="edit-form">
          <div class="form-group">
            <label for="edit-highlight-text">Highlight Text</label>
            <textarea id="edit-highlight-text" rows="4">${highlight.text}</textarea>
          </div>
          <div class="form-group">
            <label for="edit-highlight-note">Personal Note</label>
            <textarea id="edit-highlight-note" rows="3">${highlight.note || ''}</textarea>
          </div>
          <div class="form-group">
            <label for="edit-highlight-tags">Tags (comma-separated)</label>
            <input type="text" id="edit-highlight-tags" 
                   value="${highlight.tags ? highlight.tags.join(', ') : ''}">
          </div>
          <div class="form-group">
            <label for="edit-highlight-color">Color</label>
            <select id="edit-highlight-color">
              <option value="yellow" ${highlight.color === 'yellow' ? 'selected' : ''}>Yellow</option>
              <option value="blue" ${highlight.color === 'blue' ? 'selected' : ''}>Blue</option>
              <option value="pink" ${highlight.color === 'pink' ? 'selected' : ''}>Pink</option>
              <option value="orange" ${highlight.color === 'orange' ? 'selected' : ''}>Orange</option>
            </select>
          </div>
          <div class="edit-modal-actions">
            <button type="button" class="secondary-button edit-cancel">Cancel</button>
            <button type="button" class="action-button edit-save" data-highlight-id="${highlight.id}">Save Changes</button>
          </div>
        </form>
      </div>
    `;

    // Attach event listeners
    modal.querySelector('.edit-modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.querySelector('.edit-cancel').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.querySelector('.edit-save').addEventListener('click', () => {
      this.saveHighlightEdit(highlight.id, modal);
    });

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });

    return modal;
  }

  async saveHighlightEdit(highlightId, modal) {
    try {
      const text = modal.querySelector('#edit-highlight-text').value.trim();
      const note = modal.querySelector('#edit-highlight-note').value.trim();
      const tagsInput = modal.querySelector('#edit-highlight-tags').value.trim();
      const color = modal.querySelector('#edit-highlight-color').value;

      if (!text) {
        this.showStatus('Highlight text cannot be empty', 'error');
        return;
      }

      const tags = tagsInput ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag) : [];

      const updates = { text, note, tags, color };
      await this.database.updateHighlight(highlightId, updates);

      document.body.removeChild(modal);
      this.showStatus('Highlight updated successfully!', 'success');
      
      // Refresh current view
      if (this.allHighlights) {
        this.searchHighlights();
      }
    } catch (error) {
      console.error('Save highlight edit failed:', error);
      this.showStatus('Failed to save changes', 'error');
    }
  }

  async tagHighlight(highlightId) {
    const tags = prompt('Enter tags separated by commas:');
    if (tags !== null) {
      try {
        const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        const highlight = await this.database.getHighlight(highlightId);
        const existingTags = highlight.tags || [];
        const mergedTags = [...new Set([...existingTags, ...tagArray])];
        
        await this.database.updateHighlight(highlightId, { tags: mergedTags });
        this.showStatus('Tags added successfully!', 'success');
        
        if (this.allHighlights) {
          this.searchHighlights();
        }
      } catch (error) {
        console.error('Tag highlight failed:', error);
        this.showStatus('Failed to add tags', 'error');
      }
    }
  }

  async deleteHighlight(highlightId) {
    if (confirm('Are you sure you want to delete this highlight? This cannot be undone.')) {
      try {
        await this.database.deleteHighlight(highlightId);
        this.showStatus('Highlight deleted successfully!', 'success');
        
        if (this.allHighlights) {
          this.searchHighlights();
        }
      } catch (error) {
        console.error('Delete highlight failed:', error);
        this.showStatus('Failed to delete highlight', 'error');
      }
    }
  }

  async bulkAddTags() {
    if (this.selectedHighlights.size === 0) {
      this.showStatus('Please select highlights first', 'error');
      return;
    }

    const tags = prompt('Enter tags to add (comma-separated):');
    if (tags !== null && tags.trim()) {
      try {
        const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
        const selectedIds = Array.from(this.selectedHighlights);
        
        for (const highlightId of selectedIds) {
          const highlight = await this.database.getHighlight(highlightId);
          const existingTags = highlight.tags || [];
          const mergedTags = [...new Set([...existingTags, ...tagArray])];
          await this.database.updateHighlight(highlightId, { tags: mergedTags });
        }

        this.showStatus(`Tags added to ${selectedIds.length} highlights!`, 'success');
        this.selectedHighlights.clear();
        this.updateSelectedCount();
        
        if (this.allHighlights) {
          this.searchHighlights();
        }
      } catch (error) {
        console.error('Bulk tag failed:', error);
        this.showStatus('Failed to add tags', 'error');
      }
    }
  }

  async bulkDeleteHighlights() {
    if (this.selectedHighlights.size === 0) {
      this.showStatus('Please select highlights first', 'error');
      return;
    }

    const count = this.selectedHighlights.size;
    if (confirm(`Are you sure you want to delete ${count} highlight${count !== 1 ? 's' : ''}? This cannot be undone.`)) {
      try {
        const selectedIds = Array.from(this.selectedHighlights);
        await this.database.bulkDeleteHighlights(selectedIds);
        
        this.showStatus(`${count} highlight${count !== 1 ? 's' : ''} deleted successfully!`, 'success');
        this.selectedHighlights.clear();
        this.updateSelectedCount();
        
        if (this.allHighlights) {
          this.searchHighlights();
        }
      } catch (error) {
        console.error('Bulk delete failed:', error);
        this.showStatus('Failed to delete highlights', 'error');
      }
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new OptionsManager();
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OptionsManager };
}