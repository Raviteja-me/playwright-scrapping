const express = require('express');
const router = express.Router();
const { getBrowserContext, saveCookies } = require('../config/browser');
const { extractReadableContent } = require('../utils/content-extractor');
const TurndownService = require('turndown');
const turndownService = new TurndownService();

// SINGLE URL SCRAPING ENDPOINT
router.get("/scrape", async (req, res) => {
  const { url, selector, wait_for, timeout, format } = req.query;
  
  if (!url) return res.status(400).json({ error: "URL is required" });
  
  console.log(`Scraping URL: ${url}`);
  
  try {
    // Get browser context
    const context = await getBrowserContext();
    
    // Create a new page
    const page = await context.newPage();
    
    try {
      // Ensure the URL is properly formatted
      let formattedUrl = url.trim();
      
      // Fix common URL issues with spaces and special characters
      formattedUrl = formattedUrl.replace(/\s+/g, "%20");
      
      if (!formattedUrl.startsWith('http')) {
        formattedUrl = 'https://' + formattedUrl;
      }
      
      console.log(`Navigating to: ${formattedUrl}`);
      
      // Navigate to the URL
      await page.goto(formattedUrl, { 
        waitUntil: wait_for || "domcontentloaded", 
        timeout: parseInt(timeout) || 30000 
      });
      
      // Wait for selector if provided
      if (selector) {
        await page.waitForSelector(selector, { 
          timeout: parseInt(timeout) || 10000 
        }).catch(() => console.log(`Selector "${selector}" not found`));
      }
      
      // Get the final URL (after any redirects)
      const finalUrl = page.url();
      
      // Get page title
      const title = await page.title();
      
      // Prepare response based on requested format
      let result;
      
      if (format === 'readable') {
        // Extract readable content
        result = await extractReadableContent(page);
      } else if (format === 'markdown') {
        // Extract main content as HTML
        const html = await page.evaluate(() => {
          // Remove unwanted elements
          const elementsToRemove = [
            'script', 'style', 'noscript', 'iframe', 'svg', 'path', 'footer',
            'nav', 'header', '[role="banner"]', '[role="navigation"]', '[role="complementary"]'
          ];
          elementsToRemove.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => el.remove());
          });
          // Extract main content
          const mainContent = document.querySelector('main') || 
                              document.querySelector('article') || 
                              document.querySelector('#content') || 
                              document.querySelector('.content') || 
                              document.body;
          return mainContent ? mainContent.innerHTML : document.body.innerHTML;
        });
        // Convert HTML to Markdown
        const markdown = turndownService.turndown(html);
        result = {
          url: finalUrl,
          title,
          markdown
        };
      } else {
        // Default: return full HTML
        const html = await page.content();
        
        // Take a screenshot
        const screenshot = await page.screenshot({ 
          type: 'jpeg', 
          quality: 80,
          fullPage: true 
        });
        
        result = {
          url: finalUrl,
          title,
          html,
          screenshot: screenshot.toString('base64')
        };
      }
      
      // Close the page
      await page.close();
      
      // Save cookies for future use
      await saveCookies(context);
      
      res.json({
        success: true,
        url: finalUrl,
        data: result
      });
      
    } catch (error) {
      console.error("Error during scraping:", error);
      await page.close();
      res.status(500).json({ error: error.message });
    }
  } catch (error) {
    console.error("Error initializing browser:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;