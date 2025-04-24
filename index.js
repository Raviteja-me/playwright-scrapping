// At the top of your file
require('dotenv').config();
const express = require("express");
const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");

// Apply stealth plugin
chromium.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 8080;

// Enable JSON body parsing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Store the browser context to reuse
let browserContext = null;
let isInitializing = false;
let initializationQueue = [];

// Path to store cookies - use /tmp for Cloud Run
const COOKIES_PATH = process.env.COOKIES_PATH || path.join(__dirname, 'browser_cookies.json');

// Add a health check endpoint
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Add a startup log
console.log(`Starting Ultimate Web Scraper on port ${PORT}`);

// Function to get browser context
async function getBrowserContext() {
  if (browserContext) {
    return browserContext;
  }

  if (isInitializing) {
    // Wait for initialization to complete
    return new Promise((resolve) => {
      initializationQueue.push(resolve);
    });
  }

  isInitializing = true;
  console.log("Initializing browser context...");

  try {
    const browser = await chromium.launch({ 
      headless: true, 
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--js-flags=--max-old-space-size=500", // Limit memory usage
        "--window-size=1920,1080"
      ]
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      locale: "en-US",
      timezoneId: "America/New_York",
      geolocation: { longitude: -73.935242, latitude: 40.730610 },
      permissions: ["geolocation"],
      screen: { width: 1920, height: 1080 }
    });

    // Add extra headers to appear more like a real browser
    await context.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'sec-ch-ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    });

    // Try to load cookies if they exist
    try {
      if (fs.existsSync(COOKIES_PATH)) {
        const cookiesString = fs.readFileSync(COOKIES_PATH);
        const cookies = JSON.parse(cookiesString);
        await context.addCookies(cookies);
        console.log("Loaded cookies from file");
      }
    } catch (error) {
      console.log("Error loading cookies:", error.message);
    }

    // Add realistic browser behavior to all new pages
    context.on('page', async (page) => {
      await page.addInitScript(() => {
        // Override the navigator properties
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false
        });
        
        // Add language plugins to appear more like a real browser
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en']
        });
        
        // Add a fake plugins array
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            { name: 'Chrome PDF Plugin' },
            { name: 'Chrome PDF Viewer' },
            { name: 'Native Client' }
          ]
        });
      });
      
      // Add random delays to mimic human behavior
      await page.route('**/*', async route => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        route.continue();
      });
    });
    
    browserContext = context;
    
    // Resolve all waiting promises
    for (const resolve of initializationQueue) {
      resolve(browserContext);
    }
    initializationQueue = [];
    
    return browserContext;
  } catch (error) {
    console.error("Browser initialization error:", error);
    isInitializing = false;
    throw error;
  } finally {
    isInitializing = false;
  }
}

// Helper function to extract readable content from a page
async function extractReadableContent(page) {
  return page.evaluate(() => {
    // Remove unwanted elements that typically don't contain meaningful content
    const elementsToRemove = [
      'script', 'style', 'noscript', 'iframe', 'svg', 'path', 'footer',
      'nav', 'header', '[role="banner"]', '[role="navigation"]', '[role="complementary"]'
    ];
    
    elementsToRemove.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        el.remove();
      });
    });
    
    // Extract main content
    const mainContent = document.querySelector('main') || 
                        document.querySelector('article') || 
                        document.querySelector('#content') || 
                        document.querySelector('.content') || 
                        document.body;
    
    // Get all text nodes
    const textContent = mainContent.innerText
      .replace(/\s+/g, ' ')
      .trim();
    
    // Get all links
    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(a => ({
        text: a.innerText.trim(),
        href: a.href
      }))
      .filter(link => link.text && !link.href.startsWith('javascript:'));
    
    // Get all images
    const images = Array.from(document.querySelectorAll('img[src]'))
      .map(img => ({
        alt: img.alt,
        src: img.src
      }))
      .filter(img => img.src);
    
    // Get headings
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map(h => ({
        level: parseInt(h.tagName.substring(1)),
        text: h.innerText.trim()
      }))
      .filter(h => h.text);
    
    // Get meta information
    const title = document.title;
    const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
    const metaKeywords = document.querySelector('meta[name="keywords"]')?.content || '';
    
    return {
      title,
      metaDescription,
      metaKeywords,
      textContent,
      headings,
      links,
      images
    };
  });
}

// 1. SINGLE URL SCRAPING ENDPOINT
app.get("/scrape", async (req, res) => {
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
      const cookies = await context.cookies();
      fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies));
      
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

