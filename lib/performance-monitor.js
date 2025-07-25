// Performance Monitor and Error Recovery System
// Milestone 5: Production-ready performance optimization

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      syncTimes: [],
      emailSendTimes: [],
      databaseOperations: [],
      memoryUsage: [],
      errors: []
    };
    this.maxMetricsHistory = 100; // Keep last 100 operations
    this.init();
  }

  init() {
    // Monitor memory usage periodically
    if (typeof window !== 'undefined') {
      setInterval(() => this.recordMemoryUsage(), 60000); // Every minute
    }
  }

  // Record operation timing
  startTimer(operation) {
    return {
      operation,
      startTime: performance.now(),
      startMemory: this.getCurrentMemoryUsage()
    };
  }

  endTimer(timer) {
    const endTime = performance.now();
    const duration = endTime - timer.startTime;
    const endMemory = this.getCurrentMemoryUsage();
    
    const metric = {
      operation: timer.operation,
      duration,
      startTime: timer.startTime,
      endTime,
      memoryDelta: endMemory - timer.startMemory,
      timestamp: Date.now()
    };

    // Store in appropriate bucket
    switch (timer.operation) {
      case 'sync':
        this.metrics.syncTimes.push(metric);
        this.trimArray(this.metrics.syncTimes);
        break;
      case 'email':
        this.metrics.emailSendTimes.push(metric);
        this.trimArray(this.metrics.emailSendTimes);
        break;
      case 'database':
        this.metrics.databaseOperations.push(metric);
        this.trimArray(this.metrics.databaseOperations);
        break;
    }

    // Log slow operations
    if (duration > 5000) { // 5 seconds
      console.warn(`Slow operation detected: ${timer.operation} took ${duration}ms`);
    }

    return metric;
  }

  // Record errors with context
  recordError(error, context = {}) {
    const errorRecord = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now(),
      userAgent: (typeof navigator !== 'undefined' ? navigator.userAgent : 'service-worker') || 'unknown',
      url: (typeof window !== 'undefined' ? window.location?.href : 'service-worker') || 'background'
    };

    this.metrics.errors.push(errorRecord);
    this.trimArray(this.metrics.errors);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Performance Monitor - Error recorded:', errorRecord);
    }
  }

  // Memory usage monitoring
  getCurrentMemoryUsage() {
    if (performance.memory) {
      return {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };
    }
    return { used: 0, total: 0, limit: 0 };
  }

  recordMemoryUsage() {
    const usage = this.getCurrentMemoryUsage();
    this.metrics.memoryUsage.push({
      ...usage,
      timestamp: Date.now()
    });
    this.trimArray(this.metrics.memoryUsage);

    // Warn on high memory usage
    if (usage.used > usage.limit * 0.8) {
      console.warn('High memory usage detected:', usage);
    }
  }

  // Get performance statistics
  getStats() {
    return {
      sync: this.calculateStats(this.metrics.syncTimes),
      email: this.calculateStats(this.metrics.emailSendTimes),
      database: this.calculateStats(this.metrics.databaseOperations),
      memory: this.getMemoryStats(),
      errors: {
        total: this.metrics.errors.length,
        recent: this.metrics.errors.slice(-10),
        byType: this.groupErrorsByType()
      }
    };
  }

  calculateStats(operations) {
    if (operations.length === 0) {
      return { count: 0, avgDuration: 0, minDuration: 0, maxDuration: 0 };
    }

    const durations = operations.map(op => op.duration);
    return {
      count: operations.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      recent: operations.slice(-5)
    };
  }

  getMemoryStats() {
    if (this.metrics.memoryUsage.length === 0) {
      return { current: this.getCurrentMemoryUsage(), trend: 'stable' };
    }

    const recent = this.metrics.memoryUsage.slice(-10);
    const current = this.getCurrentMemoryUsage();
    const trend = this.calculateMemoryTrend(recent);

    return { current, trend, history: recent };
  }

  calculateMemoryTrend(memoryHistory) {
    if (memoryHistory.length < 2) return 'stable';

    const first = memoryHistory[0].used;
    const last = memoryHistory[memoryHistory.length - 1].used;
    const change = (last - first) / first;

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  groupErrorsByType() {
    const groups = {};
    this.metrics.errors.forEach(error => {
      const type = this.categorizeError(error.message);
      groups[type] = (groups[type] || 0) + 1;
    });
    return groups;
  }

  categorizeError(message) {
    if (message.includes('network') || message.includes('fetch')) return 'network';
    if (message.includes('authentication') || message.includes('login')) return 'auth';
    if (message.includes('database') || message.includes('IndexedDB')) return 'database';
    if (message.includes('email') || message.includes('EmailJS')) return 'email';
    if (message.includes('parse') || message.includes('scrape')) return 'scraping';
    return 'other';
  }

  // Utility methods
  trimArray(array) {
    while (array.length > this.maxMetricsHistory) {
      array.shift();
    }
  }

  // Clear metrics (for testing or reset)
  clearMetrics() {
    this.metrics = {
      syncTimes: [],
      emailSendTimes: [],
      databaseOperations: [],
      memoryUsage: [],
      errors: []
    };
  }

  // Export metrics for debugging
  exportMetrics() {
    return {
      ...this.metrics,
      exportedAt: Date.now(),
      stats: this.getStats()
    };
  }
}

