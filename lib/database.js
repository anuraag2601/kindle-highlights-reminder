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

  // Advanced query methods for Milestone 3
  async searchHighlights(query, filters = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        const highlights = await this.getAllHighlights();
        let filtered = highlights;

        // Text search
        if (query) {
          const searchTerm = query.toLowerCase();
          filtered = filtered.filter(highlight => 
            highlight.text.toLowerCase().includes(searchTerm) ||
            highlight.note.toLowerCase().includes(searchTerm) ||
            (highlight.tags && highlight.tags.some(tag => 
              tag.toLowerCase().includes(searchTerm)
            ))
          );
        }

        // Apply filters
        if (filters.bookAsin) {
          filtered = filtered.filter(h => h.bookAsin === filters.bookAsin);
        }
        if (filters.color) {
          filtered = filtered.filter(h => h.color === filters.color);
        }
        if (filters.dateFrom) {
          filtered = filtered.filter(h => h.dateHighlighted >= filters.dateFrom);
        }
        if (filters.dateTo) {
          filtered = filtered.filter(h => h.dateHighlighted <= filters.dateTo);
        }
        if (filters.hasNote !== undefined) {
          filtered = filtered.filter(h => 
            filters.hasNote ? h.note && h.note.trim() : !h.note || !h.note.trim()
          );
        }

        // Sort results by relevance/date
        filtered.sort((a, b) => b.dateHighlighted - a.dateHighlighted);

        resolve(filtered);
      } catch (error) {
        reject(error);
      }
    });
  }

  async getHighlightsByBook(asin, sortBy = 'dateHighlighted') {
    return new Promise(async (resolve, reject) => {
      try {
        const transaction = await this.getTransaction(['highlights']);
        const store = transaction.objectStore('highlights');
        const index = store.index('bookAsin');
        const highlights = [];

        const request = index.openCursor(IDBKeyRange.only(asin));
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            highlights.push(cursor.value);
            cursor.continue();
          } else {
            // Sort highlights
            highlights.sort((a, b) => {
              switch (sortBy) {
                case 'location':
                  return this.compareLocations(a.location, b.location);
                case 'dateAdded':
                  return b.dateAdded - a.dateAdded;
                case 'color':
                  return a.color.localeCompare(b.color);
                default:
                  return b.dateHighlighted - a.dateHighlighted;
              }
            });
            resolve(highlights);
          }
        };
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  compareLocations(locA, locB) {
    // Extract page numbers for comparison
    const pageA = this.extractPageNumber(locA);
    const pageB = this.extractPageNumber(locB);
    
    if (pageA && pageB) {
      return parseInt(pageA) - parseInt(pageB);
    }
    
    // Fallback to string comparison
    return locA.localeCompare(locB);
  }

  extractPageNumber(location) {
    const match = location.match(/(?:page|p\.?)\s*(\d+)/i);
    return match ? match[1] : null;
  }

  async bulkUpdateHighlights(highlightIds, updates) {
    return new Promise(async (resolve, reject) => {
      try {
        const transaction = await this.getTransaction(['highlights'], 'readwrite');
        const store = transaction.objectStore('highlights');
        const results = [];

        let completed = 0;
        const total = highlightIds.length;

        if (total === 0) {
          resolve([]);
          return;
        }

        for (const id of highlightIds) {
          const getRequest = store.get(id);
          getRequest.onsuccess = () => {
            const highlight = getRequest.result;
            if (highlight) {
              const updatedHighlight = { ...highlight, ...updates };
              const putRequest = store.put(updatedHighlight);
              putRequest.onsuccess = () => {
                results.push(updatedHighlight);
                completed++;
                if (completed === total) {
                  resolve(results);
                }
              };
              putRequest.onerror = () => reject(putRequest.error);
            } else {
              completed++;
              if (completed === total) {
                resolve(results);
              }
            }
          };
          getRequest.onerror = () => reject(getRequest.error);
        }

        transaction.onerror = () => reject(transaction.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async bulkDeleteHighlights(highlightIds) {
    return new Promise(async (resolve, reject) => {
      try {
        const transaction = await this.getTransaction(['highlights'], 'readwrite');
        const store = transaction.objectStore('highlights');
        
        let completed = 0;
        const total = highlightIds.length;

        if (total === 0) {
          resolve(0);
          return;
        }

        for (const id of highlightIds) {
          const request = store.delete(id);
          request.onsuccess = () => {
            completed++;
            if (completed === total) {
              resolve(completed);
            }
          };
          request.onerror = () => reject(request.error);
        }

        transaction.onerror = () => reject(transaction.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Data export/import functionality
  async exportAllData() {
    try {
      const [books, highlights, syncHistory, emailHistory] = await Promise.all([
        this.getAllBooks(),
        this.getAllHighlights(),
        this.getSyncHistory(),
        this.getEmailHistory()
      ]);

      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        data: {
          books,
          highlights,
          syncHistory,
          emailHistory
        },
        metadata: {
          totalBooks: books.length,
          totalHighlights: highlights.length,
          totalSyncs: syncHistory.length,
          totalEmails: emailHistory.length
        }
      };

      return exportData;
    } catch (error) {
      console.error('Export failed:', error);
      throw error;
    }
  }

  async importData(importData, options = {}) {
    const { overwrite = false, skipDuplicates = true } = options;
    
    try {
      await this.init();
      const results = {
        books: { imported: 0, skipped: 0, errors: 0 },
        highlights: { imported: 0, skipped: 0, errors: 0 },
        errors: []
      };

      // Import books
      if (importData.data.books) {
        for (const book of importData.data.books) {
          try {
            const existing = await this.getBook(book.asin);
            if (existing && !overwrite) {
              if (skipDuplicates) {
                results.books.skipped++;
                continue;
              }
            }
            await this.addBook(book);
            results.books.imported++;
          } catch (error) {
            results.books.errors++;
            results.errors.push(`Book import error (${book.asin}): ${error.message}`);
          }
        }
      }

      // Import highlights
      if (importData.data.highlights) {
        for (const highlight of importData.data.highlights) {
          try {
            const existing = await this.getHighlight(highlight.id);
            if (existing && !overwrite) {
              if (skipDuplicates) {
                results.highlights.skipped++;
                continue;
              }
            }
            await this.addHighlight(highlight);
            results.highlights.imported++;
          } catch (error) {
            results.highlights.errors++;
            results.errors.push(`Highlight import error (${highlight.id}): ${error.message}`);
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  }

  async getSyncHistory(limit = 50) {
    return new Promise(async (resolve, reject) => {
      try {
        const transaction = await this.getTransaction(['sync_history']);
        const store = transaction.objectStore('sync_history');
        const index = store.index('syncDate');
        const records = [];
        
        let count = 0;
        const request = index.openCursor(null, 'prev'); // Most recent first

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor && count < limit) {
            records.push(cursor.value);
            count++;
            cursor.continue();
          } else {
            resolve(records);
          }
        };
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  async getEmailHistory(limit = 50) {
    return new Promise(async (resolve, reject) => {
      try {
        const transaction = await this.getTransaction(['email_history']);
        const store = transaction.objectStore('email_history');
        const index = store.index('sentDate');
        const records = [];
        
        let count = 0;
        const request = index.openCursor(null, 'prev'); // Most recent first

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor && count < limit) {
            records.push(cursor.value);
            count++;
            cursor.continue();
          } else {
            resolve(records);
          }
        };
        request.onerror = () => reject(request.error);
      } catch (error) {
        reject(error);
      }
    });
  }

  // Database maintenance and cleanup
  async cleanup(options = {}) {
    const {
      removeOldSyncRecords = true,
      removeOldEmailRecords = true,
      maxSyncRecords = 100,
      maxEmailRecords = 100,
      removeOrphanedHighlights = true
    } = options;

    const results = {
      syncRecordsRemoved: 0,
      emailRecordsRemoved: 0,
      orphanedHighlightsRemoved: 0
    };

    try {
      // Clean old sync records
      if (removeOldSyncRecords) {
        const syncRecords = await this.getSyncHistory(1000);
        if (syncRecords.length > maxSyncRecords) {
          const toRemove = syncRecords.slice(maxSyncRecords);
          for (const record of toRemove) {
            await this.performOperation('sync_history', 
              (store) => store.delete(record.id), 
              'readwrite'
            );
            results.syncRecordsRemoved++;
          }
        }
      }

      // Clean old email records
      if (removeOldEmailRecords) {
        const emailRecords = await this.getEmailHistory(1000);
        if (emailRecords.length > maxEmailRecords) {
          const toRemove = emailRecords.slice(maxEmailRecords);
          for (const record of toRemove) {
            await this.performOperation('email_history', 
              (store) => store.delete(record.id), 
              'readwrite'
            );
            results.emailRecordsRemoved++;
          }
        }
      }

      // Remove orphaned highlights (highlights without corresponding books)
      if (removeOrphanedHighlights) {
        const [books, highlights] = await Promise.all([
          this.getAllBooks(),
          this.getAllHighlights()
        ]);
        
        const bookAsins = new Set(books.map(book => book.asin));
        const orphanedHighlights = highlights.filter(h => !bookAsins.has(h.bookAsin));
        
        for (const highlight of orphanedHighlights) {
          await this.deleteHighlight(highlight.id);
          results.orphanedHighlightsRemoved++;
        }
      }

      return results;
    } catch (error) {
      console.error('Database cleanup failed:', error);
      throw error;
    }
  }

  // Enhanced statistics and analytics
  async getAdvancedStats() {
    try {
      const [books, highlights, syncHistory, emailHistory] = await Promise.all([
        this.getAllBooks(),
        this.getAllHighlights(),
        this.getSyncHistory(10),
        this.getEmailHistory(10)
      ]);

      // Calculate reading statistics
      const bookStats = this.calculateBookStats(books, highlights);
      const highlightStats = this.calculateHighlightStats(highlights);
      const timeStats = this.calculateTimeStats(highlights, syncHistory);

      const lastSync = syncHistory[0];

      return {
        totalBooks: books.length,
        totalHighlights: highlights.length,
        lastSyncTime: lastSync ? lastSync.syncDate : null,
        syncStatus: lastSync ? lastSync.status : 'never_synced',
        ...bookStats,
        ...highlightStats,
        ...timeStats
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

  // Statistics calculation helpers
  calculateBookStats(books, highlights) {
    const bookHighlightCounts = {};
    highlights.forEach(h => {
      bookHighlightCounts[h.bookAsin] = (bookHighlightCounts[h.bookAsin] || 0) + 1;
    });

    const highlightCounts = Object.values(bookHighlightCounts);
    
    return {
      booksWithHighlights: Object.keys(bookHighlightCounts).length,
      averageHighlightsPerBook: highlightCounts.length > 0 
        ? Math.round(highlightCounts.reduce((a, b) => a + b, 0) / highlightCounts.length * 10) / 10 
        : 0,
      mostHighlightedBook: this.findMostHighlightedBook(books, bookHighlightCounts),
      booksWithoutHighlights: books.length - Object.keys(bookHighlightCounts).length
    };
  }

  calculateHighlightStats(highlights) {
    const colorCounts = {};
    const tagCounts = {};
    let notesCount = 0;
    
    highlights.forEach(h => {
      // Color distribution
      colorCounts[h.color] = (colorCounts[h.color] || 0) + 1;
      
      // Tag analysis
      if (h.tags && Array.isArray(h.tags)) {
        h.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
      
      // Notes count
      if (h.note && h.note.trim()) {
        notesCount++;
      }
    });

    const mostUsedColor = Object.entries(colorCounts)
      .sort(([,a], [,b]) => b - a)[0];
    
    const topTags = Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count }));

    return {
      colorDistribution: colorCounts,
      mostUsedColor: mostUsedColor ? mostUsedColor[0] : 'yellow',
      highlightsWithNotes: notesCount,
      highlightsWithoutNotes: highlights.length - notesCount,
      topTags: topTags,
      uniqueTags: Object.keys(tagCounts).length
    };
  }

  calculateTimeStats(highlights, syncHistory) {
    if (highlights.length === 0) {
      return {
        oldestHighlight: null,
        newestHighlight: null,
        highlightingSpan: 0,
        averageHighlightsPerDay: 0,
        lastSyncStatus: 'never_synced'
      };
    }

    const dates = highlights.map(h => h.dateHighlighted).filter(d => d);
    dates.sort((a, b) => a - b);
    
    const oldest = dates[0];
    const newest = dates[dates.length - 1];
    const spanDays = Math.max(1, Math.ceil((newest - oldest) / (1000 * 60 * 60 * 24)));
    
    return {
      oldestHighlight: oldest,
      newestHighlight: newest,
      highlightingSpan: spanDays,
      averageHighlightsPerDay: Math.round(highlights.length / spanDays * 10) / 10,
      lastSyncStatus: syncHistory.length > 0 ? syncHistory[0].status : 'never_synced',
      totalSyncs: syncHistory.length
    };
  }

  findMostHighlightedBook(books, bookHighlightCounts) {
    let maxCount = 0;
    let mostHighlightedAsin = null;
    
    for (const [asin, count] of Object.entries(bookHighlightCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mostHighlightedAsin = asin;
      }
    }
    
    if (mostHighlightedAsin) {
      const book = books.find(b => b.asin === mostHighlightedAsin);
      return book ? {
        asin: book.asin,
        title: book.title,
        author: book.author,
        highlightCount: maxCount
      } : null;
    }
    
    return null;
  }

  // Statistics and utility methods (keeping original method for backward compatibility)
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

  // Backward compatibility method
  async exportData() {
    return this.exportAllData();
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