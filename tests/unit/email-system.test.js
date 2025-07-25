// Email System Tests
// Tests for Milestone 4 email functionality

/**
 * @jest-environment jsdom
 */

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  runtime: {
    sendMessage: jest.fn()
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    get: jest.fn()
  }
};

// Mock database
const mockDatabase = {
  init: jest.fn().mockResolvedValue(true),
  getAllHighlights: jest.fn().mockResolvedValue([
    {
      id: 'h1',
      bookAsin: 'B001',
      text: 'Test highlight 1',
      location: 'Page 10',
      dateHighlighted: Date.now(),
      color: 'yellow',
      note: 'Test note',
      tags: ['test']
    },
    {
      id: 'h2',
      bookAsin: 'B001',
      text: 'Test highlight 2',
      location: 'Page 20',
      dateHighlighted: Date.now() - 86400000,
      color: 'blue',
      note: '',
      tags: []
    }
  ]),
  getAllBooks: jest.fn().mockResolvedValue([
    {
      asin: 'B001',
      title: 'Test Book',
      author: 'Test Author'
    }
  ]),
  getBook: jest.fn().mockResolvedValue({
    asin: 'B001',
    title: 'Test Book',
    author: 'Test Author'
  }),
  getHighlight: jest.fn().mockImplementation((id) => {
    const highlights = [
      {
        id: 'h1',
        bookAsin: 'B001',
        text: 'Test highlight 1',
        location: 'Page 10',
        dateHighlighted: Date.now(),
        color: 'yellow',
        note: 'Test note',
        tags: ['test'],
        timesShown: 0,
        lastShown: 0
      },
      {
        id: 'h2',
        bookAsin: 'B001',
        text: 'Test highlight 2',
        location: 'Page 20',
        dateHighlighted: Date.now() - 86400000,
        color: 'blue',
        note: '',
        tags: [],
        timesShown: 0,
        lastShown: 0
      }
    ];
    return Promise.resolve(highlights.find(h => h.id === id));
  }),
  addEmailRecord: jest.fn().mockResolvedValue(true),
  markHighlightAsSent: jest.fn().mockResolvedValue(true),
  updateHighlight: jest.fn().mockResolvedValue(true),
  getEmailHistory: jest.fn().mockResolvedValue([])
};

