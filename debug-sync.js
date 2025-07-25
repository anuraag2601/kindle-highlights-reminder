// Debug script to understand Amazon's current page structure
// Paste this in the console on read.amazon.com/notebook

console.log("🔍 Kindle Highlights Sync Debugger");
console.log("=" .repeat(50));

// Check if we're on the right page
console.log("Current URL:", window.location.href);
console.log("Page Title:", document.title);

// Look for book containers
console.log("\n📚 Searching for book elements...");

const potentialBookSelectors = [
  // Current selectors we're using
  '[data-testid="book-item"]',
  '.kp-notebook-library-book',
  '.library-book',
  'div[class*="library-book"]',
  'div[class*="notebook-book"]',
  '[id*="book-"]',
  
  // Additional selectors to try
  '.kp-notebook-book',
  '.notebook-library-book',
  'div[class*="book-container"]',
  'div[class*="book-item"]',
  '.book-card',
  '[data-book-asin]',
  'a[href*="/kp/notebook"]',
  '.kp-notebook-annotated-book'
];

let foundBooks = false;
for (const selector of potentialBookSelectors) {
  const elements = document.querySelectorAll(selector);
  if (elements.length > 0) {
    console.log(`✅ Found ${elements.length} elements with selector: "${selector}"`);
    foundBooks = true;
    
    // Show first element's structure
    if (elements[0]) {
      console.log("  First element HTML:", elements[0].outerHTML.substring(0, 200) + "...");
      console.log("  Classes:", elements[0].className);
      console.log("  Data attributes:", Object.keys(elements[0].dataset));
    }
  }
}

if (!foundBooks) {
  console.log("❌ No books found with any selector");
}

// Look for any elements with "book" in their class
console.log("\n🔍 Elements with 'book' in class name:");
const bookClassElements = Array.from(document.querySelectorAll('*')).filter(el => 
  el.className && el.className.toString().toLowerCase().includes('book')
);
console.log(`Found ${bookClassElements.length} elements`);
if (bookClassElements.length > 0 && bookClassElements.length < 20) {
  bookClassElements.forEach((el, i) => {
    console.log(`  ${i + 1}. <${el.tagName.toLowerCase()} class="${el.className}">`);
  });
}

// Look for highlights
console.log("\n🖍️ Searching for highlight elements...");

const potentialHighlightSelectors = [
  '[data-testid="highlight"]',
  '.kp-notebook-highlight',
  '.highlight-content',
  'div[class*="highlight"]',
  '[id*="highlight"]',
  '.a-spacing-base',
  '.kp-notebook-annotation',
  'div[class*="annotation"]',
  'span[class*="highlight"]'
];

let foundHighlights = false;
for (const selector of potentialHighlightSelectors) {
  const elements = document.querySelectorAll(selector);
  if (elements.length > 0 && elements.length < 1000) { // Avoid too generic selectors
    console.log(`✅ Found ${elements.length} elements with selector: "${selector}"`);
    foundHighlights = true;
    
    if (elements[0]) {
      console.log("  First element preview:", elements[0].textContent.substring(0, 100) + "...");
    }
  }
}

if (!foundHighlights) {
  console.log("❌ No highlights found with any selector");
}

// Check page structure
console.log("\n📄 Page Structure Analysis:");
console.log("Main containers with IDs:");
const idsOfInterest = Array.from(document.querySelectorAll('[id]'))
  .filter(el => el.id.toLowerCase().includes('book') || el.id.toLowerCase().includes('highlight') || el.id.toLowerCase().includes('notebook'))
  .map(el => `#${el.id}`);
  
if (idsOfInterest.length > 0) {
  idsOfInterest.forEach(id => console.log(`  ${id}`));
}

// Check if there's a different view or tab
console.log("\n🔍 Checking for tabs or views:");
const tabSelectors = ['[role="tab"]', '.tab', '[class*="tab"]', 'button[class*="tab"]'];
tabSelectors.forEach(selector => {
  const tabs = document.querySelectorAll(selector);
  if (tabs.length > 0 && tabs.length < 20) {
    console.log(`  Found ${tabs.length} elements with selector: "${selector}"`);
    tabs.forEach(tab => {
      if (tab.textContent.trim()) {
        console.log(`    - "${tab.textContent.trim()}"`);
      }
    });
  }
});

console.log("\n🔍 Debug complete. If books/highlights aren't found, Amazon may have changed their page structure.");