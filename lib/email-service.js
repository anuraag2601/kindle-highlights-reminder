// Kindle Highlights Reminder - Email Service
// EmailJS integration for sending highlight reminder emails

class EmailService {
  constructor() {
    // EmailJS configuration - already set up in CLAUDE.md
    this.config = {
      publicKey: 'FBGMS4hwXj_Pz5KYH',
      serviceId: 'service_i5a2wlo', 
      templateId: 'template_pzja6so'
    };
    
    this.initialized = false;
    this.database = null;
  }

  // Initialize EmailJS and dependencies
  async init(database) {
    try {
      this.database = database;
      
      // Initialize EmailJS if in browser environment
      if (typeof emailjs !== 'undefined') {
        emailjs.init(this.config.publicKey);
        this.initialized = true;
        console.log('EmailJS initialized successfully');
      } else {
        console.warn('EmailJS not available in this environment');
      }
      
      return { status: 'success' };
    } catch (error) {
      console.error('Failed to initialize EmailService:', error);
      return { status: 'error', message: error.message };
    }
  }

  // Send highlight reminder email
  async sendHighlightEmail(highlights, userSettings) {
    try {
      if (!this.initialized) {
        throw new Error('EmailService not initialized');
      }

      if (!highlights || highlights.length === 0) {
        throw new Error('No highlights provided for email');
      }

      // Generate email content
      const emailContent = await this.generateEmailContent(highlights, userSettings);
      
      // Prepare EmailJS template parameters
      const templateParams = {
        to_email: userSettings.email,
        to_name: userSettings.name || 'Reader',
        subject: this.generateSubject(highlights.length),
        highlights_html: emailContent.htmlContent,
        highlights_count: highlights.length,
        date: new Date().toLocaleDateString(),
        unsubscribe_link: this.generateUnsubscribeLink()
      };

      // Send email via EmailJS
      const response = await emailjs.send(
        this.config.serviceId,
        this.config.templateId,
        templateParams
      );

      // Record email in database
      await this.recordEmailSent(highlights, userSettings, response);

      return {
        status: 'success',
        messageId: response.text,
        highlightCount: highlights.length,
        recipient: userSettings.email
      };

    } catch (error) {
      console.error('Failed to send highlight email:', error);
      
      // Record failed email attempt
      await this.recordEmailFailed(highlights, userSettings, error);
      
      return {
        status: 'error',
        message: error.message,
        error: error
      };
    }
  }

  // Generate email content from highlights
  async generateEmailContent(highlights, userSettings) {
    try {
      // Get book information for highlights
      const bookData = await this.getBookDataForHighlights(highlights);
      
      // Group highlights by book if user preference is set
      const groupedHighlights = userSettings.includeBookInfo 
        ? this.groupHighlightsByBook(highlights, bookData)
        : highlights;

      // Generate HTML content
      const htmlContent = this.generateHTMLContent(groupedHighlights, bookData, userSettings);
      
      // Generate plain text fallback
      const textContent = this.generateTextContent(highlights, bookData);

      return {
        htmlContent,
        textContent,
        highlightCount: highlights.length,
        bookCount: Object.keys(bookData).length
      };

    } catch (error) {
      console.error('Failed to generate email content:', error);
      throw error;
    }
  }

  // Get book data for given highlights
  async getBookDataForHighlights(highlights) {
    const bookData = {};
    const uniqueAsins = [...new Set(highlights.map(h => h.bookAsin))];
    
    for (const asin of uniqueAsins) {
      try {
        const book = await this.database.getBook(asin);
        if (book) {
          bookData[asin] = book;
        }
      } catch (error) {
        console.warn(`Failed to get book data for ASIN ${asin}:`, error);
        // Provide fallback book data
        bookData[asin] = {
          title: 'Unknown Book',
          author: 'Unknown Author',
          asin: asin
        };
      }
    }
    
    return bookData;
  }

  // Group highlights by book
  groupHighlightsByBook(highlights, bookData) {
    const grouped = {};
    
    highlights.forEach(highlight => {
      const asin = highlight.bookAsin;
      if (!grouped[asin]) {
        grouped[asin] = {
          book: bookData[asin] || { title: 'Unknown Book', author: 'Unknown Author' },
          highlights: []
        };
      }
      grouped[asin].highlights.push(highlight);
    });
    
    return grouped;
  }

