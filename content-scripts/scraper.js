// Kindle Highlights Reminder - Advanced Bulk Extraction Scraper
// Based on analysis of clippings.io extension and Amazon's actual structure
// Hybrid approach: combines bulk extraction with reliable overlay UI

console.log('Kindle Highlights Reminder: Advanced scraper loaded on', window.location.href);

class KindleBulkScraper {
  constructor() {
    this.isActive = false;
    this.parser = new KindleParser();
    this.scraperState = {
      isRunning: false,
      totalBooks: 0,
      processedBooks: 0,
      totalHighlights: 0,
      errors: []
    };
    this.overlay = null;
    this.init();
  }

  init() {
    // Only activate on Amazon Kindle notebook pages
    if (this.isKindleNotebookPage()) {
      console.log('Amazon Kindle notebook page detected');
      this.isActive = true;
      this.checkAuthenticationState();
      this.notifyBackground();
    }
  }

  isKindleNotebookPage() {
    const url = window.location.href;
    return url.includes('read.amazon.com/notebook') || 
           url.includes('read.amazon.com/kp/notebook');
  }

  async checkAuthenticationState() {
    // Check if user is logged in by looking for login indicators
    const loginIndicators = [
      '.ap-sign-in-page',
      '#ap_email',
      '.signin-page'
    ];

    const isLoginPage = loginIndicators.some(selector => 
      document.querySelector(selector) !== null
    );

    if (isLoginPage) {
      this.notifyBackground({
        action: 'auth-required',
        message: 'User needs to log into Amazon'
      });
      return false;
    }

    return true;
  }

  notifyBackground(message = null) {
    const defaultMessage = {
      action: 'page-detected',
      url: window.location.href,
      pageType: 'kindle-notebook',
      isAuthenticated: !document.querySelector('.ap-sign-in-page')
    };

    chrome.runtime.sendMessage(message || defaultMessage);
  }

  // Main scraping method using bulk extraction approach
  async scrapeHighlights(options = {}) {
    if (this.scraperState.isRunning) {
      return {
        status: 'error',
        message: 'Scraping already in progress'
      };
    }

    try {
      this.scraperState.isRunning = true;
      this.scraperState.errors = [];
      
      console.log('Starting advanced bulk highlight extraction...');
      
      // Check authentication first
      if (!(await this.checkAuthenticationState())) {
        throw new Error('Authentication required');
      }

      // Create progress overlay
      this.createProgressOverlay();
      this.updateProgress('Initializing scraper...');

      // Wait for page to fully load
      await this.waitForPageLoad();
      this.updateProgress('Page loaded, extracting books...');

      // Step 1: Extract all books from library in bulk
      const books = await this.extractAllBooksFromLibrary();
      this.scraperState.totalBooks = books.length;
      
      console.log(`Found ${books.length} books`);
      this.updateProgress(`Found ${books.length} books to process`);

      if (books.length === 0) {
        this.updateProgress('No books found in library');
        setTimeout(() => this.removeProgressOverlay(), 2000);
        return {
          status: 'success',
          message: 'No books found in library',
          data: { books: [], highlights: [] }
        };
      }

      // Step 2: Extract highlights for each book using optimized method
      const allHighlights = [];
      
      for (let i = 0; i < books.length; i++) {
        const book = books[i];
        
        try {
          this.updateProgress(`Processing: ${book.title} (${i + 1}/${books.length})`);
          console.log(`Processing book ${i + 1}/${books.length}: ${book.title}`);
          
          const highlights = await this.extractHighlightsForBook(book);
          allHighlights.push(...highlights);
          
          this.scraperState.processedBooks = i + 1;
          this.scraperState.totalHighlights = allHighlights.length;
          
          // Brief pause between books to be respectful
          if (i < books.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (error) {
          console.error(`Error processing book ${book.title}:`, error);
          this.scraperState.errors.push({
            book: book.title,
            error: error.message
          });
        }
      }

      this.updateProgress(`✅ Complete! Found ${allHighlights.length} highlights from ${books.length} books`);
      console.log(`Scraping complete. Found ${allHighlights.length} highlights from ${books.length} books`);

      // Keep overlay visible for 3 seconds
      setTimeout(() => this.removeProgressOverlay(), 3000);

      return {
        status: 'success',
        data: {
          books: books,
          highlights: allHighlights,
          stats: {
            totalBooks: books.length,
            totalHighlights: allHighlights.length,
            errors: this.scraperState.errors
          }
        }
      };

    } catch (error) {
      console.error('Scraping failed:', error);
      this.updateProgress(`❌ Error: ${error.message}`);
      setTimeout(() => this.removeProgressOverlay(), 5000);
      return {
        status: 'error',
        message: error.message,
        data: {
          books: [],
          highlights: [],
          errors: this.scraperState.errors
        }
      };
    } finally {
      this.scraperState.isRunning = false;
    }
  }

  async waitForPageLoad() {
    // Wait for initial content to load
    await new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', resolve);
      }
    });

