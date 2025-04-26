const express = require('express');
const router = express.Router();
const { getBrowserContext, saveCookies } = require('../config/browser');

// CONTENT SEARCH ENDPOINT
router.post("/search", async (req, res) => {
  const { 
    start_url, 
    search_term,
    max_pages = 20, 
    max_depth = 2,
    same_domain = true,
    include_pattern,
    exclude_pattern,
    context_size = 100,
    timeout = 30000
  } = req.body;
  
  if (!start_url) return res.status(400).json({ error: "start_url is required" });
  if (!search_term) return res.status(400).json({ error: "search_term is required" });
  
  console.log(`Searching for "${search_term}" starting from: ${start_url}`);
  
  try {
    // Get browser context
    const context = await getBrowserContext();
    
    // Initialize search data
    const visited = new Set();
    const queue = [{ url: start_url, depth: 0 }];
    const results = [];
    
    // Extract domain from start_url for same_domain check
    const startDomain = new URL(start_url).hostname;
    
    // Create include/exclude regex patterns if provided
    const includeRegex = include_pattern ? new RegExp(include_pattern) : null;
    const excludeRegex = exclude_pattern ? new RegExp(exclude_pattern) : null;
    
    // Create search regex
    const searchRegex = new RegExp(search_term, 'gi');
    
    // Start searching
    while (queue.length > 0 && visited.size < max_pages) {
      const { url, depth } = queue.shift();
      
      // Skip if already visited
      if (visited.has(url)) continue;
      
      // Mark as visited
      visited.add(url);
      
      console.log(`Searching ${url} (depth: ${depth})`);
      
      // Create a new page
      const page = await context.newPage();
      
      try {
        // Navigate to the URL
        await page.goto(url, { 
          waitUntil: "domcontentloaded", 
          timeout: parseInt(timeout) 
        });
        
        // Get page title
        const title = await page.title();
        
        // Search for content
        const matches = await page.evaluate((searchTerm, contextSize) => {
          const searchRegex = new RegExp(searchTerm, 'gi');
          const text = document.body.innerText;
          const matches = [];
          
          let match;
          while ((match = searchRegex.exec(text)) !== null) {
            const start = Math.max(0, match.index - contextSize);
            const end = Math.min(text.length, match.index + match[0].length + contextSize);
            
            const before = text.substring(start, match.index);
            const term = match[0];
            const after = text.substring(match.index + term.length, end);
            
            matches.push({
              term,
              context: before + term + after,
              position: match.index
            });
          }
          
          return matches;
        }, search_term, context_size);
        
        // If we found matches, add to results
        if (matches.length > 0) {
          results.push({
            url,
            title,
            matches
          });
        }
        
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
        console.error(`Error searching ${url}:`, error.message);
        await page.close();
      }
    }
    
    // Save cookies for future use
    await saveCookies(context);
    
    res.json({
      success: true,
      pages_searched: visited.size,
      matches_found: results.reduce((total, page) => total + page.matches.length, 0),
      results
    });
    
  } catch (error) {
    console.error("Error during search:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;