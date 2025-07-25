// Kindle Highlights Reminder - Database Layer
// IndexedDB wrapper for storing highlights, books, and settings

class Database {
  constructor() {
    this.dbName = 'KindleHighlightsDB';
    this.dbVersion = 1;
    this.db = null;
  }

  // Initialize database connection
  async init() {
    if (this.db) {
      return this.db;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Database failed to open:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Database opened successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        this.db = event.target.result;
        console.log('Database upgrade needed, creating object stores');
        this.createObjectStores();
      };
    });
  }

  // Create object stores and indexes
  createObjectStores() {
    // Books store
    if (!this.db.objectStoreNames.contains('books')) {
      const booksStore = this.db.createObjectStore('books', { keyPath: 'asin' });
      booksStore.createIndex('title', 'title', { unique: false });
      booksStore.createIndex('author', 'author', { unique: false });
      booksStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
      console.log('Created books object store');
    }

    // Highlights store
    if (!this.db.objectStoreNames.contains('highlights')) {
      const highlightsStore = this.db.createObjectStore('highlights', { keyPath: 'id' });
      highlightsStore.createIndex('bookAsin', 'bookAsin', { unique: false });
      highlightsStore.createIndex('dateHighlighted', 'dateHighlighted', { unique: false });
      highlightsStore.createIndex('dateAdded', 'dateAdded', { unique: false });
      highlightsStore.createIndex('color', 'color', { unique: false });
      highlightsStore.createIndex('lastSentInEmail', 'lastSentInEmail', { unique: false });
      console.log('Created highlights object store');
    }

    // Sync history store
    if (!this.db.objectStoreNames.contains('sync_history')) {
      const syncStore = this.db.createObjectStore('sync_history', { keyPath: 'id' });
      syncStore.createIndex('syncDate', 'syncDate', { unique: false });
      syncStore.createIndex('status', 'status', { unique: false });
      console.log('Created sync_history object store');
    }

    // Email history store
    if (!this.db.objectStoreNames.contains('email_history')) {
      const emailStore = this.db.createObjectStore('email_history', { keyPath: 'id' });
      emailStore.createIndex('sentDate', 'sentDate', { unique: false });
      emailStore.createIndex('status', 'status', { unique: false });
      console.log('Created email_history object store');
    }
  }

  // Generic transaction helper
  async getTransaction(storeNames, mode = 'readonly') {
    if (!this.db) {
      await this.init();
    }
    return this.db.transaction(storeNames, mode);
  }

  // Generic operation helper
  async performOperation(storeName, operation, mode = 'readonly') {
    return new Promise(async (resolve, reject) => {
      try {
        const transaction = await this.getTransaction([storeName], mode);
        const store = transaction.objectStore(storeName);
        const request = operation(store);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Books operations
  async addBook(book) {
    const bookData = {
      asin: book.asin,
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl || '',
      lastUpdated: Date.now(),
      ...book
    };

    return this.performOperation('books', 
      (store) => store.put(bookData), 
      'readwrite'
    );
  }

  async getBook(asin) {
    return this.performOperation('books', 
      (store) => store.get(asin)
    );
  }

  async getAllBooks() {
    return this.performOperation('books', 
      (store) => store.getAll()
    );
  }

  async updateBook(asin, updates) {
    const book = await this.getBook(asin);
    if (!book) {
      throw new Error(`Book with ASIN ${asin} not found`);
    }

    const updatedBook = {
      ...book,
      ...updates,
      lastUpdated: Date.now()
    };

    return this.performOperation('books', 
      (store) => store.put(updatedBook), 
      'readwrite'
    );
  }

  async deleteBook(asin) {
    return this.performOperation('books', 
      (store) => store.delete(asin), 
      'readwrite'
    );
  }

  // Highlights operations
  async addHighlight(highlight) {
    const highlightData = {
      id: highlight.id || this.generateUUID(),
      bookAsin: highlight.bookAsin,
      text: highlight.text,
      location: highlight.location || '',
      page: highlight.page || '',
      dateHighlighted: highlight.dateHighlighted || Date.now(),
      dateAdded: Date.now(),
      color: highlight.color || 'yellow',
      note: highlight.note || '',
      tags: highlight.tags || [],
      lastSentInEmail: null,
      ...highlight
    };

    return this.performOperation('highlights', 
      (store) => store.put(highlightData), 
      'readwrite'
    );
  }

  async getHighlight(id) {
    return this.performOperation('highlights', 
      (store) => store.get(id)
    );
  }

  async getAllHighlights() {
    return this.performOperation('highlights', 
      (store) => store.getAll()
    );
  }

  async getHighlightsByBook(bookAsin) {
    return new Promise(async (resolve, reject) => {
      try {
        const transaction = await this.getTransaction(['highlights']);
        const store = transaction.objectStore('highlights');
        const index = store.index('bookAsin');
        const request = index.getAll(bookAsin);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async updateHighlight(id, updates) {
    const highlight = await this.getHighlight(id);
    if (!highlight) {
      throw new Error(`Highlight with ID ${id} not found`);
    }

    const updatedHighlight = {
      ...highlight,
      ...updates
    };

    return this.performOperation('highlights', 
      (store) => store.put(updatedHighlight), 
      'readwrite'
    );
  }

  async deleteHighlight(id) {
    return this.performOperation('highlights', 
      (store) => store.delete(id), 
      'readwrite'
    );
  }

  async markHighlightAsSent(id) {
    return this.updateHighlight(id, { 
      lastSentInEmail: Date.now() 
    });
  }

  // Sync history operations
  async addSyncRecord(syncData) {
    const record = {
      id: this.generateUUID(),
      syncDate: Date.now(),
      highlightsAdded: syncData.highlightsAdded || 0,
      highlightsTotal: syncData.highlightsTotal || 0,
      status: syncData.status || 'success',
      errorMessage: syncData.errorMessage || '',
      ...syncData
    };

    return this.performOperation('sync_history', 
      (store) => store.put(record), 
      'readwrite'
    );
  }

  async getLastSyncRecord() {
    return new Promise(async (resolve, reject) => {
      try {
        const transaction = await this.getTransaction(['sync_history']);
        const store = transaction.objectStore('sync_history');
        const index = store.index('syncDate');
        const request = index.openCursor(null, 'prev');

        request.onsuccess = () => {
          const cursor = request.result;
          resolve(cursor ? cursor.value : null);
        };
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Email history operations
  async addEmailRecord(emailData) {
    const record = {
      id: this.generateUUID(),
      sentDate: Date.now(),
      highlightIds: emailData.highlightIds || [],
      status: emailData.status || 'sent',
      ...emailData
    };

    return this.performOperation('email_history', 
      (store) => store.put(record), 
      'readwrite'
    );
  }

  // Statistics and utility methods
  async getStats() {
    try {
      const [books, highlights, lastSync] = await Promise.all([
        this.getAllBooks(),
        this.getAllHighlights(),
        this.getLastSyncRecord()
      ]);

      return {
        totalBooks: books.length,
        totalHighlights: highlights.length,
        lastSyncTime: lastSync ? lastSync.syncDate : null,
        syncStatus: lastSync ? lastSync.status : 'never_synced'
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        totalBooks: 0,
        totalHighlights: 0,
        lastSyncTime: null,
        syncStatus: 'error'
      };
    }
  }

  async clearAllData() {
    const storeNames = ['books', 'highlights', 'sync_history', 'email_history'];
    
    return new Promise(async (resolve, reject) => {
      try {
        const transaction = await this.getTransaction(storeNames, 'readwrite');
        let completed = 0;

        storeNames.forEach(storeName => {
          const store = transaction.objectStore(storeName);
          const request = store.clear();
          
          request.onsuccess = () => {
            completed++;
            if (completed === storeNames.length) {
              console.log('All data cleared');
              resolve();
            }
          };
          
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  // Export/Import functionality
  async exportData() {
    try {
      const [books, highlights, syncHistory, emailHistory] = await Promise.all([
        this.getAllBooks(),
        this.getAllHighlights(),
        this.performOperation('sync_history', (store) => store.getAll()),
        this.performOperation('email_history', (store) => store.getAll())
      ]);

      return {
        version: this.dbVersion,
        exportDate: Date.now(),
        data: {
          books,
          highlights,
          syncHistory,
          emailHistory
        }
      };
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  async importData(exportedData) {
    try {
      const { data } = exportedData;
      
      // Clear existing data
      await this.clearAllData();
      
      // Import books
      if (data.books && data.books.length > 0) {
        for (const book of data.books) {
          await this.addBook(book);
        }
      }
      
      // Import highlights
      if (data.highlights && data.highlights.length > 0) {
        for (const highlight of data.highlights) {
          await this.addHighlight(highlight);
        }
      }
      
      console.log('Data imported successfully');
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  }

  // Helper methods
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('Database connection closed');
    }
  }
}

// Create singleton instance
const database = new Database();

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment (for testing)
  module.exports = { Database, database };
} else if (typeof self !== 'undefined') {
  // Web Worker environment
  self.Database = Database;
  self.database = database;
} else {
  // Browser environment
  window.Database = Database;
  window.database = database;
}