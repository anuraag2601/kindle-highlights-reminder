// Kindle Highlights Reminder - Highlight Selection Algorithm
// Implements spaced repetition and intelligent highlight selection

class HighlightSelector {
  constructor(database) {
    this.database = database;
    
    // Spaced repetition intervals (in days)
    this.spacedRepetitionIntervals = [1, 3, 7, 14, 30, 90, 180, 365];
    
    // Default weights for selection criteria
    this.defaultWeights = {
      spacedRepetition: 0.4,    // 40% - How long since last shown
      hasNotes: 0.2,            // 20% - Highlights with notes are more valuable
      recency: 0.15,            // 15% - Recently highlighted content
      frequency: 0.1,           // 10% - How often it's been shown
      tags: 0.1,                // 10% - Tagged highlights are important
      randomness: 0.05          // 5% - Add some randomness
    };
  }

  // Main method to select highlights for email
  async selectHighlights(count, userSettings = {}) {
    try {
      await this.database.init();
      
      // Get all highlights with metadata
      const allHighlights = await this.database.getAllHighlights();
      
      if (allHighlights.length === 0) {
        return {
          status: 'success',
          highlights: [],
          message: 'No highlights available'
        };
      }

      // Filter highlights based on user preferences
      const filteredHighlights = this.filterHighlights(allHighlights, userSettings);
      
      if (filteredHighlights.length === 0) {
        return {
          status: 'success',
          highlights: [],
          message: 'No highlights match your current preferences'
        };
      }

      // Select highlights using the chosen algorithm
      const selectedHighlights = await this.selectByAlgorithm(
        filteredHighlights, 
        count, 
        userSettings.highlightSelectionMode || 'spaced-repetition'
      );

      return {
        status: 'success',
        highlights: selectedHighlights,
        totalAvailable: allHighlights.length,
        filteredCount: filteredHighlights.length,
        algorithm: userSettings.highlightSelectionMode || 'spaced-repetition'
      };

    } catch (error) {
      console.error('Failed to select highlights:', error);
      return {
        status: 'error',
        message: error.message,
        highlights: []
      };
    }
  }