  // Generate HTML email content
  generateHTMLContent(highlights, bookData, userSettings) {
    const isGrouped = typeof highlights === 'object' && !Array.isArray(highlights);
    
    let htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white;">
        <header style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">📚 Your Daily Highlights</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</p>
        </header>
        <main style="padding: 30px;">
    `;

    if (isGrouped) {
      // Grouped by book
      Object.values(highlights).forEach(bookGroup => {
        htmlContent += this.generateBookSection(bookGroup.book, bookGroup.highlights, userSettings);
      });
    } else {
      // Simple list
      htmlContent += this.generateHighlightsList(highlights, bookData, userSettings);
    }

    htmlContent += `
        </main>
        <footer style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; color: #666; font-size: 14px;">
          <p style="margin: 0;">Keep reading, keep growing! 📖</p>
          <p style="margin: 10px 0 0 0; font-size: 12px;">
            <a href="#" style="color: #667eea; text-decoration: none;">Manage your highlights</a> | 
            <a href="#" style="color: #667eea; text-decoration: none;">Update preferences</a>
          </p>
        </footer>
      </div>
    `;

    return htmlContent;
  }

  // Generate book section HTML
  generateBookSection(book, highlights, userSettings) {
    let html = `
      <div style="margin-bottom: 40px; border-left: 4px solid #667eea; padding-left: 20px;">
        <h2 style="margin: 0 0 8px 0; color: #333; font-size: 20px;">${book.title}</h2>
        <p style="margin: 0 0 20px 0; color: #666; font-style: italic;">by ${book.author}</p>
    `;

    highlights.forEach((highlight, index) => {
      html += this.generateHighlightHTML(highlight, userSettings, index);
    });

    html += `</div>`;
    return html;
  }

  // Generate highlights list HTML
  generateHighlightsList(highlights, bookData, userSettings) {
    let html = '<div style="space-y: 24px;">';
    
    highlights.forEach((highlight, index) => {
      const book = bookData[highlight.bookAsin];
      
      if (userSettings.includeBookInfo && book) {
        html += `
          <div style="margin-bottom: 24px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <div style="margin-bottom: 12px;">
              <strong style="color: #667eea; font-size: 16px;">${book.title}</strong>
              <span style="color: #666; margin-left: 8px;">by ${book.author}</span>
            </div>
        `;
      } else {
        html += '<div style="margin-bottom: 24px; padding: 20px; background: #f8f9fa; border-radius: 8px;">';
      }
      
      html += this.generateHighlightHTML(highlight, userSettings, index);
      html += '</div>';
    });
    
    html += '</div>';
    return html;
  }

  // Generate individual highlight HTML
  generateHighlightHTML(highlight, userSettings, index) {
    const colorStyles = {
      yellow: 'background: #fffbf0; border-left: 4px solid #ffc107;',
      blue: 'background: #f0f8ff; border-left: 4px solid #007bff;',
      pink: 'background: #fdf2f8; border-left: 4px solid #e83e8c;',
      orange: 'background: #fff5f0; border-left: 4px solid #fd7e14;'
    };

    const style = colorStyles[highlight.color] || colorStyles.yellow;
    const location = highlight.location ? `<div style="font-size: 12px; color: #888; margin-bottom: 8px;">${highlight.location}</div>` : '';
    const note = highlight.note && highlight.note.trim() 
      ? `<div style="margin-top: 12px; padding: 12px; background: rgba(102, 126, 234, 0.1); border-radius: 4px; font-style: italic; color: #555;">💭 ${highlight.note}</div>`
      : '';
    const tags = highlight.tags && highlight.tags.length > 0
      ? `<div style="margin-top: 12px;">${highlight.tags.map(tag => 
          `<span style="display: inline-block; background: #667eea; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; margin-right: 6px;">${tag}</span>`
        ).join('')}</div>`
      : '';

    return `
      <div style="margin-bottom: 16px;">
        ${location}
        <div style="padding: 16px; border-radius: 6px; ${style}">
          <div style="font-size: 16px; line-height: 1.6; color: #333;">${highlight.text}</div>
        </div>
        ${note}
        ${tags}
      </div>
    `;
  }

  // Generate plain text content
  generateTextContent(highlights, bookData) {
    let textContent = `Your Daily Highlights - ${new Date().toLocaleDateString()}\n\n`;
    
    highlights.forEach((highlight, index) => {
      const book = bookData[highlight.bookAsin];
      
      textContent += `${index + 1}. `;
      if (book) {
        textContent += `"${book.title}" by ${book.author}\n`;
      }
      
      if (highlight.location) {
        textContent += `   Location: ${highlight.location}\n`;
      }
      
      textContent += `   "${highlight.text}"\n`;
      
      if (highlight.note && highlight.note.trim()) {
        textContent += `   Note: ${highlight.note}\n`;
      }
      
      if (highlight.tags && highlight.tags.length > 0) {
        textContent += `   Tags: ${highlight.tags.join(', ')}\n`;
      }
      
      textContent += '\n';
    });
    
    textContent += 'Keep reading, keep growing! 📖';
    return textContent;
  }

  // Generate email subject
  generateSubject(highlightCount) {
    const subjects = [
      `📚 ${highlightCount} insights to brighten your day`,
      `💡 Your daily dose of wisdom (${highlightCount} highlights)`,
      `🌟 ${highlightCount} powerful thoughts to reflect on`,
      `📖 Today's reading highlights (${highlightCount})`,
      `✨ ${highlightCount} gems from your reading collection`
    ];
    
