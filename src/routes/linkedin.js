const express = require('express');
const router = express.Router();
const { getBrowserContext, saveCookies } = require('../config/browser');

// LINKEDIN JOB DETAILS SCRAPING ENDPOINT
router.get("/get-linkedin-url", async (req, res) => {
  const { url } = req.query;
  
  if (!url) return res.status(400).json({ error: "URL is required" });
  
  console.log(`Processing LinkedIn Job URL: ${url}`);
  
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
      
      // Extract LinkedIn job data
      const jobData = await page.evaluate(() => {
        // Job title
        const jobTitle = document.querySelector('.top-card-layout__title')?.innerText.trim() || 
                         document.querySelector('h1.job-title')?.innerText.trim() || 
                         document.querySelector('h1')?.innerText.trim() || '';
        
        // Company name
        const companyName = document.querySelector('.topcard__org-name-link')?.innerText.trim() || 
                            document.querySelector('.top-card-layout__card-link')?.innerText.trim() || 
                            document.querySelector('.company-name')?.innerText.trim() || '';
        
        // Location
        const location = document.querySelector('.topcard__flavor--bullet')?.innerText.trim() || 
                         document.querySelector('.top-card-layout__bullet')?.innerText.trim() || 
                         document.querySelector('.job-location')?.innerText.trim() || '';
        
        // Job type
        const jobTypeElement = Array.from(document.querySelectorAll('.description__job-criteria-item')).find(
          item => item.querySelector('.description__job-criteria-subheader')?.innerText.includes('Employment type')
        );
        const jobType = jobTypeElement?.querySelector('.description__job-criteria-text')?.innerText.trim() || '';
        
        // Salary
        const salaryElement = Array.from(document.querySelectorAll('.compensation__salary'))
          .map(el => el.innerText.trim())
          .filter(text => text.length > 0)
          .join(' ') || '';
        
        // Job description
        const jobDescription = document.querySelector('.description__text')?.innerText.trim() || 
                               document.querySelector('.show-more-less-html__markup')?.innerText.trim() || '';
        
        // Extract responsibilities and requirements from job description
        let responsibilities = '';
        let requirements = '';
        let aboutJob = '';
        
        // Try to extract structured sections
        const sections = Array.from(document.querySelectorAll('.show-more-less-html__markup h2, .show-more-less-html__markup h3, .show-more-less-html__markup strong, .description__text h2, .description__text h3, .description__text strong'));
        
        for (let i = 0; i < sections.length; i++) {
          const sectionTitle = sections[i].innerText.toLowerCase();
          let sectionContent = '';
          
          // Get content until next section
          let nextElement = sections[i].nextElementSibling;
          while (nextElement && !['H2', 'H3', 'STRONG'].includes(nextElement.tagName)) {
            sectionContent += nextElement.innerText + ' ';
            nextElement = nextElement.nextElementSibling;
          }
          
          if (sectionTitle.includes('responsib') || sectionTitle.includes('what you\'ll do')) {
            responsibilities = sectionContent.trim();
          } else if (sectionTitle.includes('qualif') || sectionTitle.includes('requir') || sectionTitle.includes('skill') || sectionTitle.includes('what you need')) {
            requirements = sectionContent.trim();
          } else if (sectionTitle.includes('about') || sectionTitle.includes('overview') || sectionTitle.includes('summary')) {
            aboutJob = sectionContent.trim();
          }
        }
        
        // If structured extraction failed, try to extract from the full description
        if (!responsibilities && !requirements) {
          const fullText = jobDescription;
          
          // Look for common section indicators
          const respMatch = fullText.match(/responsibilities:?([\s\S]*?)(?:requirements|qualifications|skills required|what you need|about us|$)/i);
          const reqMatch = fullText.match(/(?:requirements|qualifications|skills required|what you need):?([\s\S]*?)(?:about us|benefits|$)/i);
          const aboutMatch = fullText.match(/(?:about the job|job summary|overview|about the role):?([\s\S]*?)(?:responsibilities|what you'll do|$)/i);
          
          if (respMatch && respMatch[1]) responsibilities = respMatch[1].trim();
          if (reqMatch && reqMatch[1]) requirements = reqMatch[1].trim();
          if (aboutMatch && aboutMatch[1]) aboutJob = aboutMatch[1].trim();
        }
        
        // Posted date and applicants
        const postedDate = document.querySelector('.posted-time-ago__text')?.innerText.trim() || 
                           document.querySelector('.job-posted-date')?.innerText.trim() || '';
        
        const applicants = document.querySelector('.num-applicants__caption')?.innerText.trim() || 
                           document.querySelector('.applicant-count')?.innerText.trim() || '';
        
        // Additional details
        const seniority = Array.from(document.querySelectorAll('.description__job-criteria-item'))
          .find(item => item.querySelector('.description__job-criteria-subheader')?.innerText.includes('Seniority level'))
          ?.querySelector('.description__job-criteria-text')?.innerText.trim() || '';
        
        const industry = Array.from(document.querySelectorAll('.description__job-criteria-item'))
          .find(item => item.querySelector('.description__job-criteria-subheader')?.innerText.includes('Industry'))
          ?.querySelector('.description__job-criteria-text')?.innerText.trim() || '';
        
        return {
          jobTitle,
          companyName,
          location,
          jobType,
          salary: salaryElement,
          aboutJob,
          responsibilities,
          requirements,
          postedDate,
          applicants,
          seniority,
          industry,
          fullDescription: jobDescription
        };
      });
      
      // Close the page
      await page.close();
      
      // Save cookies for future use
      await saveCookies(context);
      
      res.json({
        success: true,
        url: finalUrl,
        job: jobData
      });
      
    } catch (error) {
      console.error("Error processing LinkedIn Job URL:", error);
      await page.close();
      res.status(500).json({ error: error.message });
    }
  } catch (error) {
    console.error("Error initializing browser:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;