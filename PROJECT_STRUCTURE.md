# Kindle Highlights Reminder - Project Structure

## Complete File Organization

```
kindle-highlights-reminder/
├── README.md                           # Project documentation
├── IMPLEMENTATION_PLAN.md              # Detailed implementation plan
├── PROJECT_STRUCTURE.md               # This file
├── kindle-highlights-reminder-app-specs.md # Original specification
│
├── manifest.json                       # Extension manifest (Manifest V3)
├── background.js                       # Service worker (main background script)
│
├── popup/                              # Extension popup interface
│   ├── popup.html                      # Popup HTML structure
│   ├── popup.js                        # Popup JavaScript logic
│   └── popup.css                       # Popup styling
│
├── options/                            # Settings/options page
│   ├── options.html                    # Settings page HTML
│   ├── options.js                      # Settings page logic
│   └── options.css                     # Settings page styling
│
├── content-scripts/                    # Scripts injected into Amazon pages
│   ├── scraper.js                      # Main scraping logic
│   ├── parser.js                       # HTML parsing utilities
│   └── injector.js                     # DOM manipulation helpers
│
├── lib/                                # Core utility libraries
│   ├── database.js                     # IndexedDB wrapper and operations
│   ├── email-service.js                # Email sending functionality
│   ├── highlight-selector.js           # Smart highlight selection algorithms
│   ├── amazon-auth.js                  # Amazon session management
│   ├── scheduler.js                    # Task scheduling utilities
│   ├── crypto.js                       # Encryption/decryption utilities
│   └── logger.js                       # Logging and debugging utilities
│
├── templates/                          # Email and UI templates
│   ├── email-template.html             # HTML email template
│   ├── email-template-text.txt         # Plain text email template
│   └── onboarding-guide.html           # User onboarding content
│
├── icons/                              # Extension icons
│   ├── icon-16.png                     # 16x16 toolbar icon
│   ├── icon-48.png                     # 48x48 extension management icon
│   ├── icon-128.png                    # 128x128 Chrome Web Store icon
│   └── icon-disabled-16.png            # Disabled state icon
│
├── styles/                             # Shared stylesheets
│   ├── common.css                      # Common styles across all pages
│   ├── variables.css                   # CSS custom properties/variables
│   └── themes.css                      # Theme definitions (light/dark)
│
├── tests/                              # Test files (for future implementation)
│   ├── unit/                           # Unit tests
│   │   ├── database.test.js
│   │   ├── highlight-selector.test.js
│   │   └── parser.test.js
│   ├── integration/                    # Integration tests
│   │   ├── sync-flow.test.js
│   │   └── email-flow.test.js
│   └── test-data/                      # Test fixtures
│       ├── sample-highlights.json
│       └── mock-amazon-pages.html
│
├── docs/                               # Additional documentation
│   ├── API.md                          # Internal API documentation
│   ├── TROUBLESHOOTING.md              # Common issues and solutions
│   └── PRIVACY.md                      # Privacy policy and data handling
│
└── utils/                              # Development utilities
    ├── build.js                        # Build script for packaging
    ├── package.json                    # Development dependencies
    └── zip-extension.js                # Script to create distribution zip
```

## File Responsibilities

### Core Extension Files

#### `manifest.json`

- Extension metadata and permissions
- Service worker registration
- Content script definitions
- Web accessible resources
- Cross-browser compatibility settings

#### `background.js`

- Service worker main entry point
- Alarm/scheduling management
- Message passing coordination
- Tab monitoring and page action
- Extension lifecycle management

### User Interface

#### `popup/` Directory

- **popup.html**: Main extension popup interface
  - Current sync status display
  - Quick stats (total highlights, books)
  - Manual sync trigger
  - Settings access
  - Quick toggles for auto-sync

- **popup.js**: Popup logic and interactions
  - Real-time stats loading
  - Manual sync initiation
  - Settings navigation
  - Status message display

- **popup.css**: Popup styling
  - Responsive design for small popup window
  - Loading states and animations
  - Status indicator styling

#### `options/` Directory

- **options.html**: Full settings page
  - Email configuration section
  - Sync preferences
  - Highlight selection settings
  - Data management tools
  - Debug/advanced options

