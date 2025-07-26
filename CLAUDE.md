# Kindle Highlights Reminder - Claude Instructions

This file provides Claude Code with all the context needed to work effectively on the Kindle Highlights Reminder Chrome extension project.

## 🎯 Project Overview

**Purpose**: Chrome extension that extracts highlights from Amazon Kindle notebook and sends daily email reminders to help users review their highlights.

**Achievement**: Successfully implemented a production-ready extension using hybrid bulk extraction approach inspired by analyzing the successful clippings.io extension architecture.

**Current Status**: ✅ **PROJECT COMPLETED** with hybrid bulk extraction approach inspired by clippings.io analysis. Advanced scraper with progress overlay, reliable email system, and auto-sync functionality implemented. Production-ready Chrome extension.

## 🏗️ Architecture & File Structure

```
kindle-highlights-reminder/
├── manifest.json           # Chrome extension manifest (Manifest V3)
├── background.js          # Service worker, handles extension lifecycle
├── popup/                 # Extension popup UI
│   ├── popup.html        # Main popup interface
│   ├── popup.css         # Gradient styling, modern UI
│   └── popup.js          # Popup controller, Chrome API integration
├── options/              # Settings/options page
│   ├── options.html      # Settings interface
│   ├── options.css       # Settings page styling
│   └── options.js        # Settings logic with auto-save
├── content-scripts/      # Web scraping logic for Amazon
│   ├── scraper.js        # Main scraping orchestration
│   └── parser.js         # HTML parsing utilities
├── lib/                  # Shared utilities
│   └── database.js       # IndexedDB wrapper for data persistence
├── tests/                # Comprehensive test suite
│   ├── unit/            # Component-specific tests
│   └── integration/     # Workflow and end-to-end tests
└── icons/               # Extension icons (various sizes)
```

## 🛠️ Development Commands

```bash
# Install dependencies
npm install

# Run all tests (75+ tests)
npm test

# Run specific test file
npm test -- tests/unit/parser.test.js

# Run tests with coverage
npm test -- --coverage

# Lint code
npm run lint

# Load extension in Chrome
# 1. Open Chrome -> Developer Mode
# 2. Load unpacked -> select project folder
```

## 🔧 Technical Stack

- **Platform**: Chrome Extension (Manifest V3)
- **Storage**: IndexedDB for local data persistence
- **Email Service**: EmailJS for sending reminder emails
- **Testing**: Jest with jsdom environment
- **Web Scraping**: Content scripts for Amazon Kindle notebook
- **UI Framework**: Vanilla HTML/CSS/JS with modern styling

## 🎯 KEY LEARNINGS FROM CLIPPINGS.IO ANALYSIS

### What We Learned from Analyzing Clippings.io Extension

**Architecture Analysis**:
- **Framework**: Built with Plasmo (React-based Chrome extension framework)
- **State Management**: Uses Zustand for global state management  
- **Error Tracking**: Sentry integration for production monitoring
- **Build System**: Parcel bundler with heavy minification

**Key Architectural Insight**: 
- Clippings.io uses a **hybrid approach** - their content script is minimal (just adds a banner), while the heavy lifting happens on their web application
- They redirect users to `my.clippings.io` for actual data processing
- Extension primarily serves as a **connector/bridge** rather than doing complex scraping

**Content Script Strategy**:
```javascript
// Their entire content script logic (simplified):
let banner = document.createElement("div");
banner.innerHTML = "Click the [logo] Icon on the toolbar to import...";
document.getElementById("kp-notebook-head").insertBefore(banner, firstChild);
```

**Business Model Approach**:
- SaaS integration focused (exports to "favorite integrations")
- Core functionality on web application, not in extension
- Connection keys link browser extension with user accounts

### Our Hybrid Implementation

Based on this analysis, we implemented a **hybrid approach** that combines the best of both strategies:

1. **Simplified Bulk Extraction** (inspired by clippings.io)
   - Removed complex book-by-book clicking logic
   - Focus on bulk data extraction from current page state
   - Added progress overlay UI similar to their "133 books imported" display

