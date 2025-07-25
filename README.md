# Kindle Highlights Reminder

A Chrome/Edge browser extension that automatically extracts Kindle highlights from Amazon's read.amazon.com/notebook interface, stores them locally, and sends daily email digests with shuffled highlights to promote knowledge retention through spaced repetition.

## Features

- 📚 **Automatic Highlight Extraction**: Scrapes highlights from your Amazon Kindle notebook
- 💾 **Local Storage**: All data stored securely in your browser using IndexedDB
- 📧 **Daily Email Reminders**: Smart selection algorithms send you highlights via email
- 🧠 **Spaced Repetition**: Intelligently resurfaces highlights for better retention
- 🎨 **Multiple Selection Modes**: Random, spaced repetition, or chronological ordering
- 🔒 **Privacy-First**: No data leaves your browser except for email delivery

## Installation

### From Chrome Web Store

_Coming soon..._

### Manual Installation (Development)

1. Clone this repository
2. Run `npm install` to install dependencies
3. Open Chrome/Edge and navigate to `chrome://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the project directory

## Development

### Prerequisites

- Node.js 18+
- Chrome or Edge browser
- Git

### Setup

```bash
git clone https://github.com/yourusername/kindle-highlights-reminder.git
cd kindle-highlights-reminder
npm install
```

### Testing

```bash
npm test              # Run all tests
npm run test:unit     # Unit tests only
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Code Quality

```bash
npm run lint          # ESLint checks
npm run format        # Format with Prettier
```

### Building

```bash
npm run build         # Create extension package
```

## Email Setup

The extension supports multiple email services:

### EmailJS (Recommended)

1. Create account at [emailjs.com](https://emailjs.com)
2. Set up email service (Gmail, Outlook, etc.)
3. Create email template
4. Configure API credentials in extension settings

### Custom Webhook

Provide your own webhook endpoint that accepts POST requests with highlight data.

## Usage

1. **Initial Setup**: Install extension and configure email settings
2. **Sync Highlights**: Visit your [Amazon Kindle notebook](https://read.amazon.com/notebook) and click "Sync Now"
3. **Configure Schedule**: Set your preferred email time and frequency
4. **Enjoy**: Receive daily highlight reminders automatically

## Privacy & Security

- ✅ All highlights stored locally in your browser
- ✅ Email credentials encrypted using Web Crypto API
- ✅ No tracking or analytics
- ✅ Minimal browser permissions requested
- ✅ Open source and auditable

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Run tests: `npm test`
4. Commit changes: `git commit -m 'Add amazing feature'`
5. Push to branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 🐛 [Report bugs](https://github.com/yourusername/kindle-highlights-reminder/issues)
- 💡 [Request features](https://github.com/yourusername/kindle-highlights-reminder/issues)
- 📧 [Email support](mailto:support@yourname.com)

## Roadmap

- [ ] Firefox support
- [ ] Export to Markdown/Notion/Obsidian
- [ ] Highlight categorization with AI
- [ ] Mobile companion app
- [ ] Social sharing features

---

**Note**: This extension is not affiliated with Amazon or Kindle. It's a third-party tool that works with publicly accessible highlight data.