    return subjects[Math.floor(Math.random() * subjects.length)];
  }

  // Generate unsubscribe link (placeholder)
  generateUnsubscribeLink() {
    return 'chrome-extension://your-extension-id/options.html?unsubscribe=true';
  }

  // Record successful email send
  async recordEmailSent(highlights, userSettings, response) {
    try {
      if (!this.database) return;
      
      const emailRecord = {
        sentDate: Date.now(),
        recipient: userSettings.email,
        highlightIds: highlights.map(h => h.id),
        highlightCount: highlights.length,
        status: 'sent',
        messageId: response.text,
        templateUsed: this.config.templateId
      };
      
      await this.database.addEmailRecord(emailRecord);
      
      // Mark highlights as sent
      for (const highlight of highlights) {
        await this.database.markHighlightAsSent(highlight.id);
      }
      
    } catch (error) {
      console.error('Failed to record email sent:', error);
    }
  }

  // Record failed email attempt
  async recordEmailFailed(highlights, userSettings, error) {
    try {
      if (!this.database) return;
      
      const emailRecord = {
        sentDate: Date.now(),
        recipient: userSettings.email,
        highlightIds: highlights ? highlights.map(h => h.id) : [],
        highlightCount: highlights ? highlights.length : 0,
        status: 'failed',
        errorMessage: error.message,
        templateUsed: this.config.templateId
      };
      
      await this.database.addEmailRecord(emailRecord);
      
    } catch (dbError) {
      console.error('Failed to record email failure:', dbError);
    }
  }

  // Send test email
  async sendTestEmail(userEmail) {
    try {
      // Create sample highlights for testing
      const sampleHighlights = this.generateSampleHighlights();
      const sampleSettings = {
        email: userEmail,
        name: 'Test User',
        includeBookInfo: true,
        prioritizeNotes: true
      };

      const result = await this.sendHighlightEmail(sampleHighlights, sampleSettings);
      
      return {
        ...result,
        isTest: true
      };
      
    } catch (error) {
      console.error('Failed to send test email:', error);
      return {
        status: 'error',
        message: error.message,
        isTest: true
      };
    }
  }

  // Generate sample highlights for testing
  generateSampleHighlights() {
    return [
      {
        id: 'sample-1',
        bookAsin: 'B001SAMPLE',
        text: 'The best time to plant a tree was 20 years ago. The second best time is now.',
        location: 'Chapter 1, Page 42',
        dateHighlighted: Date.now() - 86400000,
        color: 'yellow',
        note: 'Great reminder about taking action',
        tags: ['motivation', 'action']
      },
      {
        id: 'sample-2', 
        bookAsin: 'B002SAMPLE',
        text: 'Knowledge is power, but applied knowledge is the real power.',
        location: 'Page 127',
        dateHighlighted: Date.now() - 172800000,
        color: 'blue',
        note: '',
        tags: ['learning', 'wisdom']
      }
    ];
  }

  // Get sample book data
  getSampleBookData() {
    return {
      'B001SAMPLE': {
        asin: 'B001SAMPLE',
        title: 'Sample Wisdom Book',
        author: 'Test Author',
        coverUrl: ''
      },
      'B002SAMPLE': {
        asin: 'B002SAMPLE',
        title: 'Knowledge and Power',
        author: 'Another Author',
        coverUrl: ''
      }
    };
  }

  // Email preview functionality
  async generateEmailPreview(highlights, userSettings) {
    try {
      const emailContent = await this.generateEmailContent(highlights, userSettings);
      
      return {
        status: 'success',
        preview: {
          subject: this.generateSubject(highlights.length),
          htmlContent: emailContent.htmlContent,
          textContent: emailContent.textContent,
          recipient: userSettings.email,
          highlightCount: highlights.length,
          bookCount: emailContent.bookCount
        }
      };
      
    } catch (error) {
      console.error('Failed to generate email preview:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  // Get email sending statistics
  async getEmailStats() {
    try {
      if (!this.database) {
        throw new Error('Database not available');
      }
      
      const emailHistory = await this.database.getEmailHistory(100);
      
      const stats = {
        totalEmails: emailHistory.length,
        successfulEmails: emailHistory.filter(e => e.status === 'sent').length,
        failedEmails: emailHistory.filter(e => e.status === 'failed').length,
        lastEmailSent: emailHistory.length > 0 ? emailHistory[0].sentDate : null,
        averageHighlightsPerEmail: emailHistory.length > 0 
          ? Math.round(emailHistory.reduce((sum, e) => sum + (e.highlightCount || 0), 0) / emailHistory.length)
          : 0
      };
      
      stats.successRate = stats.totalEmails > 0 
        ? Math.round((stats.successfulEmails / stats.totalEmails) * 100)
        : 0;
      
      return {
        status: 'success',
        stats
      };
      
    } catch (error) {
      console.error('Failed to get email stats:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }
}

// Create singleton instance
const emailService = new EmailService();

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment (for testing)
  module.exports = { EmailService, emailService };
} else if (typeof self !== 'undefined') {
  // Web Worker environment
  self.EmailService = EmailService;
  self.emailService = emailService;
} else {
  // Browser environment
  window.EmailService = EmailService;
  window.emailService = emailService;
}