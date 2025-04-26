const express = require('express');
const router = express.Router();
const { getBrowserContext, saveCookies } = require('../config/browser');

// SITE MAPPING ENDPOINT
router.post("/map", async (req, res) => {
  const { 
    start_url, 
    max_urls = 100, 
    max_depth = 3,
    same_domain = true,
    include_pattern,
    exclude_pattern,
    timeout = 30000
  } = req.body;
  
  if (!start_url) return res.status(400).json({ error: "start_url is required" });
  
  console.log(`Mapping site from: ${start_url}`);
  
  try {
    // Get browser context
    const context = await getBrowserContext();
    
    // Initialize site map data
    const visited = new Set();
    const queue = [{ url: start_url, depth: 0, parent: null }];
    const siteMap = {
      nodes: [],
      links: []
    };
    
    // Extract domain from start_url for same_domain check
    const startDomain = new URL(start_url).hostname;
    
    // Create include/exclude regex patterns if provided
    const includeRegex = include_pattern ? new RegExp(include_pattern) : null;
    const excludeRegex = exclude_pattern ? new RegExp(exclude_pattern) : null;
    
    // Start mapping
    while (queue.length > 0 && siteMap.nodes.length < max_urls) {
      const { url, depth, parent } = queue.shift();
      
      // Skip if already visited
      if (visited.has(url)) {
        // If we have a parent, still add the link
        if (parent) {
          siteMap.links.push({ source: parent, target: url });
        }
        continue;
      }
      
      // Mark as visited
      visited.add(url);
      
      console.log(`Mapping ${url} (depth: ${depth})`);
      
      // Add node to site map
      const nodeId = siteMap.nodes.length;
      siteMap.nodes.push({ id: nodeId, url, depth });
      
      // Add link to parent if exists
      if (parent !== null) {
        siteMap.links.push({ source: parent, target: nodeId });
      }
      
      // If we've reached max depth, don't crawl further
      if (depth >= max_depth) continue;
      
      // Create a new page
      const page = await context.newPage();
      
      try {
        // Navigate to the URL
        await page.goto(url, { 
          waitUntil: "domcontentloaded", 
          timeout: parseInt(timeout) 
        });
        
        // Extract links
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
            
            if (sameDomainCheck && includeCheck && excludeCheck) {
              queue.push({ url: link, depth: depth + 1, parent: nodeId });
            }
          } catch (e) {
            // Skip invalid URLs
            console.log(`Skipping invalid URL: ${link}`);
          }
        }
        
        // Close the page
        await page.close();
        
      } catch (error) {
        console.error(`Error mapping ${url}:`, error.message);
        await page.close();
      }
    }
    
    // Save cookies for future use
    await saveCookies(context);
    
    res.json({
      success: true,
      urls_mapped: siteMap.nodes.length,
      site_map: siteMap
    });
    
  } catch (error) {
    console.error("Error during site mapping:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;