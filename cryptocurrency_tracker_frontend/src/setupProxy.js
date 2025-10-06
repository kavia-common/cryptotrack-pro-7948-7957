const { createProxyMiddleware } = require('http-proxy-middleware');
const https = require('https');

/**
 * Dev proxy for Jira Cloud APIs to avoid CORS and keep Authorization header out of browser requests.
 * This file is used by Create React App (react-scripts) when running `npm start`.
 *
 * Reads environment variables:
 *   REACT_APP_JIRA_SITE_DOMAIN
 *   REACT_APP_JIRA_EMAIL
 *   REACT_APP_JIRA_API_TOKEN
 *   REACT_APP_JIRA_PROXY_DEBUG (optional: 'true' to enable verbose logs)
 *
 * Proxies requests from /jira/* to https://{site}/* and injects Basic Auth.
 * IMPORTANT: This is for development only. Do not ship secrets in frontend for production.
 */
module.exports = function setupProxy(app) {
  const site = process.env.REACT_APP_JIRA_SITE_DOMAIN || '';
  const email = process.env.REACT_APP_JIRA_EMAIL || '';
  const token = process.env.REACT_APP_JIRA_API_TOKEN || '';
  const debug = String(process.env.REACT_APP_JIRA_PROXY_DEBUG || '').toLowerCase() === 'true';

  // Only attach proxy if site is configured
  if (!site) {
    console.warn('[setupProxy] REACT_APP_JIRA_SITE_DOMAIN is not set. Jira proxy will be disabled.');
    return;
  }

  // Always enforce HTTPS target and strip trailing slashes from site
  const normalizedSite = site.replace(/\/+$/, '');
  const target = normalizedSite.startsWith('http')
    ? normalizedSite.replace(/^http:\/\//i, 'https://')
    : `https://${normalizedSite}`;

  const targetHost = new URL(target).host;

  // Helper to build auth header once per request
  function authHeader() {
    if (!(email && token)) return null;
    const basic = Buffer.from(`${email}:${token}`).toString('base64');
    return `Basic ${basic}`;
  }

  // Real health endpoint: perform a server-side fetch to Jira /rest/api/3/myself
  app.get('/jira/health', async (req, res) => {
    const agent = new https.Agent({ keepAlive: true, rejectUnauthorized: true });
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const auth = authHeader();
    if (auth) headers.Authorization = auth;

    const url = `${target}/rest/api/3/myself`;

    try {
      if (debug) console.log('[setupProxy][health] GET', url, 'host:', targetHost);
      const response = await fetch(url, {
        method: 'GET',
        headers,
        redirect: 'follow',
        // Do not forward any cookies
        credentials: 'omit',
        agent,
      });
      const status = response.status;
      let bodyText = '';
      try {
        bodyText = await response.text();
      } catch {
        // ignore
      }
      // Try parse JSON when possible (mask sensitive fields as needed)
      let json;
      try {
        json = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        json = { text: bodyText?.slice(0, 500) || '' };
      }

      if (debug) {
        console.log('[setupProxy][health] status:', status, 'len:', bodyText?.length || 0);
      }

      // Echo minimal headers for diagnostics
      res.setHeader('X-Jira-Proxy-Target', targetHost);
      res.setHeader('X-Jira-Proxy-Status', String(status));

      if (status >= 200 && status < 300) {
        // Mask potentially sensitive fields
        const safe = {
          ok: true,
          accountId: json.accountId || undefined,
          displayName: json.displayName || undefined,
          emailAddress: json.emailAddress ? '[hidden]' : undefined,
          self: json.self || undefined,
        };
        res.status(200).json(safe);
      } else {
        const safeErr = {
          ok: false,
          status,
          error: (json && (json.errorMessages || json.errors)) ? json : (json?.message || json?.text || 'Request failed'),
        };
        res.status(status).json(safeErr);
      }
    } catch (e) {
      if (debug) console.error('[setupProxy][health] error:', e?.message || e);
      res.status(502).json({
        ok: false,
        status: 502,
        error: e?.message || 'Health check failed',
      });
    }
  });

  app.use(
    '/jira',
    createProxyMiddleware({
      target,
      changeOrigin: true, // present Host as Jira site host
      secure: true,       // verify SSL certs
      followRedirects: true, // follow 3xx
      logLevel: debug ? 'debug' : 'warn',
      pathRewrite: {
        '^/jira': '/', // strip /jira prefix; keep remaining path untouched
      },
      onProxyReq: (proxyReq, req, res) => {
        const start = Date.now();
        // Inject Basic Auth header server-side on every request
        const auth = authHeader();
        if (auth) {
          proxyReq.setHeader('Authorization', auth);
        }

        // Force JSON headers
        proxyReq.setHeader('Accept', 'application/json');
        if (!proxyReq.getHeader('content-type')) {
          proxyReq.setHeader('Content-Type', 'application/json');
        }

        // Strip cookies and XSRF-prone headers
        proxyReq.removeHeader?.('Cookie');
        proxyReq.removeHeader?.('cookie');
        proxyReq.removeHeader?.('Set-Cookie');
        proxyReq.removeHeader?.('X-Atlassian-Token');

        // Add a simple timing marker
        proxyReq.setHeader('X-Jira-Proxy-Start', String(start));

        if (debug) {
          const method = req.method;
          const url = req.originalUrl || req.url;
          console.log(`[setupProxy] -> ${method} ${url} (to ${targetHost})`);
        }
      },
      onProxyRes: (proxyRes, req, res) => {
        const status = proxyRes.statusCode || 0;

        // Pass minimal non-sensitive diagnostics headers
        res.setHeader('X-Jira-Proxy-Status', String(status));
        res.setHeader('X-Jira-Proxy-Target', targetHost);

        // Remove Set-Cookie from Jira response
        if (proxyRes.headers) {
          delete proxyRes.headers['set-cookie'];
          delete proxyRes.headers['Set-Cookie'];
        }

        if (debug || status === 401 || status === 403) {
          const method = req.method;
          const url = req.originalUrl || req.url;
          const www = proxyRes.headers?.['www-authenticate'];
          console.log(`[setupProxy] <- ${method} ${url} status=${status} ${www ? `www-authenticate=${www}` : ''}`);
        }
      },
      onError: (err, req, res) => {
        console.error('[setupProxy] Jira proxy error:', err?.message || err);
        try {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'Proxy error contacting Jira.',
              suggestion:
                'Verify .env REACT_APP_JIRA_* values and internet connectivity, then restart `npm start`.',
              detail: err?.message || 'Unknown error',
            })
          );
        } catch {
          // ignore
        }
      },
    })
  );
};