    // Wait for dynamic content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Extract all books from library using bulk approach
  async extractAllBooksFromLibrary() {
    console.log('Extracting all books from library using bulk approach...');
    
    // Based on actual Amazon HTML structure
    const bookSelectors = [
      '.kp-notebook-library-each-book',  // Primary selector from HTML analysis
      '#kp-notebook-library > div[id]',  // Books have ASINs as IDs
      'div[id][class*="kp-notebook-library-each-book"]'
    ];

    let bookElements = [];
    
    // Try each selector until we find books
    for (const selector of bookSelectors) {
      bookElements = Array.from(document.querySelectorAll(selector));
      if (bookElements.length > 0) {
        console.log(`Found ${bookElements.length} books using selector: ${selector}`);
        break;
      }
    }

    // Fallback: search in library container
    if (bookElements.length === 0) {
      const libraryContainer = document.querySelector('#kp-notebook-library');
      if (libraryContainer) {
        bookElements = Array.from(libraryContainer.children).filter(child => 
          child.id && child.id.match(/^[A-Z0-9]+$/) // ASIN pattern
        );
        console.log(`Found ${bookElements.length} books using library container fallback`);
      }
    }

    const books = [];
    
    for (const element of bookElements) {
      try {
        const book = this.parser.extractBookInfo(element);
        if (book && book.title) {
          // Store the original element for later use
          book.sourceElement = element;
          books.push(book);
        }
      } catch (error) {
        console.warn('Error parsing book element:', error);
      }
    }

    return books;
  }

  // Extract highlights for a specific book using optimized method
  async extractHighlightsForBook(book) {
    console.log(`Extracting highlights for: ${book.title}`);
    
    // Click on the book to load its highlights
    const clicked = await this.clickBookToLoadHighlights(book);
    
    if (!clicked) {
      console.warn(`Could not load highlights for book: ${book.title}`);
      return [];
    }
    
    // Wait for highlights to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get all highlight elements
    const highlightElements = await this.getHighlightElements();
    
    // Load all highlights (handle pagination if needed)
    const allHighlightElements = await this.loadAllHighlights(highlightElements);
    
    // Parse each highlight
    const highlights = [];
    
    for (const element of allHighlightElements) {
      try {
        const highlight = this.parser.extractHighlightInfo(element, book);
        if (highlight && highlight.text) {
          highlights.push(highlight);
        }
      } catch (error) {
        console.warn('Error parsing highlight:', error);
      }
    }
    
    console.log(`Found ${highlights.length} highlights for ${book.title}`);
    return highlights;
  }

  async clickBookToLoadHighlights(book) {
    console.log(`Loading highlights for: ${book.title}`);
    
    let bookElement = book.sourceElement;
    
    // If no source element, try to find it
    if (!bookElement && book.asin) {
      bookElement = document.querySelector(`#${book.asin}`);
    }
    
    if (!bookElement) {
      console.warn(`Could not find book element for "${book.title}"`);
      return false;
    }
    
    try {
      // Find the clickable element with annotations action
      const clickableSpan = bookElement.querySelector('span[data-action="get-annotations-for-asin"]');
      if (clickableSpan) {
        console.log('Clicking on annotations trigger...');
        clickableSpan.click();
      } else {
        // Fallback: click the link
        const clickableLink = bookElement.querySelector('a');
        if (clickableLink) {
          console.log('Clicking on book link...');
          clickableLink.click();
        } else {
          console.log('Clicking on book element directly...');
          bookElement.click();
        }
      }
      
      return true;
    } catch (error) {
      console.error(`Error clicking book element for "${book.title}":`, error);
      return false;
    }
  }

  async getHighlightElements() {
    // Look for highlights in the annotations panel
    const highlightSelectors = [
      '.kp-notebook-highlight',           // Primary selector from HTML analysis
      'div[class*="kp-notebook-highlight"]',
      '[id*="highlight-"]',               // IDs start with "highlight-"
      '.kp-notebook-selectable'
    ];

    let highlightElements = [];
    
    // First try to find highlights within the annotations panel
    const annotationsPanel = document.querySelector('#annotations');
    if (annotationsPanel) {
      for (const selector of highlightSelectors) {
        highlightElements = Array.from(annotationsPanel.querySelectorAll(selector));
        if (highlightElements.length > 0) {
          console.log(`Found ${highlightElements.length} highlights in annotations panel using: ${selector}`);
          break;
        }
      }
    }
    
    // Fallback to searching the entire document
    if (highlightElements.length === 0) {
      for (const selector of highlightSelectors) {
        highlightElements = Array.from(document.querySelectorAll(selector));
        if (highlightElements.length > 0) {
          console.log(`Found ${highlightElements.length} highlights globally using: ${selector}`);
          break;
        }
      }
    }

    // Filter to actual highlights (must have substantial text content)
    highlightElements = highlightElements.filter(element => {
      const textContent = element.textContent || '';
      return textContent.trim().length > 20; // Real highlights are longer
    });
    
    console.log(`Filtered to ${highlightElements.length} actual highlight elements`);
    return highlightElements;
  }