2. **Enhanced Local Processing** (our strength)
   - Robust local database and storage system
   - Offline-first approach without external dependencies
   - Email reminder functionality with spaced repetition

3. **Production-Ready Architecture**:
   - Comprehensive error handling with fallbacks
   - Progress overlay for better user experience
   - Automatic retry mechanisms
   - Graceful degradation when Amazon changes DOM structure

## 📊 Database Schema

**Books Table**:
```javascript
{
  asin: string,           // Amazon Standard Identification Number
  title: string,          // Book title
  author: string,         // Book author
  coverUrl: string,       // Book cover image URL
  lastUpdated: number,    // Timestamp of last update
  highlightCount: number  // Number of highlights for this book
}
```

**Highlights Table**:
```javascript
{
  id: string,            // Generated highlight ID
  bookAsin: string,      // Reference to parent book
  text: string,          // Highlight text content
  location: string,      // Page or location reference
  page: string,          // Extracted page number
  dateHighlighted: number, // When highlight was created
  dateAdded: number,     // When added to our database
  color: string,         // Highlight color (yellow, blue, pink, orange)
  note: string,          // User's personal note
  tags: string[],        // Extracted or assigned tags
  timesShown: number,    // For spaced repetition
  lastShown: number      // Last time shown in email
}
```

**Settings Storage**:
```javascript
{
  email: string,                    // User's email address
  emailFrequency: 'daily',          // How often to send emails
  emailTime: '09:00',              // When to send daily emails
  highlightsPerEmail: 5,           // Number of highlights per email
  syncFrequency: 6,                // Hours between auto-sync
  enableAutoSync: true,            // Auto-sync highlights
  enableNotifications: true,       // Show browser notifications
  highlightSelectionMode: 'spaced-repetition', // Algorithm for selecting highlights
  emailCredentials: {              // EmailJS configuration
    publicKey: 'FBGMS4hwXj_Pz5KYH',
    serviceId: 'service_i5a2wlo',
    templateId: 'template_pzja6so'
  }
}
```

## 🕷️ Web Scraping Strategy

### Amazon Kindle Notebook Scraping

**Target URL**: `https://read.amazon.com/notebook`

**Challenges**:
- Amazon frequently changes DOM structure
- Dynamic content loading with JavaScript
- Authentication required
- Rate limiting needed to avoid detection

**Solution Strategy**:
- Multiple selector fallbacks for robustness
- Rate limiting: 2 seconds between books, 500ms between operations
- Authentication detection and user guidance
- Graceful error handling with partial data recovery

### Selector Patterns

**Books**:
```javascript
const bookSelectors = [
  '[data-testid="book-item"]',    // Modern React components
  '.kp-notebook-library-book',    // Current Amazon styling
  '.library-book',                // Alternative class name
  'div[class*="library-book"]',   // Pattern matching
  'div[class*="notebook-book"]',  // Variant patterns
  '[id*="book-"]'                 // ID-based fallback
];
```

**Highlights**:
```javascript
const highlightSelectors = [
  '[data-testid="highlight"]',    // Modern components
  '.kp-notebook-highlight',       // Current styling
  '.highlight-content',           // Content containers
  'div[class*="highlight"]',      // Pattern matching
  '[id*="highlight"]'             // ID-based fallback
];
```

## 🧪 Testing Strategy

### Test Environment
- **Framework**: Jest with jsdom
- **Environment**: `@jest-environment jsdom`
- **Mocking**: Chrome APIs, DOM elements, external services

### Test Structure
```
tests/
├── unit/                    # Component testing
│   ├── database.test.js    # IndexedDB operations
│   ├── parser.test.js      # HTML parsing logic
│   ├── popup.test.js       # UI functionality
│   └── background.test.js  # Service worker logic
└── integration/            # End-to-end workflows
    └── scraping-flow.test.js # Complete scraping process
```

### Key Testing Patterns

**Chrome API Mocking**:
```javascript
global.chrome = {
  runtime: { sendMessage: jest.fn() },
  storage: { local: { get: jest.fn(), set: jest.fn() } },
  tabs: { query: jest.fn(), create: jest.fn() },
  alarms: { create: jest.fn(), getAll: jest.fn() }
};
```

