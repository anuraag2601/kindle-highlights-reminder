module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: [
    'lib/**/*.js',
    'popup/**/*.js',
    'options/**/*.js',
    'content-scripts/**/*.js',
    'background.js',
    '!**/node_modules/**',
    '!**/tests/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  globals: {
    chrome: {},
  },
  testPathIgnorePatterns: [
    '/node_modules/'
  ],
  passWithNoTests: true
};