// Error Recovery System
class ErrorRecovery {
  constructor(performanceMonitor) {
    this.performanceMonitor = performanceMonitor;
    this.retryAttempts = new Map();
    this.maxRetries = 3;
    this.backoffMultiplier = 2;
  }

  // Wrap operations with retry logic
  async withRetry(operation, operationType, context = {}) {
    const retryKey = `${operationType}-${Date.now()}`;
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const timer = this.performanceMonitor.startTimer(operationType);
      
      try {
        const result = await operation();
        this.performanceMonitor.endTimer(timer);
        
        // Clear retry count on success
        this.retryAttempts.delete(retryKey);
        return { success: true, result, attempt };

      } catch (error) {
        this.performanceMonitor.endTimer(timer);
        this.performanceMonitor.recordError(error, { 
          ...context, 
          attempt, 
          operationType 
        });

        lastError = error;

        if (attempt < this.maxRetries) {
          const delay = this.calculateBackoffDelay(attempt);
          console.warn(`Operation ${operationType} failed (attempt ${attempt}), retrying in ${delay}ms:`, error.message);
          await this.delay(delay);
        }
      }
    }

    // All retries failed
    return { 
      success: false, 
      error: lastError, 
      attempts: this.maxRetries,
      message: `Operation failed after ${this.maxRetries} attempts: ${lastError.message}`
    };
  }

  calculateBackoffDelay(attempt) {
    return Math.min(1000 * Math.pow(this.backoffMultiplier, attempt - 1), 10000);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Graceful degradation helpers
  async withFallback(primaryOperation, fallbackOperation, operationType) {
    const primaryResult = await this.withRetry(primaryOperation, operationType);
    
    if (primaryResult.success) {
      return primaryResult;
    }

    console.warn(`Primary operation ${operationType} failed, trying fallback`);
    const fallbackResult = await this.withRetry(fallbackOperation, `${operationType}-fallback`);
    
    if (fallbackResult.success) {
      return { ...fallbackResult, usedFallback: true };
    }

    return {
      success: false,
      error: fallbackResult.error,
      primaryError: primaryResult.error,
      message: 'Both primary and fallback operations failed'
    };
  }
}

// Global instances
const performanceMonitor = new PerformanceMonitor();
const errorRecovery = new ErrorRecovery(performanceMonitor);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PerformanceMonitor, ErrorRecovery, performanceMonitor, errorRecovery };
} else if (typeof self !== 'undefined') {
  // Service Worker environment
  self.performanceMonitor = performanceMonitor;
  self.errorRecovery = errorRecovery;
} else if (typeof window !== 'undefined') {
  // Browser environment
  window.performanceMonitor = performanceMonitor;
  window.errorRecovery = errorRecovery;
}