# Kindle Highlights Reminder - Implementation Plan

## Services & API Keys Required

### Email Services (Choose One)

1. **EmailJS** (Recommended for MVP)
   - **API Key Required**: EmailJS Service ID, Template ID, Public Key
   - **Setup**: Create account at emailjs.com, configure email service (Gmail, Outlook, etc.)
   - **Pros**: Easy browser integration, no backend required
   - **Cons**: Limited to ~200 emails/month on free tier

2. **SendGrid** (Alternative)
   - **API Key Required**: SendGrid API Key
   - **Setup**: Create account, verify sender domain/email
   - **Pros**: More reliable, higher limits
   - **Cons**: Requires backend service for API calls (CORS restrictions)

3. **Custom Webhook** (Backup option)
   - **API Key Required**: Your custom endpoint URL + auth token
   - **Setup**: You provide a webhook URL that accepts POST requests
   - **Pros**: Full control, can integrate with any email service
   - **Cons**: Requires you to set up backend service

### No Additional API Keys Needed

- Amazon authentication: Uses existing session cookies
- Data storage: Browser's IndexedDB (local storage)
- Web scraping: Native browser content script APIs

## Implementation Milestones

### Milestone 1: Foundation & Setup

**Goal**: Basic extension structure with testing and version control

#### Deliverables:

- Git repository with proper structure
- Testing framework setup (Jest + Puppeteer)
- CI/CD workflow (GitHub Actions)
- Basic extension structure:
  - `manifest.json` - Extension configuration
  - `popup/popup.html` - Basic popup interface
  - `popup/popup.js` - Popup functionality
  - `popup/popup.css` - Popup styling
  - `background.js` - Service worker
  - `lib/database.js` - IndexedDB wrapper
  - Basic icon files

#### Success Criteria:

- Extension loads successfully in Chrome/Edge
- Popup displays "No highlights yet" state
- Basic settings storage works
- Database initializes correctly
- All tests pass
- Git workflow established

#### Testing:

- Unit tests for database operations
- Extension loading tests
- UI interaction tests

### Milestone 2: Web Scraping Engine

**Goal**: Extract highlights from Amazon Kindle notebook

#### Deliverables:

- `content-scripts/scraper.js` - Main scraping logic
- `content-scripts/parser.js` - HTML parsing utilities
- Enhanced `background.js` - Scraping coordination
- Mock Amazon pages for testing

#### Success Criteria:

- Successfully detects Amazon notebook page
- Extracts book information (title, author, ASIN)
- Extracts highlights with complete metadata
- Handles pagination and "Show More" buttons
- Implements rate limiting and error handling
- Stores data correctly in IndexedDB
- All scraping tests pass

#### Testing:

- End-to-end scraping tests with mock pages
- Rate limiting verification
- Error handling scenarios
- Data integrity tests

### Milestone 3: Data Management & Settings

**Goal**: Robust data storage and user settings

#### Deliverables:

- Complete `lib/database.js` CRUD operations
- `options/options.html` - Full settings page
- `options/options.js` - Settings functionality
- Data export/import features
- Enhanced popup with real statistics

#### Success Criteria:

- Full database schema implemented
- Data migration system works
- Settings persist correctly
- Export/import functionality works
- Data deduplication prevents duplicates
- Statistics display accurately
- All data tests pass

#### Testing:

- Database migration tests
- Settings persistence tests
- Data export/import validation
- Large dataset performance tests

### Milestone 4: Email System

**Goal**: Smart highlight selection and email delivery

#### Deliverables:

- `lib/email-service.js` - Multi-provider email support
- `lib/highlight-selector.js` - Selection algorithms
- Email templates (HTML + text)
- Email configuration UI
- Scheduled email system

#### Success Criteria:

- Email templates render correctly
- Multiple selection algorithms work (random, spaced repetition, oldest-first)
- Scheduled emails send successfully
- Test email functionality works
- Email delivery tracking implemented
- All email tests pass

#### Testing:

- Email template rendering tests
- Selection algorithm verification
- Email service integration tests
- Scheduling system tests

### Milestone 5: Production Release

**Goal**: Polished, production-ready extension

#### Deliverables:

- Complete error handling and recovery
- Performance optimizations
- Cross-browser compatibility
- Security audit and fixes
- User documentation
- Distribution package

#### Success Criteria:

- Error recovery works in all scenarios
- Performance meets benchmarks (<2 min sync for 1000 highlights)
- Works in Chrome, Edge, and Firefox
- Security audit passes
- All integration tests pass
- Extension package ready for store submission

#### Testing:

- Full end-to-end test suite
- Performance benchmarks
- Cross-browser compatibility tests
- Security testing
- User acceptance testing

## Technical Implementation Details

### Database Schema

