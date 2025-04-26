const express = require('express');
const router = express.Router();
const { getBrowserContext, saveCookies } = require('../config/browser');
const { extractReadableContent } = require('../utils/content-extractor');

// CRAWL ENDPOINT - For crawling multiple pages
router.post("/crawl", async (req, res) => {
  const { 
    start_url, 
    max_pages = 10, 
    same_domain = true,
    max_depth = 2,
    include_pattern,
    exclude_pattern,
    selector,
    timeout = 30000
  } = req.body;
  
  if (!start_url) return res.status(400).json({ error: "start_url is required" });
  
  console.log(`Starting crawl from: ${start_url}`);
  
  try {
    // Get browser context
    const context = await getBrowserContext();
    
    // Initialize crawl data
    const visited = new Set();
    const queue = [{ url: start_url, depth: 0 }];
    const results = [];
    
    // Extract domain from start_url for same_domain check
    const startDomain = new URL(start_url).hostname;
    
    // Create include/exclude regex patterns if provided
    const includeRegex = include_pattern ? new RegExp(include_pattern) : null;
    const excludeRegex = exclude_pattern ? new RegExp(exclude_pattern) : null;
    
    // Start crawling
    while (queue.length > 0 && results.length < max_pages) {
      const { url, depth } = queue.shift();
      
      // Skip if already visited
      if (visited.has(url)) continue;
      
      // Mark as visited
      visited.add(url);
      
      console.log(`Crawling ${url} (depth: ${depth})`);
      
      // Create a new page
      const page = await context.newPage();
      
      try {
        // Navigate to the URL
        await page.goto(url, { 
          waitUntil: "domcontentloaded", 
          timeout: parseInt(timeout) 
        });
        
        // Wait for selector if provided
        if (selector) {
          await page.waitForSelector(selector, { 
            timeout: parseInt(timeout) / 2 
          }).catch(() => console.log(`Selector "${selector}" not found on ${url}`));
        }
        
        // Get page data
        const pageData = {
          url: page.url(),
          title: await page.title(),
          content: await extractReadableContent(page)
        };
        
        // Add to results
        results.push(pageData);
        
        // If we haven't reached max depth, extract links and add to queue
        if (depth < max_depth) {
          const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href]'))
              .map(a => a.href)
              .filter(href => 
                href && 
                href.startsWith('http') && 
                !href.startsWith('javascript:')
              );
          });
          
          // Process each link
          for (const link of links) {
            try {
              const linkUrl = new URL(link);
              
              // Apply filters
              const sameDomainCheck = !same_domain || linkUrl.hostname === startDomain;
              const includeCheck = !includeRegex || includeRegex.test(link);
              const excludeCheck = !excludeRegex || !excludeRegex.test(link);
              
              if (sameDomainCheck && includeCheck && excludeCheck && !visited.has(link)) {
                queue.push({ url: link, depth: depth + 1 });
              }
            } catch (e) {
              // Skip invalid URLs
              console.log(`Skipping invalid URL: ${link}`);
            }
          }
        }
        
        // Close the page
        await page.close();
        
      } catch (error) {
        console.error(`Error crawling ${url}:`, error.message);
        await page.close();
      }
    }
    
    // Save cookies for future use
    await saveCookies(context);
    
    res.json({
      success: true,
      pages_crawled: results.length,
      results
    });
    
  } catch (error) {
    console.error("Error during crawl:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;