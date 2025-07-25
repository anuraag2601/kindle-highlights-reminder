// Kindle Highlights Reminder - Content Script Scraper
// Milestone 2: Complete implementation of Amazon Kindle notebook scraping

console.log('Kindle Highlights Reminder: Content script loaded on', window.location.href);

class KindleScraper {
  constructor() {
    this.isActive = false;
    this.parser = new KindleParser();
    this.rateLimiter = new RateLimiter();
    this.scraperState = {
      isRunning: false,
      totalBooks: 0,
      processedBooks: 0,
      totalHighlights: 0,
      errors: []
    };
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
      
      console.log('Starting highlight scraping...');
      
      // Check authentication first
      if (!(await this.checkAuthenticationState())) {
        throw new Error('Authentication required');
      }

      // Wait for page to fully load
      await this.waitForPageLoad();

      // Get all books from the library
      const books = await this.scrapeBooks();
      this.scraperState.totalBooks = books.length;
      
      console.log(`Found ${books.length} books`);

      if (books.length === 0) {
        return {
          status: 'success',
          message: 'No books found in library',
          data: { books: [], highlights: [] }
        };
      }

      // Process each book to get highlights
      const allHighlights = [];
      
      for (let i = 0; i < books.length; i++) {
        const book = books[i];
        
        try {
          console.log(`Processing book ${i + 1}/${books.length}: ${book.title}`);
          
          // Rate limiting between books
          await this.rateLimiter.waitForBook();
          
          const highlights = await this.scrapeBookHighlights(book);
          allHighlights.push(...highlights);
          
          this.scraperState.processedBooks = i + 1;
          this.scraperState.totalHighlights = allHighlights.length;
          
          // Notify progress
          this.notifyProgress();
          
        } catch (error) {
          console.error(`Error processing book ${book.title}:`, error);
          this.scraperState.errors.push({
            book: book.title,
            error: error.message
          });
        }
      }

      console.log(`Scraping complete. Found ${allHighlights.length} highlights from ${books.length} books`);

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

    // Wait a bit more for dynamic content
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  async scrapeBooks() {
    console.log('Scraping books from library...');
    
    // Multiple selectors for different Amazon page versions
    const bookSelectors = [
      '[data-testid="book-item"]',
      '.kp-notebook-library-book',
      '.library-book',
      'div[class*="library-book"]',
      'div[class*="notebook-book"]',
      '[id*="book-"]'
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

    if (bookElements.length === 0) {
      // Try to find books by looking for elements with book-like content
      bookElements = this.findBookElementsFallback();
    }

    const books = [];
    
    for (const element of bookElements) {
      try {
        const book = this.parser.extractBookInfo(element);
        if (book && book.title) {
          books.push(book);
        }
      } catch (error) {
        console.warn('Error parsing book element:', error);
      }
    }

    return books;
  }

  findBookElementsFallback() {
    // Fallback method to find book elements when standard selectors fail
    const potentialBooks = [];
    
    // Look for elements containing book titles and authors
    const allDivs = document.querySelectorAll('div');
    
    for (const div of allDivs) {
      const hasTitle = div.querySelector('[class*="title"], [data-testid*="title"], h1, h2, h3, strong');
      const hasAuthor = div.querySelector('[class*="author"], [data-testid*="author"]');
      
      if (hasTitle && (hasAuthor || div.textContent.includes('by '))) {
        potentialBooks.push(div);
      }
    }
    
    console.log(`Fallback method found ${potentialBooks.length} potential book elements`);
    return potentialBooks;
  }

  async scrapeBookHighlights(book) {
    console.log(`Scraping highlights for: ${book.title}`);
    
    // First, try to navigate to or expand the book's highlights
    await this.openBookHighlights(book);
    
    // Wait for highlights to load
    await this.rateLimiter.waitForHighlights();
    
    // Get all highlight elements
    const highlightElements = await this.getHighlightElements();
    
    // Handle pagination - scroll or click "Show More" to load all highlights
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

  async openBookHighlights(book) {
    // Try to find and click the book element to expand its highlights
    const bookElement = document.querySelector(`[data-asin="${book.asin}"], #${book.asin}`);
    
    if (bookElement) {
      // Look for clickable elements within the book
      const clickableElements = bookElement.querySelectorAll('button, a, [role="button"]');
      
      for (const element of clickableElements) {
        if (element.textContent.toLowerCase().includes('highlight') ||
            element.textContent.toLowerCase().includes('view') ||
            element.classList.contains('expand')) {
          element.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
          break;
        }
      }
    }
  }

  async getHighlightElements() {
    const highlightSelectors = [
      '[data-testid="highlight"]',
      '.kp-notebook-highlight',
      '.highlight-content',
      'div[class*="highlight"]',
      '[id*="highlight"]',
      '.annotation'
    ];

    let highlightElements = [];
    
    for (const selector of highlightSelectors) {
      highlightElements = Array.from(document.querySelectorAll(selector));
      if (highlightElements.length > 0) {
        console.log(`Found ${highlightElements.length} highlights using selector: ${selector}`);
        break;
      }
    }

    return highlightElements;
  }

  async loadAllHighlights(initialElements) {
    let allElements = [...initialElements];
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      // Try to find and click "Show More" or similar pagination buttons
      const showMoreButtons = document.querySelectorAll(
        'button[class*="show-more"], button[class*="load-more"], ' +
        'a[class*="show-more"], a[class*="load-more"], ' +
        '.pagination-next, .next-page'
      );

      let clicked = false;
      
      for (const button of showMoreButtons) {
        if (button.offsetParent !== null && !button.disabled) { // Visible and enabled
          button.click();
          clicked = true;
          break;
        }
      }

      if (!clicked) {
        // Try infinite scroll
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Check for new highlights
      const newElements = await this.getHighlightElements();
      
      if (newElements.length > allElements.length) {
        allElements = newElements;
        console.log(`Loaded more highlights. Total: ${allElements.length}`);
        attempts = 0; // Reset attempts if we found more
      } else {
        attempts++;
      }
    }

    return allElements;
  }

  notifyProgress() {
    chrome.runtime.sendMessage({
      action: 'scraping-progress',
      progress: {
        totalBooks: this.scraperState.totalBooks,
        processedBooks: this.scraperState.processedBooks,
        totalHighlights: this.scraperState.totalHighlights,
        errors: this.scraperState.errors.length
      }
    });
  }
}

// Rate limiter to be respectful to Amazon's servers
class RateLimiter {
  constructor() {
    this.lastBookTime = 0;
    this.lastHighlightTime = 0;
  }

  async waitForBook() {
    const now = Date.now();
    const timeSinceLastBook = now - this.lastBookTime;
    const minBookDelay = 2000; // 2 seconds between books

    if (timeSinceLastBook < minBookDelay) {
      const waitTime = minBookDelay - timeSinceLastBook;
      console.log(`Rate limiting: waiting ${waitTime}ms before next book`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastBookTime = Date.now();
  }

  async waitForHighlights() {
    const now = Date.now();
    const timeSinceLastHighlight = now - this.lastHighlightTime;
    const minHighlightDelay = 500; // 500ms between highlight operations

    if (timeSinceLastHighlight < minHighlightDelay) {
      const waitTime = minHighlightDelay - timeSinceLastHighlight;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastHighlightTime = Date.now();
  }
}

// Initialize scraper with safety check
function initializeScraper() {
  if (typeof KindleParser === 'undefined') {
    console.warn('KindleParser not yet loaded, retrying...');
    setTimeout(initializeScraper, 100);
    return;
  }
  
  console.log('Initializing KindleScraper with loaded KindleParser');
  window.scraper = new KindleScraper();
}

// Start initialization
initializeScraper();

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'start-scraping') {
    console.log('Starting scraping process...');
    
    // Ensure scraper is initialized
    if (!window.scraper) {
      console.error('Scraper not yet initialized');
      sendResponse({
        status: 'error',
        message: 'Scraper not yet initialized. Please wait and try again.'
      });
      return;
    }
    
    console.log('Scraper is ready, starting highlight scraping...');
    
    window.scraper.scrapeHighlights(request.options || {}).then(result => {
      console.log('Scraping completed:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('Scraping failed:', error);
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
  module.exports = { KindleScraper, RateLimiter };
}