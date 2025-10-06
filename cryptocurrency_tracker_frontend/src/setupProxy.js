const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * Dev proxy for Jira Cloud APIs to avoid CORS and keep Authorization header out of browser requests.
 * This file is used by Create React App (react-scripts) when running `npm start`.
 *
 * Reads environment variables:
 *   REACT_APP_JIRA_SITE_DOMAIN
 *   REACT_APP_JIRA_EMAIL
 *   REACT_APP_JIRA_API_TOKEN
 *
 * Proxies requests from /jira/* to https://{site}/* and injects Basic Auth.
 * IMPORTANT: This is for development only. Do not ship secrets in frontend for production.
 */
module.exports = function setupProxy(app) {
  const site = process.env.REACT_APP_JIRA_SITE_DOMAIN || '';
  const email = process.env.REACT_APP_JIRA_EMAIL || '';
  const token = process.env.REACT_APP_JIRA_API_TOKEN || '';

  // Only attach proxy if site is configured
  if (!site) {
    console.warn('[setupProxy] REACT_APP_JIRA_SITE_DOMAIN is not set. Jira proxy will be disabled.');
    return;
  }

  const target = site.startsWith('http') ? site : `https://${site}`;

  app.use(
    '/jira',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      secure: true,
      logLevel: 'warn',
      pathRewrite: {
        '^/jira': '/', // strip /jira prefix
      },
      onProxyReq: (proxyReq, req, res) => {
        // Inject Basic auth header if available, but never log secrets
        if (email && token) {
          const basic = Buffer.from(`${email}:${token}`).toString('base64');
          proxyReq.setHeader('Authorization', `Basic ${basic}`);
        }
        // Ensure JSON for Jira REST
        proxyReq.setHeader('Accept', 'application/json');
      },
      onError: (err, req, res) => {
        console.error('[setupProxy] Jira proxy error:', err?.message || err);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy error contacting Jira. Check your .env and internet connectivity.' }));
      },
    })
  );
};
