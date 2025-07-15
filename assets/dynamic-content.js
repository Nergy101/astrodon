/**
 * Dynamic Content Loader
 *
 * This script fetches dynamic content from server-side Lua APIs
 * and populates the page elements with real-time data.
 */

/**
 * Back to Top Button Controller
 */
class BackToTopButton {
  constructor() {
    this.button = null;
    this.scrollThreshold = 300; // Show button after scrolling 300px
    this.init();
  }

  init() {
    this.createButton();
    this.bindEvents();
    this.checkScrollPosition();
  }

  createButton() {
    this.button = document.createElement('button');
    this.button.className = 'back-to-top';
    this.button.setAttribute('aria-label', 'Back to top');
    this.button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 15l-6-6-6 6"/>
      </svg>
    `;
    document.body.appendChild(this.button);
  }

  bindEvents() {
    // Scroll event
    window.addEventListener(
      'scroll',
      () => {
        this.checkScrollPosition();
      },
      { passive: true }
    );

    // Click event
    this.button.addEventListener('click', () => {
      this.scrollToTop();
    });

    // Keyboard navigation
    this.button.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.scrollToTop();
      }
    });
  }

  checkScrollPosition() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > this.scrollThreshold) {
      this.button.classList.add('visible');
    } else {
      this.button.classList.remove('visible');
    }
  }

  scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }
}

class DynamicContentLoader {
  constructor() {
    this.baseUrl = '/lua-scripts';
    this.intervals = new Map();
  }

  /**
   * Fetch time from the server
   * @param {string} format - Time format
   * @returns {Promise<string>} Formatted time
   */
  async getTime(format = 'iso') {
    try {
      const response = await fetch(`${this.baseUrl}/time/${format}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.time;
    } catch (error) {
      console.error(`Time API error for format ${format}:`, error);
      return '[Error loading time]';
    }
  }

  /**
   * Execute a Lua module
   * @param {string} module - Module name
   * @param {object} context - Context parameters
   * @returns {Promise<string>} Module result
   */
  async executeModule(module, context = {}) {
    try {
      const response = await fetch(`${this.baseUrl}/lua-execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, context }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.result;
    } catch (error) {
      console.error(`Module execution error for ${module}:`, error);
      return '[Error executing module]';
    }
  }

  /**
   * Update an element with content
   * @param {string} selector - CSS selector
   * @param {string} content - Content to set
   */
  updateElement(selector, content) {
    const element = document.querySelector(selector);
    if (element) {
      element.textContent = content;
    } else {
      console.warn(`Element not found: ${selector}`);
    }
  }

  /**
   * Create a live clock that updates at intervals
   * @param {string} selector - CSS selector for the clock element
   * @param {string} format - Time format
   * @param {number} interval - Update interval in milliseconds
   */
  createLiveClock(selector, format = 'time', interval = 1000) {
    const updateClock = async () => {
      const time = await this.getTime(format);
      this.updateElement(selector, time);
    };

    // Update immediately
    updateClock();

    // Then update at intervals
    const intervalId = setInterval(updateClock, interval);
    this.intervals.set(selector, intervalId);

    return intervalId;
  }

  /**
   * Generate a counter and update an element
   * @param {string} selector - CSS selector for the element
   * @param {string} prefix - Counter prefix
   * @param {number} count - Number of items
   */
  async generateCounter(selector, prefix = 'Item', count = 3) {
    const result = await this.executeModule('counter', { prefix, count });
    this.updateElement(selector, result);
  }

  /**
   * Get a random quote and update an element
   * @param {string} selector - CSS selector for the element
   */
  async getRandomQuote(selector) {
    const result = await this.executeModule('random-quote');
    this.updateElement(selector, result);
  }

  /**
   * Initialize all dynamic content on the page
   */
  async init() {
    console.log('Initializing dynamic content...');

    // Initialize dynamic time (one-time update)
    const dynamicTime = await this.getTime('friendly');
    this.updateElement('#dynamic-time', dynamicTime);

    // Initialize live clock (updates every second)
    this.createLiveClock('#live-clock', 'time', 1000);

    // Initialize live date (updates every minute)
    this.createLiveClock('#live-clock-2', 'time', 60000);

    // Initialize live friendly time (updates every 5 seconds)
    this.createLiveClock('#live-friendly', 'friendly', 5000);

    // Initialize dynamic counter (live time updates)
    this.createLiveClock('#dynamic-counter', 'time', 1000);

    // Initialize dynamic quote (updates every 10 seconds)
    const updateQuote = async () => {
      await this.getRandomQuote('#dynamic-quote');
    };
    updateQuote();
    const quoteInterval = setInterval(updateQuote, 10000);
    this.intervals.set('#dynamic-quote', quoteInterval);

    console.log('Dynamic content initialized successfully');
  }

  /**
   * Clean up intervals when page unloads
   */
  cleanup() {
    for (const [selector, intervalId] of this.intervals) {
      clearInterval(intervalId);
    }
    this.intervals.clear();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const loader = new DynamicContentLoader();
    loader.init();

    // Initialize back to top button
    new BackToTopButton();

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      loader.cleanup();
    });
  });
} else {
  const loader = new DynamicContentLoader();
  loader.init();

  // Initialize back to top button
  new BackToTopButton();

  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    loader.cleanup();
  });
}
