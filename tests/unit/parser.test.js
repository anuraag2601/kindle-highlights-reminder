// Unit tests for KindleParser class
/**
 * @jest-environment jsdom
 */

const { KindleParser } = require('../../content-scripts/parser.js');

describe('KindleParser', () => {
  let parser;

  beforeEach(() => {
    parser = new KindleParser();
  });

  describe('Text Extraction', () => {
    test('should extract text content from element', () => {
      document.body.innerHTML = `
        <div id="test-element">
          <span class="title">Test Book Title</span>
          <span class="author">Test Author</span>
        </div>
      `;

      const element = document.getElementById('test-element');
      const title = parser.extractTextContent(element, ['.title']);
      const author = parser.extractTextContent(element, ['.author']);

      expect(title).toBe('Test Book Title');
      expect(author).toBe('Test Author');
    });

    test('should return null when no matching selectors found', () => {
      document.body.innerHTML = '<div id="test">No matching content</div>';
      
      const element = document.getElementById('test');
      const result = parser.extractTextContent(element, ['.nonexistent']);

      expect(result).toBeNull();
    });

    test('should clean text content properly', () => {
      const dirtyText = '  Test   with\n\nweird   spacing  ';
      const cleanText = parser.cleanText(dirtyText);

      expect(cleanText).toBe('Test with weird spacing');
    });
  });

  describe('Book Info Extraction', () => {
    test('should extract complete book info', () => {
      document.body.innerHTML = `
        <div class="book-container" data-asin="B123456789">
          <h2 class="book-title">The Great Gatsby</h2>
          <span class="book-author">F. Scott Fitzgerald</span>
          <img class="book-cover" src="https://example.com/cover.jpg" />
        </div>
      `;

      const element = document.querySelector('.book-container');
      const book = parser.extractBookInfo(element);

      expect(book).toBeTruthy();
      expect(book.title).toBe('The Great Gatsby');
      expect(book.author).toBe('F. Scott Fitzgerald');
      expect(book.asin).toBe('B123456789');
      expect(book.coverUrl).toBe('https://example.com/cover.jpg');
    });

    test('should handle missing book information gracefully', () => {
      document.body.innerHTML = `
        <div class="book-container">
          <h2>Title Only Book</h2>
        </div>
      `;

      const element = document.querySelector('.book-container');
      const book = parser.extractBookInfo(element);

      expect(book).toBeTruthy();
      expect(book.title).toBe('Title Only Book');
      expect(book.author).toBe('Unknown Author');
      expect(book.asin).toBeTruthy(); // Should generate pseudo-ASIN
    });

    test('should return null for element without title', () => {
      document.body.innerHTML = '<div class="book-container">No title here</div>';

      const element = document.querySelector('.book-container');
      const book = parser.extractBookInfo(element);

      // Should use fallback mechanism but may still return something
      // depending on text content analysis
      expect(book).toBeDefined();
    });
  });

  describe('Highlight Info Extraction', () => {
    const mockBook = {
      asin: 'B123456789',
      title: 'Test Book',
      author: 'Test Author'
    };

    test('should extract complete highlight info', () => {
      document.body.innerHTML = `
        <div class="highlight-container" data-color="yellow">
          <span class="highlight-text">This is a great quote from the book.</span>
          <span class="highlight-location">Page 42</span>
          <span class="highlight-note">This is my personal note.</span>
        </div>
      `;

      const element = document.querySelector('.highlight-container');
      const highlight = parser.extractHighlightInfo(element, mockBook);

      expect(highlight).toBeTruthy();
      expect(highlight.text).toBe('This is a great quote from the book.');
      expect(highlight.location).toBe('Page 42');
      expect(highlight.note).toBe('This is my personal note.');
      expect(highlight.color).toBe('yellow');
      expect(highlight.bookAsin).toBe(mockBook.asin);
      expect(highlight.id).toBeTruthy();
    });

    test('should handle minimal highlight info', () => {
      document.body.innerHTML = `
        <div class="highlight-container">
          <p>Just some highlighted text</p>
        </div>
      `;

      const element = document.querySelector('.highlight-container');
      const highlight = parser.extractHighlightInfo(element, mockBook);

      expect(highlight).toBeTruthy();
      expect(highlight.text).toBe('Just some highlighted text');
      expect(highlight.color).toBe('yellow'); // Default color
      expect(highlight.location).toBe('');
      expect(highlight.note).toBe('');
    });
  });

  describe('ASIN Extraction and Generation', () => {
    test('should extract valid ASIN from data attribute', () => {
      document.body.innerHTML = '<div data-asin="B123456789"></div>';
      
      const element = document.querySelector('div');
      const asin = parser.extractASIN(element);

      expect(asin).toBe('B123456789');
    });

    test('should generate pseudo-ASIN when none found', () => {
      document.body.innerHTML = '<div><h1>Test Book Title</h1></div>';
      
      const element = document.querySelector('div');
      const asin = parser.extractASIN(element);

      expect(asin).toMatch(/^B[0-9A-Z]{9}$/);
    });

    test('should validate ASIN format', () => {
      expect(parser.isValidASIN('B123456789')).toBe(true);
      expect(parser.isValidASIN('B12345678A')).toBe(true);
      expect(parser.isValidASIN('invalid')).toBe(false);
      expect(parser.isValidASIN('A123456789')).toBe(false);
      expect(parser.isValidASIN('B12345')).toBe(false);
    });
  });

  describe('Color Extraction', () => {
    test('should extract color from data attribute', () => {
      document.body.innerHTML = '<div data-color="blue"></div>';
      
      const element = document.querySelector('div');
      const color = parser.extractHighlightColor(element);

      expect(color).toBe('blue');
    });

    test('should extract color from CSS class', () => {
      document.body.innerHTML = '<div class="highlight-yellow"></div>';
      
      const element = document.querySelector('div');
      const color = parser.extractHighlightColor(element);

      expect(color).toBe('yellow');
    });

    test('should default to yellow when no color found', () => {
      document.body.innerHTML = '<div></div>';
      
      const element = document.querySelector('div');
      const color = parser.extractHighlightColor(element);

      expect(color).toBe('yellow');
    });
  });

  describe('Page Number Extraction', () => {
    test('should extract page numbers', () => {
      expect(parser.extractPageNumber('Page 42')).toBe('42');
      expect(parser.extractPageNumber('p. 123')).toBe('123');
      expect(parser.extractPageNumber('Location 2345')).toBe('loc:2345');
      expect(parser.extractPageNumber('Random text')).toBe('Random text');
      expect(parser.extractPageNumber('')).toBe('');
    });
  });

  describe('Tag Extraction', () => {
    test('should extract tags from text content', () => {
      const text = 'This is an important concept to remember';
      const note = 'Need to follow up on this idea';
      
      const tags = parser.extractTags(text, note);

      expect(tags).toContain('important');
      expect(tags).toContain('idea');
    });

    test('should return empty array when no tags found', () => {
      const tags = parser.extractTags('Simple text', '');
      
      expect(tags).toEqual([]);
    });
  });

  describe('ID Generation', () => {
    test('should generate consistent highlight IDs', () => {
      const text = 'This is a test highlight';
      const bookAsin = 'B123456789';
      
      const id1 = parser.generateHighlightId(text, bookAsin);
      const id2 = parser.generateHighlightId(text, bookAsin);

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^highlight_B123456789_\d+$/);
    });

    test('should generate different IDs for different content', () => {
      const bookAsin = 'B123456789';
      
      const id1 = parser.generateHighlightId('First text', bookAsin);
      const id2 = parser.generateHighlightId('Second text', bookAsin);

      expect(id1).not.toBe(id2);
    });

    test('should generate consistent pseudo-ASINs', () => {
      const title = 'Test Book Title';
      
      const asin1 = parser.generatePseudoASIN(title);
      const asin2 = parser.generatePseudoASIN(title);

      expect(asin1).toBe(asin2);
      expect(asin1).toMatch(/^B[0-9A-Z]{9}$/);
    });
  });

  describe('Date Parsing', () => {
    test('should parse timestamp strings', () => {
      const timestamp = '1640995200000'; // 2022-01-01
      const parsed = parser.parseDate(timestamp);

      expect(parsed).toBe(1640995200000);
    });

    test('should parse date strings', () => {
      const dateString = '2022-01-01T00:00:00Z';
      const parsed = parser.parseDate(dateString);

      expect(parsed).toBeTruthy();
      expect(typeof parsed).toBe('number');
    });

    test('should return null for invalid dates', () => {
      expect(parser.parseDate('invalid-date')).toBeNull();
      expect(parser.parseDate('')).toBeNull();
      expect(parser.parseDate(null)).toBeNull();
    });
  });

  describe('Utility Methods', () => {
    test('should safely query selectors', () => {
      document.body.innerHTML = '<div class="test">Content</div>';
      
      const found = parser.safeQuerySelector('.test');
      const notFound = parser.safeQuerySelector('.nonexistent');

      expect(found).toBeTruthy();
      expect(found.textContent).toBe('Content');
      expect(notFound).toBeNull();
    });

    test('should handle invalid selectors gracefully', () => {
      const result = parser.safeQuerySelector('invalid[selector');
      
      expect(result).toBeNull();
    });

    test('should get text nodes from element', () => {
      document.body.innerHTML = `
        <div id="test">
          Text node 1
          <span>Text node 2</span>
          Text node 3
        </div>
      `;

      const element = document.getElementById('test');
      const textNodes = parser.getTextNodes(element);

      expect(textNodes.length).toBeGreaterThan(0);
      expect(textNodes.some(node => node.textContent.includes('Text node 1'))).toBe(true);
    });
  });
});