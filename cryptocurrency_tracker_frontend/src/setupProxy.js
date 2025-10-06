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

  // Health check endpoint for local diagnostics, returns 200/JSON while proxy is configured
  app.get('/jira/health', (req, res) => {
    const ok = Boolean(site && email && token);
    res.status(ok ? 200 : 500).json({
      ok,
      site: !!site,
      email: !!email,
      token: !!token,
      note: 'This is the local dev proxy health. It does not call Jira. Use /jira/rest/api/3/myself for real auth check.'
    });
  });

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
        // Always inject Basic auth header server-side, never rely on browser credentials.
        if (email && token) {
          const basic = Buffer.from(`${email}:${token}`).toString('base64');
          proxyReq.setHeader('Authorization', `Basic ${basic}`);
        }

        // Force JSON headers for Jira REST v3 to avoid XSRF/cookie content-type mismatches
        proxyReq.setHeader('Accept', 'application/json');
        // Respect original content-type if explicitly set by client, else default to JSON
        if (!proxyReq.getHeader('content-type')) {
          proxyReq.setHeader('Content-Type', 'application/json');
        }

        // Remove any cookie-based auth headers that could trigger XSRF checks
        proxyReq.removeHeader?.('Cookie');
        proxyReq.removeHeader?.('cookie');
        proxyReq.removeHeader?.('X-Atlassian-Token'); // ensure not sending incorrect tokens
      },
      onProxyRes: (proxyRes, req, res) => {
        // Improve diagnostics: forward status codes and add hint headers client can read
        const status = proxyRes.statusCode || 0;
        // Add non-sensitive hints for client-side diagnostics (not exposing secrets)
        res.setHeader('X-Jira-Proxy-Status', String(status));
        res.setHeader('X-Jira-Proxy-Target', new URL(target).host);
        // Strip set-cookie from Jira to avoid browser keeping cookies that might cause XSRF
        if (proxyRes.headers) {
          delete proxyRes.headers['set-cookie'];
          delete proxyRes.headers['Set-Cookie'];
        }
      },
      onError: (err, req, res) => {
        console.error('[setupProxy] Jira proxy error:', err?.message || err);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Proxy error contacting Jira.',
          suggestion: 'Verify .env REACT_APP_JIRA_* values and internet connectivity, then restart `npm start`.',
          detail: err?.message || 'Unknown error'
        }));
      },
    })
  );
};
