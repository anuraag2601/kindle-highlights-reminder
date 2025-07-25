// IndexedDB Mock for Testing
// Provides a simple in-memory implementation of IndexedDB for Jest tests

class MockIDBRequest {
  constructor() {
    this.result = null;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
  }

  _succeed(result) {
    this.result = result;
    if (this.onsuccess) {
      this.onsuccess({ target: this });
    }
  }

  _fail(error) {
    this.error = error;
    if (this.onerror) {
      this.onerror({ target: this });
    }
  }
}

class MockIDBObjectStore {
  constructor(name, keyPath) {
    this.name = name;
    this.keyPath = keyPath;
    this.data = new Map();
    this.indexes = new Map();
  }

  get(key) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      const result = this.data.get(key);
      request._succeed(result);
    }, 0);
    return request;
  }

  getAll() {
    const request = new MockIDBRequest();
    setTimeout(() => {
      const result = Array.from(this.data.values());
      request._succeed(result);
    }, 0);
    return request;
  }

  put(value) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      const key = value[this.keyPath];
      this.data.set(key, value);
      request._succeed(key);
    }, 0);
    return request;
  }

  add(value) {
    return this.put(value);
  }

  delete(key) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      const existed = this.data.has(key);
      this.data.delete(key);
      request._succeed(existed);
    }, 0);
    return request;
  }

  clear() {
    const request = new MockIDBRequest();
    setTimeout(() => {
      this.data.clear();
      request._succeed(true);
    }, 0);
    return request;
  }

  createIndex(name, keyPath, options = {}) {
    this.indexes.set(name, { name, keyPath, options });
  }

  index(name) {
    return new MockIDBIndex(this, name);
  }
}

class MockIDBIndex {
  constructor(store, name) {
    this.store = store;
    this.name = name;
  }

  get(key) {
    return this.store.get(key);
  }

  getAll(key) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      let results = Array.from(this.store.data.values());
      
      if (key !== undefined) {
        // Simple filtering for indexed values
        if (this.name === 'bookAsin') {
          results = results.filter(item => item.bookAsin === key);
        } else if (this.name === 'syncDate' || this.name === 'sentDate') {
          // For date-based indexes, return all items (simplified)
          results = results;
        }
      }
      
      request._succeed(results);
    }, 0);
    return request;
  }

  openCursor(range, direction) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      const items = Array.from(this.store.data.values());
      
      if (direction === 'prev') {
        items.reverse();
      }
      
      let index = 0;
      const cursor = {
        value: items[index],
        continue() {
          index++;
          setTimeout(() => {
            if (index < items.length) {
              cursor.value = items[index];
              if (request.onsuccess) {
                request.onsuccess({ target: request });
              }
            } else {
              cursor.value = null;
              if (request.onsuccess) {
                request.onsuccess({ target: request });
              }
            }
          }, 0);
        }
      };
      
      request.result = items.length > 0 ? cursor : null;
      request._succeed(request.result);
    }, 0);
    return request;
  }
}

class MockIDBTransaction {
  constructor(storeNames, mode) {
    this.storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];
    this.mode = mode;
    this.onerror = null;
    this.oncomplete = null;
    this.stores = new Map();
  }

  objectStore(name) {
    if (!this.stores.has(name)) {
      // Get store from database
      const db = global.mockIDBDatabase;
      if (db && db.stores.has(name)) {
        this.stores.set(name, db.stores.get(name));
      } else {
        throw new Error(`Object store "${name}" not found`);
      }
    }
    return this.stores.get(name);
  }
}

class MockIDBDatabase {
  constructor() {
    this.stores = new Map();
    this.version = 1;
    this.name = 'test';
    this.objectStoreNames = {
      contains: (name) => this.stores.has(name)
    };
  }

  createObjectStore(name, options = {}) {
    const store = new MockIDBObjectStore(name, options.keyPath);
    this.stores.set(name, store);
    return store;
  }

  transaction(storeNames, mode = 'readonly') {
    return new MockIDBTransaction(storeNames, mode);
  }

  close() {
    // Mock close operation
  }
}

class MockIDBFactory {
  constructor() {
    this._databases = new Map();
  }

  open(name, version) {
    const request = new MockIDBRequest();
    
    setTimeout(() => {
      let db = this._databases.get(name);
      const isUpgrade = !db || (version && db.version < version);
      
      if (!db) {
        db = new MockIDBDatabase();
        db.name = name;
        this._databases.set(name, db);
      }
      
      if (version) {
        db.version = version;
      }
      
      global.mockIDBDatabase = db;
      
      if (isUpgrade && request.onupgradeneeded) {
        request.onupgradeneeded({ target: { result: db } });
      }
      
      request._succeed(db);
    }, 0);
    
    return request;
  }

  deleteDatabase(name) {
    const request = new MockIDBRequest();
    setTimeout(() => {
      this._databases.delete(name);
      request._succeed(true);
    }, 0);
    return request;
  }
}

// Mock IDBKeyRange for range queries
const MockIDBKeyRange = {
  only(value) {
    return { only: value };
  },
  bound(lower, upper, lowerOpen, upperOpen) {
    return { lower, upper, lowerOpen, upperOpen };
  },
  lowerBound(bound, open) {
    return { lower: bound, lowerOpen: open };
  },
  upperBound(bound, open) {
    return { upper: bound, upperOpen: open };
  }
};

// Setup global mocks
if (typeof global !== 'undefined') {
  global.indexedDB = new MockIDBFactory();
  global.IDBKeyRange = MockIDBKeyRange;
  global.IDBRequest = MockIDBRequest;
  global.IDBObjectStore = MockIDBObjectStore;
  global.IDBTransaction = MockIDBTransaction;
  global.IDBDatabase = MockIDBDatabase;
  
  // Clear databases between tests
  global.indexedDB._databases = new Map();
}

module.exports = {
  MockIDBFactory,
  MockIDBDatabase,
  MockIDBObjectStore,
  MockIDBTransaction,
  MockIDBRequest,
  MockIDBIndex,
  MockIDBKeyRange
};