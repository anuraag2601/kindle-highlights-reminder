# 🔍 Kindle Highlights Sync - Debugging Guide

This guide will help you debug sync issues with the Kindle Highlights Reminder extension.

## 🚀 Quick Debugging Steps

### 1. Check Authentication
**Issue**: The most common problem is authentication.

**Steps**:
1. Go to [read.amazon.com/notebook](https://read.amazon.com/notebook) manually
2. Make sure you're **logged into your Amazon account**
3. Verify you can see your books and highlights on the page
4. If you see a login page, log in first, then try sync again

### 2. Enable Developer Console
**Steps**:
1. Open Chrome DevTools (F12 or right-click → Inspect)
2. Go to the **Console** tab
3. Try the sync again
4. Look for error messages or console output

**Expected Console Output**:
```
Kindle Highlights Reminder: Content script loaded on https://read.amazon.com/notebook
Amazon Kindle notebook page detected
Found X books using selector: [selector-name]
Found Y highlights using selector: [selector-name]
```

### 3. Manual Element Inspection
**Steps**:
1. Go to [read.amazon.com/notebook](https://read.amazon.com/notebook)
2. Open DevTools (F12)
3. Go to **Elements** tab
4. Try to find book elements manually

**Look for these patterns**:
```html
<!-- Books might look like: -->
<div class="kp-notebook-library-book" data-asin="B123456789">
  <h2>Book Title</h2>
  <span>Author Name</span>
</div>

<!-- Or newer format: -->
<div data-testid="book-item">
  <div class="book-title">Book Title</div>
  <div class="book-author">Author Name</div>
</div>

<!-- Highlights might look like: -->
<div class="kp-notebook-highlight" data-color="yellow">
  <span class="highlight-text">Your highlighted text</span>
  <span class="highlight-location">Page 42</span>
</div>
```

## 🔧 Advanced Debugging

### Test Current Selectors
Open the browser console on the Amazon notebook page and run:

```javascript
// Test book selectors
const bookSelectors = [
  '[data-testid="book-item"]',
  '.kp-notebook-library-book',
  '.library-book',
  'div[class*="library-book"]',
  'div[class*="notebook-book"]',
  '[id*="book-"]'
];

bookSelectors.forEach(selector => {
  const elements = document.querySelectorAll(selector);
  console.log(`${selector}: ${elements.length} elements found`);
});

// Test highlight selectors
const highlightSelectors = [
  '[data-testid="highlight"]',
  '.kp-notebook-highlight',
  '.highlight-content',
  'div[class*="highlight"]',
  '[id*="highlight"]',
  '.a-spacing-base'
];

highlightSelectors.forEach(selector => {
  const elements = document.querySelectorAll(selector);
  console.log(`${selector}: ${elements.length} elements found`);
});
```

### Check Page Structure
```javascript
// Get all unique class names on the page
const allElements = document.querySelectorAll('*');
const classNames = new Set();
allElements.forEach(el => {
  if (el.className && typeof el.className === 'string') {
    el.className.split(' ').forEach(cls => {
      if (cls.toLowerCase().includes('book') || 
          cls.toLowerCase().includes('highlight') || 
          cls.toLowerCase().includes('notebook')) {
        classNames.add(cls);
      }
    });
  }
});
console.log('Relevant class names:', Array.from(classNames));
```

## 🐛 Common Issues & Solutions

### Issue 1: "No books found"
**Possible Causes**:
- Amazon changed their HTML structure
- Page hasn't fully loaded
- User not logged in

**Solutions**:
1. Wait 5-10 seconds after page loads, then try sync
2. Check if you can manually see books on the page
3. Try refreshing the page and syncing again

### Issue 2: "Authentication required"
**Solution**: 
1. Go to [read.amazon.com/notebook](https://read.amazon.com/notebook)
2. Log into your Amazon account
3. Make sure you stay on the notebook page
4. Try sync again

### Issue 3: "Found books but no highlights"
**Possible Causes**:
- No highlights exist for your books
- Highlights are on a different page/view

**Solutions**:
1. Click on individual books on the Amazon page to see their highlights
2. Make sure you have actually highlighted text in your Kindle books

### Issue 4: Extension not responding
**Solutions**:
1. Reload the extension:
   - Go to `chrome://extensions/`
   - Find "Kindle Highlights Reminder"
   - Click the reload button 🔄
2. Reload the Amazon page
3. Try sync again

## 📋 Reporting Issues

If sync still doesn't work, please provide:

1. **Console Output**: Copy all console messages during sync
2. **Page URL**: The exact URL you're trying to sync from
3. **Browser Info**: Chrome version
4. **Account Status**: Can you see books/highlights manually on Amazon?

### Get Console Output:
1. Open DevTools (F12)
2. Go to Console tab
3. Clear console (🚫 button)
4. Try sync
5. Copy all output

### Example Good Bug Report:
```
**Issue**: No books found during sync

**URL**: https://read.amazon.com/notebook

**Console Output**:
Kindle Highlights Reminder: Content script loaded
Amazon Kindle notebook page detected
Found 0 books using all selectors
No books found on the page

**Browser**: Chrome 120.0.6099.129

**Manual Check**: I can see 5 books manually on the Amazon page
```

## 🔄 Alternative Sync Methods

If automatic sync isn't working, you can:

1. **Manual HTML Export**: 
   - Save the Amazon notebook page as HTML
   - We can create a parser for the saved file

2. **CSV Import**: 
   - Some users export highlights to CSV
   - We can add CSV import functionality

3. **API Integration**: 
   - Look into official Amazon/Goodreads APIs
   - Though these are limited

---

This debugging guide should help identify why sync isn't working. The most common issues are authentication and Amazon changing their page structure.