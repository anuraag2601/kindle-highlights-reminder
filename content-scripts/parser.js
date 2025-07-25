// Kindle Highlights Reminder - HTML Parser Utilities
// Milestone 2: Complete implementation of Amazon HTML parsing

console.log('Kindle Highlights Parser: Loaded');

class KindleParser {
  constructor() {
    // Multiple selector sets for different Amazon page versions and layouts
    this.bookSelectors = {
      container: [
        '[data-testid="book-item"]',
        '.kp-notebook-library-book',
        '.library-book',
        'div[class*="library-book"]',
        'div[class*="notebook-book"]',
        '[id*="book-"]',
        '.book-container'
      ],
      title: [
        '[data-testid="book-title"]',
        '.book-title',
        'h1', 'h2', 'h3',
        '[class*="title"]',
        '.kp-notebook-book-title',
        'strong',
        '.book-name'
      ],
      author: [
        '[data-testid="book-author"]',
        '.book-author',
        '[class*="author"]',
        '.kp-notebook-book-author',
        '.by-author'
      ],
      asin: [
        '[data-asin]',
        '[id*="book-"]',
        '[data-book-asin]'
      ],
      cover: [
        'img[data-testid="book-cover"]',
        '.book-cover img',
        'img[class*="cover"]',
        'img[src*="images-amazon"]'
      ]
    };

    this.highlightSelectors = {
      container: [
        '[data-testid="highlight"]',
        '.kp-notebook-highlight',
        '.highlight-content',
        'div[class*="highlight"]',
        '[id*="highlight"]',
        '.annotation',
        '.note-content'
      ],
      text: [
        '[data-testid="highlight-text"]',
        '.highlight-text',
        '.kp-notebook-highlight-text',
        '[class*="highlight-text"]',
        '.annotation-text',
        'span[class*="text"]'
      ],
      location: [
        '[data-testid="highlight-location"]',
        '.highlight-location',
        '.kp-notebook-highlight-location',
        '[class*="location"]',
        '.page-location',
        '.position'
      ],
      note: [
        '[data-testid="highlight-note"]',
        '.highlight-note',
        '.kp-notebook-note',
        '[class*="note"]',
        '.user-note',
        '.personal-note'
      ],
      color: [
        '[data-color]',
        '[class*="color-"]',
        '[data-highlight-color]'
      ]
    };

    // Color mapping for different highlight colors
    this.colorMap = {
      'yellow': 'yellow',
      'blue': 'blue',
      'pink': 'pink',
      'orange': 'orange',
      'highlight-yellow': 'yellow',
      'highlight-blue': 'blue',
      'highlight-pink': 'pink',
      'highlight-orange': 'orange'
    };
  }

  extractBookInfo(element) {
    if (!element) return null;

    try {
      // Extract title
      const title = this.extractTextContent(element, this.bookSelectors.title);
      
      if (!title) {
        // Fallback: look for the largest text content that looks like a title
        const textNodes = this.getTextNodes(element);
        const potentialTitles = textNodes
          .filter(node => node.textContent.length > 5 && node.textContent.length < 200)
          .sort((a, b) => b.textContent.length - a.textContent.length);
        
        if (potentialTitles.length > 0) {
          const fallbackTitle = potentialTitles[0].textContent.trim();
          if (fallbackTitle) {
            return this.createBookObject(fallbackTitle, null, null, null, element);
          }
        }
        return null;
      }

      // Extract author
      const author = this.extractTextContent(element, this.bookSelectors.author);

      // Extract ASIN
      const asin = this.extractASIN(element);

      // Extract cover URL
      const coverUrl = this.extractCoverUrl(element);

      return this.createBookObject(title, author, asin, coverUrl, element);

    } catch (error) {
      console.warn('Error extracting book info:', error);
      return null;
    }
  }

  extractHighlightInfo(element, book) {
    if (!element || !book) return null;

    try {
      // Extract highlight text
      const text = this.extractTextContent(element, this.highlightSelectors.text);
      
      if (!text) {
        // Fallback: try to find the main text content
        const mainText = this.extractMainTextContent(element);
        if (!mainText) return null;
      }

      // Extract location/page information
      const location = this.extractTextContent(element, this.highlightSelectors.location) || '';

      // Extract any associated note
      const note = this.extractTextContent(element, this.highlightSelectors.note) || '';

      // Extract highlight color
      const color = this.extractHighlightColor(element);

      // Extract or estimate date
      const dateHighlighted = this.extractDate(element);

      return this.createHighlightObject(
        text || this.extractMainTextContent(element),
        book,
        location,
        note,
        color,
        dateHighlighted
      );

    } catch (error) {
      console.warn('Error extracting highlight info:', error);
      return null;
    }
  }

