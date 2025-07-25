# Kindle Highlights Browser Extension - Complete Specification

## Project Overview
A Chrome/Edge browser extension that automatically extracts Kindle highlights from Amazon's read.amazon.com/notebook interface, stores them in a local database, and sends daily email digests with shuffled, interesting highlights to promote knowledge retention through spaced repetition.

## Architecture Components

### 1. Browser Extension Structure
```
kindle-highlights-extension/
├── manifest.json
├── background.js
├── content-scripts/
│   ├── scraper.js
│   └── parser.js
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/
│   ├── options.html
│   ├── options.js
│   └── options.css
├── lib/
│   ├── database.js
│   ├── email-service.js
│   └── highlight-selector.js
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

### 2. Database Schema (IndexedDB)

```javascript
// Database: KindleHighlightsDB
// Version: 1

// Store: books
{
  asin: string (primary key),
  title: string,
  author: string,
  coverUrl: string,
  lastUpdated: timestamp
}

// Store: highlights
{
  id: string (primary key, auto-generated UUID),
  bookAsin: string (foreign key),
  text: string,
  location: string,
  page: string,
  dateHighlighted: timestamp,
  dateAdded: timestamp,
  color: string, // yellow, blue, pink, orange
  note: string,
  tags: array[string]
}

// Store: sync_history
{
  id: string (primary key),
  syncDate: timestamp,
  highlightsAdded: number,
  highlightsTota<: number,
  status: string, // 'success', 'partial', 'failed'
  errorMessage: string
}

// Store: email_history
{
  id: string (primary key),
  sentDate: timestamp,
  highlightIds: array[string],
  status: string // 'sent', 'failed'
}

// Store: settings
{
  key: string (primary key),
  value: any
}
// Settings include:
// - email: user's email address
// - emailFrequency: 'daily', 'weekly', 'custom'
// - emailTime: "09:00"
// - highlightsPerEmail: 5
// - syncFrequency: hours (default: 6)
// - lastSyncTime: timestamp
// - emailService: 'smtp', 'sendgrid', 'mailgun'
// - emailCredentials: encrypted object
// - enableAutoSync: boolean
// - enableNotifications: boolean
// - highlightSelectionMode: 'random', 'spaced-repetition', 'oldest-first'
```

### 3. Core Functionality Specifications

#### 3.1 Authentication & Session Management
```javascript
// Detect if user is logged into Amazon
// Store session cookies securely
// Handle session expiration gracefully
// No password storage - rely on existing Amazon session
```

#### 3.2 Scraping Logic
```javascript
// URL: https://read.amazon.com/notebook

// Scraping process:
1. Check if user is on notebook page or navigate there
2. Wait for page load completion
3. Extract all books:
   - Selector: 'div[class*="kp-notebook-library-book"]'
   - Extract: ASIN, title, author, cover URL
4. For each book:
   - Click to load highlights
   - Wait for highlights to load
   - Handle pagination (scroll or click "Show More")
   - Extract highlights:
     - Selector: 'div[id="highlight"]' or 'div[class*="kp-notebook-highlight"]'
     - Extract: text, location, color, associated note
5. Handle rate limiting:
   - 2-second delay between book clicks
   - 500ms delay between pagination
   - Exponential backoff on errors
```

#### 3.3 Highlight Selection Algorithm
```javascript
class HighlightSelector {
  constructor(mode) {
    this.mode = mode; // 'random', 'spaced-repetition', 'oldest-first'
  }

  selectHighlights(count = 5) {
    switch(this.mode) {
      case 'random':
        return this.randomSelection(count);
      case 'spaced-repetition':
        return this.spacedRepetitionSelection(count);
      case 'oldest-first':
        return this.oldestFirstSelection(count);
    }
  }