  // Filter highlights based on user preferences
  filterHighlights(highlights, userSettings) {
    let filtered = [...highlights];

    // Filter by book preferences (if user has book preferences)
    if (userSettings.preferredBooks && userSettings.preferredBooks.length > 0) {
      filtered = filtered.filter(h => userSettings.preferredBooks.includes(h.bookAsin));
    }

    // Filter by color preferences
    if (userSettings.preferredColors && userSettings.preferredColors.length > 0) {
      filtered = filtered.filter(h => userSettings.preferredColors.includes(h.color));
    }

    // Filter by minimum age (don't show highlights that are too recent)
    const minAge = userSettings.minHighlightAge || 0; // in days
    if (minAge > 0) {
      const minDate = Date.now() - (minAge * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(h => h.dateHighlighted <= minDate);
    }

    // Filter by tags if specified
    if (userSettings.requiredTags && userSettings.requiredTags.length > 0) {
      filtered = filtered.filter(h => {
        if (!h.tags || h.tags.length === 0) return false;
        return userSettings.requiredTags.some(tag => h.tags.includes(tag));
      });
    }

    return filtered;
  }

  // Select highlights using specified algorithm
  async selectByAlgorithm(highlights, count, algorithm) {
    switch (algorithm) {
      case 'spaced-repetition':
        return this.selectBySpacedRepetition(highlights, count);
      
      case 'random':
        return this.selectRandomly(highlights, count);
      
      case 'oldest-first':
        return this.selectOldestFirst(highlights, count);
      
      case 'newest-first':
        return this.selectNewestFirst(highlights, count);
      
      case 'most-highlighted':
        return await this.selectFromMostHighlightedBooks(highlights, count);
      
      case 'weighted-smart':
        return this.selectByWeightedScore(highlights, count);
      
      default:
        return this.selectBySpacedRepetition(highlights, count);
    }
  }

  // Spaced repetition algorithm - the default and most sophisticated
  selectBySpacedRepetition(highlights, count) {
    const now = Date.now();
    
    // Calculate spaced repetition scores for each highlight
    const scoredHighlights = highlights.map(highlight => {
      const score = this.calculateSpacedRepetitionScore(highlight, now);
      return { ...highlight, spacedRepetitionScore: score };
    });

    // Sort by spaced repetition score (highest first)
    scoredHighlights.sort((a, b) => b.spacedRepetitionScore - a.spacedRepetitionScore);

    // Take top highlights, but add some randomness to avoid always showing the same ones
    const topCandidates = scoredHighlights.slice(0, Math.min(count * 2, scoredHighlights.length));
    
    // Randomly select from top candidates to add variety
    const selected = [];
    const candidatesCopy = [...topCandidates];
    
    for (let i = 0; i < Math.min(count, candidatesCopy.length); i++) {
      const randomIndex = Math.floor(Math.random() * candidatesCopy.length);
      selected.push(candidatesCopy.splice(randomIndex, 1)[0]);
    }

    return selected;
  }

  // Calculate spaced repetition score for a highlight
  calculateSpacedRepetitionScore(highlight, now) {
    const timesShown = highlight.timesShown || 0;
    const lastShown = highlight.lastShown || 0;
    const daysSinceLastShown = lastShown > 0 ? (now - lastShown) / (24 * 60 * 60 * 1000) : 999;
    
    // Get the next review interval based on times shown
    const intervalIndex = Math.min(timesShown, this.spacedRepetitionIntervals.length - 1);
    const targetInterval = this.spacedRepetitionIntervals[intervalIndex];
    
    // Base score: how overdue is this highlight?
    let score = daysSinceLastShown / targetInterval;
    
    // Boost score for highlights with notes (they're more valuable)
    if (highlight.note && highlight.note.trim()) {
      score *= 1.5;
    }
    
    // Boost score for tagged highlights
    if (highlight.tags && highlight.tags.length > 0) {
      score *= 1.2;
    }
    
    // Reduce score for highlights shown many times (avoid repetition)
    if (timesShown > 5) {
      score *= 0.8;
    }
    
    // Add small random factor to break ties
    score += Math.random() * 0.1;
    
    return score;
  }

  // Weighted smart selection using multiple criteria
  selectByWeightedScore(highlights, count) {
    const now = Date.now();
    
    const scoredHighlights = highlights.map(highlight => {
      const score = this.calculateWeightedScore(highlight, now);
      return { ...highlight, weightedScore: score };
    });

    scoredHighlights.sort((a, b) => b.weightedScore - a.weightedScore);
    return scoredHighlights.slice(0, count);
  }

  // Calculate weighted score using multiple criteria
  calculateWeightedScore(highlight, now) {
    const weights = this.defaultWeights;
    let totalScore = 0;

    // Spaced repetition component
    const spacedScore = this.calculateSpacedRepetitionScore(highlight, now);
    totalScore += spacedScore * weights.spacedRepetition;

    // Notes component (highlights with notes are more valuable)
    const hasNotesScore = (highlight.note && highlight.note.trim()) ? 1 : 0;
    totalScore += hasNotesScore * weights.hasNotes;

    // Recency component (more recent highlights might be more relevant)
    const daysSinceHighlighted = (now - highlight.dateHighlighted) / (24 * 60 * 60 * 1000);
    const recencyScore = Math.max(0, 1 - (daysSinceHighlighted / 365)); // Decay over a year
    totalScore += recencyScore * weights.recency;

    // Frequency component (avoid over-showing highlights)
    const timesShown = highlight.timesShown || 0;
    const frequencyScore = Math.max(0, 1 - (timesShown / 10)); // Penalty increases with shows
    totalScore += frequencyScore * weights.frequency;

    // Tags component (tagged highlights are curated)
    const tagsScore = (highlight.tags && highlight.tags.length > 0) ? 1 : 0;
    totalScore += tagsScore * weights.tags;

    // Randomness component
    const randomScore = Math.random();
    totalScore += randomScore * weights.randomness;

    return totalScore;
  }

  // Simple random selection
  selectRandomly(highlights, count) {
    const shuffled = [...highlights].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  // Select oldest highlights first
  selectOldestFirst(highlights, count) {
    const sorted = [...highlights].sort((a, b) => a.dateHighlighted - b.dateHighlighted);
    return sorted.slice(0, count);
  }

  // Select newest highlights first
  selectNewestFirst(highlights, count) {
    const sorted = [...highlights].sort((a, b) => b.dateHighlighted - a.dateHighlighted);
    return sorted.slice(0, count);
  }

  // Select from most highlighted books
  async selectFromMostHighlightedBooks(highlights, count) {
    // Group highlights by book
    const bookGroups = {};
    highlights.forEach(highlight => {
      if (!bookGroups[highlight.bookAsin]) {
        bookGroups[highlight.bookAsin] = [];
      }
      bookGroups[highlight.bookAsin].push(highlight);
    });

    // Sort books by highlight count
    const sortedBooks = Object.entries(bookGroups)
      .sort(([, a], [, b]) => b.length - a.length);

    // Select highlights from top books, distributing evenly
    const selected = [];
    let bookIndex = 0;
    
    while (selected.length < count && bookIndex < sortedBooks.length) {
      const [asin, bookHighlights] = sortedBooks[bookIndex];
      
      // Select one highlight from this book (prioritize unshown ones)
      const unshown = bookHighlights.filter(h => !h.lastShown);
      const candidate = unshown.length > 0 
        ? unshown[Math.floor(Math.random() * unshown.length)]
        : bookHighlights[Math.floor(Math.random() * bookHighlights.length)];
      
      if (candidate && !selected.find(s => s.id === candidate.id)) {
        selected.push(candidate);
      }
      
      bookIndex++;
      
      // Reset to first book if we've gone through all books but need more highlights
      if (bookIndex >= sortedBooks.length && selected.length < count) {
        bookIndex = 0;
      }
    }

    return selected;
  }

  // Get selection statistics and insights
  async getSelectionStats() {
    try {
      await this.database.init();
      
      const highlights = await this.database.getAllHighlights();
      const emailHistory = await this.database.getEmailHistory(50);
      
      // Calculate stats
      const totalHighlights = highlights.length;
      const highlightsWithNotes = highlights.filter(h => h.note && h.note.trim()).length;
      const taggedHighlights = highlights.filter(h => h.tags && h.tags.length > 0).length;
      const neverShown = highlights.filter(h => !h.lastShown || h.timesShown === 0).length;
      
      // Calculate average times shown
      const averageTimesShown = totalHighlights > 0 
        ? highlights.reduce((sum, h) => sum + (h.timesShown || 0), 0) / totalHighlights
        : 0;

      // Calculate distribution by show count
      const showDistribution = {};
      highlights.forEach(h => {
        const times = h.timesShown || 0;
        showDistribution[times] = (showDistribution[times] || 0) + 1;
      });

      return {
        status: 'success',
        stats: {
          totalHighlights,
          highlightsWithNotes,
          taggedHighlights,
          neverShown,
          averageTimesShown: Math.round(averageTimesShown * 10) / 10,
          showDistribution,
          recentEmails: emailHistory.length,
          spacedRepetitionIntervals: this.spacedRepetitionIntervals
        }
      };

    } catch (error) {
      console.error('Failed to get selection stats:', error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  // Update highlight show statistics
  async markHighlightsAsShown(highlightIds) {
    try {
      const now = Date.now();
      
      for (const id of highlightIds) {
        const highlight = await this.database.getHighlight(id);
        if (highlight) {
          const updates = {
            lastShown: now,
            timesShown: (highlight.timesShown || 0) + 1
          };
          await this.database.updateHighlight(id, updates);
        }
      }

      return { status: 'success', updatedCount: highlightIds.length };

    } catch (error) {
      console.error('Failed to mark highlights as shown:', error);
      return { 
        status: 'error', 
        message: error.message 
      };
    }
  }

  // Preview highlight selection without updating statistics
  async previewSelection(count, userSettings = {}) {
    try {
      const result = await this.selectHighlights(count, userSettings);
      
      if (result.status === 'success') {
        // Add preview metadata without updating the database
        result.preview = true;
        result.selectionReasons = result.highlights.map(h => this.explainSelection(h, userSettings));
      }
      
      return result;

    } catch (error) {
      console.error('Failed to preview selection:', error);
      return {
        status: 'error',
        message: error.message,
        highlights: []
      };
    }
  }

  // Explain why a highlight was selected
  explainSelection(highlight, userSettings) {
    const reasons = [];
    const algorithm = userSettings.highlightSelectionMode || 'spaced-repetition';

    switch (algorithm) {
      case 'spaced-repetition':
        const timesShown = highlight.timesShown || 0;
        const daysSinceLastShown = highlight.lastShown 
          ? Math.floor((Date.now() - highlight.lastShown) / (24 * 60 * 60 * 1000))
          : 'Never shown';
        
        reasons.push(`Spaced repetition: Shown ${timesShown} times, last shown ${daysSinceLastShown} days ago`);
        
        if (highlight.note && highlight.note.trim()) {
          reasons.push('Has personal note (prioritized)');
        }
        if (highlight.tags && highlight.tags.length > 0) {
          reasons.push(`Tagged: ${highlight.tags.join(', ')}`);
        }
        break;

      case 'random':
        reasons.push('Randomly selected');
        break;

      case 'oldest-first':
        const age = Math.floor((Date.now() - highlight.dateHighlighted) / (24 * 60 * 60 * 1000));
        reasons.push(`Oldest highlight (${age} days old)`);
        break;

      case 'newest-first':
        const recency = Math.floor((Date.now() - highlight.dateHighlighted) / (24 * 60 * 60 * 1000));
        reasons.push(`Recent highlight (${recency} days old)`);
        break;

      case 'most-highlighted':
        reasons.push('From a highly highlighted book');
        break;
    }

    return {
      highlightId: highlight.id,
      reasons: reasons,
      algorithm: algorithm
    };
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment (for testing)
  module.exports = { HighlightSelector };
} else if (typeof self !== 'undefined') {
  // Web Worker environment
  self.HighlightSelector = HighlightSelector;
} else {
  // Browser environment
  window.HighlightSelector = HighlightSelector;
}