describe('Email System Components', () => {
  let EmailService, HighlightSelector, EmailScheduler;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Import the classes
    const emailServiceModule = require('../../lib/email-service');
    const highlightSelectorModule = require('../../lib/highlight-selector');
    const emailSchedulerModule = require('../../lib/email-scheduler');
    
    EmailService = emailServiceModule.EmailService;
    HighlightSelector = highlightSelectorModule.HighlightSelector;
    EmailScheduler = emailSchedulerModule.EmailScheduler;
  });

  describe('EmailService', () => {
    let emailService;

    beforeEach(() => {
      emailService = new EmailService();
    });

    test('should initialize with correct configuration', () => {
      expect(emailService.config.publicKey).toBe('FBGMS4hwXj_Pz5KYH');
      expect(emailService.config.serviceId).toBe('service_i5a2wlo');
      expect(emailService.config.templateId).toBe('template_pzja6so');
      expect(emailService.initialized).toBe(false);
    });

    test('should initialize successfully', async () => {
      const result = await emailService.init(mockDatabase);
      
      expect(result.status).toBe('success');
      expect(emailService.database).toBe(mockDatabase);
    });

    test('should generate email content', async () => {
      await emailService.init(mockDatabase);
      
      const highlights = [
        {
          id: 'h1',
          bookAsin: 'B001',
          text: 'Test highlight text',
          location: 'Page 10',
          color: 'yellow',
          note: 'Test note',
          tags: ['important']
        }
      ];

      const userSettings = {
        email: 'test@example.com',
        includeBookInfo: true
      };

      const result = await emailService.generateEmailContent(highlights, userSettings);
      
      expect(result.htmlContent).toContain('Test highlight text');
      expect(result.htmlContent).toContain('Test Book');
      expect(result.htmlContent).toContain('Test note');
      expect(result.textContent).toContain('Test highlight text');
      expect(result.highlightCount).toBe(1);
    });

    test('should generate sample highlights for testing', () => {
      const sampleHighlights = emailService.generateSampleHighlights();
      
      expect(sampleHighlights).toHaveLength(2);
      expect(sampleHighlights[0]).toHaveProperty('id');
      expect(sampleHighlights[0]).toHaveProperty('text');
      expect(sampleHighlights[0]).toHaveProperty('bookAsin');
    });

    test('should generate different email subjects', () => {
      const subject1 = emailService.generateSubject(5);
      const subject2 = emailService.generateSubject(5);
      const subject3 = emailService.generateSubject(3);
      
      expect(typeof subject1).toBe('string');
      expect(subject1.length).toBeGreaterThan(0);
      expect(subject3).toContain('3');
    });

    test('should handle different highlight colors in HTML', () => {
      const yellowHighlight = { color: 'yellow', text: 'Yellow text' };
      const blueHighlight = { color: 'blue', text: 'Blue text' };
      
      const yellowHtml = emailService.generateHighlightHTML(yellowHighlight, {}, 0);
      const blueHtml = emailService.generateHighlightHTML(blueHighlight, {}, 0);
      
      expect(yellowHtml).toContain('#ffc107');
      expect(blueHtml).toContain('#007bff');
    });
  });

  describe('HighlightSelector', () => {
    let highlightSelector;

    beforeEach(() => {
      highlightSelector = new HighlightSelector(mockDatabase);
    });

    test('should initialize with correct default weights', () => {
      expect(highlightSelector.defaultWeights.spacedRepetition).toBe(0.4);
      expect(highlightSelector.defaultWeights.hasNotes).toBe(0.2);
      expect(highlightSelector.defaultWeights.recency).toBe(0.15);
    });

    test('should calculate spaced repetition score', () => {
      const highlight = {
        timesShown: 2,
        lastShown: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
        note: 'Test note',
        tags: ['important']
      };

      const score = highlightSelector.calculateSpacedRepetitionScore(highlight, Date.now());
      
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThan(0);
    });

    test('should select highlights successfully', async () => {
      const result = await highlightSelector.selectHighlights(3, {
        highlightSelectionMode: 'spaced-repetition'
      });
      
      expect(result.status).toBe('success');
      expect(result.highlights).toBeInstanceOf(Array);
      expect(result.algorithm).toBe('spaced-repetition');
      expect(mockDatabase.getAllHighlights).toHaveBeenCalled();
    });

    test('should filter highlights by preferences', () => {
      const highlights = [
        { bookAsin: 'B001', color: 'yellow', tags: ['work'] },
        { bookAsin: 'B002', color: 'blue', tags: ['personal'] },
        { bookAsin: 'B001', color: 'pink', tags: ['work'] }
      ];

      const userSettings = {
        preferredBooks: ['B001'],
        preferredColors: ['yellow', 'pink']
      };

      const filtered = highlightSelector.filterHighlights(highlights, userSettings);
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(h => h.bookAsin === 'B001')).toBe(true);
      expect(filtered.every(h => ['yellow', 'pink'].includes(h.color))).toBe(true);
    });

    test('should handle different selection algorithms', async () => {
      const algorithms = ['random', 'oldest-first', 'newest-first', 'weighted-smart'];
      
      for (const algorithm of algorithms) {
        const result = await highlightSelector.selectHighlights(2, {
          highlightSelectionMode: algorithm
        });
        
        expect(result.status).toBe('success');
        expect(result.algorithm).toBe(algorithm);
      }
    });

    test('should update highlight show statistics', async () => {
      const result = await highlightSelector.markHighlightsAsShown(['h1', 'h2']);
      
      expect(result.status).toBe('success');
      expect(result.updatedCount).toBe(2);
      expect(mockDatabase.updateHighlight).toHaveBeenCalledTimes(2);
    });
  });

  describe('EmailScheduler', () => {
    let emailScheduler, mockEmailService, mockHighlightSelector;

    beforeEach(() => {
      emailScheduler = new EmailScheduler();
      mockEmailService = {
        init: jest.fn().mockResolvedValue({ status: 'success' }),
        sendHighlightEmail: jest.fn().mockResolvedValue({
          status: 'success',
          highlightCount: 3,
          recipient: 'test@example.com'
        }),
        sendTestEmail: jest.fn().mockResolvedValue({
          status: 'success',
          isTest: true
        })
      };
      mockHighlightSelector = {
        selectHighlights: jest.fn().mockResolvedValue({
          status: 'success',
          highlights: [{ id: 'h1' }, { id: 'h2' }]
        }),
        markHighlightsAsShown: jest.fn().mockResolvedValue({
          status: 'success'
        })
      };
    });

    test('should initialize successfully', async () => {
      const result = await emailScheduler.init(mockDatabase, mockEmailService, mockHighlightSelector);
      
      expect(result.status).toBe('success');
      expect(emailScheduler.database).toBe(mockDatabase);
      expect(emailScheduler.emailService).toBe(mockEmailService);
      expect(mockEmailService.init).toHaveBeenCalledWith(mockDatabase);
    });

    test('should calculate next email time correctly', () => {
      const userSettings = {
        emailTime: '09:00',
        emailFrequency: 'daily'
      };

      const nextTime = emailScheduler.calculateNextEmailTime(userSettings);
      const nextDate = new Date(nextTime);
      
      expect(nextDate.getHours()).toBe(9);
      expect(nextDate.getMinutes()).toBe(0);
      expect(nextTime).toBeGreaterThan(Date.now());
    });

    test('should get correct alarm period', () => {
      expect(emailScheduler.getAlarmPeriod('daily')).toBe(24 * 60);
      expect(emailScheduler.getAlarmPeriod('weekly')).toBe(7 * 24 * 60);
      expect(emailScheduler.getAlarmPeriod('manual')).toBeNull();
    });

    test('should handle scheduled email sending', async () => {
      await emailScheduler.init(mockDatabase, mockEmailService, mockHighlightSelector);
      
      const userSettings = {
        email: 'test@example.com',
        highlightsPerEmail: 3,
        enableNotifications: false
      };

      // Mock Chrome storage
      global.chrome.storage.local.get.mockImplementation((key, callback) => {
        callback({ settings: userSettings });
      });

      const result = await emailScheduler.sendScheduledEmail(userSettings);
      
      expect(result.status).toBe('success');
      expect(result.highlightCount).toBe(3);
      expect(mockHighlightSelector.selectHighlights).toHaveBeenCalledWith(3, userSettings);
      expect(mockEmailService.sendHighlightEmail).toHaveBeenCalled();
    });

    test('should handle empty highlights gracefully', async () => {
      await emailScheduler.init(mockDatabase, mockEmailService, mockHighlightSelector);
      
      mockHighlightSelector.selectHighlights.mockResolvedValueOnce({
        status: 'success',
        highlights: []
      });

      const userSettings = {
        email: 'test@example.com',
        highlightsPerEmail: 3
      };

      const result = await emailScheduler.sendScheduledEmail(userSettings);
      
      expect(result.status).toBe('success');
      expect(result.message).toContain('No highlights available');
      expect(result.highlightCount).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    test('should work together for complete email flow', async () => {
      const emailService = new EmailService();
      const highlightSelector = new HighlightSelector(mockDatabase);
      const emailScheduler = new EmailScheduler();
      
      // Initialize email scheduler
      await emailScheduler.init(mockDatabase, emailService, highlightSelector);
      
      // Test the flow
      const userSettings = {
        email: 'test@example.com',
        highlightsPerEmail: 2,
        highlightSelectionMode: 'spaced-repetition',
        includeBookInfo: true
      };

      // Select highlights
      const selectionResult = await highlightSelector.selectHighlights(
        userSettings.highlightsPerEmail,
        userSettings
      );
      
      expect(selectionResult.status).toBe('success');
      expect(selectionResult.highlights.length).toBeGreaterThan(0);
      
      // Generate email content
      const emailContent = await emailService.generateEmailContent(
        selectionResult.highlights,
        userSettings
      );
      
      expect(emailContent.htmlContent).toContain('Test highlight');
      expect(emailContent.highlightCount).toBe(selectionResult.highlights.length);
    });
  });
});