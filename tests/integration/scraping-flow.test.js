// Integration tests for scraping flow
/**
 * @jest-environment jsdom
 */

// Need to import parser first since scraper depends on it
const { KindleParser } = require('../../content-scripts/parser.js');

// Make KindleParser globally available for scraper
global.KindleParser = KindleParser;

const { KindleBulkScraper } = require('../../content-scripts/scraper.js');

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn()
  }
};

// Mock window.scrollTo (not implemented in jsdom)
global.window.scrollTo = jest.fn();

describe('Scraping Flow Integration', () => {
  let scraper;
  let mockAmazonPage;

  beforeEach(() => {
    // Clear mocks
    jest.clearAllMocks();
    
    // Set up mock Amazon page
    mockAmazonPage = `
      <html>
        <body>
          <div class="kp-notebook-library-book" data-asin="B123456789">
            <h2 class="book-title">The Great Gatsby</h2>
            <span class="book-author">F. Scott Fitzgerald</span>
            <img class="book-cover" src="https://example.com/cover.jpg" />
          </div>
          
          <div class="kp-notebook-library-book" data-asin="B987654321">
            <h2 class="book-title">To Kill a Mockingbird</h2>
            <span class="book-author">Harper Lee</span>
          </div>
          
          <div class="kp-notebook-highlight" data-color="yellow">
            <span class="highlight-text">In his blue gardens men and girls came and went like moths among the whisperings and the champagne and the stars.</span>
            <span class="highlight-location">Page 39</span>
            <span class="highlight-note">Beautiful imagery</span>
          </div>
          
          <div class="kp-notebook-highlight" data-color="blue">
            <span class="highlight-text">You can't really understand a person until you consider things from his point of view.</span>
            <span class="highlight-location">Page 30</span>
          </div>
        </body>
      </html>
    `;

    document.body.innerHTML = mockAmazonPage;
    
    // Mock the location instead of setting it directly (jsdom doesn't support navigation)
    Object.defineProperty(window, 'location', {
      value: {
        href: 'https://read.amazon.com/notebook'
      },
      writable: true
    });
    
    // Initialize scraper
    scraper = new KindleBulkScraper();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Page Detection', () => {
    test('should detect Kindle notebook page', () => {
      expect(scraper.isKindleNotebookPage()).toBe(true);
      expect(scraper.isActive).toBe(true);
    });

    test('should not activate on non-Kindle pages', () => {
      // Create new scraper with different URL
      Object.defineProperty(window, 'location', {
        value: { href: 'https://example.com' },
        writable: true
      });

      const nonKindleScraper = new KindleScraper();
      expect(nonKindleScraper.isKindleNotebookPage()).toBe(false);
      expect(nonKindleScraper.isActive).toBe(false);
    });
  });

  describe('Book Scraping', () => {
    test('should scrape books from mock page', async () => {
      const books = await scraper.scrapeBooks();

      expect(books).toHaveLength(2);
      
      expect(books[0].title).toBe('The Great Gatsby');
      expect(books[0].author).toBe('F. Scott Fitzgerald');
      expect(books[0].asin).toBe('B123456789');

      expect(books[1].title).toBe('To Kill a Mockingbird');
      expect(books[1].author).toBe('Harper Lee');
      expect(books[1].asin).toBe('B987654321');
    });

    test('should handle empty book list', async () => {
      document.body.innerHTML = '<div>No books found</div>';
      
      const books = await scraper.scrapeBooks();
      expect(books).toHaveLength(0);
    });
  });

  describe('Highlight Scraping', () => {
    test('should scrape highlights from page', async () => {
      const mockBook = {
        asin: 'B123456789',
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald'
      };

      // Mock time-consuming methods
      scraper.openBookHighlights = jest.fn().mockResolvedValue();
      scraper.rateLimiter.waitForHighlights = jest.fn().mockResolvedValue();
      scraper.loadAllHighlights = jest.fn().mockResolvedValue(
        Array.from(document.querySelectorAll('.kp-notebook-highlight'))
      );

      const highlights = await scraper.scrapeBookHighlights(mockBook);

      expect(highlights).toHaveLength(2);
      
      expect(highlights[0].text).toContain('blue gardens men and girls');
      expect(highlights[0].location).toBe('Page 39');
      expect(highlights[0].note).toBe('Beautiful imagery');
      expect(highlights[0].color).toBe('yellow');
      
      expect(highlights[1].text).toContain('understand a person');
      expect(highlights[1].location).toBe('Page 30');
      expect(highlights[1].color).toBe('blue');
    }, 10000);
  });

  describe('Full Scraping Flow', () => {
    test('should complete full scraping process', async () => {
      // Mock time-consuming methods to avoid timeouts
      scraper.waitForPageLoad = jest.fn().mockResolvedValue();
      scraper.openBookHighlights = jest.fn().mockResolvedValue();
      scraper.loadAllHighlights = jest.fn().mockResolvedValue(
        Array.from(document.querySelectorAll('.kp-notebook-highlight'))
      );
      scraper.rateLimiter.waitForBook = jest.fn().mockResolvedValue();
      scraper.rateLimiter.waitForHighlights = jest.fn().mockResolvedValue();

      const result = await scraper.scrapeHighlights();

      expect(result.status).toBe('success');
      expect(result.data.books).toHaveLength(2);
      expect(result.data.highlights).toHaveLength(4); // 2 highlights per book
      expect(result.data.stats.totalBooks).toBe(2);
      expect(result.data.stats.totalHighlights).toBe(4);
    }, 10000);

    test('should handle authentication failure', async () => {
      // Mock authentication check to fail
      scraper.checkAuthenticationState = jest.fn().mockResolvedValue(false);

      const result = await scraper.scrapeHighlights();

      expect(result.status).toBe('error');
      expect(result.message).toBe('Authentication required');
    });

    test('should handle scraping errors gracefully', async () => {
      // Mock scrapeBooks to throw an error
      scraper.scrapeBooks = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await scraper.scrapeHighlights();

      expect(result.status).toBe('error');
      expect(result.message).toBe('Network error');
    });

    test('should prevent concurrent scraping', async () => {
      // Set the scraper state to running to simulate concurrent scraping attempt
      scraper.scraperState.isRunning = true;
      
      // Try to start scraping when already running
      const result = await scraper.scrapeHighlights();

      expect(result.status).toBe('error');
      expect(result.message).toBe('Scraping already in progress');
      
      // Reset state
      scraper.scraperState.isRunning = false;
    });
  });

  describe('Progress Reporting', () => {
    test('should report progress during scraping', async () => {
      // Mock time-consuming methods
      scraper.waitForPageLoad = jest.fn().mockResolvedValue();
      scraper.rateLimiter.waitForBook = jest.fn().mockResolvedValue();
      scraper.rateLimiter.waitForHighlights = jest.fn().mockResolvedValue();
      scraper.openBookHighlights = jest.fn().mockResolvedValue();
      scraper.loadAllHighlights = jest.fn().mockResolvedValue(
        Array.from(document.querySelectorAll('.kp-notebook-highlight'))
      );
      
      // Mock chrome.runtime.sendMessage to capture progress messages
      const progressMessages = [];
      chrome.runtime.sendMessage.mockImplementation((message) => {
        if (message.action === 'scraping-progress') {
          progressMessages.push(message.progress);
        }
      });

      await scraper.scrapeHighlights();

      expect(progressMessages.length).toBeGreaterThan(0);
      expect(progressMessages[progressMessages.length - 1].processedBooks).toBe(2);
    }, 10000);
  });

  describe('Error Handling', () => {
    test('should collect and report errors during scraping', async () => {
      // Mock time-consuming methods
      scraper.waitForPageLoad = jest.fn().mockResolvedValue();
      scraper.rateLimiter.waitForBook = jest.fn().mockResolvedValue();
      scraper.rateLimiter.waitForHighlights = jest.fn().mockResolvedValue();
      scraper.openBookHighlights = jest.fn().mockResolvedValue();
      scraper.loadAllHighlights = jest.fn().mockResolvedValue(
        Array.from(document.querySelectorAll('.kp-notebook-highlight'))
      );
      
      // Mock scrapeBookHighlights to throw errors on specific books
      const originalScrapeBookHighlights = scraper.scrapeBookHighlights;
      scraper.scrapeBookHighlights = jest.fn().mockImplementation(async (book) => {
        if (book && book.title === 'The Great Gatsby') {
          throw new Error('Mock parsing error');
        }
        return originalScrapeBookHighlights.call(scraper, book);
      });

      const result = await scraper.scrapeHighlights();

      expect(result.status).toBe('success'); // Should still succeed with partial data
      expect(result.data.stats.errors).toHaveLength(1);
      expect(result.data.stats.errors[0].book).toBe('The Great Gatsby');
    }, 10000);
  });
});

// RateLimiter is now integrated into the KindleBulkScraper class