```javascript
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
  id: string (UUID),
  bookAsin: string,
  text: string,
  location: string,
  page: string,
  dateHighlighted: timestamp,
  dateAdded: timestamp,
  color: string,
  note: string,
  tags: array[string],
  lastSentInEmail: timestamp // for spaced repetition
}

// Store: settings
{
  email: string,
  emailFrequency: 'daily'|'weekly'|'custom',
  emailTime: "09:00",
  highlightsPerEmail: 5,
  syncFrequency: 6, // hours
  emailService: 'emailjs'|'sendgrid'|'webhook',
  emailCredentials: encrypted_object,
  enableAutoSync: boolean,
  highlightSelectionMode: 'random'|'spaced-repetition'|'oldest-first'
}
```

### Scraping Strategy

1. **Page Detection**: Monitor tab updates for read.amazon.com/notebook
2. **Authentication Check**: Verify user is logged in
3. **Progressive Scraping**:
   - Load book list first
   - For each book, click to load highlights
   - Handle pagination with "Show More" clicks
   - Use MutationObserver to wait for dynamic content
4. **Rate Limiting**: 2-second delays between operations
5. **Error Recovery**: Retry failed operations with exponential backoff

### Email Selection Algorithm

```javascript
// Spaced Repetition Logic
function selectHighlightsSpacedRepetition(count = 5) {
  const now = Date.now();
  const highlights = getAllHighlights();

  // Categorize by last sent time
  const neverSent = highlights.filter(h => !h.lastSentInEmail);
  const sent30DaysAgo = highlights.filter(h => daysSince(h.lastSentInEmail) > 30);
  const sent15_30DaysAgo = highlights.filter(h => daysSince(h.lastSentInEmail) 15-30);
  const sent7_15DaysAgo = highlights.filter(h => daysSince(h.lastSentInEmail) 7-15);

  // Mix: 40% never sent, 30% >30 days, 20% 15-30 days, 10% 7-15 days
  return [
    ...shuffle(neverSent).slice(0, Math.ceil(count * 0.4)),
    ...shuffle(sent30DaysAgo).slice(0, Math.ceil(count * 0.3)),
    ...shuffle(sent15_30DaysAgo).slice(0, Math.ceil(count * 0.2)),
    ...shuffle(sent7_15DaysAgo).slice(0, Math.ceil(count * 0.1))
  ].slice(0, count);
}
```

## Security Considerations

1. **Data Privacy**: All data stored locally in browser
2. **Credential Encryption**: Email credentials encrypted using Web Crypto API
3. **Minimal Permissions**: Only request necessary permissions
4. **Session Security**: Use existing Amazon session, no password storage
5. **CORS Handling**: EmailJS bypasses CORS, other services may need proxy

## Potential Challenges & Solutions

### Challenge 1: Amazon UI Changes

**Risk**: Amazon could change their HTML structure
**Solution**:

- Use multiple CSS selectors as fallbacks
- Implement graceful degradation
- Add debug logging to identify selector failures
- Regular monitoring and updates

### Challenge 2: Rate Limiting

**Risk**: Amazon might block rapid requests
**Solution**:

- Implement respectful delays (2+ seconds between operations)
- Exponential backoff on errors
- Allow manual sync override
- Monitor for 429/rate limit responses

### Challenge 3: Email Deliverability

**Risk**: Emails might go to spam or fail to send
**Solution**:

- Use reputable email services (EmailJS, SendGrid)
- Implement email delivery tracking
- Provide test email functionality
- Clear error messages for delivery failures

### Challenge 4: Large Libraries

**Risk**: Users with thousands of highlights
**Solution**:

- Batch processing (50 highlights at a time)
- Progress indicators during sync
- Incremental sync (only new highlights)
- Optional sync limits for very large libraries

### Challenge 5: Cross-Browser Compatibility

**Risk**: Different behavior in Chrome vs Edge vs Firefox
**Solution**:

- Use standard web APIs (avoid Chrome-specific features)
- Test in multiple browsers
- Polyfills for missing features
- Manifest V3 compatibility

## User Onboarding Flow

1. **Install Extension** → Show welcome popup
2. **First Setup** → Guide to Amazon notebook page
3. **Initial Sync** → Progress indicator, explain what's happening
4. **Email Setup** → Configure email address and service
5. **Test Email** → Send sample to verify delivery
6. **Schedule Setup** → Set daily email time
7. **Ready** → Show stats and next sync time

## Success Metrics

- **Functional**: Successfully extracts highlights from Amazon
- **Reliable**: <5% error rate on syncs
- **Performant**: Sync completes in <2 minutes for 1000 highlights
- **User-Friendly**: Setup completes in <5 minutes
- **Stable**: No data loss, proper error recovery

## Testing Strategy & Tools

### Testing Framework Setup

#### Required Dependencies

```json
{
  "devDependencies": {
    "jest": "^29.7.0",
    "puppeteer": "^21.5.0",
    "@types/chrome": "^0.0.251",
    "jest-environment-jsdom": "^29.7.0",
    "jest-chrome": "^0.8.0",
    "fake-indexeddb": "^5.0.1",
    "web-ext": "^7.8.0",
    "eslint": "^8.55.0",
    "prettier": "^3.1.0"
  }
}
```

#### Test Structure