// 2. CRAWL ENDPOINT - For crawling multiple pages
app.post("/crawl", async (req, res) => {
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
                !href.includes('#') && 
                !href.endsWith('.pdf') && 
                !href.endsWith('.jpg') && 
                !href.endsWith('.png') && 
                !href.endsWith('.gif')
              );
          });
          
          // Process each link
          for (const link of links) {
            // Skip if already visited or queued
            if (visited.has(link)) continue;
            
            // Check if same domain (if required)
            if (same_domain) {
              const linkDomain = new URL(link).hostname;
              if (linkDomain !== startDomain) continue;
            }
            
            // Check include pattern
            if (includeRegex && !includeRegex.test(link)) continue;
            
            // Check exclude pattern
            if (excludeRegex && excludeRegex.test(link)) continue;
            
            // Add to queue
            queue.push({ url: link, depth: depth + 1 });
          }
        }
      } catch (error) {
        console.error(`Error crawling ${url}:`, error.message);
      } finally {
        await page.close();
      }
    }
    
    // Save cookies for future use
    const cookies = await context.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies));
    
    res.json({
      success: true,
      pages_crawled: results.length,
      total_discovered: visited.size,
      results
    });
    
  } catch (error) {
    console.error("Error during crawl:", error);
    res.status(500).json({ error: error.message });
  }
});

// 3. MAP ENDPOINT - For creating a site map
app.post("/map", async (req, res) => {
  const { 
    url, 
    max_urls = 100, 
    max_depth = 3,
    include_pattern,
    exclude_pattern
  } = req.body;
  
  if (!url) return res.status(400).json({ error: "URL is required" });
  
  console.log(`Mapping site: ${url}`);
  
  try {
    // Get browser context
    const context = await getBrowserContext();
    
    // Initialize map data
    const visited = new Set();
    const queue = [{ url, depth: 0 }];
    const siteMap = {
      domain: new URL(url).hostname,
      start_url: url,
      urls: [],
      structure: {}
    };
    
    // Create include/exclude regex patterns if provided
    const includeRegex = include_pattern ? new RegExp(include_pattern) : null;
    const excludeRegex = exclude_pattern ? new RegExp(exclude_pattern) : null;
    
    // Extract domain from url
    const domain = new URL(url).hostname;
    
    // Start mapping
    while (queue.length > 0 && visited.size < max_urls) {
      const { url, depth } = queue.shift();
      
      // Skip if already visited
      if (visited.has(url)) continue;
      
      // Mark as visited
      visited.add(url);
      
      console.log(`Mapping ${url} (depth: ${depth})`);
      
      // Skip if we've reached max depth
      if (depth > max_depth) continue;
      
      // Create a new page
      const page = await context.newPage();
      
      try {
        // Navigate to the URL
        await page.goto(url, { 
          waitUntil: "domcontentloaded", 
          timeout: 30000 
        });
        
        // Get page data
        const finalUrl = page.url();
        const title = await page.title();
        
        // Add to site map
        const urlData = {
          url: finalUrl,
          title,
          depth,
          links: []
        };
        
        siteMap.urls.push(urlData);
        
        // Add to structure
        let currentLevel = siteMap.structure;
        const urlParts = new URL(finalUrl).pathname.split('/').filter(Boolean);
        
        for (let i = 0; i < urlParts.length; i++) {
          const part = urlParts[i];
          if (!currentLevel[part]) {
            currentLevel[part] = {};
          }
          currentLevel = currentLevel[part];
        }
        
        // Extract links if we haven't reached max depth
        if (depth < max_depth) {
          const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href]'))
              .map(a => ({
                href: a.href,
                text: a.innerText.trim(),
                rel: a.rel
              }))
              .filter(link => 
                link.href && 
                link.href.startsWith('http') && 
                !link.href.includes('#') &&
                !link.href.endsWith('.pdf') && 
                !link.href.endsWith('.jpg') && 
                !link.href.endsWith('.png') && 
                !link.href.endsWith('.gif')
              );
          });
          
          // Process each link
          for (const link of links) {
            // Add to page links
            urlData.links.push(link);
            
            // Check if link is on the same domain
            const linkDomain = new URL(link.href).hostname;
            if (linkDomain !== domain) continue;
            
            // Check include pattern
            if (includeRegex && !includeRegex.test(link.href)) continue;
            
            // Check exclude pattern
            if (excludeRegex && excludeRegex.test(link.href)) continue;
            
            // Add to queue
            queue.push({ url: link.href, depth: depth + 1 });
          }
        }
      } catch (error) {
        console.error(`Error mapping ${url}:`, error.message);
      } finally {
        await page.close();
      }
    }
    
    // Save cookies for future use
    const cookies = await context.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies));
    
    res.json({
      success: true,
      urls_mapped: siteMap.urls.length,
      total_discovered: visited.size,
      site_map: siteMap
    });
    
  } catch (error) {
    console.error("Error during site mapping:", error);
    res.status(500).json({ error: error.message });
  }
});

