const cheerio = require('cheerio');
const TurndownService = require('turndown');

const turndown = new TurndownService();

/**
 * Extracts the main job content from a job listing HTML page.
 * Removes clutter and returns plain text or markdown.
 * @param {string} html - The raw HTML of the job page.
 * @param {boolean} returnMarkdown - Whether to return Markdown instead of raw HTML.
 * @returns {string} - Cleaned content.
 */
function extractJobContent(html, returnMarkdown = false) {
  const $ = cheerio.load(html);

  // Remove common clutter and more unwanted elements
  $(
    [
      'header',
      'footer',
      'nav',
      'aside',
      'script',
      'style',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="contentinfo"]',
      '.ad',
      '.ads',
      '.advertisement',
      '.promo',
      '.sidebar',
      '.footer',
      '.header',
      '.navbar',
      '.navigation',
      '.cookie',
      '.cookies',
      '.newsletter',
      '.subscribe',
      '.modal',
      '.popup',
      '.related-jobs',
      '.comments',
      '.recommendations',
      '.suggested-jobs',
      '.breadcrumb',
      '.breadcrumbs',
      '.share',
      '.social',
      '.apply-button',
      '.job-apply',
      '.job-actions',
      '.job-footer',
      '.job-header',
      '.site-footer',
      '.site-header',
      '.global-nav',
      '.global-footer',
      '[aria-hidden="true"]',
      '[style*="display:none"]',
      '[style*="display: none"]',
      // LinkedIn-specific
      '.jobs-apply-button',
      '.jobs-similar-jobs',
      '.jobs-poster__container',
      '.jobs-unified-top-card__content--two-pane',
      '.jobs-unified-top-card__content--single-pane',
      '.jobs-details__main-content',
      '.jobs-details__similar-jobs',
      '.jobs-details__footer',
      '.jobs-details__job-description',
      '.jobs-search-box',
      '.jobs-search-box__input',
      '.jobs-search-box__submit-button',
      '.jobs-search-box__clear-button',
      '.jobs-search-box__dropdown',
      '.jobs-search-box__dropdown-trigger',
      '.jobs-search-box__dropdown-menu',
      '.jobs-search-box__dropdown-option',
      '.jobs-search-box__dropdown-option-label',
      '.jobs-search-box__dropdown-option-icon',
      '.jobs-search-box__dropdown-option-description',
      '.jobs-search-box__dropdown-option-action',
      '.jobs-search-box__dropdown-option-action-icon',
      '.jobs-search-box__dropdown-option-action-label',
      '.jobs-search-box__dropdown-option-action-description',
      '.jobs-search-box__dropdown-option-action-link',
      '.jobs-search-box__dropdown-option-action-link-icon',
      '.jobs-search-box__dropdown-option-action-link-label',
      '.jobs-search-box__dropdown-option-action-link-description',
      '.jobs-search-box__dropdown-option-action-link-action',
      '.jobs-search-box__dropdown-option-action-link-action-icon',
      '.jobs-search-box__dropdown-option-action-link-action-label',
      '.jobs-search-box__dropdown-option-action-link-action-description',
      '.jobs-search-box__dropdown-option-action-link-action-link',
      '.jobs-search-box__dropdown-option-action-link-action-link-icon',
      '.jobs-search-box__dropdown-option-action-link-action-link-label',
      '.jobs-search-box__dropdown-option-action-link-action-link-description',
      '.jobs-search-box__dropdown-option-action-link-action-link-action',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-icon',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-label',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-description',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-icon',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-label',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-description',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-icon',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-label',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-description',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-icon',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-label',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-description',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-action',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-action-icon',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-action-label',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-action-description',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-action-link',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-action-link-icon',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-action-link-label',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-action-link-description',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-action-link-action',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-action-link-action-icon',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-action-link-action-label',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-action-link-action-description',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-action-link-action-link',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-action-link-action-link-icon',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-action-link-action-link-label',
      '.jobs-search-box__dropdown-option-action-link-action-link-action-link-action-link-action-link-action-link-description',
    ].join(', ')
  ).remove();

  // Try to find the main content using a prioritized list of selectors
  const mainSelectors = [
    'main',
    '.job-description',
    '#job-description',
    '.description',
    '#description',
    '.job-desc',
    '#job-desc',
    '.job-details',
    '#job-details',
    '.job-view',
    '#job-view',
    '.job-content',
    '#job-content',
    '[class*="description"]',
    '[id*="description"]',
    '[class*="job"]',
    '[id*="job"]',
    '[class*="content"]',
    '[id*="content"]',
    '[class*="main"]',
    '[id*="main"]',
  ];

  let mainContent = null;
  for (const selector of mainSelectors) {
    const found = $(selector).first();
    if (found.length && found.text().trim().length > 80) { // Only if it's not empty and has enough text
      mainContent = found;
      break;
    }
  }

  // As a last resort, fallback to body only if nothing else found
  if (!mainContent) {
    const body = $('body');
    if (body.length && body.text().trim().length > 80) {
      mainContent = body;
    }
  }

  if (!mainContent) return '';

  const htmlContent = mainContent.html() || '';
  let cleanText = returnMarkdown
    ? turndown.turndown(htmlContent)
    : cheerio.load(htmlContent).text().trim();

  // Post-process: remove excessive whitespace and empty lines
  cleanText = cleanText
    .replace(/\n{3,}/g, '\n\n') // No more than 2 consecutive newlines
    .replace(/[ \t]+/g, ' ')      // Collapse multiple spaces/tabs
    .replace(/^\s+|\s+$/gm, '')  // Trim each line
    .trim();

  // Remove LinkedIn sign-in/join blocks and similar jobs blocks from Markdown
  cleanText = cleanText.replace(/Sign in[\s\S]*?New to LinkedIn\? \[Join now\][\s\S]*?\n\n/g, '');
  cleanText = cleanText.replace(/Similar jobs[\s\S]*?Show more Show less[\s\S]*?\n\n/g, '');

  // Best practice: Remove repeated "Welcome back" and "By clicking Continue" blocks
  cleanText = cleanText.replace(/Welcome back[\s\S]*?By clicking Continue to join or sign in[\s\S]*?\n\n/g, '');

  // Remove any remaining "People also viewed" or "Explore collaborative articles" blocks
  cleanText = cleanText.replace(/People also viewed[\s\S]*?Explore collaborative articles[\s\S]*?\n\n/g, '');

  // Final trim
  cleanText = cleanText.trim();

  return cleanText;
}

module.exports = { extractJobContent };