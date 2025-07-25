// Jest setup file for Chrome extension testing
require('jest-chrome');

// Mock IndexedDB
require('fake-indexeddb/auto');

// Mock chrome APIs
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    sendMessage: jest.fn(),
    getURL: jest.fn((path) => `chrome-extension://test-id/${path}`),
    id: 'test-extension-id',
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    },
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    },
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    clearAll: jest.fn(),
    get: jest.fn(),
    getAll: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  notifications: {
    create: jest.fn(),
    clear: jest.fn(),
    onClicked: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
};

// Mock console methods in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
