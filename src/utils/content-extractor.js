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

module.exports = {
  extractReadableContent
};