- **options.js**: Settings page functionality
  - Form validation and submission
  - Settings persistence
  - Test email functionality
  - Data export/import
  - Debug mode controls

- **options.css**: Settings page styling
  - Form layouts and styling
  - Section organization
  - Responsive design for various screen sizes

### Core Logic

#### `content-scripts/` Directory

- **scraper.js**: Main Amazon page scraping
  - Page state detection
  - Navigation to notebook sections
  - Book list extraction
  - Highlight pagination handling
  - Rate limiting implementation

- **parser.js**: HTML parsing utilities
  - Highlight text extraction
  - Metadata parsing (location, color, notes)
  - Book information extraction
  - Fallback selector handling

- **injector.js**: DOM manipulation helpers
  - Safe element clicking
  - Scroll management
  - Loading state detection
  - Error state recovery

#### `lib/` Directory

- **database.js**: IndexedDB operations
  - Database initialization and migrations
  - CRUD operations for all object stores
  - Data validation and sanitization
  - Backup and restore functionality

- **email-service.js**: Email functionality
  - Multiple service provider support (EmailJS, SendGrid, webhooks)
  - Template rendering
  - Delivery tracking and retry logic
  - Credential management

- **highlight-selector.js**: Selection algorithms
  - Random selection
  - Spaced repetition algorithm
  - Oldest-first selection
  - Smart filtering and deduplication

- **amazon-auth.js**: Session management
  - Login state detection
  - Session cookie handling
  - Authentication error recovery
  - Logout detection

- **scheduler.js**: Task scheduling
  - Chrome alarms management
  - Sync scheduling logic
  - Email scheduling calculations
  - Retry scheduling with backoff

- **crypto.js**: Security utilities
  - Credential encryption/decryption
  - Secure key storage
  - Data integrity checks

- **logger.js**: Logging system
  - Debug logging with levels
  - Error tracking and reporting
  - Performance monitoring
  - User action tracking

### Templates and Assets

#### `templates/` Directory

- **email-template.html**: Rich HTML email template
  - Responsive email design
  - Highlight presentation formatting
  - Book information display
  - Unsubscribe/settings links

- **email-template-text.txt**: Plain text fallback
  - Simple text formatting
  - Essential information only
  - Accessibility-friendly

#### `icons/` Directory

- Multiple sizes for different contexts
- Disabled state versions
- High-DPI support

#### `styles/` Directory

- **common.css**: Shared styles across all components
- **variables.css**: CSS custom properties for consistent theming
- **themes.css**: Light/dark theme definitions

## Data Flow Architecture

```
User Action (Popup/Options)
        ↓
    background.js (Message Handling)
        ↓
Content Script (scraper.js) → Amazon Page
        ↓
    parser.js (Data Extraction)
        ↓
    database.js (Storage)
        ↓
highlight-selector.js (Email Selection)
        ↓
email-service.js (Email Generation & Sending)
        ↓
    External Email Service (EmailJS/SendGrid)
```

## Development Workflow

1. **Initial Setup**: Create basic extension structure with manifest.json
2. **UI Development**: Build popup and options pages
3. **Database Layer**: Implement IndexedDB wrapper and schema
4. **Scraping Logic**: Develop content scripts for Amazon interaction
5. **Email System**: Integrate email service and template rendering
6. **Background Services**: Implement scheduling and coordination
7. **Testing**: Unit and integration tests
8. **Packaging**: Build scripts for distribution

## Security Architecture

- **Local Data Only**: All user data stored in browser's IndexedDB
- **Encrypted Credentials**: Email service credentials encrypted with Web Crypto API
- **Minimal Permissions**: Only request necessary browser permissions
- **Content Security Policy**: Strict CSP in manifest.json
- **Secure Communication**: HTTPS only for external API calls

## Performance Considerations

- **Lazy Loading**: Load components only when needed
- **Batch Processing**: Handle large datasets in chunks
- **Memory Management**: Clean up unused objects and event listeners
- **Caching**: Cache book metadata and templates
- **Debouncing**: Prevent rapid repeated operations

This structure provides a solid foundation for building a maintainable, scalable browser extension while following best practices for security, performance, and user experience.