```
tests/
├── setup.js                           # Test environment setup
├── unit/                              # Unit tests
│   ├── database.test.js               # Database operations
│   ├── highlight-selector.test.js     # Selection algorithms
│   ├── parser.test.js                 # HTML parsing
│   ├── email-service.test.js          # Email functionality
│   └── scheduler.test.js              # Task scheduling
├── integration/                       # Integration tests
│   ├── sync-flow.test.js              # Full sync workflow
│   ├── email-flow.test.js             # Email generation and sending
│   ├── extension-loading.test.js      # Extension initialization
│   └── cross-browser.test.js          # Browser compatibility
├── e2e/                              # End-to-end tests
│   ├── scraping.test.js              # Amazon page scraping
│   ├── user-workflow.test.js         # Complete user journey
│   └── performance.test.js           # Performance benchmarks
├── fixtures/                         # Test data and mock pages
│   ├── mock-amazon-notebook.html     # Mock Amazon pages
│   ├── sample-highlights.json        # Test highlight data
│   └── mock-books.json               # Test book data
└── helpers/                          # Test utilities
    ├── extension-helper.js           # Extension loading utilities
    ├── mock-chrome-apis.js           # Chrome API mocks
    └── puppeteer-helper.js           # Puppeteer utilities
```

#### Testing Commands

```bash
npm run test              # Run all tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:e2e          # End-to-end tests only
npm run test:watch        # Watch mode for development
npm run test:coverage     # Coverage report
npm run lint              # ESLint checks
npm run format            # Prettier formatting
```

### Browser Automation Setup

#### Puppeteer Configuration

- Automated Chrome/Edge browser control
- Extension loading and testing
- Amazon page interaction simulation
- Screenshot capture for debugging
- Performance monitoring

#### Test Scenarios

1. **Extension Loading**: Verify extension loads correctly
2. **Popup Interaction**: Test popup UI functionality
3. **Settings Management**: Verify settings persistence
4. **Scraping Simulation**: Test with mock Amazon pages
5. **Email Generation**: Verify email template rendering
6. **Error Handling**: Test failure scenarios
7. **Performance**: Benchmark sync operations

## Version Control & CI/CD

### Git Repository Structure

```
.github/
├── workflows/
│   ├── test.yml                      # Run tests on PR/push
│   ├── build.yml                     # Build extension package
│   └── release.yml                   # Create release packages
├── ISSUE_TEMPLATE/
│   ├── bug_report.md
│   └── feature_request.md
└── pull_request_template.md

.gitignore                            # Git ignore patterns
README.md                             # Project documentation
CHANGELOG.md                          # Version history
LICENSE                               # Project license
```

### Development Workflow

#### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - Feature development
- `hotfix/*` - Bug fixes

#### Commit Workflow

1. **Feature Development**: Work on feature branch
2. **Testing**: Run full test suite locally
3. **Code Review**: Create PR to develop branch
4. **CI/CD**: Automated testing and builds
5. **Merge**: Merge to develop after approval
6. **Release**: Tag and release from main branch

#### GitHub Actions Workflows

##### `.github/workflows/test.yml`

```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run test:e2e
```

##### `.github/workflows/build.yml`

```yaml
name: Build Extension
on:
  push:
    tags: ['v*']
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
      - run: npm run package
      - uses: actions/upload-artifact@v4
        with:
          name: extension-package
          path: dist/
```

### Quality Assurance

#### Pre-commit Hooks

- ESLint for code quality
- Prettier for formatting
- Unit tests must pass
- No console.log statements in production code

#### Code Coverage Requirements

- Minimum 80% code coverage
- 100% coverage for critical functions (database, email, scraping)
- Coverage reports in CI/CD

#### Performance Benchmarks

- Sync 1000 highlights: <2 minutes
- Database operations: <100ms per operation
- Memory usage: <50MB peak
- Extension startup: <1 second

## Development Environment Setup

### Required Software

1. **Node.js 18+** - JavaScript runtime
2. **Chrome/Edge Developer Mode** - Extension testing
3. **Git** - Version control
4. **VS Code** (recommended) - IDE with extensions:
   - Jest Test Explorer
   - Puppeteer Snippets
   - Chrome Extension Pack

### Initial Setup Commands

```bash
# Initialize project
npm init -y
npm install --save-dev jest puppeteer @types/chrome jest-environment-jsdom jest-chrome fake-indexeddb web-ext eslint prettier

# Initialize Git repository
git init
git add .
git commit -m "Initial project setup"

# Create GitHub repository
gh repo create kindle-highlights-reminder --public
git remote add origin https://github.com/yourusername/kindle-highlights-reminder.git
git push -u origin main
```

### EmailJS Setup

1. Create account at [emailjs.com](https://emailjs.com)
2. Configure email service (Gmail recommended)
3. Create email template
4. Get API credentials:
   - Service ID
   - Template ID
   - Public Key

---

**Next Steps**:

1. Set up development environment and testing framework
2. Initialize Git repository with proper structure
3. Set up EmailJS account and get API credentials
4. Review and approve this updated implementation plan
5. Begin Milestone 1 development
