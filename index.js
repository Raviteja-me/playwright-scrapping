const express = require("express");
const { chromium, firefox, webkit } = require("playwright-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

chromium.use(StealthPlugin());
firefox.use(StealthPlugin());
webkit.use(StealthPlugin());

const app = express();
const PORT = process.env.PORT || 8080;

app.get("/scrape", async (req, res) => {
    const { url, browserType = "chromium" } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });

    let browser;
    try {
        // Choose the browser dynamically
        const browserEngine = browserType === "firefox" ? firefox
                            : browserType === "webkit" ? webkit
                            : chromium;

        browser = await browserEngine.launch({ headless: true, args: ["--no-sandbox"] });

        const context = await browser.newContext({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
            viewport: { width: 1280, height: 800 }
        });

        const page = await context.newPage();
        await page.goto(url, { waitUntil: "load", timeout: 90000 });

        // **Different strategies for LinkedIn & Naukri**
        let pageContent = "No readable content found";

        if (url.includes("linkedin.com")) {
            // **LinkedIn: Requires scrolling**
            for (let i = 0; i < 3; i++) {
                await page.mouse.wheel(0, 500);
                await page.waitForTimeout(2000);
            }

            await page.waitForSelector("body", { timeout: 15000 }).catch(() => null);
            pageContent = await page.evaluate(() => document.body.innerText.trim());

        } else if (url.includes("naukri.com")) {
            // **Naukri: Requires waiting for job content**
            await page.waitForSelector(".jd-container", { timeout: 10000 }).catch(() => null);
            pageContent = await page.evaluate(() => document.body.innerText.trim());
        } else {
            // **Default strategy for other websites**
            pageContent = await page.evaluate(() => document.body.innerText.trim());
        }

        res.json({ content: pageContent || "No readable content found" });

    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));