// Unit tests for Database class
const { Database } = require('../../lib/database.js');

describe('Database', () => {
  let db;

  beforeEach(async () => {
    db = new Database();
    await db.init();
  });

  afterEach(async () => {
    if (db) {
      await db.clearAllData();
      db.close();
    }
  });

  describe('Initialization', () => {
    test('should initialize database successfully', async () => {
      expect(db.db).toBeTruthy();
      expect(db.dbName).toBe('KindleHighlightsDB');
      expect(db.dbVersion).toBe(1);
    });

    test('should create required object stores', async () => {
      const objectStoreNames = Array.from(db.db.objectStoreNames);
      expect(objectStoreNames).toContain('books');
      expect(objectStoreNames).toContain('highlights');
      expect(objectStoreNames).toContain('sync_history');
      expect(objectStoreNames).toContain('email_history');
    });
  });

  describe('Books Operations', () => {
    const sampleBook = {
      asin: 'B001TEST123',
      title: 'Test Book',
      author: 'Test Author',
      coverUrl: 'https://example.com/cover.jpg'
    };

    test('should add a book successfully', async () => {
      const result = await db.addBook(sampleBook);
      expect(result).toBeTruthy();

      const retrieved = await db.getBook(sampleBook.asin);
      expect(retrieved.title).toBe(sampleBook.title);
      expect(retrieved.author).toBe(sampleBook.author);
      expect(retrieved.lastUpdated).toBeTruthy();
    });

    test('should get all books', async () => {
      await db.addBook(sampleBook);
      await db.addBook({
        ...sampleBook,
        asin: 'B002TEST456',
        title: 'Another Test Book'
      });

      const books = await db.getAllBooks();
      expect(books).toHaveLength(2);
    });

    test('should update a book', async () => {
      await db.addBook(sampleBook);
      
      const updates = { title: 'Updated Title' };
      await db.updateBook(sampleBook.asin, updates);

      const updated = await db.getBook(sampleBook.asin);
      expect(updated.title).toBe('Updated Title');
      expect(updated.author).toBe(sampleBook.author); // Should remain unchanged
    });

    test('should delete a book', async () => {
      await db.addBook(sampleBook);
      await db.deleteBook(sampleBook.asin);

      const retrieved = await db.getBook(sampleBook.asin);
      expect(retrieved).toBeUndefined();
    });

    test('should throw error when updating non-existent book', async () => {
      await expect(db.updateBook('non-existent', { title: 'New Title' }))
        .rejects.toThrow('Book with ASIN non-existent not found');
    });
  });

  describe('Highlights Operations', () => {
    const sampleHighlight = {
      bookAsin: 'B001TEST123',
      text: 'This is a test highlight',
      location: 'Page 42',
      color: 'yellow',
      note: 'Important concept'
    };

    test('should add a highlight successfully', async () => {
      const result = await db.addHighlight(sampleHighlight);
      expect(result).toBeTruthy();

      const highlights = await db.getAllHighlights();
      expect(highlights).toHaveLength(1);
      expect(highlights[0].text).toBe(sampleHighlight.text);
      expect(highlights[0].id).toBeTruthy(); // Should auto-generate ID
    });

    test('should generate UUID for highlights without ID', async () => {
      await db.addHighlight(sampleHighlight);
      const highlights = await db.getAllHighlights();
      
      expect(highlights[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    test('should get highlights by book', async () => {
      const book1Asin = 'B001TEST123';
      const book2Asin = 'B002TEST456';

      await db.addHighlight({ ...sampleHighlight, bookAsin: book1Asin });
      await db.addHighlight({ ...sampleHighlight, bookAsin: book1Asin, text: 'Second highlight' });
      await db.addHighlight({ ...sampleHighlight, bookAsin: book2Asin, text: 'Different book' });

      const book1Highlights = await db.getHighlightsByBook(book1Asin);
      expect(book1Highlights).toHaveLength(2);
      
      const book2Highlights = await db.getHighlightsByBook(book2Asin);
      expect(book2Highlights).toHaveLength(1);
    });

    test('should mark highlight as sent', async () => {
      await db.addHighlight(sampleHighlight);
      const highlights = await db.getAllHighlights();
      const highlightId = highlights[0].id;

      await db.markHighlightAsSent(highlightId);

      const updated = await db.getHighlight(highlightId);
      expect(updated.lastSentInEmail).toBeTruthy();
      expect(typeof updated.lastSentInEmail).toBe('number');
    });
  });

  describe('Statistics', () => {
    test('should return correct stats with no data', async () => {
      const stats = await db.getStats();
      
      expect(stats).toEqual({
        totalBooks: 0,
        totalHighlights: 0,
        lastSyncTime: null,
        syncStatus: 'never_synced'
      });
    });

    test('should return correct stats with data', async () => {
      // Add test data
      await db.addBook({
        asin: 'B001TEST123',
        title: 'Test Book',
        author: 'Test Author'
      });

      await db.addHighlight({
        bookAsin: 'B001TEST123',
        text: 'Test highlight'
      });

      await db.addSyncRecord({
        highlightsAdded: 1,
        highlightsTotal: 1,
        status: 'success'
      });

      const stats = await db.getStats();
      
      expect(stats.totalBooks).toBe(1);
      expect(stats.totalHighlights).toBe(1);
      expect(stats.lastSyncTime).toBeTruthy();
      expect(stats.syncStatus).toBe('success');
    });
  });

  describe('Sync History', () => {
    test('should add sync record', async () => {
      const syncData = {
        highlightsAdded: 5,
        highlightsTotal: 50,
        status: 'success'
      };

      await db.addSyncRecord(syncData);
      const lastSync = await db.getLastSyncRecord();

      expect(lastSync.highlightsAdded).toBe(5);
      expect(lastSync.status).toBe('success');
      expect(lastSync.syncDate).toBeTruthy();
      expect(lastSync.id).toBeTruthy();
    });

    test('should get last sync record', async () => {
      // Add multiple sync records
      await db.addSyncRecord({ status: 'old' });
      await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      await db.addSyncRecord({ status: 'latest' });

      const lastSync = await db.getLastSyncRecord();
      expect(lastSync.status).toBe('latest');
    });
  });

  describe('Data Management', () => {
    test('should clear all data', async () => {
      // Add test data
      await db.addBook({ asin: 'test', title: 'Test' });
      await db.addHighlight({ bookAsin: 'test', text: 'Test' });

      await db.clearAllData();

      const stats = await db.getStats();
      expect(stats.totalBooks).toBe(0);
      expect(stats.totalHighlights).toBe(0);
    });

    test('should export and import data', async () => {
      // Add test data
      const book = { asin: 'B001TEST', title: 'Export Test', author: 'Test Author' };
      const highlight = { bookAsin: 'B001TEST', text: 'Test highlight' };

      await db.addBook(book);
      await db.addHighlight(highlight);

      // Export data
      const exportedData = await db.exportData();
      expect(exportedData.data.books).toHaveLength(1);
      expect(exportedData.data.highlights).toHaveLength(1);

      // Clear and import
      await db.clearAllData();
      await db.importData(exportedData);

      // Verify import
      const stats = await db.getStats();
      expect(stats.totalBooks).toBe(1);
      expect(stats.totalHighlights).toBe(1);

      const importedBook = await db.getBook('B001TEST');
      expect(importedBook.title).toBe('Export Test');
    });
  });

  describe('Utility Methods', () => {
    test('should generate valid UUID', () => {
      const uuid = db.generateUUID();
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    test('should generate unique UUIDs', () => {
      const uuid1 = db.generateUUID();
      const uuid2 = db.generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });
});