  spacedRepetitionSelection(count) {
    // Algorithm:
    // 1. Never shown: Priority 1
    // 2. Shown > 30 days ago: Priority 2
    // 3. Shown 15-30 days ago: Priority 3
    // 4. Shown 7-15 days ago: Priority 4
    // 5. Mix priorities: 40% P1, 30% P2, 20% P3, 10% P4
  }
}
```

#### 3.4 Email Service Implementation
```javascript
// Email Template
const emailTemplate = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Georgia, serif; line-height: 1.6; color: #333; }
    .highlight { 
      background: #fff3cd; 
      padding: 20px; 
      margin: 20px 0; 
      border-left: 4px solid #ffc107;
      border-radius: 4px;
    }
    .book-info { 
      color: #666; 
      font-size: 14px; 
      margin-top: 10px;
    }
    .note {
      font-style: italic;
      color: #555;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <h2>Your Daily Kindle Highlights</h2>
  {{highlights}}
  <footer>
    <p>Keep learning! 📚</p>
  </footer>
</body>
</html>
`;

// Support multiple email services:
// 1. Browser-based (using mailto: with limitations)
// 2. EmailJS integration
// 3. Custom webhook endpoint
// 4. Local SMTP (requires user configuration)
```

### 4. User Interface Specifications

#### 4.1 Popup Interface
```html
<!-- popup.html -->
<div class="popup-container">
  <header>
    <h1>Kindle Highlights</h1>
    <span class="sync-status">Last sync: 2 hours ago</span>
  </header>
  
  <div class="stats">
    <div class="stat-item">
      <span class="stat-number">{{totalHighlights}}</span>
      <span class="stat-label">Total Highlights</span>
    </div>
    <div class="stat-item">
      <span class="stat-number">{{totalBooks}}</span>
      <span class="stat-label">Books</span>
    </div>
  </div>
  
  <div class="actions">
    <button id="sync-now">Sync Now</button>
    <button id="send-test-email">Send Test Email</button>
  </div>
  
  <div class="quick-settings">
    <label>
      <input type="checkbox" id="auto-sync-toggle">
      Auto-sync enabled
    </label>
  </div>
  
  <footer>
    <a href="#" id="open-settings">Settings</a>
    <a href="#" id="view-highlights">View All Highlights</a>
  </footer>
</div>
```

#### 4.2 Options Page
```html
<!-- Full settings interface with sections for: -->
1. Email Configuration
   - Email address
   - Delivery time
   - Frequency
   - Number of highlights per email
   - Email service setup

2. Sync Settings
   - Auto-sync frequency
   - Manual sync button
   - Clear cache option

3. Highlight Selection
   - Selection algorithm
   - Filter by books
   - Exclude certain highlights

4. Data Management
   - Export highlights (JSON/CSV)
   - Import highlights
   - Clear all data
   - Backup/Restore

5. Advanced
   - Debug mode
   - Performance settings
   - API endpoints (if using custom backend)
```

### 5. Background Service Worker Tasks

```javascript
// background.js main tasks

1. Scheduled Sync
chrome.alarms.create('sync-highlights', {
  periodInMinutes: settings.syncFrequency * 60
});

2. Scheduled Email
chrome.alarms.create('send-email', {
  when: getNextEmailTime(settings.emailTime)
});

3. Message Handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch(request.action) {
    case 'sync-now':
      performSync();
      break;
    case 'send-test-email':
      sendTestEmail();
      break;
    case 'get-stats':
      getStatistics();
      break;
  }
});

4. Tab Monitoring
// Detect when user navigates to read.amazon.com
// Show page action icon
// Offer quick sync option
```

### 6. Error Handling & Edge Cases

```javascript
const ErrorHandler = {
  handleSyncError(error) {
    if (error.type === 'AUTH_REQUIRED') {
      // Prompt user to log into Amazon
      chrome.tabs.create({ url: 'https://read.amazon.com' });
    } else if (error.type === 'RATE_LIMITED') {
      // Exponential backoff
      scheduleRetry(error.retryAfter);
    } else if (error.type === 'PARSING_ERROR') {
      // Log error, try alternative selectors
      fallbackParsing();
    }
  },
  
  handleEmailError(error) {
    // Store failed email in queue
    // Retry with exponential backoff
    // Notify user after 3 failures
  }
};
```

### 7. Security & Privacy

1. **Data Storage**: All data stored locally in IndexedDB
2. **Credentials**: Email credentials encrypted using Web Crypto API
3. **Permissions**: Minimal required permissions
   - `storage`: For saving settings
   - `alarms`: For scheduling
   - `tabs`: For detecting Amazon pages
   - `notifications`: For user alerts
   - Host permission: `*://read.amazon.com/*`

### 8. Performance Optimizations

1. **Incremental Sync**: Only fetch new highlights since last sync
2. **Batching**: Process highlights in batches of 50
3. **Lazy Loading**: Load book details only when needed
4. **Caching**: Cache book metadata for 7 days
5. **Debouncing**: Prevent rapid repeated syncs

### 9. Testing Requirements

```javascript
// Unit tests for:
- Highlight parsing logic
- Selection algorithms
- Email template generation
- Database operations

// Integration tests for:
- Full sync flow
- Email sending
- Error recovery
- Settings persistence

// Manual test cases:
- First time setup
- Large libraries (1000+ highlights)
- Network interruptions
- Session expiration
```

### 10. Development Phases

**Phase 1**: Core Extension Setup
- Basic manifest and structure
- Popup UI
- Settings storage

**Phase 2**: Scraping Implementation
- Content script for highlight extraction
- Pagination handling
- Error handling

**Phase 3**: Database Layer
- IndexedDB setup
- CRUD operations
- Migration support

**Phase 4**: Email Service
- Template system
- Multiple service support
- Scheduling

**Phase 5**: Polish & Optimization
- Performance improvements
- Better error handling
- User onboarding

### 11. Future Enhancements (Post-MVP)

1. **Multi-format Export**: Markdown, Notion, Obsidian
2. **Smart Categorization**: AI-powered highlight grouping
3. **Social Features**: Share highlight collections
4. **Mobile Sync**: Companion mobile app
5. **Analytics**: Reading patterns and insights
6. **Backup Service**: Cloud backup option

## Implementation Notes for Claude Code

1. Start with a minimal Chrome extension that can read from read.amazon.com
2. Use Chrome's IndexedDB API for storage (not localStorage due to size limits)
3. Implement core scraping logic first, then add scheduling
4. For email in MVP, use EmailJS or a simple webhook to a service like Zapier
5. Make the extension cross-browser compatible (Chrome, Edge, Firefox)
6. Use modern JavaScript (ES6+) with proper error handling
7. Keep the UI simple but functional
8. Add proper logging for debugging
9. Implement graceful degradation if Amazon changes their UI

This specification provides a complete blueprint for building the Kindle Highlights Browser Extension with all necessary details for implementation.