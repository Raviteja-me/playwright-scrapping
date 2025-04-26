const { chromium } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");

// Apply stealth plugin
chromium.use(StealthPlugin());

// Store the browser context to reuse
let browserContext = null;
let isInitializing = false;
let initializationQueue = [];

// Path to store cookies - use /tmp for Cloud Run
const COOKIES_PATH = process.env.COOKIES_PATH || path.join(__dirname, '../../browser_cookies.json');

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

// Function to save cookies
async function saveCookies(context) {
  const cookies = await context.cookies();
  fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies));
}

module.exports = {
  getBrowserContext,
  saveCookies,
  COOKIES_PATH
};