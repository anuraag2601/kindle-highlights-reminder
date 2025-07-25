# Kindle Highlights Reminder - Claude Instructions

This file provides Claude Code with all the context needed to work effectively on the Kindle Highlights Reminder Chrome extension project.

## 🎯 Project Overview

**Purpose**: Chrome extension that extracts highlights from Amazon Kindle notebook and sends daily email reminders to help users review their highlights.

**Current Status**: Milestone 3 (Data Management & Settings) completed. 72 tests passing. Enhanced database operations, advanced settings UI, data export/import, and highlight management features implemented. Ready for Milestone 4 (Email System).

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

# Run all tests (currently 72 tests passing)
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
- 🔄 **Milestone 4**: Email System (EmailJS integration) - **NEXT**
- ⏳ **Milestone 5**: Production Release (optimization, deployment)

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

### Rate Limiting
**Issue**: Too many requests to Amazon
**Solution**: Built-in delays (2s between books, 500ms between operations)

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

**Last Completed**: Milestone 3 - Data Management & Settings with enhanced database operations, settings UI, and highlight management
**Next Focus**: Milestone 4 - Email System (EmailJS integration)
**Key Metrics**: 72 tests passing, comprehensive error handling, production-ready scraping, advanced data management

**Recently Added**:
- Advanced database queries with search, filtering, and sorting
- Bulk operations for highlight management (update, delete, tag)
- Data export/import functionality with JSON format
- Database cleanup and maintenance operations
- Enhanced analytics and statistics calculation
- Highlight management UI with edit, delete, organize features
- Modern settings interface with real-time validation
- Pagination for large datasets

**Ready for**: EmailJS integration, email template design, scheduled email sending, spaced repetition algorithm for highlight selection.

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

This document should provide everything needed to continue development effectively. Update as the project evolves.