**Mock Amazon Pages**:
```javascript
const mockAmazonPage = `
  <div class="kp-notebook-library-book" data-asin="B123456789">
    <h2 class="book-title">Test Book</h2>
    <span class="book-author">Test Author</span>
  </div>
  <div class="kp-notebook-highlight" data-color="yellow">
    <span class="highlight-text">Test highlight text</span>
    <span class="highlight-location">Page 42</span>
  </div>
`;
```

**jsdom Adaptations**:
```javascript
// Mock missing jsdom functionality
global.window.scrollTo = jest.fn();
Object.defineProperty(window, 'location', {
  value: { href: 'https://read.amazon.com/notebook' },
  writable: true
});
```

## 🎨 UI/UX Guidelines

### Popup Interface
- **Design**: Modern gradient background, clean typography
- **Colors**: Blue-purple gradient theme
- **Layout**: Stats cards, action buttons, progress indicators
- **Responsive**: Works in 400x600px popup window

### Options Page
- **Sections**: Email settings, sync preferences, highlight selection
- **Validation**: Real-time input validation and feedback
- **Auto-save**: Settings saved automatically on change
- **Testing**: Email test functionality

## 🔄 Development Workflow

### Milestone Progress
- ✅ **Milestone 1**: Foundation (manifest, popup, database, basic structure)
- ✅ **Milestone 2**: Web Scraping Engine (complete Amazon scraping system)
- ✅ **Milestone 3**: Data Management & Settings (enhanced database, settings UI, export/import, highlight management)
- ✅ **Milestone 4**: Advanced Email System (Simple Email Service with mailto approach)
- ✅ **Milestone 5**: Production Release (hybrid bulk extraction, progress overlay, auto-sync)

### Major Architecture Evolution

**Phase 1: Initial Implementation** (Milestones 1-3)
- Book-by-book clicking approach
- Complex rate limiting and retry logic
- Individual book processing with sequential delays

**Phase 2: Clippings.io Analysis & Redesign** (Milestones 4-5)
- Analyzed successful clippings.io extension architecture
- Implemented hybrid bulk extraction approach
- Added professional progress overlay UI
- Simplified email system using native browser capabilities
- Enhanced error handling and user experience

**Result**: Transformed from a complex, unreliable scraper into a production-ready extension with professional UX

### Quality Standards
- **All tests must pass** before milestone completion
- **Error handling** implemented for all operations
- **User feedback** for long-running operations
- **Data validation** for all inputs
- **Chrome extension best practices** followed

## 🚨 Common Issues & Solutions

### Extension Loading
**Issue**: "Could not load options page"
**Solution**: Ensure all referenced files in manifest.json exist

### Test Failures
**Issue**: jsdom limitations (scrollTo, navigation)
**Solution**: Mock browser APIs globally in test setup

### Amazon Scraping
**Issue**: Selectors not found due to DOM changes
**Solution**: Multiple fallback selectors and graceful degradation

### Manifest V3 Compliance
**Issue**: External scripts not allowed, service worker limitations
**Solution**: Use native browser capabilities (mailto:// links for email)

### Rate Limiting
**Issue**: Too many requests to Amazon
**Solution**: Built-in delays (1s between books, respectful timing)

### Scraping Reliability
**Issue**: Book-by-book clicking was unreliable
**Solution**: Hybrid bulk extraction approach inspired by clippings.io analysis

## 📝 Code Style & Patterns

### Error Handling Pattern
```javascript
async function operation() {
  try {
    const result = await riskyOperation();
    return { status: 'success', data: result };
  } catch (error) {
    console.error('Operation failed:', error);
    return { status: 'error', message: error.message };
  }
}
```

### Progress Overlay Pattern (Inspired by Clippings.io)
```javascript
// Professional progress feedback
createProgressOverlay() {
  this.overlay = document.createElement('div');
  this.overlay.innerHTML = `
    <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.8); z-index: 10000;">
      <div style="background: white; padding: 30px; border-radius: 10px;">
        <h2>📚 Kindle Highlights Reminder</h2>
        <div id="progress-text">Processing...</div>
        <div id="progress-bar" style="background: linear-gradient(90deg, #4CAF50, #45a049);"></div>
      </div>
    </div>
  `;
}
```

