// Simple Email Service - Works within Manifest V3 constraints
// No external scripts, uses browser's native capabilities

class SimpleEmailService {
  constructor() {
    this.initialized = true; // Always ready
  }

  async init() {
    // No initialization needed for simple mailto approach
    return { status: 'success' };
  }

  // Generate a mailto link for the user to send email
  generateMailtoLink(highlights, userSettings) {
    const subject = encodeURIComponent(`Your Kindle Highlights - ${new Date().toLocaleDateString()}`);
    
    let body = 'Your Kindle Highlights for Today:\n\n';
    
    highlights.forEach((highlight, index) => {
      body += `${index + 1}. "${highlight.text}"\n`;
      if (highlight.bookTitle) {
        body += `   - From: ${highlight.bookTitle}\n`;
      }
      if (highlight.note) {
        body += `   - Note: ${highlight.note}\n`;
      }
      body += '\n';
    });
    
    body += '\n---\nKindle Highlights Reminder Extension';
    
    const encodedBody = encodeURIComponent(body);
    const mailto = `mailto:${userSettings.email || ''}?subject=${subject}&body=${encodedBody}`;
    
    return mailto;
  }

  // Open default email client with pre-filled email
  async sendHighlightEmail(highlights, userSettings) {
    try {
      const mailto = this.generateMailtoLink(highlights, userSettings);
      
      // Return the mailto link so the background script can handle opening it
      return {
        status: 'success',
        message: 'Opening email client with your highlights',
        mailto: mailto,
        highlightCount: highlights.length,
        recipient: userSettings.email
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  // Generate sample highlights for testing
  generateSampleHighlights() {
    return [
      {
        id: 'sample1',
        text: 'The only way to do great work is to love what you do.',
        bookTitle: 'Sample Book',
        author: 'Sample Author',
        color: 'yellow',
        note: 'Inspiring quote about passion and work'
      },
      {
        id: 'sample2',
        text: 'Innovation distinguishes between a leader and a follower.',
        bookTitle: 'Sample Book 2',
        author: 'Sample Author',
        color: 'blue'
      }
    ];
  }

  // Send test email
  async sendTestEmail(email) {
    const sampleHighlights = this.generateSampleHighlights();
    return this.sendHighlightEmail(sampleHighlights, { email });
  }

  // Email preview (returns HTML)
  async generateEmailPreview(highlights, userSettings) {
    const preview = {
      htmlContent: this.generateEmailHTML(highlights, userSettings),
      textContent: this.generateEmailText(highlights, userSettings),
      highlightCount: highlights.length
    };
    
    return { 
      status: 'success', 
      preview 
    };
  }

  generateEmailHTML(highlights, userSettings) {
    let html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Your Kindle Highlights</h2>
        <p style="color: #666;">Here are your highlights for ${new Date().toLocaleDateString()}</p>
        <hr style="border: 1px solid #eee;">
    `;
    
    highlights.forEach((highlight, index) => {
      const bgColor = this.getHighlightColor(highlight.color);
      html += `
        <div style="margin: 20px 0; padding: 15px; background: ${bgColor}; border-radius: 8px;">
          <p style="font-size: 16px; line-height: 1.6; margin: 0;">
            "${highlight.text}"
          </p>
          ${highlight.bookTitle ? `<p style="font-size: 14px; color: #666; margin-top: 10px;">— ${highlight.bookTitle}</p>` : ''}
          ${highlight.note ? `<p style="font-size: 14px; color: #888; margin-top: 5px;">Note: ${highlight.note}</p>` : ''}
        </div>
      `;
    });
    
    html += `
        <hr style="border: 1px solid #eee;">
        <p style="color: #999; font-size: 12px;">
          Sent by Kindle Highlights Reminder Extension
        </p>
      </div>
    `;
    
    return html;
  }

  generateEmailText(highlights, userSettings) {
    let text = `Your Kindle Highlights - ${new Date().toLocaleDateString()}\n\n`;
    
    highlights.forEach((highlight, index) => {
      text += `${index + 1}. "${highlight.text}"\n`;
      if (highlight.bookTitle) text += `   From: ${highlight.bookTitle}\n`;
      if (highlight.note) text += `   Note: ${highlight.note}\n`;
      text += '\n';
    });
    
    return text;
  }

  getHighlightColor(color) {
    const colors = {
      yellow: '#fff3cd',
      blue: '#cfe2ff',
      pink: '#f8d7da',
      orange: '#ffe5d0'
    };
    return colors[color] || '#f8f9fa';
  }

  // Get email statistics
  async getEmailStats() {
    // Simple stats from local storage
    try {
      const result = await chrome.storage.local.get('emailStats');
      return {
        status: 'success',
        stats: result.emailStats || {
          totalSent: 0,
          lastSent: null
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }
}

// Create global instance
const simpleEmailService = new SimpleEmailService();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SimpleEmailService, simpleEmailService };
} else if (typeof self !== 'undefined') {
  // Service Worker environment
  self.simpleEmailService = simpleEmailService;
  self.SimpleEmailService = SimpleEmailService;
}