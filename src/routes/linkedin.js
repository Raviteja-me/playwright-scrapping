const express = require('express');
const router = express.Router();
const { getBrowserContext, saveCookies } = require('../config/browser');

// LINKEDIN URL PROCESSING ENDPOINT
router.get("/get-linkedin-url", async (req, res) => {
  const { url } = req.query;
  
  if (!url) return res.status(400).json({ error: "URL is required" });
  
  console.log(`Processing LinkedIn URL: ${url}`);
  
  try {
    // Get browser context
    const context = await getBrowserContext();
    
    // Create a new page
    const page = await context.newPage();
    
    try {
      // Navigate to the URL
      await page.goto(url, { 
        waitUntil: "domcontentloaded", 
        timeout: 30000 
      });
      
      // Get the final URL (after any redirects)
      const finalUrl = page.url();
      
      // Extract LinkedIn profile data
      const profileData = await page.evaluate(() => {
        const name = document.querySelector('.text-heading-xlarge')?.innerText || '';
        const headline = document.querySelector('.text-body-medium')?.innerText || '';
        const location = document.querySelector('.text-body-small.inline.t-black--light.break-words')?.innerText || '';
        
        // Get experience
        const experienceItems = Array.from(document.querySelectorAll('#experience-section .pv-entity__position-group'));
        const experience = experienceItems.map(item => {
          const company = item.querySelector('.pv-entity__secondary-title')?.innerText || '';
          const title = item.querySelector('.pv-entity__primary-title')?.innerText || '';
          const duration = item.querySelector('.pv-entity__date-range span:nth-child(2)')?.innerText || '';
          return { company, title, duration };
        });
        
        // Get education
        const educationItems = Array.from(document.querySelectorAll('#education-section .pv-education-entity'));
        const education = educationItems.map(item => {
          const school = item.querySelector('.pv-entity__school-name')?.innerText || '';
          const degree = item.querySelector('.pv-entity__degree-name .pv-entity__comma-item')?.innerText || '';
          const field = item.querySelector('.pv-entity__fos .pv-entity__comma-item')?.innerText || '';
          return { school, degree, field };
        });
        
        return {
          name,
          headline,
          location,
          experience,
          education
        };
      });
      
      // Close the page
      await page.close();
      
      // Save cookies for future use
      await saveCookies(context);
      
      res.json({
        success: true,
        url: finalUrl,
        profile: profileData
      });
      
    } catch (error) {
      console.error("Error processing LinkedIn URL:", error);
      await page.close();
      res.status(500).json({ error: error.message });
    }
  } catch (error) {
    console.error("Error initializing browser:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;