### Bulk Extraction Pattern
```javascript
// Extract all books at once instead of clicking through each
async extractAllBooksFromLibrary() {
  const bookElements = Array.from(document.querySelectorAll('.kp-notebook-library-each-book'));
  return bookElements.map(element => this.parser.extractBookInfo(element));
}
```

### Manifest V3 Email Pattern
```javascript
// Use native mailto instead of external email services
const mailto = `mailto:${email}?subject=${subject}&body=${encodedBody}`;
await chrome.tabs.create({ url: mailto });
```

### ASIN Handling
```javascript
// Always provide fallback for missing ASINs
const asin = extractASIN(element) || generatePseudoASIN(title);
```

### Selector Fallbacks
```javascript
// Try multiple selectors for robustness
for (const selector of selectors) {
  const element = document.querySelector(selector);
  if (element) return element;
}
```

## 🎯 Current Development Context

**Status**: ✅ **PROJECT COMPLETED**
**Architecture**: Hybrid bulk extraction approach inspired by successful clippings.io extension
**Key Achievement**: Transformed from unreliable book-by-book scraper to production-ready bulk extraction system

**Final Implementation Features**:
- **Advanced Bulk Scraper**: KindleBulkScraper class with progress overlay UI
- **Professional UX**: Overlay modal with progress bar (inspired by clippings.io)
- **Reliable Email System**: Simple Email Service using native mailto:// approach (Manifest V3 compliant)
- **Auto-Sync**: Background sync with user setting controls
- **Error Handling**: Comprehensive fallbacks and graceful degradation
- **Data Management**: Enhanced database operations with spaced repetition
- **Settings Management**: Complete settings UI with real-time validation

**Technical Insights Gained**:
1. **Analysis of Successful Extensions**: Reverse-engineering clippings.io provided crucial architectural insights
2. **Hybrid Approach**: Combining bulk extraction (clippings.io style) with local processing (our strength)
3. **Manifest V3 Compliance**: Using native browser capabilities instead of external dependencies
4. **User Experience**: Professional progress feedback is crucial for long-running operations
5. **Reliability over Complexity**: Simple, robust solutions often outperform complex ones

**Production Ready**: Extension is now ready for Chrome Web Store publication with professional-grade UX and reliability.

## 📚 Dependencies

```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "jest-environment-jsdom": "^29.0.0",
    "jest-chrome": "^0.8.0"
  }
}
```

**Chrome Permissions Required**:
- `storage` - Local data persistence
- `alarms` - Scheduled operations
- `tabs` - Amazon page access
- `notifications` - User notifications
- `*://read.amazon.com/*` - Kindle notebook access

## 🏆 PROJECT COMPLETION SUMMARY

### What We Built
A production-ready Chrome extension that:
- Reliably extracts Kindle highlights using advanced bulk scraping
- Provides professional progress feedback with overlay UI
- Sends email reminders using spaced repetition algorithm
- Supports auto-sync with user preference controls
- Handles errors gracefully with multiple fallback strategies

### Key Technical Achievements
1. **Successful Reverse Engineering**: Analyzed clippings.io to understand successful architecture patterns
2. **Hybrid Architecture**: Combined external insights with our local-first approach
3. **Manifest V3 Compliance**: Built using only native browser capabilities
4. **Professional UX**: Implemented progress overlay and error handling comparable to commercial extensions
5. **Reliable Scraping**: Moved from fragile book-by-book clicking to robust bulk extraction

### Lessons Learned
- **Research competitor solutions** before building complex systems
- **Simple, robust approaches** often outperform complex ones
- **User experience feedback** is crucial for long-running operations
- **Manifest V3 constraints** can be overcome with creative native solutions
- **Hybrid architectures** can combine the best of multiple approaches

**Final Status**: ✅ Production-ready Chrome extension with professional-grade architecture and user experience.

This document chronicles the complete development journey from basic scraper to production-ready extension.