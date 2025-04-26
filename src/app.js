require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

// Create Express app
const app = express();
const PORT = process.env.PORT || 8080;

// Enable JSON body parsing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Add a health check endpoint
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Import routes
const scrapeRoute = require('./routes/scrape');
const crawlRoute = require('./routes/crawl');
const mapRoute = require('./routes/map');
const searchRoute = require('./routes/search');
const linkedinRoute = require('./routes/linkedin');

// Register routes
app.use(scrapeRoute);
app.use(crawlRoute);
app.use(mapRoute);
app.use(searchRoute);
app.use(linkedinRoute);

// Add a startup log
console.log(`Starting Ultimate Web Scraper on port ${PORT}`);

module.exports = { app, PORT };