  extractTextContent(element, selectors) {
    for (const selector of selectors) {
      const found = this.safeQuerySelector(selector, element);
      if (found && found.textContent && found.textContent.trim()) {
        return this.cleanText(found.textContent);
      }
    }
    return null;
  }

  extractMainTextContent(element) {
    // Find the element with the most meaningful text content
    const textElements = element.querySelectorAll('*');
    let bestElement = null;
    let maxTextLength = 0;

    for (const el of textElements) {
      const text = el.textContent?.trim();
      if (text && text.length > maxTextLength && text.length > 10) {
        // Make sure this element doesn't contain other large text elements
        const childTextLength = Array.from(el.children)
          .reduce((sum, child) => sum + (child.textContent?.length || 0), 0);
        
        if (text.length - childTextLength > maxTextLength) {
          maxTextLength = text.length - childTextLength;
          bestElement = el;
        }
      }
    }

    return bestElement ? this.cleanText(bestElement.textContent) : null;
  }

  extractASIN(element) {
    // First check the element itself for ASIN attributes
    const directAsin = element.getAttribute('data-asin') || 
                      element.getAttribute('data-book-asin') ||
                      element.getAttribute('id');
    
    if (directAsin && this.isValidASIN(directAsin)) {
      return this.cleanASIN(directAsin);
    }
    
    // Try multiple methods to extract ASIN from child elements
    for (const selector of this.bookSelectors.asin) {
      const found = this.safeQuerySelector(selector, element);
      if (found) {
        // Check data attributes
        const asin = found.getAttribute('data-asin') || 
                    found.getAttribute('data-book-asin') ||
                    found.getAttribute('id');
        
        if (asin && this.isValidASIN(asin)) {
          return this.cleanASIN(asin);
        }
      }
    }

    // Fallback: look for ASIN patterns in URLs or IDs
    const allElements = element.querySelectorAll('*');
    for (const el of allElements) {
      const id = el.id;
      const href = el.href;
      const dataAttrs = Array.from(el.attributes)
        .map(attr => attr.value)
        .join(' ');

      const searchText = `${id} ${href} ${dataAttrs}`;
      const asinMatch = searchText.match(/[B][0-9A-Z]{9}/);
      if (asinMatch) {
        return asinMatch[0];
      }
    }

    // Generate a pseudo-ASIN based on title for consistency
    const title = this.extractTextContent(element, this.bookSelectors.title);
    return title ? this.generatePseudoASIN(title) : `UNKNOWN_${Date.now()}`;
  }

  extractCoverUrl(element) {
    for (const selector of this.bookSelectors.cover) {
      const img = this.safeQuerySelector(selector, element);
      if (img && img.src) {
        return img.src;
      }
    }
    return '';
  }

  extractHighlightColor(element) {
    // First check the element itself for color attributes
    const directColor = element.getAttribute('data-color') ||
                       element.getAttribute('data-highlight-color');
    
    if (directColor && this.colorMap[directColor]) {
      return this.colorMap[directColor];
    }
    
    // Try to find color information in child elements
    for (const selector of this.highlightSelectors.color) {
      const colorElement = this.safeQuerySelector(selector, element);
      if (colorElement) {
        const colorAttr = colorElement.getAttribute('data-color') ||
                         colorElement.getAttribute('data-highlight-color');
        
        if (colorAttr && this.colorMap[colorAttr]) {
          return this.colorMap[colorAttr];
        }
      }
    }

    // Check CSS classes for color information
    const classNames = element.className || '';
    for (const [key, value] of Object.entries(this.colorMap)) {
      if (classNames.includes(key)) {
        return value;
      }
    }

    return 'yellow'; // Default color
  }

  extractDate(element) {
    // Look for date information in various formats
    const dateSelectors = [
      '[data-timestamp]',
      '[datetime]',
      '.date',
      '[class*="date"]',
      '.timestamp'
    ];

    for (const selector of dateSelectors) {
      const dateElement = this.safeQuerySelector(selector, element);
      if (dateElement) {
        const timestamp = dateElement.getAttribute('data-timestamp') ||
                         dateElement.getAttribute('datetime') ||
                         dateElement.textContent;
        
        const date = this.parseDate(timestamp);
        if (date) return date;
      }
    }

    // Fallback to current time
    return Date.now();
  }

