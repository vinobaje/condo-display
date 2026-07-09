const { onRequest } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");

/**
 * RSS Feed CORS Proxy for Condo Notice Board
 * Fetches RSS feeds server-side to bypass browser CORS restrictions.
 * 
 * Usage: GET /rssProxy?url=https://www.chch.com/feed/
 * Returns: RSS XML with CORS headers
 */
exports.rssProxy = onRequest(
  { cors: true, region: "northamerica-northeast1", memory: "256MiB" },
  async (req, res) => {
    const feedUrl = req.query.url;

    if (!feedUrl) {
      res.status(400).json({ error: "Missing ?url= parameter" });
      return;
    }

    // Only allow RSS/news domains (security)
    const allowedDomains = [
      "chch.com",
      "cbc.ca",
      "cp24.com",
      "globalnews.ca",
      "thespec.com",
      "hamiltonspectator.com",
      "toronto.ctvnews.ca",
      "citynews.ca",
      "niagarathisweek.com",
      "insidehalton.com",
    ];

    try {
      const url = new URL(feedUrl);
      const domainAllowed = allowedDomains.some(d => url.hostname.endsWith(d));
      if (!domainAllowed) {
        res.status(403).json({ 
          error: "Domain not allowed", 
          domain: url.hostname,
          allowed: allowedDomains 
        });
        return;
      }

      const response = await fetch(feedUrl, {
        headers: { "User-Agent": "CondoNoticeBoard/2.0" },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        res.status(response.status).json({ 
          error: `Feed returned ${response.status}` 
        });
        return;
      }

      const xml = await response.text();

      // Cache for 10 minutes
      res.set("Cache-Control", "public, max-age=600");
      res.set("Content-Type", "application/xml; charset=utf-8");
      res.send(xml);
    } catch (err) {
      console.error("RSS proxy error:", err.message);
      res.status(500).json({ error: err.message });
    }
  }
);