  async loadAllHighlights(initialElements) {
    let allElements = [...initialElements];
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      // Try scrolling to load more highlights
      window.scrollTo(0, document.body.scrollHeight);
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Check for "Show More" buttons
      const showMoreButtons = document.querySelectorAll(
        'button[class*="show-more"], button[class*="load-more"], ' +
        'a[class*="show-more"], a[class*="load-more"]'
      );

      let clicked = false;
      for (const button of showMoreButtons) {
        if (button.offsetParent !== null && !button.disabled) {
          button.click();
          clicked = true;
          await new Promise(resolve => setTimeout(resolve, 2000));
          break;
        }
      }

      // Check for new highlights
      const newElements = await this.getHighlightElements();
      
      if (newElements.length > allElements.length) {
        allElements = newElements;
        console.log(`Loaded more highlights. Total: ${allElements.length}`);
        attempts = 0; // Reset if we found more
      } else {
        attempts++;
      }

      if (!clicked) {
        break; // No more pagination buttons, we're done
      }
    }

    return allElements;
  }

  // Progress overlay UI (inspired by clippings.io)
  createProgressOverlay() {
    if (this.overlay) {
      return; // Already exists
    }

    this.overlay = document.createElement('div');
    this.overlay.id = 'kindle-scraper-overlay';
    this.overlay.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: Arial, sans-serif;
      ">
        <div style="
          background: white;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          text-align: center;
          min-width: 400px;
          max-width: 600px;
        ">
          <h2 style="margin: 0 0 20px 0; color: #333; font-size: 24px;">
            📚 Kindle Highlights Reminder
          </h2>
          <div id="progress-text" style="
            font-size: 16px;
            color: #666;
            margin: 15px 0;
            min-height: 24px;
          ">
            Initializing...
          </div>
          <div style="
            width: 100%;
            height: 4px;
            background: #f0f0f0;
            border-radius: 2px;
            margin: 20px 0;
            overflow: hidden;
          ">
            <div id="progress-bar" style="
              height: 100%;
              background: linear-gradient(90deg, #4CAF50, #45a049);
              width: 0%;
              transition: width 0.3s ease;
            "></div>
          </div>
          <div style="font-size: 12px; color: #999; margin-top: 15px;">
            Please keep this tab active while scraping...
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);
  }

  updateProgress(message) {
    if (!this.overlay) return;

    const progressText = this.overlay.querySelector('#progress-text');
    const progressBar = this.overlay.querySelector('#progress-bar');
    
    if (progressText) {
      progressText.textContent = message;
    }
    
    if (progressBar && this.scraperState.totalBooks > 0) {
      const percentage = (this.scraperState.processedBooks / this.scraperState.totalBooks) * 100;
      progressBar.style.width = percentage + '%';
    }
  }

  removeProgressOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
}

// Initialize scraper with safety check
function initializeScraper() {
  if (typeof KindleParser === 'undefined') {
    console.warn('KindleParser not yet loaded, retrying...');
    setTimeout(initializeScraper, 100);
    return;
  }
  
  console.log('Initializing KindleBulkScraper with loaded KindleParser');
  window.scraper = new KindleBulkScraper();
}

// Start initialization
initializeScraper();

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'ping') {
    console.log('Ping received, responding...');
    sendResponse({ status: 'ready', message: 'Advanced bulk scraper is active' });
    return true;
  }
  
  if (request.action === 'start-scraping') {
    console.log('Starting advanced bulk scraping process...');
    
    // Ensure scraper is initialized
    if (!window.scraper) {
      console.error('Scraper not yet initialized');
      sendResponse({
        status: 'error',
        message: 'Scraper not yet initialized. Please wait and try again.'
      });
      return;
    }
    
    console.log('Advanced scraper is ready, starting bulk extraction...');
    
    window.scraper.scrapeHighlights(request.options || {}).then(result => {
      console.log('Advanced scraping completed:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('Advanced scraping failed:', error);
      sendResponse({
        status: 'error',
        message: error.message
      });
    });
    
    return true; // Keep message channel open for async response
  }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KindleBulkScraper };
}