  parseDate(dateString) {
    if (!dateString) return null;

    // Try parsing as timestamp
    const timestamp = parseInt(dateString);
    if (!isNaN(timestamp) && timestamp > 1000000000) {
      return timestamp > 1000000000000 ? timestamp : timestamp * 1000;
    }

    // Try parsing as date string
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.getTime();
    }

    return null;
  }

  createBookObject(title, author, asin, coverUrl, element) {
    return {
      asin: asin || this.generatePseudoASIN(title),
      title: this.cleanText(title),
      author: this.cleanText(author) || 'Unknown Author',
      coverUrl: coverUrl || '',
      lastUpdated: Date.now(),
      sourceElement: element // For debugging, will be removed before storage
    };
  }

  createHighlightObject(text, book, location, note, color, dateHighlighted) {
    return {
      id: this.generateHighlightId(text, book.asin),
      bookAsin: book.asin,
      text: this.cleanText(text),
      location: this.cleanText(location),
      page: this.extractPageNumber(location),
      dateHighlighted: dateHighlighted || Date.now(),
      dateAdded: Date.now(),
      color: color || 'yellow',
      note: this.cleanText(note),
      tags: this.extractTags(text, note)
    };
  }

  generateHighlightId(text, bookAsin) {
    // Generate a consistent ID based on text content and book
    const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    const hash = this.simpleHash(cleanText + bookAsin);
    return `highlight_${bookAsin}_${hash}`;
  }

  generatePseudoASIN(title) {
    // Generate a consistent pseudo-ASIN for books without real ASINs
    const hash = this.simpleHash(title.toLowerCase());
    return `B${hash.toString(36).toUpperCase().padStart(9, '0').substring(0, 9)}`;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  extractPageNumber(location) {
    if (!location) return '';
    
    // Look for page patterns like "Page 42", "p. 123", etc.
    const pageMatch = location.match(/(?:page|p\.?)\s*(\d+)/i);
    if (pageMatch) {
      return pageMatch[1];
    }

    // Look for location patterns like "Location 2345"
    const locationMatch = location.match(/(?:location|loc\.?)\s*(\d+)/i);
    if (locationMatch) {
      return `loc:${locationMatch[1]}`;
    }

    return location;
  }

  extractTags(text, note) {
    const tags = [];
    const combinedText = `${text} ${note}`.toLowerCase();

    // Simple tag extraction based on common patterns
    const tagPatterns = [
      /\b(important|key|critical|remember)\b/,
      /\b(quote|quotation)\b/,
      /\b(idea|concept|theory)\b/,
      /\b(todo|action|follow\s*up)\b/,
      /\b(question|doubt|unclear)\b/
    ];

    for (const pattern of tagPatterns) {
      if (pattern.test(combinedText)) {
        tags.push(pattern.source.replace(/\\b|\(|\)|[^a-z|]/g, '').split('|')[0]);
      }
    }

    return tags;
  }

  cleanText(text) {
    if (!text) return '';
    
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[""]/g, '"') // Normalize quotes
      .replace(/['']/g, "'") // Normalize apostrophes
      .replace(/…/g, '...') // Normalize ellipsis
      .replace(/\u00A0/g, ' '); // Replace non-breaking spaces
  }

  cleanASIN(asin) {
    return asin.replace(/^book-/, '').replace(/_.*$/, '');
  }

  isValidASIN(asin) {
    return /^[B][0-9A-Z]{9}$/.test(asin.replace(/^book-/, '').replace(/_.*$/, ''));
  }

  getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim()) {
        textNodes.push(node);
      }
    }

    return textNodes;
  }

  // Utility method for safe element selection
  safeQuerySelector(selector, context = document) {
    try {
      return context.querySelector(selector);
    } catch (error) {
      console.warn('Invalid selector:', selector, error);
      return null;
    }
  }

  safeQuerySelectorAll(selector, context = document) {
    try {
      return Array.from(context.querySelectorAll(selector));
    } catch (error) {
      console.warn('Invalid selector:', selector, error);
      return [];
    }
  }
}

// Export for use by scraper and testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { KindleParser };
} else {
  window.KindleParser = KindleParser;
}