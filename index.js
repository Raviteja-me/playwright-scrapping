// Import the app and PORT from the app module
const { app, PORT } = require('./src/app');

// Try to start the server with fallback ports
const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`Ultimate Web Scraper server running on port ${port}`);
    console.log(`Health check available at: http://localhost:${port}/health`);
    console.log(`API endpoints:`);
    console.log(`- GET  /scrape - Scrape a single URL`);
    console.log(`- POST /crawl  - Crawl multiple pages`);
    console.log(`- POST /map    - Create a site map`);
    console.log(`- POST /search - Search for content across pages`);
    console.log(`- GET  /get-linkedin-url - Process LinkedIn URLs`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is busy, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
    });
  });
};

// Start with the default PORT from app.js
startServer(PORT);