// 4. SEARCH ENDPOINT - For searching content across a site
app.post("/search", async (req, res) => {
  const { 
    url, 
    query,
    max_results = 10,
    max_pages = 20,
    include_pattern,
    exclude_pattern
  } = req.body;
  
  if (!url) return res.status(400).json({ error: "URL is required" });
  if (!query) return res.status(400).json({ error: "Search query is required" });
  
  console.log(`Searching for "${query}" on ${url}`);
  
  try {
    // Get browser context
    const context = await getBrowserContext();
    
    // Initialize search data
    const visited = new Set();
    const queue = [url];
    const results = [];
    
    // Create include/exclude regex patterns if provided
    const includeRegex = include_pattern ? new RegExp(include_pattern) : null;
    const excludeRegex = exclude_pattern ? new RegExp(exclude_pattern) : null;
    
    // Create search regex
    const searchRegex = new RegExp(query, 'i');
    
    // Extract domain from url
    const domain = new URL(url).hostname;
    
    // Start searching
    while (queue.length > 0 && visited.size < max_pages && results.length < max_results) {
      const currentUrl = queue.shift();
      
      // Skip if already visited
      if (visited.has(currentUrl)) continue;
      
      // Mark as visited
      visited.add(currentUrl);
      
      console.log(`Searching ${currentUrl}`);
      
      // Create a new page
      const page = await context.newPage();
      
      try {
        // Navigate to the URL
        await page.goto(currentUrl, { 
          waitUntil: "domcontentloaded", 
          timeout: 30000 
        });
        
        // Get page content
        const content = await page.content();
        const title = await page.title();
        
        // Check if content matches search query
        if (searchRegex.test(content)) {
          // Extract matching text with context
          const matches = await page.evaluate((query) => {
            const regex = new RegExp(`(.{0,50}${query}.{0,50})`, 'gi');
            const content = document.body.innerText;
            const matches = [];
            let match;
            
            while ((match = regex.exec(content)) !== null) {
              matches.push(match[0].trim());
            }
            
            return matches;
          }, query);
          
          // Add to results
          if (matches.length > 0) {
            results.push({
              url: page.url(),
              title,
              matches
            });
          }
        }
        
        // Extract links for further searching
        if (visited.size < max_pages) {
          const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href]'))
              .map(a => a.href)
              .filter(href => 
                href && 
                href.startsWith('http') && 
                !href.includes('#') &&
                !href.endsWith('.pdf') && 
                !href.endsWith('.jpg') && 
                !href.endsWith('.png') && 
                !href.endsWith('.gif')
              );
          });
          
          // Process each link
          for (const link of links) {
            // Skip if already visited or queued
            if (visited.has(link) || queue.includes(link)) continue;
            
            // Check if link is on the same domain
            const linkDomain = new URL(link).hostname;
            if (linkDomain !== domain) continue;
            
            // Check include pattern
            if (includeRegex && !includeRegex.test(link)) continue;
            
            // Check exclude pattern
            if (excludeRegex && excludeRegex.test(link)) continue;
            
            // Add to queue
            queue.push(link);
          }
        }
      } catch (error) {
        console.error(`Error searching ${currentUrl}:`, error.message);
      } finally {
        await page.close();
      }
    }
    
    // Save cookies for future use
    const cookies = await context.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies));
    
    res.json({
      success: true,
      query,
      results_found: results.length,
      pages_searched: visited.size,
      results
    });
    
  } catch (error) {
    console.error("Error during search:", error);
    res.status(500).json({ error: error.message });
  }
});

// Keep the LinkedIn URL endpoint for backward compatibility
app.get("/get-linkedin-url", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL is required" });

  console.log(`Processing LinkedIn URL: ${url}`);
  
  try {
    // Get browser context
    const context = await getBrowserContext();
    
    // Create a new page
    const page = await context.newPage();
    
    // Ensure the URL is properly formatted
    let formattedUrl = url.trim();
    
    // Fix common URL issues with spaces and special characters
    formattedUrl = formattedUrl.replace(/\s+/g, "%20");
    
    console.log(`Navigating to: ${formattedUrl}`);
    
    // Navigate to the URL
    await page.goto(formattedUrl, { 
      waitUntil: "domcontentloaded", 
      timeout: 60000 
    });
    
    // Wait a moment for any client-side redirects
    await page.waitForTimeout(3000);
    
    // If it's a job search URL, try to click on the first job to get currentJobId
    if (formattedUrl.includes("/jobs/search")) {
      console.log("Job search page detected, looking for job cards...");
      
      // Wait for job cards to appear
      await page.waitForSelector(".job-card-container", { timeout: 10000 })
        .catch(() => console.log("Job cards not found, continuing anyway"));
      
      // Click on the first job card if available
      const firstJobCard = await page.$(".job-card-container");
      if (firstJobCard) {
        console.log("Found job card, clicking...");
        await firstJobCard.click();
        await page.waitForTimeout(3000); // Wait for URL to update
      } else {
        console.log("No job cards found");
      }
    }
    
    // Get the final URL
    const finalUrl = page.url();
    console.log(`Final URL: ${finalUrl}`);
    
    // Close the page but keep the context for future requests
    await page.close();
    
    res.json({ 
      originalUrl: url,
      finalUrl: finalUrl,
      success: finalUrl.includes("currentJobId")
    });
  } catch (error) {
    console.error("Error processing URL:", error);
    
    // If authentication failed, clear the context to try again next time
    if (error.message.includes("login failed")) {
      browserContext = null;
      
      // Delete cookies file if authentication failed
      if (fs.existsSync(COOKIES_PATH)) {
        fs.unlinkSync(COOKIES_PATH);
        console.log("Deleted invalid cookies file");
      }
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Ultimate Web Scraper running on port ${PORT}`);
});